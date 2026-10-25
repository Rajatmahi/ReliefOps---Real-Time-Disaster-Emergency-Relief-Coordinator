from typing import Optional
from fastapi import APIRouter
import services
import store

router = APIRouter()

@router.get("/room-blocks/{block_id}/balances")
def get_balances(block_id: int, base: Optional[str] = None):
    """
    Net balance and pairwise breakdown for every party.
    """
    with store.block_lock(block_id):
        block = store.get_room_block(block_id)
        return services.balances_report(block, base)

@router.get("/room-blocks/{block_id}/settle")
def get_settle(block_id: int, base: Optional[str] = None):
    """
    Minimum transfer plan for the room block (a preview while open, the remaining plan once closed).
    """
    with store.block_lock(block_id):
        block = store.get_room_block(block_id)
        return services.settle_report(block, base)