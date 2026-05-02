import hashlib
import json
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from db import init_db, get_conn, DATA_DIR
from agent_runner import (
    list_agents,
    assemble_prompt,
    invoke_claude,
    agent_color,
    agent_model,
    classify_agent,
    draft_agent_persona,
    add_agent_to_registry,
    AGENTS_DIR,
)
from pdf_extract import extract_text, extract_metadata

PDF_DIR = DATA_DIR / "pdfs"
PDF_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Nachi")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    backfill_document_text()


def backfill_document_text():
    """One-time: extract text for any documents that don't have it yet."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, filepath FROM documents WHERE full_text IS NULL OR num_pages IS NULL"
        ).fetchall()
        for r in rows:
            try:
                text, n = extract_text(r["filepath"])
                conn.execute(
                    "UPDATE documents SET full_text = ?, num_pages = ? WHERE id = ?",
                    (text, n, r["id"]),
                )
            except Exception as e:
                print(f"[backfill] failed for {r['id']}: {e}")


@app.get("/agents")
def get_agents():
    return list_agents()


@app.get("/documents")
def get_documents():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, title, author, num_pages, added_at,
                      (full_text IS NOT NULL) AS has_text
               FROM documents ORDER BY added_at DESC"""
        ).fetchall()
        return [dict(r) for r in rows]


@app.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF uploads supported")
    content = await file.read()
    doc_id = hashlib.sha1(content).hexdigest()[:16]
    dest = PDF_DIR / f"{doc_id}.pdf"
    dest.write_bytes(content)

    try:
        full_text, num_pages = extract_text(str(dest))
        meta = extract_metadata(str(dest))
    except Exception as e:
        raise HTTPException(400, f"Failed to extract text from PDF: {e}")

    final_title = title or meta["title"] or file.filename.rsplit(".", 1)[0]
    final_author = author or meta["author"]

    with get_conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO documents
               (id, title, author, filepath, full_text, num_pages)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (doc_id, final_title, final_author, str(dest), full_text, num_pages),
        )
    return {
        "id": doc_id,
        "title": final_title,
        "author": final_author,
        "num_pages": num_pages,
    }


