from fastapi import APIRouter
import services
import store
from schemas import RoomBookingCreate

router = APIRouter()

@router.post("/room-blocks/{block_id}/room-bookings", status_code=201)
def create_booking(block_id: int, payload: RoomBookingCreate):
    """
    Create a room booking for a room block.
    """
    with store.block_lock(block_id):
        block = store.get_room_block(block_id)
        return services.create_booking(block, payload)

@router.get("/room-blocks/{block_id}/room-bookings/{booking_id}")
def get_booking(block_id: int, booking_id: int):
    """
    Return a single room booking of a room block.
    """
    with store.block_lock(block_id):
        block = store.get_room_block(block_id)
        booking = store.get_booking(block, booking_id)
        return services.booking_to_dict(booking)

@router.delete("/room-blocks/{block_id}/room-bookings/{booking_id}/participants/{party}")
def drop_participant(block_id: int, booking_id: int, party: str):
    """
    A party drops out of a room booking.
    """
    with store.block_lock(block_id):
        block = store.get_room_block(block_id)
        booking = store.get_booking(block, booking_id)
        return services.drop_participant(block, booking, party)