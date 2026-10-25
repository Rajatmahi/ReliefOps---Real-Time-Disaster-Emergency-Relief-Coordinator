"""Optional local demo data. Never run this for an organization workspace."""
from getpass import getpass

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import Incident, IncidentStatus, IncidentStatusHistory, Inventory, RescueTeam, Role, Severity, User
from app.security import hash_password


def read_password(label: str) -> str:
    while True:
        password = getpass(f"Set a password for {label} (at least 10 characters): ")
        if len(password) >= 10:
            return password
        print("Password must contain at least 10 characters.")


def main() -> None:
    if settings.environment.lower() != "development":
        raise SystemExit("Demo seeding is disabled outside ENVIRONMENT=development")
    accounts = [
        ("Demo Citizen", "citizen@example.com", Role.CITIZEN),
        ("Demo Administrator", "admin@example.com", Role.ADMIN),
        ("Demo Coordinator", "coordinator@example.com", Role.COORDINATOR),
    ]
    with SessionLocal.begin() as db:
        users = {}
        for name, email, role in accounts:
            user = db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(name=name, email=email, password_hash=hash_password(read_password(email)), role=role)
                db.add(user)
                db.flush()
            elif user.role != role:
                raise SystemExit(f"{email} already belongs to a different role; use a fresh demo database or a different seed account")
            users[role] = user

        if not db.scalar(select(RescueTeam.id).limit(1)):
            db.add_all([
                RescueTeam(team_name="Coastal Response Unit", capacity=60, availability="available", coordinator_id=users[Role.COORDINATOR].id, current_latitude=19.076, current_longitude=72.878),
                RescueTeam(team_name="Medical Support Team", capacity=25, availability="available", coordinator_id=users[Role.COORDINATOR].id, current_latitude=19.11, current_longitude=72.86),
            ])
        if not db.scalar(select(Inventory.id).limit(1)):
            db.add_all([
                Inventory(relief_center="North Relief Center", item_name="Water packets", quantity=420),
                Inventory(relief_center="North Relief Center", item_name="Food kits", quantity=165),
                Inventory(relief_center="Central Medical Camp", item_name="First aid kits", quantity=34),
                Inventory(relief_center="Central Medical Camp", item_name="Blankets", quantity=18),
            ])
        if not db.scalar(select(Incident.id).limit(1)):
            samples = [
                ("Flood", "Simulated river overflow near low-lying homes; residents moved to a safe assembly point.", 19.076, 72.878, Severity.CRITICAL, 48, IncidentStatus.REPORTED),
                ("Cyclone", "Simulated wind damage reported near the eastern market; access route needs inspection.", 19.105, 72.865, Severity.HIGH, 16, IncidentStatus.VERIFIED),
                ("Landslide", "Simulated hillside debris affecting a local road; no injuries reported.", 19.15, 72.91, Severity.MEDIUM, 4, IncidentStatus.REPORTED),
                ("Flood", "Simulated waterlogging near a community hall; relief supplies requested.", 19.048, 72.84, Severity.HIGH, 22, IncidentStatus.RESOLVED),
            ]
            for disaster, description, lat, lon, severity, people, incident_status in samples:
                incident = Incident(reporter_id=users[Role.CITIZEN].id, disaster_type=disaster, description=description, latitude=lat, longitude=lon, severity=severity, people_affected=people, status=incident_status)
                db.add(incident)
                db.flush()
                db.add(IncidentStatusHistory(incident_id=incident.id, old_status=None, new_status=IncidentStatus.REPORTED, changed_by=users[Role.CITIZEN].id))
                if incident_status != IncidentStatus.REPORTED:
                    db.add(IncidentStatusHistory(incident_id=incident.id, old_status=IncidentStatus.REPORTED, new_status=incident_status, changed_by=users[Role.ADMIN].id))
    print("Demo accounts and simulated records are ready. Credentials were entered securely and are not printed or stored in this project.")


if __name__ == "__main__":
    main()
