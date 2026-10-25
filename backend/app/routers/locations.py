"""On-demand place-name lookup through the public OSM Nominatim service."""

import json
import time
from threading import Lock
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.dependencies.auth import current_user
from app.models import User

router = APIRouter(prefix="/api/locations", tags=["location search"])
_search_lock = Lock()
_last_search_at = 0.0
_cache: dict[str, tuple[float, list[dict]]] = {}
_reverse_cache: dict[str, tuple[float, str]] = {}
_CACHE_SECONDS = 600


@router.get("/search")
def search_places(query: str = Query(min_length=2, max_length=120), _: User = Depends(current_user)):
    """Search only when requested by the user; do not submit incident details."""
    global _last_search_at
    clean_query = query.strip()
    if len(clean_query) < 2:
        raise HTTPException(status_code=422, detail="Enter a place name to search")
    cache_key = clean_query.casefold()
    now = time.monotonic()
    with _search_lock:
        cached = _cache.get(cache_key)
        if cached and now - cached[0] < _CACHE_SECONDS:
            return cached[1]
        if now - _last_search_at < 1.0:
            raise HTTPException(status_code=429, detail="Please wait a moment before searching again")
        _last_search_at = now

    params = urlencode({"q": clean_query, "format": "jsonv2", "limit": 5, "addressdetails": 0})
    request = Request(
        f"{settings.geocoding_search_url}?{params}",
        headers={
            "User-Agent": "ReliefOps/0.2 (organization emergency coordination workspace)",
            "Accept": "application/json",
            "Accept-Language": "en",
            "Referer": "http://localhost:5173/",
        },
    )
    try:
        with urlopen(request, timeout=8) as response:
            raw_results = json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Place search is temporarily unavailable. You can still place the pin directly on the map.") from exc

    results = []
    for item in raw_results:
        try:
            results.append({
                "display_name": str(item["display_name"])[:255],
                "latitude": float(item["lat"]),
                "longitude": float(item["lon"]),
            })
        except (KeyError, TypeError, ValueError):
            continue
    with _search_lock:
        if len(_cache) >= 256:
            _cache.clear()
        _cache[cache_key] = (time.monotonic(), results)
    return results


@router.get("/reverse")
def reverse_geocode(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    _: User = Depends(current_user),
):
    """Turn a user-requested GPS point into a readable place label."""
    global _last_search_at
    cache_key = f"{latitude:.5f},{longitude:.5f}"
    now = time.monotonic()
    with _search_lock:
        cached = _reverse_cache.get(cache_key)
        if cached and now - cached[0] < _CACHE_SECONDS:
            return {"display_name": cached[1]}
        wait = 1.0 - (now - _last_search_at)
        if wait > 0:
            time.sleep(wait)
        _last_search_at = time.monotonic()

    params = urlencode({
        "lat": latitude,
        "lon": longitude,
        "format": "jsonv2",
        "zoom": 18,
        "addressdetails": 1,
    })
    request = Request(
        f"{settings.geocoding_reverse_url}?{params}",
        headers={
            "User-Agent": "ReliefOps/0.2 (organization emergency coordination workspace)",
            "Accept": "application/json",
            "Accept-Language": "en",
            "Referer": "http://localhost:5173/",
        },
    )
    try:
        with urlopen(request, timeout=8) as response:
            item = json.loads(response.read().decode("utf-8"))
        display_name = str(item.get("display_name", "")).strip()[:255]
        if not display_name:
            raise ValueError("No address returned")
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Could not find a place name for this location") from exc

    with _search_lock:
        if len(_reverse_cache) >= 256:
            _reverse_cache.clear()
        _reverse_cache[cache_key] = (time.monotonic(), display_name)
    return {"display_name": display_name}
