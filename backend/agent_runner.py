import json
import subprocess
import uuid
import yaml
from pathlib import Path
from functools import lru_cache

AGENTS_DIR = Path(__file__).parent / "agents"

WEB_SEARCH_HINT = """You have access to WebSearch and WebFetch tools. Use them when:
- The user asks about recent scholarship (2024 or later) that may post-date your training
- The user asks whether a specific scholar has engaged with an idea and you're unsure about their recent work
- You want to verify a specific claim about a publication, title, or date
- The question touches on an ongoing debate where current position matters

Do not use web search for established historical facts, well-known texts, or figures whose scholarly reception is stable. Use it sparingly and cite what you find concretely (title, author, venue, year)."""


@lru_cache(maxsize=1)
def load_registry():
    with open(AGENTS_DIR / "registry.yaml") as f:
        return yaml.safe_load(f)


def list_agents():
    # Bust the cache so newly created agents appear without a restart.
    load_registry.cache_clear()
    reg = load_registry()
    return [
        {
            "id": a["id"],
            "name": a["name"],
            "color": a.get("color", "#888888"),
            "description": a.get("description", ""),
        }
        for a in reg["agents"]
    ]


def add_agent_to_registry(agent_id: str, name: str, color: str, filename: str, description: str = "") -> None:
    """Append an agent entry to registry.yaml and clear caches."""
    registry_path = AGENTS_DIR / "registry.yaml"
    with open(registry_path) as f:
        reg = yaml.safe_load(f) or {"agents": []}
    # Replace existing entry with same id if present
    reg["agents"] = [a for a in reg["agents"] if a["id"] != agent_id]
    entry = {"id": agent_id, "name": name, "file": filename, "color": color}
    if description:
        entry["description"] = description
    reg["agents"].append(entry)
    with open(registry_path, "w") as f:
        yaml.safe_dump(reg, f, sort_keys=False)
    load_registry.cache_clear()
    load_persona.cache_clear()


def agent_color(agent_id: str) -> str:
    reg = load_registry()
    for a in reg["agents"]:
        if a["id"] == agent_id:
            return a.get("color", "#888888")
    return "#888888"


@lru_cache(maxsize=16)
def load_persona(agent_id: str) -> str:
    reg = load_registry()
    for a in reg["agents"]:
        if a["id"] == agent_id:
            path = AGENTS_DIR / a["file"]
            text = path.read_text()
            if text.startswith("---"):
                parts = text.split("---", 2)
                if len(parts) >= 3:
                    return parts[2].strip()
            return text.strip()
    raise ValueError(f"Unknown agent: {agent_id}")


def assemble_prompt(
    agent_id: str,
    book_title: str | None,
    book_author: str | None,
    paragraph: str | None,
    selected_text: str,
    question: str,
    full_book_text: str | None = None,
    history: list[dict] | None = None,
) -> tuple[str, str]:
    """Return (system_prompt, user_message)."""
    persona = load_persona(agent_id)
    system_prompt = f"{persona}\n\n---\n\n{WEB_SEARCH_HINT}"

    meta_lines = []
    if book_title:
        meta_lines.append(f"Book: {book_title}")
    if book_author:
        meta_lines.append(f"Author: {book_author}")
    meta = "\n".join(meta_lines) if meta_lines else "(no document metadata provided)"

    parts = [f"The user is reading the following text.\n\n{meta}"]

    if full_book_text:
        parts.append(
            "Full document text (use this to answer in-text questions like "
            "'does the author mention X elsewhere' or 'how does this relate to "
            "chapter N'):\n\n"
            f"\"\"\"\n{full_book_text}\n\"\"\""
        )

    parts.append(
        f"Paragraph containing the passage they asked about:\n"
        f"\"\"\"\n{paragraph or '(no surrounding paragraph provided)'}\n\"\"\""
    )
    parts.append(f'Selected passage: "{selected_text}"')
    parts.append(f"Question: {question}")

    user_message = "\n\n".join(parts)

    if history:
        convo = "\n\n".join(
            f"[{m['role'].upper()}]\n{m['content']}" for m in history
        )
        user_message = f"Prior conversation:\n{convo}\n\n---\n\n{user_message}"

    return system_prompt, user_message