@app.get("/documents/{doc_id}/file")
def get_document_file(doc_id: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT filepath FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
    return FileResponse(row["filepath"], media_type="application/pdf")


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    """Permanently delete a document: its DB row, its PDF file on disk, and
    every annotation, conversation, message, message_annotation, and Claude
    session tied to it. Irreversible."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT filepath FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Document not found")
        conv_ids = [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM conversations WHERE document_id = ?", (doc_id,)
            ).fetchall()
        ]
        for cid in conv_ids:
            conn.execute(
                "DELETE FROM message_annotations WHERE message_id IN "
                "(SELECT id FROM messages WHERE conversation_id = ?)",
                (cid,),
            )
            conn.execute(
                "DELETE FROM messages WHERE conversation_id = ?", (cid,)
            )
        conn.execute(
            "DELETE FROM conversations WHERE document_id = ?", (doc_id,)
        )
        conn.execute(
            "DELETE FROM annotations WHERE document_id = ?", (doc_id,)
        )
        conn.execute(
            "DELETE FROM claude_sessions WHERE document_id = ?", (doc_id,)
        )
        conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))

    # Remove the PDF file from disk. Tolerate it being missing.
    try:
        Path(row["filepath"]).unlink(missing_ok=True)
    except OSError:
        pass

    return {"ok": True}


@app.post("/documents/{doc_id}/reset")
def reset_document(doc_id: str):
    """Delete all annotations, conversations, messages, and Claude sessions
    for this document. The document and its PDF stay. Irreversible."""
    with get_conn() as conn:
        if not conn.execute(
            "SELECT 1 FROM documents WHERE id = ?", (doc_id,)
        ).fetchone():
            raise HTTPException(404, "Document not found")
        # messages and message_annotations are scoped by conversation_id;
        # collect conv ids first then cascade cleanly.
        conv_ids = [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM conversations WHERE document_id = ?", (doc_id,)
            ).fetchall()
        ]
        for cid in conv_ids:
            conn.execute(
                "DELETE FROM message_annotations WHERE message_id IN "
                "(SELECT id FROM messages WHERE conversation_id = ?)",
                (cid,),
            )
            conn.execute(
                "DELETE FROM messages WHERE conversation_id = ?", (cid,)
            )
        conn.execute(
            "DELETE FROM conversations WHERE document_id = ?", (doc_id,)
        )
        conn.execute(
            "DELETE FROM annotations WHERE document_id = ?", (doc_id,)
        )
        conn.execute(
            "DELETE FROM claude_sessions WHERE document_id = ?", (doc_id,)
        )
    return {"ok": True}


@app.post("/documents/{doc_id}/duplicate")
def duplicate_document(doc_id: str):
    """Create a fresh copy of a document (new doc id, same PDF content, no
    annotations / conversations). Useful for re-reading with a clean slate
    while preserving the original's annotations."""
    import secrets
    with get_conn() as conn:
        src = conn.execute(
            "SELECT title, author, filepath, full_text, num_pages "
            "FROM documents WHERE id = ?",
            (doc_id,),
        ).fetchone()
        if not src:
            raise HTTPException(404, "Document not found")

        new_id = secrets.token_hex(8)  # 16 hex chars, matches upload format
        src_path = Path(src["filepath"])
        if not src_path.exists():
            raise HTTPException(500, "Source PDF file not found on disk")
        new_path = PDF_DIR / f"{new_id}.pdf"
        new_path.write_bytes(src_path.read_bytes())

        new_title = (src["title"] or "Untitled") + " (copy)"
        conn.execute(
            """INSERT INTO documents
               (id, title, author, filepath, full_text, num_pages)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                new_id,
                new_title,
                src["author"],
                str(new_path),
                src["full_text"],
                src["num_pages"],
            ),
        )
    return {
        "id": new_id,
        "title": new_title,
        "author": src["author"],
        "num_pages": src["num_pages"],
    }


@app.get("/documents/{doc_id}/marked-up")
def get_marked_up_document(doc_id: str):
    """Return the PDF with highlights and notes burned in as PDF annotations.
    Uses the stored rects (page-ratio coords) to draw highlight annotations
    on each page."""
    import fitz

    with get_conn() as conn:
        doc_row = conn.execute(
            "SELECT filepath, title FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        if not doc_row:
            raise HTTPException(404, "Document not found")
        anns = conn.execute(
            """SELECT id, page, selected_text, rects_json, kind, note_text,
                      COALESCE(agent_id, '') AS agent_id
               FROM annotations WHERE document_id = ? AND rects_json IS NOT NULL""",
            (doc_id,),
        ).fetchall()

    pdf = fitz.open(doc_row["filepath"])
    try:
        for a in anns:
            page_num = (a["page"] or 1) - 1
            if page_num < 0 or page_num >= len(pdf):
                continue
            page = pdf[page_num]
            pw, ph = page.rect.width, page.rect.height
            try:
                rects = json.loads(a["rects_json"])
            except Exception:
                continue

            kind = a["kind"] or "ask"
            # Colors: ask = amber, highlight = yellow, note = blue.
            if kind == "note":
                rgb = (0.29, 0.56, 0.89)  # blue
            elif kind == "highlight":
                rgb = (0.91, 0.72, 0.0)  # amber-yellow
            else:
                rgb = (0.85, 0.48, 0.24)  # rust (ask)

            quads = []
            for r in rects:
                x0 = r["x"] * pw
                y0 = r["y"] * ph
                x1 = (r["x"] + r["w"]) * pw
                y1 = (r["y"] + r["h"]) * ph
                quads.append(fitz.Rect(x0, y0, x1, y1))
            if not quads:
                continue

            hl = page.add_highlight_annot(quads)
            hl.set_colors(stroke=rgb)
            content = a["selected_text"] or ""
            if a["note_text"]:
                content = f"Note: {a['note_text']}\n\n{content}"
            elif kind == "ask" and a["agent_id"]:
                content = (
                    f"Asked {a['agent_id'].replace('_', ' ')}:\n\n{content}"
                )
            hl.set_info(content=content)
            hl.update()

        out_bytes = pdf.tobytes()
    finally:
        pdf.close()

    safe_title = "".join(
        c if c.isalnum() or c in "-_" else "_"
        for c in (doc_row["title"] or "document")
    )[:60]
    return Response(
        content=out_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_title}_annotated.pdf"'
            ),
        },
    )


class Rect(BaseModel):
    x: float
    y: float
    w: float
    h: float


class AskRequest(BaseModel):
    agent_id: str  # can be "auto" to auto-classify
    document_id: str
    selected_text: str
    question: str
    paragraph: Optional[str] = None
    page: Optional[int] = None
    rects: Optional[list[Rect]] = None
    use_full_book: bool = False
    conversation_id: Optional[int] = None
    # Optional short label stored as the user-visible message in the chat
    # thread. When the Ask form is submitted with an empty textarea, this is
    # set to the scholar's action label (e.g. "Joke") while `question` holds
    # the full action_prompt (with few-shot examples) that goes to Claude.
    display_question: Optional[str] = None


class AnnotationCreate(BaseModel):
    document_id: str
    selected_text: str
    kind: str  # 'highlight' or 'note'
    page: Optional[int] = None
    paragraph: Optional[str] = None
    rects: Optional[list[Rect]] = None
    note_text: Optional[str] = None


class MessageAnnotationCreate(BaseModel):
    message_id: int
    kind: str  # 'highlight' or 'note'
    start_offset: int
    end_offset: int
    selected_text: str
    note_text: Optional[str] = None


class ReplyRequest(BaseModel):
    conversation_id: int
    question: str
    quote: Optional[str] = None  # optional snippet being quoted from prior response


class NewAgentRequest(BaseModel):
    description: str


@app.post("/ask")
def ask(req: AskRequest):
    # Resolve "auto" → best-fit agent
    effective_agent_id = req.agent_id
    if effective_agent_id == "auto":
        try:
            effective_agent_id = classify_agent(
                req.question, req.paragraph, req.selected_text, list_agents()
            )
        except Exception as e:
            raise HTTPException(500, f"Agent auto-detect failed: {e}")

    with get_conn() as conn:
        doc = conn.execute(
            "SELECT title, author, full_text FROM documents WHERE id = ?",
            (req.document_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(404, "Document not found")

        history = []
        conv_id = req.conversation_id
        annot_id = None

        if conv_id:
            history_rows = conn.execute(
                "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id",
                (conv_id,),
            ).fetchall()
            history = [dict(r) for r in history_rows]
        else:
            rects_json = (
                json.dumps([r.model_dump() for r in req.rects]) if req.rects else None
            )
            cur = conn.execute(
                """INSERT INTO annotations
                   (document_id, agent_id, page, selected_text, paragraph, rects_json, kind)
                   VALUES (?, ?, ?, ?, ?, ?, 'ask')""",
                (
                    req.document_id,
                    effective_agent_id,
                    req.page,
                    req.selected_text,
                    req.paragraph,
                    rects_json,
                ),
            )
            annot_id = cur.lastrowid
            cur = conn.execute(
                "INSERT INTO conversations (document_id, agent_id, annotation_id) VALUES (?, ?, ?)",
                (req.document_id, effective_agent_id, annot_id),
            )
            conv_id = cur.lastrowid

    # Session resumption for ALL asks on this (doc, agent) pair, not just
    # full-book mode. First call sets the system prompt + persona; every
    # subsequent ask resumes the session — Claude Code re-sends the prior
    # transcript and Anthropic's prompt cache (5-min TTL) keeps that fast.
    # The persona and prior conversation are not re-sent in our user_message.
    existing_session_id = None
    with get_conn() as conn:
        row = conn.execute(
            "SELECT session_id FROM claude_sessions WHERE document_id = ? AND agent_id = ?",
            (req.document_id, effective_agent_id),
        ).fetchone()
        if row:
            existing_session_id = row["session_id"]

    resuming = bool(existing_session_id)
    # On resume, the book + persona + prior history are already in the
    # session — don't re-include them in this turn's message.
    full_book = doc["full_text"] if (req.use_full_book and not resuming) else None

    system_prompt, user_message = assemble_prompt(
        agent_id=effective_agent_id,
        book_title=doc["title"],
        book_author=doc["author"],
        paragraph=req.paragraph,
        selected_text=req.selected_text,
        question=req.question,
        full_book_text=full_book,
        history=history if not resuming else None,
    )

    try:
        answer, session_id, used_web = invoke_claude(
            system_prompt,
            user_message,
            session_id=existing_session_id,
            resume=resuming,
            model=agent_model(effective_agent_id),
        )
    except (subprocess.TimeoutExpired, RuntimeError) as e:
        raise HTTPException(500, f"Agent call failed: {e}")

    # Always persist the session id after the first call so subsequent
    # asks on this (doc, agent) pair can resume.
    if not resuming and session_id:
        with get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO claude_sessions (document_id, agent_id, session_id) VALUES (?, ?, ?)",
                (req.document_id, effective_agent_id, session_id),
            )

    # Store the user-visible short label if provided, else the full prompt.
    # The full prompt is what Claude saw; the display version is what the
    # user sees in the chat thread.
    stored_user_message = req.display_question or req.question

    with get_conn() as conn:
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
            (conv_id, "user", stored_user_message),
        )
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content, used_web) VALUES (?, ?, ?, ?)",
            (conv_id, "assistant", answer, int(used_web)),
        )

    return {
        "answer": answer,
        "conversation_id": conv_id,
        "annotation_id": annot_id,
        "agent_id": effective_agent_id,
        "used_web": used_web,
    }


@app.post("/annotations")
def create_annotation(req: AnnotationCreate):
    """Create a plain highlight or note on a PDF passage — no agent call."""
    if req.kind not in ("highlight", "note"):
        raise HTTPException(400, "kind must be 'highlight' or 'note'")
    rects_json = (
        json.dumps([r.model_dump() for r in req.rects]) if req.rects else None
    )
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO annotations
               (document_id, agent_id, page, selected_text, paragraph, rects_json, kind, note_text)
               VALUES (?, NULL, ?, ?, ?, ?, ?, ?)""",
            (
                req.document_id,
                req.page,
                req.selected_text,
                req.paragraph,
                rects_json,
                req.kind,
                req.note_text,
            ),
        )
    return {"id": cur.lastrowid, "kind": req.kind}


@app.delete("/annotations/{annotation_id}")
def delete_annotation(annotation_id: int):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE annotation_id = ?)",
            (annotation_id,),
        )
        conn.execute("DELETE FROM conversations WHERE annotation_id = ?", (annotation_id,))
        conn.execute("DELETE FROM annotations WHERE id = ?", (annotation_id,))
    return {"ok": True}


