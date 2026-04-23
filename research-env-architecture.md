# Nachi — Architecture & Design Notes

## Vision
**Nachi** (from Naciketas, Kaṭha Upaniṣad) — a local-first, Zotero-like PDF
research environment with AI agent integration. Named for the young questioner
who refused easy answers and kept pressing until he reached the real teaching.

Highlight passages, annotate, and invoke specialized domain-scholar agents — all
with persistent memory that grows across sessions and documents.

---

## Core Interaction Model

### PDF Pane (left)
- **pdf.js** for rendering (Mozilla's PDF viewer, battle-tested)
- Custom annotation layer on top:
  - Text highlights (colored by agent or purpose)
  - Margin notes (your own + agent-generated)
  - Anchored conversations — a highlight links to its chat thread
- Multi-document: tabbed or sidebar library view
- Text selection triggers a floating toolbar: "Ask Agent" / "Annotate" / "Copy"

### Chat Pane (right)
- Agent selector dropdown/tabs at top
- Threaded conversation, Slack-style
- Passage references inline — clickable back-links to the highlight in the PDF
- Free-form typing for sustained conversation
- "Project mode" toggle: agent sees all loaded docs, not just current one

### Annotation ↔ Chat linkage
- Every agent invocation anchored to a passage gets a bidirectional link:
  - In PDF: highlight has a small icon/badge showing it has a conversation
  - In chat: message shows the quoted passage with page/line reference
- Agent responses can optionally be pinned back as margin annotations

---

## Agent Design

### Domain-first architecture

Agents are **domain scholars**, not task types. Each agent is a full persona
defined by your existing CLAUDE.md files. All agents share a common set of
capabilities (close reading, synthesis, argumentation, bibliography) — but
each executes those capabilities through their domain's lens.

Task mode is **implicit** — inferred from conversational context, never
explicitly selected. You talk to the scholar; they figure out what you need.

### Agent config structure
```
agents/
├── base_capabilities.md         # Shared sub-config appended to ALL agents
├── dh_researcher.md             # Domain CLAUDE.md (your existing file)
├── rel_studies_scholar.md       # Domain CLAUDE.md (your existing file)
├── [future_agents].md           # Drop in new .md files to add agents
└── agent_registry.yaml          # Name, description, .md path per agent
```

### base_capabilities.md (appended to every domain persona)
This file defines HOW every agent performs the four core tasks, regardless
of domain. It should include:

1. **Close reading protocol**
   - Always reference passages by page number + opening/closing words
   - Attend to rhetorical structure, not just content
   - Flag ambiguities and interpretive crux points

2. **Cross-text synthesis protocol**
   - When multiple documents are in context, identify convergences and tensions
   - Map argumentative structures across texts
   - Note methodological differences between authors

3. **Adversarial argumentation protocol**
   - Infer target from context: if the user asserts, push back on the user;
     if the user asks "is this sound?", push back on the author
   - Steel-man before attacking — show you understand the position
   - Ground objections in the domain's evidentiary standards

4. **Bibliography / citation tracing protocol**
   - Identify cited works and their role in the argument
   - Note missing citations (who SHOULD be cited but isn't?)
   - Suggest related work the user may not know

### Optional task mode modifier
Task mode is inferred by default ("Auto") but can be explicitly pinned
for clarity — useful for demos, new users, or when you want to force
a specific analytical lens.

**UI:** Small chip bar below the agent selector:
  `[Auto] [Close Reading] [Synthesis] [Adversarial] [Bibliography]`

- **Auto (default):** No modifier sent. Agent infers task from conversation.
- **Pinned mode:** Prepends a task emphasis block to the system prompt:
  "The user has explicitly requested [mode] — prioritize this analytical
  approach while maintaining your domain perspective."

This is invisible to power users (just leave it on Auto) but makes the
system's capabilities legible to new users or in a demo context.
A religious studies scholar doing adversarial argumentation will invoke
different standards of evidence, different canonical references, and different
theoretical frameworks than a DH researcher. The domain IS the agent.
Task instructions are shared plumbing; the persona determines the output.

### System prompt assembly (per request):
```
[Domain CLAUDE.md — the full persona]
[base_capabilities.md — shared task protocols]
[Full document text OR relevant chunks if too long]
[Your annotations/highlights on this document]
[Conversation history for this agent + document]
[If project mode: summaries of other loaded documents]
[If memory is large: RAG-retrieved relevant prior conversations]
```

### Cross-agent awareness
- Agents know other agents exist (listed in base_capabilities.md)
- Agents can reference another agent's prior observations via RAG retrieval
  (e.g., "Your DH researcher noted X about this passage — from my disciplinary
  perspective, I'd push back on that because...")
- This happens through retrieved context, not by dumping full cross-agent history

### Adding new agents
1. Write a new CLAUDE.md file with the domain persona
2. Add an entry to agent_registry.yaml
3. Restart the backend — new agent appears in the UI
No code changes needed.

---

## Tech Stack

### Frontend
- **React** (Vite) — runs at localhost:5173 or similar
- **react-pdf** or raw **pdf.js** for PDF rendering
  - react-pdf wraps pdf.js, easier to start with
  - May need to drop to raw pdf.js for custom annotation layer
- **Annotation layer options:**
  - **Hypothes.is client** (open source) — very mature, but heavy to integrate
  - **Custom canvas/SVG overlay** — more control, more work
  - **pdf-annotate.js** — lighter weight, may be sufficient
  - Recommendation: start with react-pdf + custom highlight overlay using
    DOM positioning based on pdf.js text layer coordinates
- **Chat UI:** roll your own with a simple message list + input box
  - Don't over-engineer — a scrollable div with messages is fine
  - Use markdown rendering (react-markdown) for agent responses
- **State management:** Zustand or just React context — don't need Redux

### Backend
- **FastAPI (Python)** — lightweight, async, easy to extend
  - Endpoints: /documents, /annotations, /conversations, /agents/invoke
  - PDF text extraction: **PyMuPDF (fitz)** — fast, reliable, preserves layout
  - Serves the React frontend in production (or separate dev servers)
- **Alternative: Node/Express** if you prefer JS everywhere
  - PDF extraction: pdf-parse or pdf.js server-side

### LLM Integration (Claude Code CLI)
- **Subprocess approach:**
  ```python
  import subprocess
  result = subprocess.run(
      ["claude", "--print", "--system-prompt", agent_system_prompt],
      input=assembled_context,
      capture_output=True, text=True
  )
  response = result.stdout
  ```
- `--print` flag gives you non-interactive output
- `--system-prompt` lets you pass the agent persona
- Pass document + annotations + history via stdin
- **Session management:** Claude Code can maintain conversation with `--conversation`
  flag (check current CLI docs) — this could help with sustained conversations
  without re-sending full history

#### CLI caveats to watch:
- Subprocess spawning adds latency (~2-5s startup per call)
- No streaming to the frontend without extra work (WebSockets + chunked reading)
- Rate limits: Max plan has per-conversation limits, not per-minute API limits
  — but rapid successive calls could still hit throttling
- If Claude Code CLI changes flags/behavior, your integration breaks
  — pin a version and document the expected interface

#### Future option: switch to API
- Design the LLM layer as a clean interface (e.g., `invoke_agent(agent_id, context)`)
- Implementation can swap from CLI subprocess to API HTTP call without touching
  the rest of the app
- If CLI gets too painful, switching to API ($3/M input, $15/M output for Sonnet)
  would cost roughly $0.50-2.00 per deep 250k-token session

### Storage

#### SQLite (via **sqlite3** or **SQLAlchemy**)
```sql
-- Core tables
documents (id, title, filepath, full_text, added_at, metadata_json)
annotations (id, document_id, page, start_offset, end_offset, highlighted_text,
             user_note, color, created_at)
conversations (id, document_id, agent_id, project_id, created_at)
messages (id, conversation_id, role, content, annotation_id, created_at)
projects (id, name, created_at)
project_documents (project_id, document_id)

-- Memory / knowledge base
embeddings (id, source_type, source_id, chunk_text, embedding_vector, created_at)
-- source_type: 'annotation', 'message', 'document_chunk'
-- source_id: references the relevant table
```

#### Vector search for RAG
- **Option A: sqlite-vss** — SQLite extension for vector similarity search
  - Pro: single DB file, no extra services
  - Con: less mature, limited to ~100k vectors efficiently
- **Option B: ChromaDB** — local-first vector DB, Python-native
  - Pro: easy API, handles embedding + retrieval
  - Con: separate process, another dependency
- **Option C: FAISS** — Facebook's vector library
  - Pro: very fast, well-proven
  - Con: more manual setup, no persistence built in (save/load index files)
- **Recommendation:** ChromaDB for simplicity, or sqlite-vss if you want
  everything in one file

#### Local embeddings
- **sentence-transformers** (`all-MiniLM-L6-v2`) — runs on CPU, ~80MB model
- Embed: document chunks, annotations, key agent responses
- At query time: embed the current passage/question, retrieve top-k similar
  items from the knowledge base, inject into agent context

---

## Data Flow Examples

### Flow 1: Highlight → Ask Close Reader
1. User highlights passage on page 7
2. Frontend sends: { text, page, offsets } → POST /annotations
3. Frontend sends: { annotation_id, agent: "close_reader" } → POST /agents/invoke
4. Backend assembles context:
   - Close reader system prompt
   - Full document text (or chunks around the passage)
   - User's other annotations on this document
   - Last N messages from close reader conversation on this doc
   - RAG: any related prior close readings from other docs
5. Backend spawns Claude Code CLI with assembled context
6. Response saved as message linked to annotation
7. Frontend shows response in chat pane, adds badge to highlight in PDF

### Flow 2: Sustained adversarial argument
1. User types freely in chat panel with Adversary selected
2. Backend sends: full conversation history + document + annotations
3. As conversation grows past ~100k tokens:
   - Backend summarizes older messages (could use Claude for this too)
   - Keeps recent messages verbatim + summary of earlier discussion
   - RAG retrieval for any referenced passages or prior arguments
4. Conversation persists in DB, resumable next session

### Flow 3: Cross-document synthesis
1. User has 3 papers loaded in a project
2. Selects Synthesizer agent, project mode ON
3. Backend assembles:
   - Full text of current paper
   - Summaries + key annotations from other 2 papers
   - Any prior synthesizer conversations in this project
4. User asks: "How does Author B's framework challenge what Author A assumes?"
5. Agent responds with references to specific passages in both papers
6. Frontend renders with clickable links to each passage in each PDF

---

## Build Order (suggested)

### Phase 1: Skeleton (weekend)
- [ ] Vite + React app with split pane layout
- [ ] pdf.js rendering a hardcoded PDF
- [ ] Basic chat panel (input + message list, no LLM yet)
- [ ] FastAPI backend with document upload endpoint
- [ ] SQLite schema created

### Phase 2: Annotations + Agent invocation (week 1)
- [ ] Text selection → highlight creation
- [ ] Highlights persisted to DB and re-rendered on load
- [ ] Claude Code CLI integration (single agent, close reader)
- [ ] Agent responses displayed in chat, linked to highlights
- [ ] Basic conversation persistence

### Phase 3: Multi-agent + multi-document (week 2)
- [ ] Agent selector UI
- [ ] All 4 agents wired up with their system prompts
- [ ] Document library sidebar
- [ ] Project grouping
- [ ] Cross-document context assembly for synthesizer

### Phase 4: Memory + RAG (week 3)
- [ ] Local embeddings pipeline (sentence-transformers)
- [ ] ChromaDB or sqlite-vss integration
- [ ] Automatic embedding of annotations and key messages
- [ ] RAG retrieval injected into agent context
- [ ] Conversation summarization for long sessions

### Phase 5: Polish (ongoing)
- [ ] Streaming responses (WebSocket)
- [ ] Better annotation UX (colors, categories, search)
- [ ] Export annotations + conversations as markdown
- [ ] Keyboard shortcuts
- [ ] Dark mode (you're going to want this for long reading sessions)

---

## Key Design Decisions to Make

1. **react-pdf vs raw pdf.js** — start with react-pdf, drop down if annotation
   layer needs more control

2. **Conversation context strategy** — when does summarization kick in?
   Suggestion: keep last 50 messages verbatim, summarize everything older,
   always include RAG-retrieved relevant context. Total context target: ~80k tokens
   per agent call to leave room for response.

3. **Agent awareness of each other** — should agents see each other's conversations?
   Recommendation: yes, but via RAG retrieval, not by dumping full cross-agent
   history. The synthesizer's system prompt should instruct it to reference
   insights from other agents when retrieved.

4. **Annotation schema** — W3C Web Annotation model is overkill but worth knowing
   about. Your schema above is simpler and sufficient. Key: store character offsets
   relative to extracted text so highlights survive re-renders.

5. **CLI vs API escape hatch** — wrap all LLM calls in a clean interface:
   ```python
   class AgentRunner:
       def invoke(self, agent_id: str, context: str) -> str: ...
   
   class CLIAgentRunner(AgentRunner): ...   # subprocess
   class APIAgentRunner(AgentRunner): ...   # HTTP to Anthropic API
   ```
   Start with CLI. Swap later if needed. No other code changes.

---

## File Structure
```
nachi/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PDFViewer.jsx
│   │   │   ├── AnnotationLayer.jsx
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── AgentSelector.jsx
│   │   │   ├── DocumentLibrary.jsx
│   │   │   └── ProjectSidebar.jsx
│   │   ├── stores/          # Zustand stores
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── routes/
│   │   │   ├── documents.py
│   │   │   ├── annotations.py
│   │   │   ├── conversations.py
│   │   │   └── agents.py
│   │   ├── services/
│   │   │   ├── agent_runner.py    # CLI/API abstraction
│   │   │   ├── context_builder.py # Assembles agent context
│   │   │   ├── pdf_extractor.py
│   │   │   ├── embeddings.py
│   │   │   └── memory.py          # RAG retrieval
│   │   ├── models/           # SQLAlchemy models
│   │   └── db.py
│   ├── agents/               # Your CLAUDE.md files go here
│   │   ├── base_capabilities.md   # Shared sub-config for all agents
│   │   ├── dh_researcher.md       # Domain persona
│   │   ├── rel_studies_scholar.md  # Domain persona
│   │   └── agent_registry.yaml    # Agent name, description, .md path
│   └── requirements.txt
├── data/                     # SQLite DB + ChromaDB files
└── README.md
```
