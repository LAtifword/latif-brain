# IANA integration — initial isolated implementation

This branch adds a read-only IANA CSV lookup service and an opt-in synchronization script.
It does not claim to package all IANA registries, install Termux packages, or embed a model.
The service is not wired into the FastAPI router or Flutter UI yet.

Run from backend:
```bash
python scripts/sync_iana.py
pytest tests/test_iana_registry.py
```

The downloaded registry files are source data, not executable code.
Future integration requires an API endpoint, Flutter search screen, offline database
packaging, provenance metadata, and build validation.
Official source: https://www.iana.org/protocols
