"""Deterministic tests for offline IANA archive building; no live network."""
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import xml.etree.ElementTree as ET

from tools.build_iana_offline import build, discover

NAMESPACE = "http://www.iana.org/assignments"
def fixture_xml():
    return ET.fromstring(
        '<registry xmlns="' + NAMESPACE + '">'
        '<title>Protocol Collection</title>'
        '<registry id="example"><title>Test TLS Registry</title>'
        '<record><value>443</value><description>HTTPS secure service</description></record>'
        '</registry></registry>'
    )

class IanaOfflineTests(unittest.TestCase):
    def test_index_rejects_external_and_tricky_links(self):
        html = ('<a href="/assignments/http-fields">HTTP</a>'
                '<a href="https://evil.example/assignments/tls">BAD</a>'
                '<a href="/assignments/dns-parameters">DNS</a>')
        self.assertEqual(set(discover(html)), {"http-fields", "dns-parameters"})

    def test_at_least_100_populated_registry_snapshots(self):
        html = "".join('<a href="/assignments/test-%03d">X</a>' % i for i in range(115))
        def fake_fetch(slug):
            return slug, "https://www.iana.org/assignments/" + slug + "/" + slug + ".xml", "1"*64, fixture_xml(), None
        with tempfile.TemporaryDirectory() as td, patch("tools.build_iana_offline.get_registry_xml", side_effect=fake_fetch):
            path = Path(td) / "archive.db"
            result = build(path, html, max_groups=115, minimum=100, workers=2)
            self.assertEqual(result["populated_registries"], 115)
            self.assertEqual(result["indexed_records"], 115)
            con = sqlite3.connect(path)
            matches = con.execute("SELECT count(*) FROM fts WHERE text MATCH 'HTTPS'").fetchone()[0]
            self.assertEqual(matches, 115)
            self.assertEqual(con.execute("PRAGMA quick_check").fetchone()[0], "ok")
            con.close()

    def test_fails_closed_on_insufficient_sources(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaisesRegex(RuntimeError, "only 1 source"):
                build(Path(td) / "bad.db", '<a href="/assignments/one">X</a>', 5, 100, 1)

if __name__ == "__main__":
    unittest.main()
