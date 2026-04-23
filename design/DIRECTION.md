# Nachi — Visual Direction

## The through-line

Naciketas is not a reader. He's a child standing at Death's door refusing to leave. He turns down wealth, chariots, kingdoms, heavenly women — everything easy — because he wants the one real answer. The Upanishad gives us the vocabulary to work with:

- **Threshold.** The door of Yama's house. Three nights of waiting.
- **Fire.** The three agnis, the funeral pyre, the inner fire that doesn't go out.
- **Dialogue.** Katha = the told thing, the conversation. Child and Death, back and forth.
- **Refusal.** Preyas vs. śreyas. The pleasing versus the good. Naciketas keeps saying *no, ask again*.
- **Two paths.** The fork is the whole ethic: easy truth vs. hard truth.

A reading app built around this story should not feel cozy. It should feel like standing at a doorway with a clear eye. The previous parchment aesthetic is exactly wrong — it makes the app feel like a library when it should feel like an audience chamber. You're not curled up reading. You're summoning scholars and interrogating them.

**The critique stands: drop the parchment.** No cream, no sepia, no rust-on-beige. A paper-textured "serious reading" app is a dozen other apps. Nachi is a dialogue with specialists. It should look like a **room you summon people into**, not a book you open.

## Palette — "Threshold"

Named after places in the Kaṭha:

| Token | Hex | Role |
|---|---|---|
| `--pyre` | `#E8422C` | primary accent. The Naciketas fire. Vermilion, not rust. Alive. |
| `--ember` | `#F4A73A` | secondary warm. The second fire. Used for highlight, warn, hover. |
| `--gold` | `#F0C44A` | third fire. Sparingly — the agent you're speaking to, a focused state. |
| `--yama` | `#1B1C22` | deep ink near-black. Text, surfaces, UI scaffolding. Not pure black. |
| `--threshold` | `#2A2F3A` | slate grey-blue. The doorway. Second-layer surface for the chat. |
| `--bone` | `#FFFFFF` | pure white page. PDFs live here. No off-white. |
| `--kalpa` | `#5E6CE7` | cobalt. Web-source badge. Reserved for "external truth." |
| `--soma` | `#8B6FE8` | violet. Esotericism scholar, second specialist. |
| `--vayu` | `#3FB8A8` | teal. Third specialist slot. |

The app frame reads cool and dark at the edges (the threshold); the content surface is bone white (the page of the text); the accent is a living vermilion that shows up in marks, highlights, and the active agent. It's the opposite of parchment — the page is bright, the chrome is deep, and fire is the constant.

**Rule of thumb:** if the composition would read as "brown site with rust touches," it's wrong. If it reads as "bright page inside a dark room, with a fire on the table," it's right.

## Typography

Dialogue is the form. Two voices, not one. So two typefaces that are doing different work, not a one-font piety play.

- **Display / UI / labels:** `Fraunces` — a modern contrast serif with optional soft/sharp axes. Set tight, small caps for labels. Old-style numerals off. It's serif because this is a reading app, but it has teeth — not Charter's polite neutrality.
- **Body / PDF UI / long reading:** `Source Serif 4` — calm, high-legibility, deep family. Where you actually read.
- **Mono / metadata / page numbers / source badges:** `JetBrains Mono` — where the app shows its work. Source attributions, offsets, counts.

(If Fraunces loads slow locally, `Crimson Pro` is the backup with similar contrast. Avoid Georgia; it's the parchment's old accomplice.)

## Motifs — used sparingly, never decoratively

1. **The threshold bar.** The top bar is not a nav. It's a doorway. Thin vermilion rule across the top of the app, one pixel, ember on hover. That's your threshold.
2. **The agent flame.** Each scholar has a small flame glyph — a 12px SVG tongue of fire in their color. It flickers (a 2-frame CSS animation, ~1.2s) when they're the active listener. Not when idle.
3. **The refusal mark.** When the agent flags low confidence or no source, the badge is a small *nẖ* — a refusal dot, not a warning triangle. The ethic of the app is that refusing to answer is a feature.
4. **Page numbers as offerings.** Page labels use old-style figures in the vermilion, aligned to an em-space grid. Makes the page number feel like a coordinate, not chrome.
5. **The quote-anchor as a doorframe.** When you anchor a question to a passage, the conversation gets framed with two thin vertical rules on left and right in the agent's color. The question sits inside a doorframe.

## Signature interactions

- **Hold-to-ask.** When you select text in the PDF, the Ask popup doesn't appear instantly. It fades in over 160ms, and the "Ask" button has a 1px vermilion underline that extends left-to-right as the popup settles. Small thing, but it makes the gesture feel like a decision.
- **Fire on active agent.** The flame glyph for the currently selected scholar burns; the others are outlined. When you switch, there's a 220ms cross-fade: the old flame goes to outline, the new one ignites.
- **Source badges bite.** `model` and `web` are not equal-weighted. `web` is cobalt on white, bordered. `model` is the same shape but in outline only — no fill. The user should feel the difference with their eyes closed.
- **Refusal acknowledged.** If the agent says "I don't know" or flags uncertainty, the message gets a thin vermilion left rule — the Naciketas mark. The app rewards refusal.

## Mood board, in words

A dark-green enamel desk lamp. A hand-set copy of the Upanishads in vermilion and black ink. Riso prints in two colors, overlap crisp. A Studio Dumbar information panel at an institutional auditorium. Verso Books covers. Anagrama's wayfinding. A small brass bell at a Nachiketa temple in Uttarakhand. The corner of a Persian miniature where the king sits on a black ground with one vermilion cushion — all the color energy in one object.

Not: candles, incense, saffron-cloth, "spiritual app," hieroglyph-as-ornament, any "Sanskrit font." The story is Indian; the design does not need to costume.

## Taste coordinates

- Federica Fragapane's *The Stories Behind a Line* — editorial data with handmade structure.
- Irma Boom's book covers — confident color blocks, unafraid of vermilion.
- Anagrama's *Papasito* identity — deep ground, bright accent, small type, strong grid.
- Verso Books — serif, confident reds, institutional but alive.
- Risograph prints in red + black — the tool's palette.

## Anti-references

- Readwise / Matter / Instapaper — the "serious reader" cream-paper genre.
- Apple Books — glossy aspirational library.
- Any "alchemy UI" that uses gold-foil-on-navy as a vibe signal.
- Sanskrit-font-as-decoration, anywhere.

## What this means for existing app components

| Component | Current | After |
|---|---|---|
| Top bar | Cream, rust brand, light rule | Deep `--yama`, vermilion threshold rule at bottom, Fraunces brand small-caps |
| PDF pane | Cream bg, paper page | `--threshold` bg (dark), page stays pure white, clear contrast |
| Highlight (PDF) | Muted yellow | Ember yellow + vermilion underline, active pulses gold |
| Chat pane | Warm white | Pure white with slate surfaces for user messages |
| Agent label | Rust text | Agent's color + 12px flame glyph |
| Source badge | Muted green/beige | Cobalt filled (`web`) vs. bone outline (`model`) |
| Ask button | Rust | Vermilion `--pyre`, white text |
| Annotations drawer | Cream, rust header | Deep `--yama` header, bone body, ember ruled dividers |
| Conversation anchor | Cream block, rust border | White ground, agent-color doorframe (left + right rule) |

## The homepage promise

If Nachi ever goes public, the landing page is not a feature grid. It's a single image of the dialogue. See `hero.html` — the child, the door, the scholars summoned as flames. Not a marketing page. An invitation to the scene.
