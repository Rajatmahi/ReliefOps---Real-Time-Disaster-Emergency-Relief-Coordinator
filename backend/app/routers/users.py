from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models import Role, User
from app.routers.auth import UserRead
from app.security import hash_password

router = APIRouter(prefix="/api/users", tags=["team access"])


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: Role


class UserUpdate(BaseModel):
    role: Role | None = None
    password: str | None = Field(default=None, min_length=12, max_length=128)


@router.get("", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))):
    return list(db.scalars(select(User).order_by(User.name, User.email)))


@router.post("", response_model=UserRead, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))):
    email = payload.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(name=payload.name.strip(), email=email, password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))):
    # Serialize administrator role changes so two concurrent requests cannot remove every admin.
    if payload.role is not None:
        db.scalars(select(User.id).where(User.role == Role.ADMIN).order_by(User.id).with_for_update()).all()
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    if user is None:
        raise HTTPException(status_code=404, detail="Team account not found")
    changes = payload.model_dump(exclude_unset=True)
    if user.id == actor.id and changes.get("role", user.role) != Role.ADMIN:
        raise HTTPException(status_code=409, detail="You cannot remove your own administrator access")
    if changes.get("role") is not None and user.role == Role.ADMIN and changes["role"] != Role.ADMIN:
        other_admin = db.scalar(select(User.id).where(User.role == Role.ADMIN, User.id != user.id).limit(1))
        if other_admin is None:
            raise HTTPException(status_code=409, detail="At least one administrator account must remain")
    if "role" in changes and changes["role"] is not None:
        user.role = changes["role"]
    if changes.get("password"):
        user.password_hash = hash_password(changes["password"])
    db.commit()
    db.refresh(user)
    return user
