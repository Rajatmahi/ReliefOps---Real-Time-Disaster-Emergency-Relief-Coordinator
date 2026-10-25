def report(client, headers):
    response = client.post("/api/incidents", headers=headers["citizen"], json={
        "disaster_type": "Flood",
        "description": "Flood water reached several homes near the river",
        "latitude": 19.076,
        "longitude": 72.877,
        "severity": "critical",
        "people_affected": 7,
    })
    assert response.status_code == 201
    return response.json()


def test_authentication_and_role_enforcement(client, headers):
    assert client.get("/api/teams").status_code == 401
    assert client.get("/api/auth/me", headers=headers["citizen"]).json()["role"] == "citizen"
    assert client.post("/api/teams", headers=headers["citizen"], json={"team_name": "Team A", "capacity": 4}).status_code == 403
    bad_login = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "incorrect"})
    assert bad_login.status_code == 401
    registered = client.post("/api/auth/register", json={"name": "New Citizen", "email": "new@example.com", "password": "NewCitizen123!", "role": "admin"})
    assert registered.status_code == 201
    assert registered.json()["role"] == "citizen"
    assert client.post("/api/auth/register", json={"name": "New Citizen", "email": "new@example.com", "password": "NewCitizen123!"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "new@example.com", "password": "NewCitizen123!"}).json()["user"]["role"] == "citizen"


def test_incident_status_transitions_and_history(client, headers):
    assert client.get("/health").status_code == 200
    invalid = client.post("/api/incidents", headers=headers["citizen"], json={"disaster_type":"Flood","description":"This description is long enough","latitude":91,"longitude":0,"severity":"high","people_affected":1})
    assert invalid.status_code == 422
    incident = report(client, headers)
    incident_id = incident["id"]
    assert client.get("/api/incidents", headers=headers["citizen"]).json()[0]["id"] == incident_id
    client.post("/api/auth/register", json={"name":"Other Citizen","email":"other@example.com","password":"OtherCitizen123!"})
    other = client.post("/api/auth/login", json={"email":"other@example.com","password":"OtherCitizen123!"}).json()
    other_headers = {"Authorization":f"Bearer {other['access_token']}"}
    assert client.get(f"/api/incidents/{incident_id}", headers=other_headers).status_code == 404
    assert client.patch(f"/api/incidents/{incident_id}/status", headers=headers["citizen"], json={"status": "verified"}).status_code == 403
    assert client.patch(f"/api/incidents/{incident_id}/status", headers=headers["admin"], json={"status": "resolved"}).status_code == 409
    assert client.patch(f"/api/incidents/{incident_id}/status", headers=headers["admin"], json={"status": "verified"}).status_code == 200
    history = client.get(f"/api/incidents/{incident_id}/history", headers=headers["citizen"])
    assert [event["new_status"] for event in history.json()] == ["reported", "verified"]


def test_assignment_lifecycle_and_team_availability(client, headers):
    incident = report(client, headers)
    incident_id = incident["id"]
    assert client.patch(f"/api/incidents/{incident_id}/status", headers=headers["admin"], json={"status": "verified"}).status_code == 200
    too_small = client.post("/api/teams", headers=headers["admin"], json={"team_name":"Small Team","capacity":2,"coordinator_id":3})
    assert too_small.status_code == 201
    assert client.post("/api/assignments", headers=headers["admin"], json={"incident_id":incident_id,"team_id":too_small.json()["id"]}).status_code == 409
    team_response = client.post("/api/teams", headers=headers["admin"], json={"team_name": "River Team", "capacity": 10, "coordinator_id": 3})
    assert team_response.status_code == 201
    team_id = team_response.json()["id"]
    assigned = client.post("/api/assignments", headers=headers["admin"], json={"incident_id": incident_id, "team_id": team_id})
    assert assigned.status_code == 201
    assert client.patch(f"/api/teams/{team_id}", headers=headers["admin"], json={"availability": "available"}).status_code == 409
    assert client.post("/api/assignments", headers=headers["admin"], json={"incident_id": incident_id, "team_id": team_id}).status_code == 409
    assignment_id = assigned.json()["id"]
    assert client.patch(f"/api/assignments/{assignment_id}/status", headers=headers["coordinator"], json={"status": "in_progress"}).status_code == 200
    assert client.patch(f"/api/assignments/{assignment_id}/status", headers=headers["coordinator"], json={"status": "arrived"}).status_code == 200
    assert client.patch(f"/api/assignments/{assignment_id}/status", headers=headers["coordinator"], json={"status": "completed", "reason": "All households checked; two people evacuated to the local shelter."}).status_code == 200
    assert client.get(f"/api/incidents/{incident_id}", headers=headers["citizen"]).json()["status"] == "awaiting_verification"
    assert client.patch(f"/api/incidents/{incident_id}/status", headers=headers["coordinator"], json={"status": "resolved", "reason": "verified"}).status_code == 403
    assert client.patch(f"/api/incidents/{incident_id}/status", headers=headers["admin"], json={"status": "resolved", "reason": "Control room verified team report."}).status_code == 200
    assert client.get(f"/api/incidents/{incident_id}", headers=headers["citizen"]).json()["status"] == "resolved"
    assert client.get("/api/teams", headers=headers["admin"]).json()[0]["availability"] == "available"


