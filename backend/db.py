import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager

# Keep runtime state on local disk, not on Google Drive — SQLite hangs on
# CloudStorage file locks. Override with NACHI_DATA_DIR if needed.
DATA_DIR = Path(os.environ.get("NACHI_DATA_DIR", Path.home() / ".nachi")).expanduser()
DB_PATH = DATA_DIR / "nachi.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT,
    author TEXT,
    filepath TEXT NOT NULL,
    full_text TEXT,
    num_pages INTEGER,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    agent_id TEXT,
    page INTEGER,
    selected_text TEXT NOT NULL,
    paragraph TEXT,
    rects_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    annotation_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (annotation_id) REFERENCES annotations(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    used_web INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS message_annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    selected_text TEXT,
    note_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_msg_ann_msg ON message_annotations(message_id);

CREATE TABLE IF NOT EXISTS claude_sessions (
    document_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id, agent_id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_annotations_doc ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_page ON annotations(document_id, page);
CREATE INDEX IF NOT EXISTS idx_conversations_doc ON conversations(document_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
"""

MIGRATIONS = [
    "ALTER TABLE annotations ADD COLUMN agent_id TEXT",
    "ALTER TABLE annotations ADD COLUMN rects_json TEXT",
    "ALTER TABLE documents ADD COLUMN full_text TEXT",
    "ALTER TABLE documents ADD COLUMN num_pages INTEGER",
    "ALTER TABLE annotations ADD COLUMN kind TEXT DEFAULT 'ask'",
    "ALTER TABLE annotations ADD COLUMN note_text TEXT",
    "ALTER TABLE messages ADD COLUMN used_web INTEGER DEFAULT 0",
]


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)
        for stmt in MIGRATIONS:
            try:
                conn.execute(stmt)
            except sqlite3.OperationalError:
                pass  # column already exists


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