def invoke_claude_oneshot(system_prompt: str, user_message: str, timeout: int = 60) -> str:
    """Fast one-shot call with no tools, no session. For internal utility calls
    (classification, persona drafting) — not user-facing answers."""
    result = subprocess.run(
        [
            "claude", "-p", user_message,
            "--output-format", "json",
            "--append-system-prompt", system_prompt,
            "--allowed-tools", "",
        ],
        capture_output=True, text=True, timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(f"claude CLI failed: {result.stderr}")
    data = json.loads(result.stdout)
    if data.get("is_error"):
        raise RuntimeError(f"claude reported error: {data.get('result')}")
    return data["result"].strip()


def classify_agent(
    question: str,
    paragraph: str | None,
    selected_text: str,
    candidates: list[dict],
) -> str:
    """Pick the best agent id for this question. Returns agent id string."""
    persona_lines = "\n".join(
        f"- {a['id']}: {a['name']} — {a.get('description', '')}" for a in candidates
    )
    system = "You route questions to the best-fit scholar. Reply with ONLY the agent id from the list, no explanation."
    user = f"""Available agents:
{persona_lines}

The user is reading a text. The paragraph contains: "{(paragraph or '')[:600]}"
They selected: "{selected_text}"
Their question: {question}

Which agent id fits best? Reply with only the id."""
    raw = invoke_claude_oneshot(system, user, timeout=30)
    # Response might be "religious_studies" or ` religious_studies ` or with backticks
    id_ = raw.strip().strip("`\"'").split()[0].split("\n")[0]
    valid = {a["id"] for a in candidates}
    return id_ if id_ in valid else candidates[0]["id"]


def draft_agent_persona(description: str) -> tuple[str, str, str, str]:
    """Use Claude to draft a full agent persona from a short description.
    Returns (id, name, color, markdown_content)."""
    system = """You are drafting a domain-scholar persona for a research reading tool. The user gives a short description. Produce a full persona in the style of a specialist scholar.

Output format — exactly this, no code fences, no preamble:

ID: <slug_snake_case>
NAME: <display name, e.g. "Media Theorist">
COLOR: <hex color code, distinct and readable, not too close to #d97a3c or #8a5cb8>
PERSONA:
<400-600 words of persona text. Write in second person ("You are..."). Establish the scholar's training, home literature, canonical debates they care about, what concrete moves they make when asked about a figure/concept/text. Give them teeth — no hedging, no both-sides-ism. Include at least 5 specific scholar names and/or works they'd reference.>"""

    user = f"Draft a persona for: {description.strip()}"
    raw = invoke_claude_oneshot(system, user, timeout=60)

    lines = raw.strip().split("\n")
    id_ = ""
    name = ""
    color = "#6b8e7e"
    persona_lines = []
    mode = "header"
    for line in lines:
        if mode == "header":
            if line.startswith("ID:"):
                id_ = line[3:].strip().strip("`\"' ").lower()
                id_ = "".join(c if c.isalnum() or c == "_" else "_" for c in id_)
            elif line.startswith("NAME:"):
                name = line[5:].strip().strip("`\"' ")
            elif line.startswith("COLOR:"):
                c = line[6:].strip().strip("`\"' ")
                if c.startswith("#") and len(c) in (4, 7):
                    color = c
            elif line.strip().upper() == "PERSONA:":
                mode = "persona"
        else:
            persona_lines.append(line)
    persona_md = "\n".join(persona_lines).strip()
    if not id_ or not name or not persona_md:
        raise RuntimeError(f"Failed to parse drafted persona: {raw[:300]}")
    return id_, name, color, persona_md


def invoke_claude(
    system_prompt: str,
    user_message: str,
    session_id: str | None = None,
    resume: bool = False,
    timeout: int = 300,
    allow_web: bool = True,
) -> tuple[str, str, bool]:
    """One-shot Claude Code invocation. Returns (answer, session_id, used_web).

    used_web is True if WebSearch or WebFetch made any requests this turn.
    If resume=True and session_id is given, resumes that session — Claude Code
    reconstructs the transcript locally and re-sends it with prompt caching.
    If session_id is given without resume, pins the new session to that UUID.
    """
    cmd = ["claude", "-p", user_message, "--output-format", "json"]

    if resume and session_id:
        cmd += ["--resume", session_id]
    else:
        sid = session_id or str(uuid.uuid4())
        cmd += ["--session-id", sid, "--append-system-prompt", system_prompt]

    if allow_web:
        cmd += ["--allowed-tools", "WebSearch,WebFetch"]

    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=timeout
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"claude CLI failed (code {result.returncode}): {result.stderr}"
        )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"claude returned non-JSON: {result.stdout[:200]}") from e

    if data.get("is_error"):
        raise RuntimeError(f"claude reported error: {data.get('result')}")

    server_tools = (data.get("usage") or {}).get("server_tool_use") or {}
    used_web = (
        (server_tools.get("web_search_requests") or 0) > 0
        or (server_tools.get("web_fetch_requests") or 0) > 0
    )

    return data["result"].strip(), data["session_id"], used_web
