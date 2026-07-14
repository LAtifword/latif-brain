from fastapi.testclient import TestClient


def test_health(_isolated_environment):
    from app.main import create_app

    with TestClient(create_app()) as client:
        response = client.get("/api/system/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_stats_reports_real_values(_isolated_environment):
    from app.main import create_app

    with TestClient(create_app()) as client:
        response = client.get("/api/system/stats")
        assert response.status_code == 200
        body = response.json()
        assert 0.0 <= body["cpu_percent"] <= 100.0
        assert body["memory_total_mb"] > 0
        assert isinstance(body["gpu_available"], bool)
