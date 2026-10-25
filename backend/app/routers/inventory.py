from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_roles
from app.models import Inventory, InventoryTransaction, Role, User

router = APIRouter(prefix="/api/inventory", tags=["relief inventory"])


class InventoryCreate(BaseModel):
    relief_center: str = Field(min_length=2, max_length=120)
    item_name: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=0, le=100000000)


class InventoryUpdate(BaseModel):
    relief_center: str | None = Field(default=None, min_length=2, max_length=120)
    item_name: str | None = Field(default=None, min_length=1, max_length=120)
    quantity: int | None = Field(default=None, ge=0, le=100000000)


class TransactionCreate(BaseModel):
    transaction_type: str
    quantity: int = Field(gt=0, le=100000000)
    notes: str | None = Field(default=None, max_length=1000)


class InventoryRead(BaseModel):
    id: int
    relief_center: str
    item_name: str
    quantity: int
    last_updated: datetime
    model_config = {"from_attributes": True}


@router.get("", response_model=list[InventoryRead])
def list_inventory(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN, Role.COORDINATOR))):
    return list(db.scalars(select(Inventory).order_by(Inventory.relief_center, Inventory.item_name)))


@router.post("", response_model=InventoryRead, status_code=201)
def create_inventory(payload: InventoryCreate, db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))):
    item = Inventory(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That item is already tracked at this relief center") from exc
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=InventoryRead)
def update_inventory(item_id: int, payload: InventoryUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles(Role.ADMIN))):
    item = db.scalar(select(Inventory).where(Inventory.id == item_id).with_for_update())
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    changes = payload.model_dump(exclude_unset=True)
    if "quantity" in changes:
        raise HTTPException(status_code=422, detail="Use the transaction endpoint to change stock quantities")
    for key, value in changes.items():
        setattr(item, key, value)
    item.last_updated = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That item is already tracked at this relief center") from exc
    db.refresh(item)
    return item


@router.post("/{item_id}/transactions", response_model=InventoryRead)
def record_transaction(item_id: int, payload: TransactionCreate, db: Session = Depends(get_db), actor: User = Depends(require_roles(Role.ADMIN))):
    if payload.transaction_type not in {"received", "distributed"}:
        raise HTTPException(status_code=422, detail="transaction_type must be received or distributed")
    item = db.scalar(select(Inventory).where(Inventory.id == item_id).with_for_update())
    if item is None:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    if payload.transaction_type == "distributed" and payload.quantity > item.quantity:
        raise HTTPException(status_code=409, detail="Distribution exceeds available stock")
    item.quantity += payload.quantity if payload.transaction_type == "received" else -payload.quantity
    item.last_updated = datetime.now(timezone.utc)
    db.add(InventoryTransaction(inventory_id=item.id, transaction_type=payload.transaction_type, quantity=payload.quantity, recorded_by=actor.id, notes=payload.notes))
    db.commit()
    db.refresh(item)
    return item
