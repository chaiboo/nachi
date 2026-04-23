# Nachi — Swap-in punch list (light-touch)

Superficial pass only. Layout, minimalism, and chrome structure stay. Palette, type, and small motif elements change. Anything that would re-theme chrome to dark (top bar, PDF pane ground, annotations drawer header, popup toolbar) is out of scope here — see DIRECTION.md if you ever want the full redesign.

Ordered so the first four items give you the biggest visual shift without touching any component structure. Everything after #4 is optional polish.

---

## 1. Replace the token block (biggest single change)

`src/App.css` lines 1–10 and `src/index.css` lines 9–13.

Swap the `:root` block. No class names change, so the visual rotation is instant.

```css
/* App.css :root — replace lines 1–10 */
:root {
  /* Threshold palette — light mode */
  --pyre: #D6351C;         /* deeper vermilion, survives on white */
  --pyre-ink: #A72713;     /* for body-adjacent small type */
  --ember: #E08A1E;        /* saffron, not crayon */
  --gold: #C7951C;         /* old-gold highlight */
  --yama: #1B1C22;         /* reserved for rules, ink, logo marks */

  /* Surfaces */
  --bg: #FFFFFF;           /* pure white — no cream, no parchment */
  --bg-chat: #FFFFFF;
  --page: #FFFFFF;
  --bg-warm: #FFF6EE;      /* pale ember wash for ask-form / quote grounds */

  /* Text */
  --ink: #15161B;
  --ink-muted: #6B7280;
  --ink-inverse: #FFFFFF;

  /* Rules */
  --rule: #E3E0D9;
  --rule-hard: #1B1C22;    /* for the single hairline under the doc-bar */

  /* Agent accents */
  --kalpa: #3D4BC7;        /* cobalt — web source badge */
  --soma: #6A4DC4;
  --vayu: #1F8E80;

  /* Backward-compat aliases */
  --accent: var(--pyre);
  --accent-soft: #FFF0E8;  /* pale ember for ask-form, replaces #f0e4da */
  --highlight: #FFE27A;    /* saffron highlight, replaces #fff2c2 */
}
```

Add this to the top of `index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Source+Serif+4:opsz,wght@8..60,300..700&family=JetBrains+Mono:wght@400..600&display=swap');
```

Update `index.css` body (lines 9–13):

```css
body {
  font-family: 'Source Serif 4', Charter, Georgia, serif;
  background: var(--bg);
  color: var(--ink);
}
```

After this step alone, the app already looks different — vermilion accents, cooler ink, pure white ground.

## 2. Typography — one display rule, no JSX changes

Paste at the bottom of `App.css`. Routes Fraunces to display type and JetBrains Mono to all-caps labels through existing class names.

```css
.doc-brand,
.ann-header h3,
.modal h3 {
  font-family: 'Fraunces', 'Source Serif 4', Charter, Georgia, serif;
  font-variation-settings: 'SOFT' 30;
  font-weight: 500;
}

.agent-label,
.anchor-label,
.quote-label,
.ann-section h4 {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.14em;
}
```

Combined with #1 this is where the app starts *feeling* like Nachi.

## 3. Agent dot becomes agent flame

`src/App.css` lines 660–665. Replace the 8px disc with a flame glyph via CSS mask — inherits the agent color, no SVG components needed.

```css
.msg-agent-dot {
  display: inline-block;
  width: 10px;
  height: 13px;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 18'><path d='M 7 17 C 2 15 1 11 4 6 C 5 9 7.5 8 6 3 C 10 5 12 10 11 14 C 10 16.5 8.5 17.5 7 17 Z'/></svg>") center/contain no-repeat;
          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 18'><path d='M 7 17 C 2 15 1 11 4 6 C 5 9 7.5 8 6 3 C 10 5 12 10 11 14 C 10 16.5 8.5 17.5 7 17 Z'/></svg>") center/contain no-repeat;
  vertical-align: -2px;
}
```

Every message already has an agent color. The flame inherits it. This is the single most recognizable motif from the hero, and it costs one rule.

## 4. Source badges — make the hierarchy visible

`src/App.css` lines 667–688. Most ethically-loaded component in the app. Rewrite so web-sourced vs. model-only reads at a glance.

```css
.src-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: lowercase;
}

.src-web {
  background: var(--kalpa);
  color: #fff;
  border: 1px solid var(--kalpa);
}

.src-model {
  background: transparent;
  color: var(--ink-muted);
  border: 1px solid currentColor;
}
```

In `ChatPanel.jsx` line 330–331, replace the emoji badges with text:

```jsx
{m.used_web ? 'web' : 'model only'}
```

