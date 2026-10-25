from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import cast, exists, or_, select, String
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import current_user, require_roles
from app.dispatch import coordinator_in_dispatch_top_k, ranked_dispatch_coordinators
from app.models import Assignment, Incident, IncidentStatus, IncidentStatusHistory, RescueTeam, Role, Severity, User
from app.schemas import IncidentCreate, IncidentRead, IncidentStatusUpdate, StatusHistoryRead

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


class PriorityUpdate(BaseModel):
    severity: Severity
    reason: str = Field(min_length=8, max_length=2000)


def recommend_priority(incident):
    reasons = []
    people_affected = incident.people_affected
    if incident.people_trapped:
        reasons.append(f"{incident.people_trapped} person(s) reported trapped")
    if incident.urgent_medical:
        reasons.append("urgent medical assistance reported")
    if people_affected is not None and people_affected >= 25:
        reasons.append("large number of people affected (25+)")
    elif people_affected is not None and people_affected >= 5:
        reasons.append("multiple people affected (5+)")
    if "rescue" in (incident.immediate_needs or []):
        reasons.append("rescue support requested")
    if incident.people_trapped or incident.urgent_medical:
        return "critical", reasons
    if (people_affected is not None and people_affected >= 25) or "evacuation" in (incident.immediate_needs or []):
        return "high", reasons
    if (people_affected is not None and people_affected >= 5) or incident.immediate_needs:
        return "medium", reasons
    return "low", reasons


@router.post("", response_model=IncidentRead, status_code=status.HTTP_201_CREATED)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    incident = Incident(reporter_id=actor.id, **payload.model_dump())
    db.add(incident)
    db.flush()
    recommended, reasons = recommend_priority(incident)
    incident.suggested_severity = Severity(recommended)
    incident.priority_reasons = reasons or ["No elevated urgency indicators reported"]
    db.add(IncidentStatusHistory(incident_id=incident.id, old_status=None, new_status=IncidentStatus.REPORTED, changed_by=actor.id))
    db.commit()
    db.refresh(incident)
    return incident


@router.get("", response_model=list[IncidentRead])
def list_incidents(
    status_filter: IncidentStatus | None = Query(default=None, alias="status"),
    severity: str | None = None,
    disaster_type: str | None = None,
    q: str | None = Query(default=None, max_length=120),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    before_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
    actor: User = Depends(current_user),
):
    query = select(Incident)
    if before_id is not None:
        query = query.where(Incident.id < before_id).offset(0)
    if status_filter:
        query = query.where(Incident.status == status_filter)
    if severity:
        query = query.where(Incident.severity == severity)
    if disaster_type:
        query = query.where(Incident.disaster_type.ilike(f"%{disaster_type}%"))
    if q:
        term = f"%{q}%"
        query = query.where(or_(Incident.description.ilike(term), Incident.disaster_type.ilike(term), cast(Incident.latitude, String).ilike(term), cast(Incident.longitude, String).ilike(term)))
    if actor.role == Role.CITIZEN:
        query = query.where(Incident.reporter_id == actor.id)
    elif actor.role == Role.COORDINATOR:
        assigned_to_actor = exists(select(Assignment.id).join(RescueTeam, Assignment.team_id == RescueTeam.id).where(Assignment.incident_id == Incident.id, RescueTeam.coordinator_id == actor.id))
        visible_ids = []
        if status_filter in (None, IncidentStatus.VERIFIED):
            verified = db.scalars(select(Incident).where(Incident.status == IncidentStatus.VERIFIED)).all()
            available_teams = db.scalars(select(RescueTeam).where(RescueTeam.availability == "available")).all()
            visible_ids = [
                incident.id for incident in verified
                if any(coordinator_id == actor.id for coordinator_id, _, _ in ranked_dispatch_coordinators(incident, available_teams))
            ]
        query = query.where(or_(Incident.id.in_(visible_ids), assigned_to_actor))
    query = query.order_by(Incident.id.desc()).offset(skip).limit(limit)
    return list(db.scalars(query))