@app.post("/message-annotations")
def create_message_annotation(req: MessageAnnotationCreate):
    if req.kind not in ("highlight", "note"):
        raise HTTPException(400, "kind must be 'highlight' or 'note'")
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO message_annotations
               (message_id, kind, start_offset, end_offset, selected_text, note_text)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                req.message_id,
                req.kind,
                req.start_offset,
                req.end_offset,
                req.selected_text,
                req.note_text,
            ),
        )
    return {"id": cur.lastrowid}


@app.get("/message-annotations/doc/{doc_id}")
def list_message_annotations_for_doc(doc_id: str):
    """All message annotations across all conversations for a document."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT ma.id, ma.message_id, ma.kind, ma.start_offset, ma.end_offset,
                      ma.selected_text, ma.note_text, ma.created_at
               FROM message_annotations ma
               JOIN messages m ON m.id = ma.message_id
               JOIN conversations c ON c.id = m.conversation_id
               WHERE c.document_id = ?
               ORDER BY ma.id""",
            (doc_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.delete("/message-annotations/{mid}")
def delete_message_annotation(mid: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM message_annotations WHERE id = ?", (mid,))
    return {"ok": True}


@app.post("/reply")
def reply(req: ReplyRequest):
    """Follow-up question in an existing conversation. Reuses the Claude session
    if full-book mode is active for that conversation's (doc, agent)."""
    with get_conn() as conn:
        conv = conn.execute(
            "SELECT id, document_id, agent_id FROM conversations WHERE id = ?",
            (req.conversation_id,),
        ).fetchone()
        if not conv:
            raise HTTPException(404, "Conversation not found")

        doc = conn.execute(
            "SELECT title, author FROM documents WHERE id = ?",
            (conv["document_id"],),
        ).fetchone()

        history_rows = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id",
            (req.conversation_id,),
        ).fetchall()
        history = [dict(r) for r in history_rows]

        session_row = conn.execute(
            "SELECT session_id FROM claude_sessions WHERE document_id = ? AND agent_id = ?",
            (conv["document_id"], conv["agent_id"]),
        ).fetchone()

    existing_session_id = session_row["session_id"] if session_row else None
    resuming = bool(existing_session_id)

    # Build the user message. If a quote is given, frame it as a quote-reply.
    if req.quote:
        user_message = (
            f'You previously said:\n\n> {req.quote}\n\n'
            f'Follow-up: {req.question}'
        )
    else:
        user_message = req.question

    if resuming:
        # When resuming, Claude Code already has the full transcript — just send the new turn.
        system_prompt = ""  # ignored on resume
        try:
            answer, _, used_web = invoke_claude(
                system_prompt, user_message,
                session_id=existing_session_id, resume=True,
                model=agent_model(conv["agent_id"]),
            )
        except (subprocess.TimeoutExpired, RuntimeError) as e:
            raise HTTPException(500, f"Agent call failed: {e}")
    else:
        # Not resuming — assemble full context with history
        from agent_runner import load_persona, WEB_SEARCH_HINT
        persona = load_persona(conv["agent_id"])
        system_prompt = f"{persona}\n\n---\n\n{WEB_SEARCH_HINT}"
        convo = "\n\n".join(f"[{m['role'].upper()}]\n{m['content']}" for m in history)
        full_user = (
            f"You are continuing a conversation about \"{doc['title']}\".\n\n"
            f"Prior conversation:\n{convo}\n\n---\n\n{user_message}"
        )
        try:
            answer, _, used_web = invoke_claude(
                system_prompt, full_user,
                session_id=None, resume=False,
                model=agent_model(conv["agent_id"]),
            )
        except (subprocess.TimeoutExpired, RuntimeError) as e:
            raise HTTPException(500, f"Agent call failed: {e}")

    with get_conn() as conn:
        user_content = (
            f"[quoting: {req.quote}]\n\n{req.question}" if req.quote else req.question
        )
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
            (req.conversation_id, "user", user_content),
        )
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content, used_web) VALUES (?, ?, ?, ?)",
            (req.conversation_id, "assistant", answer, int(used_web)),
        )
    return {"answer": answer, "conversation_id": req.conversation_id, "used_web": used_web}


