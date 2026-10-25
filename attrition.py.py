"""Attrition-penalty calculation for a room block's negotiated commitment."""

def compute_attrition_penalty(committed_room_nights: int, threshold_bps: int,
                              filled_room_nights: int, penalty_rate_cents: int) -> int:
    """
    `threshold_bps` is the negotiated fill threshold in hundredths of a percent
    (5000 = 50%). The number of room-nights the group was required to fill is
    `committed_room_nights * threshold_bps / 10000`, rounded half up to the nearest
    whole room-night.

    The shortfall is max(0, required_room_nights - filled_room_nights). Returns the
    shortfall multiplied by `penalty_rate_cents` (0 if there is no shortfall).
    """
    # Adding 5000 before dividing by 10000 simulates an exact round half up
    required_room_nights = (committed_room_nights * threshold_bps + 5000) // 10000
    shortfall = max(0, required_room_nights - filled_room_nights)
    
    return shortfall * penalty_rate_cents