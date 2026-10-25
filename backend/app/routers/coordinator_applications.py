from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import current_user, require_roles
from app.models import CoordinatorApplication, Role, User

router = APIRouter(prefix="/api/coordinator-applications", tags=["coordinator applications"])


class ApplicationCreate(BaseModel):
    motivation: str = Field(min_length=30, max_length=3000)
    experience: str | None = Field(default=None, max_length=3000)

    @field_validator("motivation")
    @classmethod
    def require_meaningful_motivation(cls, value):
        value = value.strip()
        if len(value) < 30:
            raise ValueError("Please provide at least 30 non-space characters")
        return value


class ApplicationReview(BaseModel):
    decision: str
    reason: str | None = Field(default=None, max_length=2000)


class ApplicationRead(BaseModel):
    id: int
    applicant_id: int
    motivation: str
    experience: str | None
    status: str
    submitted_at: datetime
    reviewed_by: int | None
    reviewed_at: datetime | None
    review_reason: str | None
    applicant_name: str
    applicant_email: str
    model_config = ConfigDict(from_attributes=True)


def serialize(application: CoordinatorApplication, applicant: User) -> dict:
    return {
        "id": application.id,
        "applicant_id": application.applicant_id,
        "motivation": application.motivation,
        "experience": application.experience,
        "status": application.status,
        "submitted_at": application.submitted_at,
        "reviewed_by": application.reviewed_by,
        "reviewed_at": application.reviewed_at,
        "review_reason": application.review_reason,
        "applicant_name": applicant.name,
        "applicant_email": applicant.email,
    }


@router.post("", response_model=ApplicationRead, status_code=201)
def submit_application(payload: ApplicationCreate, db: Session = Depends(get_db), applicant: User = Depends(current_user)):
    locked_user = db.scalar(select(User).where(User.id == applicant.id).with_for_update())
    if locked_user.role != Role.CITIZEN:
        raise HTTPException(status_code=409, detail="Only reporter accounts can apply to become coordinators")
    pending = db.scalar(select(CoordinatorApplication.id).where(CoordinatorApplication.applicant_id == applicant.id, CoordinatorApplication.status == "pending"))
    if pending:
        raise HTTPException(status_code=409, detail="You already have a coordinator application awaiting review")
    application = CoordinatorApplication(
        applicant_id=applicant.id,
        motivation=payload.motivation.strip(),
        experience=payload.experience.strip() if payload.experience and payload.experience.strip() else None,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return serialize(application, locked_user)


@router.get("/mine", response_model=list[ApplicationRead])
def list_my_applications(db: Session = Depends(get_db), applicant: User = Depends(current_user)):
    rows = db.execute(
        select(CoordinatorApplication, User)
        .join(User, User.id == CoordinatorApplication.applicant_id)
        .where(CoordinatorApplication.applicant_id == applicant.id)
        .order_by(CoordinatorApplication.submitted_at.desc())
    ).all()
    return [serialize(application, user) for application, user in rows]


@router.get("", response_model=list[ApplicationRead])
def list_applications(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))):
    rows = db.execute(
        select(CoordinatorApplication, User)
        .join(User, User.id == CoordinatorApplication.applicant_id)
        .order_by(CoordinatorApplication.submitted_at.desc())
    ).all()
    return [serialize(application, user) for application, user in rows]


@router.patch("/{application_id}/review", response_model=ApplicationRead)
def review_application(application_id: int, payload: ApplicationReview, db: Session = Depends(get_db), admin: User = Depends(require_roles(Role.ADMIN))):
    if payload.decision not in {"approve", "reject"}:
        raise HTTPException(status_code=422, detail="decision must be approve or reject")
    if payload.decision == "reject" and not (payload.reason or "").strip():
        raise HTTPException(status_code=422, detail="A reason is required when rejecting an application")
    application = db.scalar(select(CoordinatorApplication).where(CoordinatorApplication.id == application_id).with_for_update())
    if application is None:
        raise HTTPException(status_code=404, detail="Coordinator application not found")
    if application.status != "pending":
        raise HTTPException(status_code=409, detail="This application has already been reviewed")
    applicant = db.scalar(select(User).where(User.id == application.applicant_id).with_for_update())
    if applicant is None or applicant.role != Role.CITIZEN:
        raise HTTPException(status_code=409, detail="Applicant is no longer eligible for coordinator approval")
    application.status = "approved" if payload.decision == "approve" else "rejected"
    application.reviewed_by = admin.id
    application.reviewed_at = datetime.now(timezone.utc)
    application.review_reason = (payload.reason or "").strip() or None
    if payload.decision == "approve":
        applicant.role = Role.COORDINATOR
    db.commit()
    db.refresh(application)
    db.refresh(applicant)
    return serialize(application, applicant)