@app.post("/agents")
def create_agent(req: NewAgentRequest):
    """Generate a new agent persona from a short description using Claude."""
    try:
        agent_id, name, color, persona_md = draft_agent_persona(req.description)
    except Exception as e:
        raise HTTPException(500, f"Draft failed: {e}")

    filename = f"{agent_id}.md"
    path = AGENTS_DIR / filename
    frontmatter = (
        "---\n"
        f"id: {agent_id}\n"
        f"name: {name}\n"
        f"description: {req.description.strip()[:200]}\n"
        "---\n\n"
    )
    path.write_text(frontmatter + persona_md + "\n")

    add_agent_to_registry(
        agent_id=agent_id,
        name=name,
        color=color,
        filename=filename,
        description=req.description.strip()[:200],
    )
    return {"id": agent_id, "name": name, "color": color}


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    persona: Optional[str] = None
    description: Optional[str] = None


@app.get("/agents/{agent_id}")
def get_agent(agent_id: str):
    """Return the agent's registry entry plus full persona markdown."""
    from agent_runner import load_registry, load_persona
    reg = load_registry()
    entry = next((a for a in reg["agents"] if a["id"] == agent_id), None)
    if not entry:
        raise HTTPException(404, "Agent not found")
    try:
        persona = load_persona(agent_id)
    except Exception:
        persona = ""
    return {
        "id": entry["id"],
        "name": entry["name"],
        "color": entry.get("color", "#888888"),
        "description": entry.get("description", ""),
        "persona": persona,
    }


