from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import current_user
from app.config import settings
from app.dispatch import coordinator_in_dispatch_top_k
from app.models import Assignment, Incident, IncidentStatus, IncidentStatusHistory, RescueTeam, Role, User

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


class AssignmentCreate(BaseModel):
    incident_id: int = Field(gt=0)
    team_id: int = Field(gt=0)


class AssignmentStatusUpdate(BaseModel):
    status: str
    reason: str | None = Field(default=None, max_length=2000)


class AssignmentRead(BaseModel):
    id: int
    incident_id: int
    team_id: int
    assigned_by: int
    assigned_at: datetime
    completed_at: datetime | None
    arrived_at: datetime | None
    outcome_notes: str | None
    status: str
    model_config = {"from_attributes": True}


class DispatchTeamRead(BaseModel):
    id: int
    team_name: str
    capacity: int
    availability: str
    coordinator_id: int | None
    location_label: str | None
    current_latitude: float | None
    current_longitude: float | None
    model_config = {"from_attributes": True}


class DispatchRecommendations(BaseModel):
    top_k: int
    teams: list[DispatchTeamRead]


@router.get("/recommended-teams", response_model=DispatchRecommendations)
def recommended_teams(incident_id: int, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    if actor.role not in {Role.ADMIN, Role.COORDINATOR}:
        raise HTTPException(status_code=403, detail="Insufficient role")
    incident = db.get(Incident, incident_id)
    if incident is None or incident.status != IncidentStatus.VERIFIED:
        raise HTTPException(status_code=404, detail="Verified incident not found")
    if actor.role == Role.COORDINATOR and not coordinator_in_dispatch_top_k(db, incident, actor.id):
        raise HTTPException(status_code=404, detail="This incident is outside your coordinator's nearest dispatch area")
    query = select(RescueTeam).where(RescueTeam.availability == "available")
    if actor.role == Role.COORDINATOR:
        query = query.where(RescueTeam.coordinator_id == actor.id)
    teams = [
        team for team in db.scalars(query)
        if incident.people_affected is None or team.capacity >= incident.people_affected
    ]
    return {"top_k": settings.dispatch_top_k, "teams": teams}


@router.post("", response_model=AssignmentRead, status_code=201)
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    if actor.role not in {Role.ADMIN, Role.COORDINATOR}:
        raise HTTPException(status_code=403, detail="Only admins and coordinators can assign teams")
    incident = db.scalar(select(Incident).where(Incident.id == payload.incident_id).with_for_update())
    team = db.scalar(select(RescueTeam).where(RescueTeam.id == payload.team_id).with_for_update())
    if incident is None or team is None:
        raise HTTPException(status_code=404, detail="Incident or rescue team not found")
    if incident.status != IncidentStatus.VERIFIED:
        raise HTTPException(status_code=409, detail="Only verified incidents can be assigned")
    if team.availability != "available":
        raise HTTPException(status_code=409, detail="Rescue team is not available")
    if actor.role == Role.COORDINATOR and team.coordinator_id != actor.id:
        raise HTTPException(status_code=403, detail="You can only assign teams coordinated by your account")
    if actor.role == Role.COORDINATOR and not coordinator_in_dispatch_top_k(db, incident, actor.id):
        raise HTTPException(status_code=403, detail="Your coordinator account is outside the nearest eligible coordinator group for this incident.")
    if incident.people_affected is not None and team.capacity < incident.people_affected:
        raise HTTPException(status_code=409, detail="Incident exceeds this team's response capacity")
    active = db.scalar(select(Assignment.id).where((Assignment.team_id == team.id) | (Assignment.incident_id == incident.id), Assignment.status.in_(["active", "active_in_progress"])))
    if active:
        raise HTTPException(status_code=409, detail="Team or incident already has an active assignment")
    assignment = Assignment(incident_id=incident.id, team_id=team.id, assigned_by=actor.id, status="active")
    db.add(assignment)
    incident.status = IncidentStatus.ASSIGNED
    db.add(IncidentStatusHistory(incident_id=incident.id, old_status=IncidentStatus.VERIFIED, new_status=IncidentStatus.ASSIGNED, changed_by=actor.id))
    team.availability = "busy"
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("", response_model=list[AssignmentRead])
def list_assignments(db: Session = Depends(get_db), actor: User = Depends(current_user)):
    query = select(Assignment).order_by(Assignment.assigned_at.desc())
    if actor.role == Role.COORDINATOR:
        query = query.join(RescueTeam, Assignment.team_id == RescueTeam.id).where(RescueTeam.coordinator_id == actor.id)
    elif actor.role == Role.CITIZEN:
        raise HTTPException(status_code=403, detail="Citizens cannot view rescue assignments")
    return list(db.scalars(query))


@router.patch("/{assignment_id}/status", response_model=AssignmentRead)
def update_assignment(assignment_id: int, payload: AssignmentStatusUpdate, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    if actor.role not in {Role.ADMIN, Role.COORDINATOR}:
        raise HTTPException(status_code=403, detail="Insufficient role")
    assignment = db.scalar(select(Assignment).where(Assignment.id == assignment_id).with_for_update())
    if assignment is None:
        raise HTTPException(status_code=404, detail="Assignment not found")
    team = db.get(RescueTeam, assignment.team_id)
    if actor.role == Role.COORDINATOR and team.coordinator_id != actor.id:
        raise HTTPException(status_code=403, detail="Assignment belongs to another coordinator")
    if assignment.status not in {"active", "active_in_progress"}:
        raise HTTPException(status_code=409, detail="Assignment is already closed")
    incident = db.scalar(select(Incident).where(Incident.id == assignment.incident_id).with_for_update())
    now = datetime.now(timezone.utc)
    if payload.status == "in_progress":
        if assignment.status != "active":
            raise HTTPException(status_code=409, detail="Assignment is already in progress")
        if incident.status != IncidentStatus.ASSIGNED:
            raise HTTPException(status_code=409, detail="Incident is not assigned")
        old_status = incident.status
        incident.status = IncidentStatus.IN_PROGRESS
        db.add(IncidentStatusHistory(incident_id=incident.id, old_status=old_status, new_status=incident.status, changed_by=actor.id))
        assignment.status = "active_in_progress"
    elif payload.status == "completed":
        if assignment.status != "active_in_progress" or incident.status != IncidentStatus.IN_PROGRESS:
            raise HTTPException(status_code=409, detail="Assignment must be in progress before completion")
        if not (payload.reason or "").strip():
            raise HTTPException(status_code=422, detail="Outcome notes are required before completing an assignment")
        assignment.status = "completed"
        assignment.completed_at = now
        assignment.outcome_notes = payload.reason.strip()
        old_status = incident.status
        incident.status = IncidentStatus.AWAITING_VERIFICATION
        db.add(IncidentStatusHistory(incident_id=incident.id, old_status=old_status, new_status=incident.status, changed_by=actor.id, reason=payload.reason.strip()))
        team.availability = "available"
    elif payload.status == "arrived":
        if assignment.status != "active_in_progress" or assignment.arrived_at is not None:
            raise HTTPException(status_code=409, detail="Assignment must be in progress and not already marked arrived")
        assignment.arrived_at = now
    else:
        raise HTTPException(status_code=422, detail="status must be in_progress or completed")
    db.commit()
    db.refresh(assignment)
    return assignment
