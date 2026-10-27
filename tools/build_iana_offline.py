#!/usr/bin/env python3
"""Build a bounded, provenance-tracked offline IANA SQLite reference for LATIF NI.

Fetches *published registry records*, never executable code. No model files or
network diagnostic binaries are downloaded. Fails closed below minimum coverage.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sqlite3
import time
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

BASE = "https://www.iana.org"
INDEX = BASE + "/protocols"
MAX_XML_BYTES = 6_000_000
MAX_INDEX_BYTES = 3_000_000
MAX_ROWS_PER_REGISTRY = 1600
MAX_TOTAL_ROWS = 160_000
PRIORITY = (
    "tls", "dns", "http", "ip", "tcp", "udp", "port", "mime", "media", "oauth",
    "crypto", "security", "ssh", "quic", "uri", "json", "jwt", "cose",
    "cert", "websocket", "smtp", "email", "ldap", "x509", "sctp", "dtls",
    "ike", "ipsec", "bgp", "dhcp", "ether", "snmp", "syslog", "ftp", "mqtt",
    "coap", "rdap", "http", "language", "charset", "yang", "web", "xml",
    "content", "socket", "auth", "rtp", "sip", "webrtc", "compression",
)

def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag

class IndexLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.slugs: set[str] = set()

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        href = dict(attrs).get("href", "")
        p = urlparse(urljoin(BASE, href))
        if p.netloc not in ("www.iana.org", "iana.org"):
            return
        match = re.fullmatch(r"/assignments/([a-z0-9-]+)/?", p.path)
        if match:
            self.slugs.add(match.group(1))

def discover(html: str) -> list[str]:
    parser = IndexLinks()
    parser.feed(html)
    def priority(slug):
        return -sum(1 for word in PRIORITY if word in slug), slug
    return sorted(parser.slugs, key=priority)

def download(url: str, maximum: int) -> bytes:
    request = Request(url, headers={"User-Agent": "LATIF-NI-IANA-Archive/1.0 (read-only registry mirror)", "Accept": "text/html,application/xml,text/xml"})
    with urlopen(request, timeout=25) as resp:
        # Limit memory and skip unexpectedly large registries rather than truncating.
        data = resp.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError("Source exceeds per-file limit")
    if not data:
        raise ValueError("Empty source")
    return data

def get_registry_xml(slug: str):
    url = f"{BASE}/assignments/{slug}/{slug}.xml"
    try:
        data = download(url, MAX_XML_BYTES)
        root = ET.fromstring(data)
        if local_name(root.tag) != "registry":
            raise ValueError("Not an IANA registry XML file")
        return slug, url, hashlib.sha256(data).hexdigest(), root, None
    except (OSError, ValueError, ET.ParseError, TimeoutError) as exc:
        return slug, url, None, None, str(exc)[:240]

def one_text(el, tag):
    for child in el:
        if local_name(child.tag) == tag:
            return " ".join("".join(child.itertext()).split())[:240]
    return ""

def registries(root):
    for el in root.iter():
        if local_name(el.tag) == "registry" and el is not root:
            yield el

def records_for(reg):
    for item in reg:
        if local_name(item.tag) != "record":
            continue
        fields = {}
        for child in item:
            key = local_name(child.tag)
            if key in ("xref", "contact", "annotation"):
                if key == "xref":
                    value = ":".join([child.attrib.get("type", ""), child.attrib.get("data", "")]).strip(":")
                else:
                    continue
            else:
                value = " ".join("".join(child.itertext()).split())
            if value:
                fields.setdefault(key, [])
                if len(fields[key]) < 3:
                    fields[key].append(value[:320])
        if fields:
            compact = {k: "; ".join(v) for k, v in fields.items()}
            text = " | ".join(compact.values())[:1300]
            yield text, json.dumps(compact, ensure_ascii=False, separators=(",", ":"))

def build(output: Path, html: str, max_groups: int, minimum: int, workers: int):
    sources = discover(html)
    if len(sources) < minimum:
        raise RuntimeError(f"Index yielded only {len(sources)} source groups")
    sources = sources[:max_groups]
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(".tmp")
    if tmp.exists():
        tmp.unlink()
    db = sqlite3.connect(tmp)
    db.executescript("""
      PRAGMA journal_mode=DELETE;
      CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE groups(slug TEXT PRIMARY KEY, title TEXT, source_url TEXT, sha256 TEXT);
      CREATE TABLE registries(id INTEGER PRIMARY KEY, grp TEXT NOT NULL, key TEXT,
                              title TEXT NOT NULL, source_url TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE records(id INTEGER PRIMARY KEY, registry_id INTEGER NOT NULL, text TEXT NOT NULL, fields TEXT NOT NULL);
      CREATE VIRTUAL TABLE fts USING fts4(text, tokenize=unicode61);
      CREATE INDEX ix_records_reg ON records(registry_id);
      CREATE INDEX ix_reg_group ON registries(grp);
    """)
    failures = {}
    successes = 0
    total_records = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(8, workers))) as pool:
        for slug, url, sha, root, error in pool.map(get_registry_xml, sources):
            if error:
                failures[slug] = error
                continue
            group_title = one_text(root, "title") or slug
            db.execute("INSERT INTO groups VALUES(?,?,?,?)", (slug, group_title, url, sha))
            successes += 1
            for reg in registries(root):
                title = one_text(reg, "title")
                if not title:
                    continue
                ident = reg.attrib.get("id", "")[:140]
                source = f"{BASE}/assignments/{slug}#{ident}" if ident else f"{BASE}/assignments/{slug}"
                record_rows = list(records_for(reg))
                if not record_rows:
                    continue
                cur = db.execute("INSERT INTO registries(grp,key,title,source_url) VALUES(?,?,?,?)".replace("(grp,key,title,source_url) VALUES(?,?,?,?)", "(grp,key,title,source_url,count) VALUES(?,?,?,?,0)"), (slug, ident, title[:240], source))
                reg_id = cur.lastrowid
                added = 0
                for value, fields in record_rows[:MAX_ROWS_PER_REGISTRY]:
                    if total_records >= MAX_TOTAL_ROWS:
                        break
                    db.execute("INSERT INTO records(registry_id,text,fields) VALUES(?,?,?)", (reg_id, value, fields))
                    db.execute("INSERT INTO fts(docid,text) VALUES(last_insert_rowid(),?)", (value,))
                    total_records += 1
                    added += 1
                db.execute("UPDATE registries SET count=? WHERE id=?", (added, reg_id))
                if total_records >= MAX_TOTAL_ROWS:
                    break
            if total_records >= MAX_TOTAL_ROWS:
                break
    count = db.execute("SELECT count(*) FROM registries WHERE count>0").fetchone()[0]
    if count < minimum:
        db.close()
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"Only {count} populated registries; need {minimum}. Groups={successes}; failures={len(failures)}")
    db.execute("INSERT INTO meta VALUES('source',?)", (INDEX,))
    db.execute("INSERT INTO meta VALUES('built_at_utc',?)", (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),))
    db.execute("INSERT INTO meta VALUES('registry_count',?)", (str(count),))
    db.execute("INSERT INTO meta VALUES('row_count',?)", (str(total_records),))
    db.commit()
    assert db.execute("PRAGMA quick_check").fetchone()[0] == "ok"
    db.close()
    tmp.replace(output)
    report = {
        "source": INDEX, "fetched_source_groups": successes,
        "populated_registries": count, "indexed_records": total_records,
        "failed_sources": failures, "database_sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "database_bytes": output.stat().st_size,
    }
    output.with_suffix(".report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "failed_sources"}, indent=2))
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="android/webapps/src/ni/assets/iana/registries.db")
    parser.add_argument("--max-groups", type=int, default=180)
    parser.add_argument("--minimum", type=int, default=100)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--index-file", type=Path, help="Use test fixture instead of live index")
    args = parser.parse_args()
    html = args.index_file.read_text(encoding="utf-8") if args.index_file else download(INDEX, MAX_INDEX_BYTES).decode("utf-8", "replace")
    build(Path(args.output), html, args.max_groups, args.minimum, args.workers)

if __name__ == "__main__":
    main()
