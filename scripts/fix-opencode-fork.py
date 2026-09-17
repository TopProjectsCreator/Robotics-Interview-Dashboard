#!/usr/bin/env python3
"""
Re-runnable fix for: [invalid_request_error] reasoning `encrypted_content` was not issued to this caller
V1: strips ONLY reasoningEncryptedContent, keeps itemId + reasoning text (no /compact).
Usage:
  python3 fix-opencode-fork.py --session ses_xxx [--db ~/.local/share/opencode/opencode.db]
  python3 fix-opencode-fork.py --session ses_f7428d927ffeU5bWgONAlPQuxP
Safe: backs up DB via SQLite backup API to /tmp before writing, only touches given session ID,
leaves tool/text itemIds intact, verifies with integrity_check.
"""
import argparse, sqlite3, json, os, time, sys

def fix_session(db_path, session_id):
    print(f"DB: {db_path}")
    print(f"Session: {session_id}")
    if not os.path.exists(db_path):
        print(f"DB not found: {db_path}", file=sys.stderr)
        sys.exit(1)
    # backup
    bak = f"/tmp/opencode.db.bak.{int(time.time())}"
    os.makedirs("/tmp", exist_ok=True)
    print(f"Backing up to {bak} ...")
    s = sqlite3.connect(db_path)
    d = sqlite3.connect(bak)
    with d:
        s.backup(d)
    d.close(); s.close()
    print(f"Backup done ({os.path.getsize(bak)} bytes)")

    con = sqlite3.connect(db_path, timeout=30.0)
    cur = con.cursor()
    # PART - v1: delete only reasoningEncryptedContent, keep itemId
    rows = cur.execute("SELECT id, data FROM part WHERE session_id=? AND data LIKE '%reasoningEncryptedContent%'", (session_id,)).fetchall()
    print(f"Stripping encrypted tag in {len(rows)} parts...")
    fixed_part = 0
    for pid, data in rows:
        try:
            j = json.loads(data)
        except:
            continue
        md = j.get("metadata")
        if isinstance(md, dict):
            for k, v in list(md.items()):
                if isinstance(v, dict) and "reasoningEncryptedContent" in v:
                    del v["reasoningEncryptedContent"]
                    fixed_part += 1
            cur.execute("UPDATE part SET data=? WHERE id=?", (json.dumps(j, separators=(",", ":"), ensure_ascii=False), pid))
    print(f"Fixed {fixed_part} provider blocks in parts")
    # EVENT - v1 only
    erows = cur.execute("SELECT id, data FROM event WHERE aggregate_id=? AND data LIKE '%reasoningEncryptedContent%'", (session_id,)).fetchall()
    print(f"Stripping encrypted tag in {len(erows)} events...")
    fixed_event = 0
    for eid, data in erows:
        try:
            j = json.loads(data)
        except:
            continue
        part_obj = j.get("part")
        if not isinstance(part_obj, dict):
            continue
        md = part_obj.get("metadata")
        if isinstance(md, dict):
            changed = False
            for k, v in list(md.items()):
                if isinstance(v, dict) and "reasoningEncryptedContent" in v:
                    del v["reasoningEncryptedContent"]
                    changed = True
                    fixed_event += 1
            if changed:
                cur.execute("UPDATE event SET data=? WHERE id=?", (json.dumps(j, separators=(",", ":"), ensure_ascii=False), eid))
    print(f"Fixed {fixed_event} provider blocks in events")
    con.commit()
    # verify
    c1 = cur.execute("SELECT count(*) FROM part WHERE session_id=? AND data LIKE '%reasoningEncryptedContent%'", (session_id,)).fetchone()[0]
    c2 = cur.execute("SELECT count(*) FROM event WHERE aggregate_id=? AND data LIKE '%reasoningEncryptedContent%'", (session_id,)).fetchone()[0]
    # reasoning with itemId should be 0
    rows3 = cur.execute("SELECT data FROM part WHERE session_id=?", (session_id,)).fetchall()
    bad = 0
    rc = 0
    nonempty = 0
    for (d,) in rows3:
        try:
            j = json.loads(d)
            if j.get("type") == "reasoning":
                rc += 1
                if j.get("text"):
                    nonempty += 1
                if "itemId" in d:
                    bad += 1
        except:
            pass
    print(f"VERIFY encrypted remaining part={c1} event={c2} (want 0,0)")
    print(f"VERIFY reasoning parts={rc} nonempty={nonempty} still-with-itemId={bad} (want bad=rc, v1 keeps itemId)")
    print("integrity:", cur.execute("PRAGMA integrity_check").fetchone()[0])
    con.close()
    print("Done. Now fully exit opencode (ctrl+c / /exit) and resume with:")
    print(f"  opencode --continue --session {session_id}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", required=True, help="session id, e.g. ses_f62dc87ffffenlOEJ66qJ6fki6")
    ap.add_argument("--db", default=os.path.expanduser("~/.local/share/opencode/opencode.db"))
    a = ap.parse_args()
    fix_session(a.db, a.session)
