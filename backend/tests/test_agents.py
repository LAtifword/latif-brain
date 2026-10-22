from fastapi.testclient import TestClient


def test_list_agents_includes_chat_online_status(_isolated_environment):
    from app.main import create_app

    with TestClient(create_app()) as client:
        response = client.get("/api/agents")
        assert response.status_code == 200
        agents = response.json()
        assert len(agents) == 9

        chat = next(a for a in agents if a["id"] == "chat")
        assert chat["implemented"] is True
        # No GGUF model in the isolated test models dir, so the Chat Agent
        # must honestly report itself offline rather than faking "online".
        assert chat["status"] == "offline"

        code = next(a for a in agents if a["id"] == "code")
        assert code["implemented"] is False
        assert code["status"] == "not_implemented"


def test_get_unknown_agent_404s(_isolated_environment):
    from app.main import create_app

    with TestClient(create_app()) as client:
        response = client.get("/api/agents/does-not-exist")
        assert response.status_code == 404


def test_models_endpoint_reports_engine_unavailable_without_model(_isolated_environment):
    from app.main import create_app

    with TestClient(create_app()) as client:
        response = client.get("/api/models/status")
        assert response.status_code == 200
        body = response.json()
        assert body["model_loaded"] is False