@router.get("/{incident_id}", response_model=IncidentRead)
def get_incident(incident_id: int, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if actor.role == Role.CITIZEN and incident.reporter_id != actor.id:
        raise HTTPException(status_code=404, detail="Incident not found")
    if actor.role == Role.COORDINATOR:
        assigned = db.scalar(select(Assignment.id).join(RescueTeam, Assignment.team_id == RescueTeam.id).where(Assignment.incident_id == incident_id, RescueTeam.coordinator_id == actor.id))
        in_dispatch_range = incident.status == IncidentStatus.VERIFIED and coordinator_in_dispatch_top_k(db, incident, actor.id)
        if assigned is None and not in_dispatch_range:
            raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.patch("/{incident_id}/status", response_model=IncidentRead)
def update_incident_status(incident_id: int, payload: IncidentStatusUpdate, db: Session = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))):
    incident = db.scalar(select(Incident).where(Incident.id == incident_id).with_for_update())
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    allowed = {
        IncidentStatus.REPORTED: {IncidentStatus.VERIFIED, IncidentStatus.INVALID},
        IncidentStatus.AWAITING_VERIFICATION: {IncidentStatus.RESOLVED},
        IncidentStatus.RESOLVED: {IncidentStatus.CLOSED},
    }
    if payload.status not in allowed[incident.status]:
        raise HTTPException(status_code=409, detail=f"Cannot change incident from {incident.status.value} to {payload.status.value}")
    old_status = incident.status
    if payload.status == IncidentStatus.INVALID and not (payload.reason or "").strip():
        raise HTTPException(status_code=422, detail="A reason is required to mark an incident invalid")
    if payload.status == IncidentStatus.RESOLVED and not (payload.reason or "").strip():
        raise HTTPException(status_code=422, detail="Resolution verification notes are required")
    if payload.status == IncidentStatus.CLOSED and not (payload.reason or "").strip():
        raise HTTPException(status_code=422, detail="A closure reason is required")
    incident.status = payload.status
    if payload.status == IncidentStatus.RESOLVED:
        incident.resolution_notes = payload.reason.strip()
    db.add(IncidentStatusHistory(incident_id=incident.id, old_status=old_status, new_status=payload.status, changed_by=actor.id, reason=payload.reason))
    db.commit()
    db.refresh(incident)
    return incident


@router.get("/{incident_id}/history", response_model=list[StatusHistoryRead])
def get_incident_history(incident_id: int, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    incident = db.get(Incident, incident_id)
    if incident is None or (actor.role == Role.CITIZEN and incident.reporter_id != actor.id):
        raise HTTPException(status_code=404, detail="Incident not found")
    if actor.role == Role.COORDINATOR:
        assigned = db.scalar(select(Assignment.id).join(RescueTeam, Assignment.team_id == RescueTeam.id).where(Assignment.incident_id == incident_id, RescueTeam.coordinator_id == actor.id))
        in_dispatch_range = incident.status == IncidentStatus.VERIFIED and coordinator_in_dispatch_top_k(db, incident, actor.id)
        if assigned is None and not in_dispatch_range:
            raise HTTPException(status_code=404, detail="Incident not found")
    return list(db.scalars(select(IncidentStatusHistory).where(IncidentStatusHistory.incident_id == incident_id).order_by(IncidentStatusHistory.changed_at, IncidentStatusHistory.id)))


@router.get("/{incident_id}/possible-duplicates", response_model=list[IncidentRead])
def possible_duplicates(incident_id: int, db: Session = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.COORDINATOR))):
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    # Approximate local distance filter (about 1.1 km); results are suggestions for human review only.
    if actor.role == Role.COORDINATOR and db.scalar(select(Assignment.id).join(RescueTeam, Assignment.team_id == RescueTeam.id).where(Assignment.incident_id == incident_id, RescueTeam.coordinator_id == actor.id)) is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    query = select(Incident).where(
        Incident.id != incident.id,
        Incident.disaster_type.ilike(incident.disaster_type),
        Incident.created_at >= incident.created_at - timedelta(hours=24),
        Incident.latitude.between(float(incident.latitude) - 0.01, float(incident.latitude) + 0.01),
        Incident.longitude.between(float(incident.longitude) - 0.01, float(incident.longitude) + 0.01),
    )
    if actor.role == Role.COORDINATOR:
        query = query.join(Assignment, Assignment.incident_id == Incident.id).join(RescueTeam, Assignment.team_id == RescueTeam.id).where(RescueTeam.coordinator_id == actor.id)
    matches = db.scalars(query.order_by(Incident.created_at.desc()).limit(20))
    return [item for item in matches if any(word in item.description.lower() for word in incident.description.lower().split() if len(word) >= 5)]


@router.post("/{incident_id}/priority", response_model=IncidentRead)
def override_priority(incident_id: int, payload: PriorityUpdate, db: Session = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))):
    incident = db.scalar(select(Incident).where(Incident.id == incident_id).with_for_update())
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.severity = payload.severity
    incident.priority_override_reason = payload.reason.strip()
    db.commit()
    db.refresh(incident)
    return incident
