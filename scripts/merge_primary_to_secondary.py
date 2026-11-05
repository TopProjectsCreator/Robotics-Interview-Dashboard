#!/usr/bin/env python3
"""Resume-friendly merge PRIMARY -> SECONDARY remaining tables."""
import os, sys
import psycopg2
from psycopg2.extras import Json

def load_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env

env = load_env("/workspaces/Robotics-Interview-Dashboard/.env")
src = psycopg2.connect(env["DATABASE_URL"], sslmode="require", connect_timeout=30)
dst = psycopg2.connect(env["SECONDARY_DATABASE_URL"], sslmode="require", connect_timeout=30)
dst.autocommit = True
src.autocommit = True

def get_columns(conn, table):
    cur = conn.cursor()
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position", (table,))
    return [r[0] for r in cur.fetchall()]

# FK-safe order for remaining tables; parents already merged
ordered = [
    "cad_models",
    "code_files",
    "code_presence",
    "code_revisions",
    "chat_channel_members",
    "custom_workspace_versions",
    "custom_workspace_data",
    "chat_message_reactions",
    "chat_polls",
    "chat_poll_votes",
    "chat_message_reads",
    "applicants",
    "application_imports",
    "assistant_builder_runs",
    "assistant_conversations",
    "assistant_messages",
    "assistant_prompt_runs",
    "dashboard_charts",
    "data_snapshots",
    "feature_requests",
    "interview_whiteboards",
    "maildrop_inboxes",
    "parts_inventory",
    "parts_robot_allocations",
    "parts_supplier_price_snapshots",
    "parts_supplier_sync_states",
    "parts_team_settings",
    "parts_vendor_blocks",
    "parts_catalog_crawl_skips",
    "page_visits",
    "chunked_uploads",
    "chat_custom_emojis",
    "whiteboards",
    "external_objects",
    "audit_logs",
    "ingested_emails",
    "cad_preview_jobs",
    "assistant_skills",
    "assistant_model_policies",
    "assistant_model_policy_history",
    "scheduled_chat_messages",
    "team_name_rules",
    "parts_catalog_crawl_state",
    "parts_catalog_sync_state",
    "display_settings",
    "seating_settings",
    "workspace_settings",
    "chat_settings",
    "interview_queue",
    "presence_heartbeats",
    "revoked_sessions",
    "personal_notepad",  # already done but idempotent
]

def adapt_row(row):
    return tuple(Json(v) if isinstance(v, (dict, list)) else v for v in row)

for table in ordered:
    src_cols = get_columns(src, table)
    dst_cols = get_columns(dst, table)
    if not dst_cols:
        print(f"SKIP {table}: missing in secondary", flush=True)
        continue
    cols = [c for c in src_cols if c in dst_cols]
    col_list = ", ".join(f'"{c}"' for c in cols)
    # counts
    cur = dst.cursor()
    cur.execute(f'SELECT COUNT(*) FROM "{table}"')
    before = cur.fetchone()[0]
    # fetch primary count
    cur2 = src.cursor()
    cur2.execute(f'SELECT COUNT(*) FROM "{table}"')
    src_count = cur2.fetchone()[0]
    if src_count == 0:
        print(f"{table}: src=0 dst={before} skip", flush=True)
        continue
    print(f"MERGE {table}: src={src_count} dst_before={before}", flush=True)
    # Fetch in chunks via ORDER BY primary key if exists else LIMIT/OFFSET
    # Get PK
    cur2.execute("""
      SELECT kcu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
      WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema='public' AND tc.table_name=%s
      ORDER BY kcu.ordinal_position
    """, (table,))
    pk_rows = cur2.fetchall()
    pk = pk_rows[0][0] if pk_rows else None
    order_clause = f'ORDER BY "{pk}"' if pk else ""
    BATCH = 200
    offset = 0
    total_inserted_rows = 0
    while True:
        cur2.execute(f'SELECT {col_list} FROM "{table}" {order_clause} LIMIT %s OFFSET %s', (BATCH, offset))
        rows = cur2.fetchall()
        if not rows:
            break
        placeholders = ", ".join(["%s"] * len(cols))
        sql = f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
        cur3 = dst.cursor()
        batch = [adapt_row(r) for r in rows]
        cur3.executemany(sql, batch)
        total_inserted_rows += len(rows)
        offset += len(rows)
        if offset % 1000 < BATCH or len(rows) < BATCH:
            print(f"  {table}: progress {offset}/{src_count}", flush=True)
        if len(rows) < BATCH:
            break
    cur.execute(f'SELECT COUNT(*) FROM "{table}"')
    after = cur.fetchone()[0]
    print(f"{table}: done dst {before} -> {after} (+{after-before})", flush=True)

src.close(); dst.close()
print("ALL DONE")
