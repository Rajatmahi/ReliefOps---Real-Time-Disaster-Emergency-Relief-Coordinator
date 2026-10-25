"""Splitting helper. Money is handled as integer cents everywhere inside the application."""
from typing import List

def split_largest_remainder(total_cents: int, weights: List[int]) -> List[int]:
    """
    Split `total_cents` across `weights` (positive integers).

    Returns one amount per weight, in the same order, summing exactly to `total_cents`.
    Each amount is the exact proportional share rounded down to the cent. The leftover
    cents go one each to the largest discarded fractions. If fractions tie, the earlier
    index wins.
    """
    total_weight = sum(weights)
    if total_weight == 0:
        return [0] * len(weights)

    shares = []
    remainders = []
    allocated = 0

    for i, w in enumerate(weights):
        exact_share = (total_cents * w) // total_weight
        rem = (total_cents * w) % total_weight
        shares.append(exact_share)
        allocated += exact_share
        remainders.append((rem, i))

    leftover = total_cents - allocated

    # Sort remainders: primarily by remainder descending (-rem), secondarily by index ascending (i)
    remainders.sort(key=lambda x: (-x[0], x[1]))

    for i in range(leftover):
        idx = remainders[i][1]
        shares[idx] += 1

    return shares