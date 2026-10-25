import os

from locust import HttpUser, between, task


class ApiDemoUser(HttpUser):
    wait_time = between(0.2, 1.0)

    @task(4)
    def health(self):
        self.client.get("/health", name="GET /health")

    @task(1)
    def incidents(self):
        token = os.getenv("LOADTEST_TOKEN")
        if token:
            self.client.get("/api/incidents?limit=50", headers={"Authorization": f"Bearer {token}"}, name="GET /api/incidents")