@app.put("/agents/{agent_id}")
def update_agent(agent_id: str, req: AgentUpdate):
    """Update an existing agent's name, color, and/or persona text."""
    from agent_runner import load_registry
    reg = load_registry()
    entry = next((a for a in reg["agents"] if a["id"] == agent_id), None)
    if not entry:
        raise HTTPException(404, "Agent not found")

    new_name = req.name if req.name is not None else entry["name"]
    new_color = req.color if req.color is not None else entry.get("color", "#888888")
    new_desc = (
        req.description
        if req.description is not None
        else entry.get("description", "")
    )
    filename = entry["file"]
    path = AGENTS_DIR / filename

    if req.persona is not None:
        frontmatter = (
            "---\n"
            f"id: {agent_id}\n"
            f"name: {new_name}\n"
            f"description: {new_desc.strip()[:200] if new_desc else ''}\n"
            "---\n\n"
        )
        path.write_text(frontmatter + req.persona.strip() + "\n")

    add_agent_to_registry(
        agent_id=agent_id,
        name=new_name,
        color=new_color,
        filename=filename,
        description=new_desc,
    )
    return {"id": agent_id, "name": new_name, "color": new_color}


@app.delete("/sessions/{doc_id}/{agent_id}")
def reset_session(doc_id: str, agent_id: str):
    """Forget the Claude session for this (doc, agent). Next full-book ask
    will start fresh (resends the book)."""
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM claude_sessions WHERE document_id = ? AND agent_id = ?",
            (doc_id, agent_id),
        )
    return {"ok": True}


