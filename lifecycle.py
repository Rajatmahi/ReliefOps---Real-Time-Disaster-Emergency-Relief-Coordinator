from typing import Optional
from fastapi import APIRouter
import services
import store
from schemas import TransferCreate

router = APIRouter()

@router.post("/room-blocks/{block_id}/close")
def close_block(block_id: int, base: Optional[str] = None):
    """
    Close an open room block: apply the attrition penalty, then fix its payment plan.
    """
    with store.block_lock(block_id):
        block = store.get_room_block(block_id)
        return services.close_block(block, base)

@router.post("/room-blocks/{block_id}/transfers", status_code=201)
def record_transfer(block_id: int, payload: TransferCreate):
    """
    Record a transfer against the fixed plan.
    """
    with store.block_lock(block_id):
        block = store.get_room_block(block_id)
        return services.record_transfer(block, payload)