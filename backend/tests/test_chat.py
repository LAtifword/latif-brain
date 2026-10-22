from fastapi.testclient import TestClient


def test_create_and_list_conversation(_isolated_environment):
    from app.main import create_app

    with TestClient(create_app()) as client:
        created = client.post("/api/chat/conversations", params={"title": "Test chat"})
        assert created.status_code == 200
        conv = created.json()
        assert conv["title"] == "Test chat"
        assert conv["agent_id"] == "chat"

        listed = client.get("/api/chat/conversations")
        assert listed.status_code == 200
        assert any(c["id"] == conv["id"] for c in listed.json())


def test_chat_websocket_reports_missing_model_honestly(_isolated_environment):
    from app.main import create_app

    with TestClient(create_app()) as client:
        conv = client.post("/api/chat/conversations", params={"title": "Test"}).json()

        with client.websocket_connect(f"/api/chat/ws/{conv['id']}") as ws:
            ws.send_json({"content": "hello"})
            message = ws.receive_json()
            # No GGUF model is present in the isolated test environment, so
            # the agent must surface a real error instead of a fake reply.
            assert message["type"] == "error"
            assert "model" in message["detail"].lower() or "llama" in message["detail"].lower()

        messages = client.get(f"/api/chat/conversations/{conv['id']}/messages").json()
        assert any(m["role"] == "user" and m["content"] == "hello" for m in messages)


def test_chat_websocket_unknown_conversation(_isolated_environment):
    from app.main import create_app

    with TestClient(create_app()) as client:
        with client.websocket_connect("/api/chat/ws/does-not-exist") as ws:
            message = ws.receive_json()
            assert message["type"] == "error"