@app.get("/sessions/{doc_id}")
def list_sessions(doc_id: str):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT agent_id, session_id, created_at FROM claude_sessions WHERE document_id = ?",
            (doc_id,),
        ).fetchall()
    return [dict(r) for r in rows]


DEFAULT_HIGHLIGHT_COLOR = "#e8b800"  # yellow for plain user highlights
DEFAULT_NOTE_COLOR = "#4a90e2"       # blue for plain user notes


@app.get("/annotations/{doc_id}")
def list_annotations(doc_id: str):
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT a.id, a.page, a.selected_text, a.rects_json, a.agent_id,
                      a.kind, a.note_text,
                      c.id AS conversation_id
               FROM annotations a
               LEFT JOIN conversations c ON c.annotation_id = a.id
               WHERE a.document_id = ?
               ORDER BY a.id""",
            (doc_id,),
        ).fetchall()
    out = []
    for r in rows:
        rects = json.loads(r["rects_json"]) if r["rects_json"] else []
        kind = r["kind"] or "ask"
        if r["agent_id"]:
            color = agent_color(r["agent_id"])
        elif kind == "note":
            color = DEFAULT_NOTE_COLOR
        else:
            color = DEFAULT_HIGHLIGHT_COLOR
        out.append(
            {
                "id": r["id"],
                "page": r["page"],
                "selected_text": r["selected_text"],
                "rects": rects,
                "agent_id": r["agent_id"],
                "color": color,
                "kind": kind,
                "note_text": r["note_text"],
                "conversation_id": r["conversation_id"],
            }
        )
    return out


@app.get("/conversations/{doc_id}")
def list_conversations(doc_id: str):
    with get_conn() as conn:
        # Order by reading position (page ASC, then rect top) so conversations
        # flow in the same direction the user reads. Conversations without a
        # page fall to the end.
        convs = conn.execute(
            """SELECT c.id, c.agent_id, c.annotation_id, c.created_at,
                      a.selected_text, a.paragraph, a.page, a.rects_json
               FROM conversations c
               LEFT JOIN annotations a ON a.id = c.annotation_id
               WHERE c.document_id = ?
               ORDER BY CASE WHEN a.page IS NULL THEN 1 ELSE 0 END,
                        a.page ASC,
                        c.created_at ASC""",
            (doc_id,),
        ).fetchall()
        out = []
        for c in convs:
            msgs = conn.execute(
                "SELECT id, role, content, used_web, created_at FROM messages WHERE conversation_id = ? ORDER BY id",
                (c["id"],),
            ).fetchall()
            out.append(
                {
                    **dict(c),
                    "color": agent_color(c["agent_id"]),
                    "messages": [dict(m) for m in msgs],
                }
            )
        return out
