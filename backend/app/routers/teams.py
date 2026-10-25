from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models import RescueTeam, Role, User

router = APIRouter(prefix="/api/teams", tags=["rescue teams"])


class TeamCreate(BaseModel):
    team_name: str = Field(min_length=2, max_length=120)
    capacity: int = Field(gt=0, le=10000)
    current_latitude: float | None = Field(default=None, ge=-90, le=90)
    current_longitude: float | None = Field(default=None, ge=-180, le=180)
    coordinator_id: int | None = None
    location_label: str | None = Field(default=None, max_length=255)


class TeamUpdate(BaseModel):
    team_name: str | None = Field(default=None, min_length=2, max_length=120)
    capacity: int | None = Field(default=None, gt=0, le=10000)
    availability: str | None = None
    current_latitude: float | None = Field(default=None, ge=-90, le=90)
    current_longitude: float | None = Field(default=None, ge=-180, le=180)
    coordinator_id: int | None = None
    location_label: str | None = Field(default=None, max_length=255)


class TeamRead(BaseModel):
    id: int
    team_name: str
    capacity: int
    availability: str
    coordinator_id: int | None
    location_label: str | None
    current_latitude: float | None
    current_longitude: float | None
    model_config = {"from_attributes": True}


@router.post("", response_model=TeamRead, status_code=201)
def create_team(payload: TeamCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))):
    if payload.coordinator_id is not None:
        coordinator = db.get(User, payload.coordinator_id)
        if coordinator is None or coordinator.role != Role.COORDINATOR:
            raise HTTPException(status_code=422, detail="coordinator_id must refer to a rescue coordinator")
    team = RescueTeam(**payload.model_dump())
    db.add(team)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A response team with this name already exists") from exc
    db.refresh(team)
    return team


@router.get("", response_model=list[TeamRead])
def list_teams(db: Session = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.COORDINATOR))):
    query = select(RescueTeam).order_by(RescueTeam.team_name)
    if actor.role == Role.COORDINATOR:
        query = query.where(RescueTeam.coordinator_id == actor.id)
    return list(db.scalars(query))


@router.get("/{team_id}", response_model=TeamRead)
def get_team(team_id: int, db: Session = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN, Role.COORDINATOR))):
    team = db.get(RescueTeam, team_id)
    if team is None or (actor.role == Role.COORDINATOR and team.coordinator_id != actor.id):
        raise HTTPException(status_code=404, detail="Rescue team not found")
    return team


@router.patch("/{team_id}", response_model=TeamRead)
def update_team(team_id: int, payload: TeamUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))):
    team = db.scalar(select(RescueTeam).where(RescueTeam.id == team_id).with_for_update())
    if team is None:
        raise HTTPException(status_code=404, detail="Rescue team not found")
    changes = payload.model_dump(exclude_unset=True)
    if "availability" in changes and changes["availability"] not in {"available", "busy", "offline"}:
        raise HTTPException(status_code=422, detail="availability must be available, busy, or offline")
    if "coordinator_id" in changes and changes["coordinator_id"] is not None:
        coordinator = db.get(User, changes["coordinator_id"])
        if coordinator is None or coordinator.role != Role.COORDINATOR:
            raise HTTPException(status_code=422, detail="coordinator_id must refer to a rescue coordinator")
    if changes.get("availability") == "available":
        from app.models import Assignment
        active = db.scalar(select(Assignment.id).where(Assignment.team_id == team_id, Assignment.status.in_(["active", "active_in_progress"])))
        if active:
            raise HTTPException(status_code=409, detail="A team with an active assignment cannot be marked available")
    if "capacity" in changes:
        from app.models import Assignment, Incident
        oversized_active = db.scalar(
            select(Assignment.id)
            .join(Incident, Incident.id == Assignment.incident_id)
            .where(Assignment.team_id == team_id, Assignment.status.in_(["active", "active_in_progress"]), Incident.people_affected > changes["capacity"])
        )
        if oversized_active:
            raise HTTPException(status_code=409, detail="Capacity cannot be reduced below the needs of this team's active incident")
    for key, value in changes.items():
        setattr(team, key, value)
    db.commit()
    db.refresh(team)
    return team
