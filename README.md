# Nachi

A local-first PDF research environment with scholar-agent chat.

Named after **Naciketas** from the Kaṭha Upaniṣad — the boy who goes to the house of Death and refuses to leave until Death teaches him the real answer. Nachi reads like that: demand real answers, don't accept plausible-sounding evasions, verify.

You read an academic PDF on one side. On the other side, you chat with a scholar — a Literary Theorist, a Historian, a Philosopher, a Religious Studies Scholar, a Paronomaniac, a Willful Misreader, whoever fits the passage. You can highlight, note, and ask. The scholar responds with source attribution (web search vs. model knowledge) so you know whether they looked something up or are working from training. You can edit any scholar's persona, spin up new ones on demand, and ask the same question to multiple scholars at once.

Everything runs locally. Your PDFs, annotations, and conversations stay on your machine. The AI side calls your local [Claude Code](https://docs.anthropic.com/claude/docs/claude-code) CLI as a subprocess — if you have a Claude Max subscription, Nachi's inference costs you nothing beyond that.

## Screenshots

Drop 3–5 screenshots here once you've run it:

- `docs/screenshots/overview-light.png` — split-pane reading + chat, light mode
- `docs/screenshots/overview-dark.png` — same, dark mode
- `docs/screenshots/scholars.png` — scholar dropdown open
- `docs/screenshots/annotation-picker.png` — multi-annotation popover
- `docs/screenshots/editor.png` — scholar editor modal

## Status

**Alpha.** It works for the author's own reading. Interfaces and storage formats may change. Not packaged for end users yet — see [Tauri plans](#shipping).

## Requirements

- **Python 3.11+** (for the backend)
- **Node.js 22.12+** (for the frontend)
- **[Claude Code CLI](https://docs.anthropic.com/claude/docs/claude-code)**, installed and authenticated. Test with `claude --version`.

Tested on macOS (Apple Silicon). Should work on Linux; Windows untested.

## Quick start

```bash
git clone <your-fork-url> nachi
cd nachi

# 1. Backend: set up a Python 3.11 venv at ~/.nachi/venv.
#    Using uv (https://docs.astral.sh/uv/) is easiest:
#    uv python install 3.11
#    uv venv --python 3.11 ~/.nachi/venv
#    Or use your own python3.11 install.
python3.11 -m venv ~/.nachi/venv
~/.nachi/venv/bin/pip install -r backend/requirements.txt

# 2. Frontend: install Node deps.
cd frontend && npm install && cd ..

# 3. Start both servers.
./run.sh
```

Open **http://localhost:5173/** in a browser.

### First steps in the UI

1. Click **+ Upload** in the top bar, pick a PDF.
2. Select some text. A small popup appears: **Highlight · Note · Ask →**.
3. Pick a scholar from the dropdown (upper right of chat pane) and click **Ask**.
4. Chat appears anchored to the passage. Highlights in the PDF are clickable — click one to jump back to the conversation. Multiple annotations on the same text → picker menu.
5. **✎ Annotations** button in the top bar opens a drawer with all your highlights, notes, and response-annotations, copy/export as `.txt`.
6. **Moon / sun icon** on the right: toggle light / dark mode.

### Background on "scholars"

Nachi's scholars are **personas** (system prompts), not full agents — they have a voice and web-search access but no persistent tool inventory. The `backend/agents/` directory has one `.md` file per scholar plus `registry.yaml`. Edit them directly or use the in-app **✎** editor next to the dropdown. Current roster includes academic scholars (Religious Studies, Literary Theorist, Philosopher, Historian, Sociologist, Anthropologist, DH, Religious Media Theorist, Western Esotericism), a Generalist (just Claude, no framing), and a handful of playful ones (The Jester, The Rabbit-Hole, The Willful Misreader, The Paronomaniac, The Lechturer, The Crank).

## Architecture (short version)

```
PDF viewer (react-pdf + pdf.js) ────┐
                                    ├──► FastAPI backend ──► claude CLI
Chat pane + annotation layer ───────┘        │
                                             ▼
                                       ~/.nachi/nachi.db (SQLite)
                                       ~/.nachi/pdfs/   (uploaded PDFs)
```

- **Backend**: FastAPI + SQLite + PyMuPDF (text extraction). `backend/main.py` has the routes; `backend/agent_runner.py` spawns `claude -p … --output-format json`, supports session resumption for full-book caching.
- **Frontend**: Vite + React 19 + `react-pdf`. Local state, no backend auth.
- **Storage**: all local, under `~/.nachi/` (override with `NACHI_DATA_DIR`). Nothing cloud, no telemetry.

More on the vision and the pieces that aren't yet built: see [`research-env-architecture.md`](research-env-architecture.md). Aesthetic direction and the threshold-motif hero: see [`design/DIRECTION.md`](design/DIRECTION.md) and open [`design/hero-light.html`](design/hero-light.html) in a browser.

## Data location

By default:
- SQLite DB: `~/.nachi/nachi.db`
- Uploaded PDFs: `~/.nachi/pdfs/`
- Python venv: `~/.nachi/venv/`
- Frontend `node_modules`: `frontend/node_modules` (symlink if you want to keep heavy deps off a synced folder — see [Google Drive workaround](#google-drive-workaround))

Override the data root with `NACHI_DATA_DIR=/some/path ./run.sh`.

## Google Drive workaround

If your project dir lives on Google Drive / Dropbox / iCloud, SQLite and Vite both hang on the file-lock dance that cloud storage does. The fix is to keep the heavy dev state *off* the synced folder:

```bash
# One-time: put node_modules under ~/.nachi and symlink into the project.
mkdir -p ~/.nachi/frontend-cache
cp frontend/package.json frontend/package-lock.json ~/.nachi/frontend-cache/
(cd ~/.nachi/frontend-cache && npm install)
rm -rf frontend/node_modules
ln -s ~/.nachi/frontend-cache/node_modules frontend/node_modules
```

The venv already lives at `~/.nachi/venv/` by default, so no action needed there.

## Shipping

This is an alpha you clone and run. The plan for real distribution:

- **Tauri desktop app** — wrap the current webapp, bundle a Python sidecar (PyInstaller), detect / prompt-install Claude Code. Single `.dmg` / `.msi` / `.AppImage`.

Not there yet. PRs welcome.

## Design

`design/hero-light.html` and `design/hero.html` are standalone single-page mockups exploring the *threshold* motif (Naciketas at Yama's door, the three fires, ignitable scholars). They're the design language guide — open them in a browser.

Palette / type / motif decisions live in `design/DIRECTION.md`. The light-touch punch list for applying the aesthetic to the app is in `design/SWAP_IN.md`.

## Acknowledgments

Built collaboratively with Claude. Visual direction by Claude's `tvashtr` subagent.

## License

MIT — see [`LICENSE`](LICENSE).