def test_coordinator_receives_verified_queue_and_can_assign_only_owned_team(client, headers):
    incident = report(client, headers)
    incident_id = incident["id"]
    client.patch(f"/api/incidents/{incident_id}/status", headers=headers["admin"], json={"status": "verified"})
    assert any(item["id"] == incident_id for item in client.get("/api/incidents", headers=headers["coordinator"]).json())
    assert client.get(f"/api/incidents/{incident_id}", headers=headers["coordinator"]).status_code == 200
    assert client.get(f"/api/incidents/{incident_id}/history", headers=headers["coordinator"]).status_code == 200

    own = client.post("/api/teams", headers=headers["admin"], json={"team_name":"Coordinator One Team","capacity":10,"coordinator_id":3}).json()
    other_user = client.post("/api/users", headers=headers["admin"], json={"name":"Other Coordinator","email":"other-coordinator@example.com","password":"OtherCoordinator123!","role":"coordinator"}).json()
    other = client.post("/api/teams", headers=headers["admin"], json={"team_name":"Coordinator Two Team","capacity":10,"coordinator_id":other_user["id"]}).json()
    assert [team["id"] for team in client.get("/api/teams", headers=headers["coordinator"]).json()] == [own["id"]]
    denied = client.post("/api/assignments", headers=headers["coordinator"], json={"incident_id":incident_id,"team_id":other["id"]})
    assert denied.status_code == 403
    assigned = client.post("/api/assignments", headers=headers["coordinator"], json={"incident_id":incident_id,"team_id":own["id"]})
    assert assigned.status_code == 201
    assert client.get("/api/assignments", headers=headers["admin"]).json()[0]["incident_id"] == incident_id
    assert client.post("/api/assignments", headers=headers["citizen"], json={"incident_id":incident_id,"team_id":own["id"]}).status_code == 403


def test_coordinator_application_requires_admin_review(client, headers):
    payload = {"motivation": "I coordinate neighborhood response volunteers and can manage dispatch updates.", "experience": "Three years supporting local flood response."}
    submitted = client.post("/api/coordinator-applications", headers=headers["citizen"], json=payload)
    assert submitted.status_code == 201
    application_id = submitted.json()["id"]
    assert submitted.json()["status"] == "pending"
    assert client.post("/api/coordinator-applications", headers=headers["citizen"], json=payload).status_code == 409
    assert client.get("/api/coordinator-applications", headers=headers["coordinator"]).status_code == 403
    assert client.patch(f"/api/coordinator-applications/{application_id}/review", headers=headers["citizen"], json={"decision":"approve"}).status_code == 403
    assert client.patch(f"/api/coordinator-applications/{application_id}/review", headers=headers["admin"], json={"decision":"reject"}).status_code == 422
    rejected = client.patch(f"/api/coordinator-applications/{application_id}/review", headers=headers["admin"], json={"decision":"reject","reason":"Please complete the required organization training first."})
    assert rejected.status_code == 200
    assert client.get("/api/auth/me", headers=headers["citizen"]).json()["role"] == "citizen"
    reapply = client.post("/api/coordinator-applications", headers=headers["citizen"], json=payload)
    assert reapply.status_code == 201
    approved = client.patch(f"/api/coordinator-applications/{reapply.json()['id']}/review", headers=headers["admin"], json={"decision":"approve","reason":"Training verified."})
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert client.get("/api/auth/me", headers=headers["citizen"]).json()["role"] == "coordinator"
    assert client.patch(f"/api/coordinator-applications/{reapply.json()['id']}/review", headers=headers["admin"], json={"decision":"reject","reason":"duplicate review"}).status_code == 409
    assert client.get("/api/coordinator-applications/mine", headers=headers["citizen"]).json()[0]["status"] == "approved"


def test_priority_indicators_and_audited_invalid_report(client, headers):
    response = client.post("/api/incidents", headers=headers["citizen"], json={
        "disaster_type": "Flood", "description": "Water entered homes and trapped residents near the crossing",
        "latitude": 19.076, "longitude": 72.877, "severity": "medium", "people_affected": 4,
        "people_trapped": 2, "urgent_medical": True, "immediate_needs": ["rescue", "medical"],
    })
    assert response.status_code == 201
    item = response.json()
    assert item["suggested_severity"] == "critical"
    assert len(item["priority_reasons"]) >= 2
    assert client.patch(f"/api/incidents/{item['id']}/status", headers=headers["admin"], json={"status": "invalid"}).status_code == 422
    assert client.patch(f"/api/incidents/{item['id']}/status", headers=headers["admin"], json={"status": "invalid", "reason": "Duplicate spam report"}).status_code == 200
    assert client.get(f"/api/incidents/{item['id']}/history", headers=headers["citizen"]).json()[-1]["reason"] == "Duplicate spam report"


def test_inventory_cannot_become_negative(client, headers):
    negative = client.post("/api/inventory", headers=headers["admin"], json={"relief_center":"North Center","item_name":"Invalid","quantity":-1})
    assert negative.status_code == 422
    created = client.post("/api/inventory", headers=headers["admin"], json={"relief_center": "North Center", "item_name": "Water", "quantity": 8})
    assert created.status_code == 201
    url = f"/api/inventory/{created.json()['id']}/transactions"
    overdraw = client.post(url, headers=headers["admin"], json={"transaction_type": "distributed", "quantity": 9})
    assert overdraw.status_code == 409
    distributed = client.post(url, headers=headers["admin"], json={"transaction_type": "distributed", "quantity": 3})
    assert distributed.status_code == 200
    assert distributed.json()["quantity"] == 5