Filled cobalt vs. outline grey carries the meaning. No emoji.

---

*Stop here and look at it.* Items 1–4 together do ~80% of the visual work without touching any layout, chrome color, or component structure.

---

## 5. Highlights become ember, not muted yellow

`src/App.css` lines 343–346 (`.highlight-rect.focus`):

```css
.highlight-rect.focus {
  box-shadow: 0 0 0 2px var(--pyre), 0 0 14px rgba(214, 53, 28, 0.45);
  animation: hl-pulse 1s ease-out 2;
}
```

In-message inline highlight (lines 420–425):

```css
.msg-highlight {
  background: rgba(224, 138, 30, 0.32);   /* ember */
  border-bottom: 1px solid var(--pyre);
  padding: 0 1px;
  border-radius: 1px;
}
```

## 6. Conversation anchor — doorframe motif

`src/App.css` lines 601–614 — `.conv-anchor`. Add a right rule matching the left so it reads as a doorframe, not just a left-bordered block.

```css
.conv-anchor {
  display: block;
  width: 100%;
  background: transparent;
  border: none;
  border-left: 2px solid var(--accent);
  border-right: 2px solid var(--accent);        /* NEW */
  padding: 0.6rem 0.9rem;
  margin-bottom: 0.75rem;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}

.conv-anchor:hover { background: rgba(214, 53, 28, 0.04); }
```

In `ChatPanel.jsx` line 288:

```jsx
style={{ borderLeftColor: c.color || '#888', borderRightColor: c.color || '#888' }}
```

## 7. Ask form — vermilion left rule

`src/App.css` lines 708–714 — `.ask-form`. The `--accent-soft` token rotation already warms the ground; this tightens the rule.

```css
.ask-form {
  background: var(--accent-soft);
  border: 1px solid var(--rule);
  border-left: 3px solid var(--pyre);
  border-radius: 0 6px 6px 0;
  padding: 0.9rem 1rem;
  margin-bottom: 1rem;
}

.ask-form textarea:focus {
  outline: none;
  border-color: var(--pyre);
  box-shadow: 0 0 0 2px rgba(214, 53, 28, 0.18);
}
```

Keep `note-form`'s blue left rule as-is. Blue = *note* in this app and that distinction is useful.

## 8. The refusal mark (highest-ethic polish)

Not in the current CSS. Add:

```css
.msg-refusal {
  position: relative;
  padding-left: 0.9rem;
}
.msg-refusal::before {
  content: '';
  position: absolute;
  left: 0; top: 0.3em; bottom: 0.3em;
  width: 2px;
  background: var(--pyre);
}
```

In `ChatPanel.jsx`, when rendering an assistant message whose content matches refusal markers, add the class:

```jsx
<div
  className={`msg-assistant-text${isRefusal(m) ? ' msg-refusal' : ''}`}
  onMouseUp={(e) => handleMessageMouseUp(m.id, e)}
>
```

Helper:

```js
const REFUSAL_RX = /(i (?:don'?t|do not) know|no (?:primary )?sources?|declin(?:e|ing)|cannot confirm|unverified)/i;
function isRefusal(m) {
  return !m.used_web && REFUSAL_RX.test(m.content || '');
}
```

The app visually honors refusal the way the story does. Single most on-brand detail.

---

## Out of scope (now)

These items from earlier drafts are cut for the light-touch pass. They re-theme chrome to dark and would change the structural feel of the app:

- **Dark threshold top bar (`.doc-bar` as `--yama`)** — too heavy without redesigning the pane below it. Top bar stays white with a vermilion hairline instead (the token rotation already gives you that via `--accent`).
- **Dark PDF pane ambient** — the "bright page in a dark room" move. Beautiful but changes the reading ground's temperature. Not a palette swap.
- **Inverted annotations drawer header** — same reason as the top bar.
- **Dark popup toolbar restyle** — the popup is fine as-is under the new palette.

If any of these start calling to you after living with 1–8 for a week, they're documented in DIRECTION.md as the aspirational version.

## Don't touch

- Component structure.
- `PDFViewer.jsx` rendering logic.
- `api.js`, backend.
- `note-form` blue left rule (keep it — blue = note).

## Order of operations

1. **Item 1** (tokens) — 10 minutes, biggest visual delta.
2. **Item 2** (typography routing) — 5 minutes, display type wakes up.
3. **Item 3** (flame glyph) — 5 minutes, motif lands.
4. **Item 4** (source badges) — 10 minutes, ethical hierarchy legible.
5. *Look at it. Decide if you want to go further.*
6. Items 5–8 — polish, any order, ~30 minutes total.

Full light-touch rotation: about 60 minutes. No component rewrites, no chrome inversions.
