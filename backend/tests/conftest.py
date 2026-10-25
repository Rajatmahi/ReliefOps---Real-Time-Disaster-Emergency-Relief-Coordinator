import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import Role, User
from app.security import hash_password


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    settings.jwt_secret_key = "test-signing-secret-that-is-not-used-outside-tests"
    session.add_all([
        User(name="Citizen", email="citizen@example.com", password_hash=hash_password("CitizenPass123!"), role=Role.CITIZEN),
        User(name="Admin", email="admin@example.com", password_hash=hash_password("AdminPass123!"), role=Role.ADMIN),
        User(name="Coordinator", email="coordinator@example.com", password_hash=hash_password("Coordinator123!"), role=Role.COORDINATOR),
    ])
    session.commit()

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        test_client.headers_by_role = {}
        for email, password, role in [("citizen@example.com", "CitizenPass123!", "citizen"), ("admin@example.com", "AdminPass123!", "admin"), ("coordinator@example.com", "Coordinator123!", "coordinator")]:
            response = test_client.post("/api/auth/login", json={"email": email, "password": password})
            assert response.status_code == 200
            test_client.headers_by_role[role] = {"Authorization": f"Bearer {response.json()['access_token']}"}
        yield test_client
    app.dependency_overrides.clear()
    session.close()
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def headers(client):
    return client.headers_by_role
