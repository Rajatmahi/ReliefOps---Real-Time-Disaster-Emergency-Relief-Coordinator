"""Seed database with realistic initial disaster relief data (Users, Teams, Incidents, Inventory).

Usage:
    python -m app.seed_database
    python -m app.seed_database --db-url "postgresql+psycopg://user:pass@host/dbname"
"""

import argparse
import sys
from datetime import datetime, timezone

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import (
    Assignment,
    CoordinatorApplication,
    Incident,
    IncidentStatus,
    IncidentStatusHistory,
    Inventory,
    InventoryTransaction,
    RescueTeam,
    Role,
    Severity,
    User,
)
from app.security import hash_password


def utcnow():
    return datetime.now(timezone.utc)


def seed(db_url: str = None) -> None:
    target_url = db_url or settings.database_url
    if target_url.startswith("postgres://"):
        target_url = "postgresql+psycopg://" + target_url[len("postgres://"):]
    elif target_url.startswith("postgresql://") and not target_url.startswith("postgresql+"):
        target_url = "postgresql+psycopg://" + target_url[len("postgresql://"):]

    print(f"Connecting to database...")
    engine = create_engine(target_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    with Session() as db:
        print("1. Seeding Users...")
        users_data = [
            ("Administrator", "admin@example.com", "AdminPassword123!", Role.ADMIN),
            ("Sarah Connor", "coordinator@example.com", "CoordinatorPassword123!", Role.COORDINATOR),
            ("David Miller", "field_lead@example.com", "CoordinatorPassword123!", Role.COORDINATOR),
            ("Alex Morgan", "citizen@example.com", "CitizenPassword123!", Role.CITIZEN),
            ("Priya Sharma", "priya.sharma@example.com", "CitizenPassword123!", Role.CITIZEN),
        ]
        users = {}
        for name, email, password, role in users_data:
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                user = User(
                    name=name,
                    email=email,
                    password_hash=hash_password(password),
                    role=role,
                )
                db.add(user)
                db.flush()
                print(f"   Created user: {email} ({role})")
            else:
                user.role = role
                print(f"   Existing user verified: {email} ({role})")
            users[email] = user

        print("2. Seeding Coordinator Applications...")
        app_user = users["priya.sharma@example.com"]
        existing_app = db.scalar(select(CoordinatorApplication).where(CoordinatorApplication.applicant_id == app_user.id))
        if not existing_app:
            db.add(
                CoordinatorApplication(
                    applicant_id=app_user.id,
                    motivation="Certified EMT with 4 years search and rescue experience in municipal flooding.",
                    experience="Senior field paramedic, certified emergency rescue diver.",
                    status="pending",
                )
            )
            print("   Created pending coordinator application for Priya Sharma")

        print("3. Seeding Rescue Teams...")
        teams_data = [
            ("Coastal Response Unit", 60, "busy", users["coordinator@example.com"].id, "Mumbai Harbor Base", 19.076, 72.878),
            ("Medical Support Team Alpha", 25, "busy", users["coordinator@example.com"].id, "North Suburban Clinic Base", 19.110, 72.860),
            ("Urban Search & Rescue Squad", 40, "available", users["field_lead@example.com"].id, "Central Logistics Center", 19.150, 72.910),
            ("Rapid Evacuation Unit", 80, "available", users["field_lead@example.com"].id, "South Coast Depot", 19.048, 72.840),
        ]
        teams = {}
        for name, cap, avail, coord_id, loc_label, lat, lon in teams_data:
            team = db.scalar(select(RescueTeam).where(RescueTeam.team_name == name))
            if not team:
                team = RescueTeam(
                    team_name=name,
                    capacity=cap,
                    availability=avail,
                    coordinator_id=coord_id,
                    location_label=loc_label,
                    current_latitude=lat,
                    current_longitude=lon,
                )
                db.add(team)
                db.flush()
                print(f"   Created rescue team: {name}")
            teams[name] = team

        print("4. Seeding Relief Inventory...")
        inventory_items = [
            ("North Relief Center", "Water Packets (10L)", 520),
            ("North Relief Center", "Ready-to-Eat Food Kits", 240),
            ("North Relief Center", "Heavy Blankets", 160),
            ("Central Medical Camp", "First Aid Trauma Kits", 95),
            ("Central Medical Camp", "Emergency Medicines Pack", 140),
            ("Central Medical Camp", "Sterile Bandages", 210),
            ("South Coast Depot", "Emergency Tents & Tarps", 75),
            ("South Coast Depot", "Water Purification Tablets", 600),
            ("South Coast Depot", "High-Calorie Energy Rations", 320),
        ]
        for center, item_name, qty in inventory_items:
            inv = db.scalar(
                select(Inventory).where(
                    Inventory.relief_center == center,
                    Inventory.item_name == item_name,
                )
            )
            if not inv:
                inv = Inventory(relief_center=center, item_name=item_name, quantity=qty)
                db.add(inv)
                db.flush()
                # Record transaction
                db.add(
                    InventoryTransaction(
                        inventory_id=inv.id,
                        transaction_type="received",
                        quantity=qty,
                        recorded_by=users["admin@example.com"].id,
                        notes="Initial warehouse inventory baseline.",
                    )
                )
                print(f"   Created inventory: {center} - {item_name} ({qty})")

        print("5. Seeding Realistic Incidents...")
        incidents_data = [
            {
                "reporter": users["citizen@example.com"].id,
                "disaster_type": "Flood",
                "description": "Flash flooding overflowing near residential lowlands; water rising rapidly around sector 4 homes.",
                "location_label": "Sector 4 Lowlands",
                "lat": 19.076,
                "lon": 72.878,
                "severity": Severity.CRITICAL,
                "people_affected": 60,
                "people_trapped": 14,
                "urgent_medical": True,
                "immediate_needs": ["Boats", "Emergency Evacuation", "Clean Water"],
                "status": IncidentStatus.IN_PROGRESS,
            },
            {
                "reporter": users["citizen@example.com"].id,
                "disaster_type": "Cyclone",
                "description": "Severe storm damage and fallen transmission lines blocking central market access; roof collapsed on shop.",
                "location_label": "Eastern Market Area",
                "lat": 19.105,
                "lon": 72.865,
                "severity": Severity.HIGH,
                "people_affected": 24,
                "people_trapped": 2,
                "urgent_medical": True,
                "immediate_needs": ["First Aid", "Debris Clearance"],
                "status": IncidentStatus.ASSIGNED,
            },
            {
                "reporter": users["priya.sharma@example.com"].id,
                "disaster_type": "Landslide",
                "description": "Hillside mudslide blocking northern transit bypass. Two vehicles disabled, passengers evacuated to shelter.",
                "location_label": "Northern Bypass Road",
                "lat": 19.150,
                "lon": 72.910,
                "severity": Severity.MEDIUM,
                "people_affected": 10,
                "people_trapped": 0,
                "urgent_medical": False,
                "immediate_needs": ["Heavy Equipment", "Road Clearing"],
                "status": IncidentStatus.VERIFIED,
            },
            {
                "reporter": users["citizen@example.com"].id,
                "disaster_type": "Earthquake",
                "description": "Structural tremor damage to residential apartment block; minor wall cracks, residents gathered on open ground.",
                "location_label": "Greenview Colony Ground",
                "lat": 19.020,
                "lon": 72.830,
                "severity": Severity.HIGH,
                "people_affected": 45,
                "people_trapped": 0,
                "urgent_medical": False,
                "immediate_needs": ["Temporary Shelter", "Blankets", "Water"],
                "status": IncidentStatus.REPORTED,
            },
            {
                "reporter": users["priya.sharma@example.com"].id,
                "disaster_type": "Flood",
                "description": "Waterlogging near community health center; water pumped out and safety check completed.",
                "location_label": "Community Center Complex",
                "lat": 19.048,
                "lon": 72.840,
                "severity": Severity.MEDIUM,
                "people_affected": 30,
                "people_trapped": 0,
                "urgent_medical": False,
                "immediate_needs": ["Sanitation", "Relief Food"],
                "status": IncidentStatus.RESOLVED,
                "resolution_notes": "Water cleared by municipal pumps. 30 relief kits delivered. Area safe.",
            },
        ]

        created_incidents = []
        for inc_info in incidents_data:
            existing = db.scalar(
                select(Incident).where(
                    Incident.disaster_type == inc_info["disaster_type"],
                    Incident.location_label == inc_info["location_label"],
                )
            )
            if not existing:
                inc = Incident(
                    reporter_id=inc_info["reporter"],
                    disaster_type=inc_info["disaster_type"],
                    description=inc_info["description"],
                    location_label=inc_info["location_label"],
                    latitude=inc_info["lat"],
                    longitude=inc_info["lon"],
                    severity=inc_info["severity"],
                    people_affected=inc_info["people_affected"],
                    people_trapped=inc_info["people_trapped"],
                    urgent_medical=inc_info["urgent_medical"],
                    immediate_needs=inc_info["immediate_needs"],
                    suggested_severity=inc_info["severity"],
                    status=inc_info["status"],
                    resolution_notes=inc_info.get("resolution_notes"),
                )
                db.add(inc)
                db.flush()
                # Add status history
                db.add(
                    IncidentStatusHistory(
                        incident_id=inc.id,
                        old_status=None,
                        new_status=IncidentStatus.REPORTED,
                        changed_by=inc_info["reporter"],
                        reason="Initial disaster report submitted.",
                    )
                )
                if inc_info["status"] != IncidentStatus.REPORTED:
                    db.add(
                        IncidentStatusHistory(
                            incident_id=inc.id,
                            old_status=IncidentStatus.REPORTED,
                            new_status=inc_info["status"],
                            changed_by=users["admin@example.com"].id,
                            reason="Operational status updated by Administrator.",
                        )
                    )
                created_incidents.append(inc)
                print(f"   Created incident: {inc.disaster_type} at {inc.location_label} ({inc.status})")
            else:
                created_incidents.append(existing)

        print("6. Seeding Active Assignments...")
        # Assign Coastal Response Unit to Incident 1
        inc1 = created_incidents[0]
        team1 = teams.get("Coastal Response Unit")
        if inc1 and team1:
            existing_assn = db.scalar(select(Assignment).where(Assignment.incident_id == inc1.id))
            if not existing_assn:
                db.add(
                    Assignment(
                        incident_id=inc1.id,
                        team_id=team1.id,
                        assigned_by=users["coordinator@example.com"].id,
                        assigned_at=utcnow(),
                        arrived_at=utcnow(),
                        status="active_in_progress",
                    )
                )
                print("   Assigned Coastal Response Unit to Flood in Sector 4 (In Progress)")

        # Assign Medical Support Team Alpha to Incident 2
        inc2 = created_incidents[1]
        team2 = teams.get("Medical Support Team Alpha")
        if inc2 and team2:
            existing_assn = db.scalar(select(Assignment).where(Assignment.incident_id == inc2.id))
            if not existing_assn:
                db.add(
                    Assignment(
                        incident_id=inc2.id,
                        team_id=team2.id,
                        assigned_by=users["coordinator@example.com"].id,
                        assigned_at=utcnow(),
                        status="active",
                    )
                )
                print("   Assigned Medical Support Team Alpha to Eastern Market Cyclone (En Route)")

        db.commit()
        print("\nAll starter data seeded successfully!")


def main():
    parser = argparse.ArgumentParser(description="Seed database with relief operations data.")
    parser.add_argument("--db-url", type=str, default=None, help="Custom database connection URL")
    args = parser.parse_args()
    seed(args.db_url)


if __name__ == "__main__":
    main()
