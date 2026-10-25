"""Distinct-coordinator dispatch routing for verified incidents."""

from math import atan2, cos, radians, sin, sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Incident, RescueTeam


def distance_km(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    """Great-circle distance using the Haversine formula."""
    lat_a, lat_b = radians(float(latitude_a)), radians(float(latitude_b))
    delta_lat = lat_b - lat_a
    delta_lon = radians(float(longitude_b) - float(longitude_a))
    arc = sin(delta_lat / 2) ** 2 + cos(lat_a) * cos(lat_b) * sin(delta_lon / 2) ** 2
    arc = min(1.0, max(0.0, arc))
    return 6371.0088 * 2 * atan2(sqrt(arc), sqrt(1 - arc))


def ranked_dispatch_coordinators(
    incident: Incident,
    teams: list[RescueTeam],
) -> list[tuple[int, RescueTeam, float]]:
    """Rank each coordinator once, using their nearest eligible team as their score."""
    nearest_by_coordinator: dict[int, tuple[RescueTeam, float]] = {}
    for team in teams:
        if team.availability != "available" or team.coordinator_id is None:
            continue
        if team.current_latitude is None or team.current_longitude is None:
            continue
        if incident.people_affected is not None and team.capacity < incident.people_affected:
            continue
        distance = distance_km(incident.latitude, incident.longitude, team.current_latitude, team.current_longitude)
        current = nearest_by_coordinator.get(team.coordinator_id)
        team_key = (
            distance,
            team.capacity - incident.people_affected if incident.people_affected is not None else team.capacity,
            team.team_name.casefold(),
            team.id,
        )
        if current is None:
            nearest_by_coordinator[team.coordinator_id] = (team, distance)
        else:
            current_team, current_distance = current
            current_key = (
                current_distance,
                current_team.capacity - incident.people_affected if incident.people_affected is not None else current_team.capacity,
                current_team.team_name.casefold(),
                current_team.id,
            )
            if team_key < current_key:
                nearest_by_coordinator[team.coordinator_id] = (team, distance)

    ranked = [
        (coordinator_id, team, distance)
        for coordinator_id, (team, distance) in nearest_by_coordinator.items()
    ]
    ranked.sort(key=lambda item: (item[2], item[1].team_name.casefold(), item[0]))
    return ranked[: settings.dispatch_top_k]


def top_k_coordinators_for_incident(db: Session, incident: Incident) -> list[tuple[int, RescueTeam, float]]:
    teams = list(db.scalars(select(RescueTeam).where(RescueTeam.availability == "available")))
    return ranked_dispatch_coordinators(incident, teams)


def coordinator_in_dispatch_top_k(db: Session, incident: Incident, coordinator_id: int) -> bool:
    return any(candidate_id == coordinator_id for candidate_id, _, _ in top_k_coordinators_for_incident(db, incident))
