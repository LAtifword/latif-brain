from app.services.iana_registry import search_registry
def test_missing_registry_is_safe():
    assert search_registry("http", "media-types") == []
def test_registry_allowlist():
    try:
        search_registry("http", "../../secrets")
    except ValueError:
        pass
    else:
        raise AssertionError("Registry allowlist not enforced")
