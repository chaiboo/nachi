"""
Generate the sample 'About Nachi' PDF that ships with the repo.

Run from the project root with the nachi venv active:
    ~/.nachi/venv/bin/python docs/samples/build-sample.py

Produces:
    docs/samples/about-nachi.pdf
"""
from pathlib import Path

import fitz  # PyMuPDF

OUT = Path(__file__).parent / "about-nachi.pdf"

HTML = """
<html>
<head>
<style>
  @page { margin: 1in; }
  body {
    font-family: Georgia, 'Charter', serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #1a1916;
  }
  h1 {
    font-size: 28pt;
    font-weight: 500;
    letter-spacing: -0.01em;
    margin: 0 0 0.15em 0;
    color: #a72713;
  }
  h2 {
    font-size: 13pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 1.4em 0 0.5em 0;
    color: #a72713;
  }
  .subtitle {
    font-style: italic;
    color: #6b6660;
    margin: 0 0 2em 0;
    font-size: 12pt;
  }
  p { margin: 0 0 0.9em 0; text-align: justify; }
  blockquote {
    border-left: 2px solid #d6351c;
    padding-left: 0.8em;
    margin: 0.9em 0;
    font-style: italic;
    color: #4a4640;
  }
  em { font-style: italic; }
  strong { font-weight: 600; }
  .dropcap { float: left; font-size: 3em; line-height: 0.9; padding-right: 0.08em; color: #d6351c; }
  ol { padding-left: 1.4em; }
  ol li { margin-bottom: 0.5em; }
  hr { border: 0; border-top: 1px solid #e6e1d8; margin: 2em 0; }
  .sig { margin-top: 2.5em; font-style: italic; color: #6b6660; font-size: 10pt; }
</style>
</head>
<body>

<h1>Nachi — A Primer</h1>
<p class="subtitle">Or, the boy at the door of Death</p>

<p><span class="dropcap">N</span>achi is named after <strong>Naciketas</strong>, the student in the Kaṭha Upaniṣad whose persistence at the threshold of Yama's house — the house of Death — becomes the frame for one of the great dialogues of the Indic tradition. The story matters because it sets the ethic of the app.</p>

<h2>The story</h2>

<p>Vājaśravasa, a Brahmin, performs a sacrifice that requires him to give away everything he owns. His young son Naciketas watches the old, useless cows his father is offering and feels an irritation that is also a question: if the sacrifice demands your all, is this really giving anything? <em>"To whom,"</em> he asks his father, <em>"will you give me?"</em></p>

<p>Three times the boy asks. In anger, his father answers: <strong>"I give you to Death."</strong></p>

<p>Naciketas takes this seriously. He goes to Yama's house and waits there for three days and three nights without food or water. Yama, who had been away, returns and finds a Brahmin boy on his threshold — a breach of hospitality that must be made right. He offers Naciketas three boons.</p>

<p>The first: reconciliation with his father. The second: the knowledge of the sacred fire that leads to the heavens. Naciketas takes both. Then for the third, he asks the question Yama does not want to answer:</p>

<blockquote>"When a man has died, some say 'he exists,' and some say 'he does not.' I want to know the truth of this. Teach me."</blockquote>

<p>Yama tries to deflect him. He offers gold, kingdoms, sons who live a hundred years, daughters fair as apsarases, every pleasure the three worlds contain. He names them all by name. Naciketas refuses all of it in one of the most uncompromising passages in the tradition:</p>

<blockquote>"All these endure only until tomorrow. They wear down even the senses. Life is short. Keep your horses, your songs, your dancers. I will not settle for anything less than the answer you are hiding."</blockquote>

<p>Yama, defeated, teaches him.</p>

<h2>Why this matters for the app</h2>

<p>An AI reader of academic texts is a tool that can, at every step, offer you a version of Yama's deflection — the smooth summary that sounds like an answer but isn't; the confident restatement of what you already brought to it; the plausible invention that fills the place where real inquiry would have to go. The point of Nachi is to build a tool that refuses this, or at least makes the refusal visible when it happens.</p>

<p>Three things matter:</p>

<ol>
<li><strong>Source surfacing.</strong> Every response in Nachi is marked as either <em>web</em> (the scholar actually used search and you should ask what they found) or <em>model</em> (from training, which may be outdated, wrong, or confidently confabulated). You always know which you're looking at.</li>
<li><strong>Distinct voices.</strong> The app is built around scholars with specific argumentative positions, not a neutral assistant. A Religious Studies Scholar reads differently than a Digital Humanities Scholar, and disagreement between them is a feature — it tells you where the real argument lives.</li>
<li><strong>Editability.</strong> You can rewrite any scholar's persona, spin up new ones, and tell them what to refuse. The tool is yours.</li>
</ol>

<h2>Some passages to try</h2>

<p>Select any of these and ask a scholar. Try the same passage with two different scholars and notice how the readings diverge.</p>

<blockquote>"To whom will you give me?"</blockquote>

<p>Ask the Philosopher, then the Historian. Both will have something to say, and neither will say the same thing. The Philosopher will reconstruct the argument about agency and gift. The Historian will ask when and where the Kaṭha was compiled and by whom.</p>

<blockquote>"Some say he exists, and some say he does not."</blockquote>

<p>Ask the Religious Studies Scholar whether this is a question about metaphysics or about grief. Ask the Willful Misreader to give you the worst possible interpretation. Ask the Crank how the Cārvākas — the Indian materialists — would have answered it, and whether the author of the Kaṭha knew they would.</p>

<blockquote>"Keep your horses, your songs, your dancers."</blockquote>

<p>Try the Literary Theorist on the rhetoric of refusal — the list of specific pleasures, the naming. Try the Paronomaniac on the Sanskrit <em>preyas</em> (the pleasing) vs. <em>śreyas</em> (the good, the real) as they live in this passage. Try the Lechturer on the dancers.</p>

<h2>A note on truth</h2>

<p>The Kaṭha has a specific view about what Naciketas is asking for. It is not information. It is not the name of a thing. It is — the text says — <em>śreyas</em>: the good, the real, which is distinguished throughout the Upaniṣad from <em>preyas</em>, the pleasing, the plausible, the what-you-want-to-hear.</p>

<p>Your AI reader will, by default, give you <em>preyas</em>. The purpose of the tool is to help you demand <em>śreyas</em>, and to show you clearly when you have been given the other instead.</p>

<hr/>

<p class="sig">Built collaboratively by a human and by Claude (Anthropic). Released under the MIT License.</p>

</body>
</html>
"""


def main() -> None:
    # Use the Story / DocumentWriter pipeline — it auto-paginates HTML across
    # pages. Letter size, 1" margins.
    MEDIABOX = fitz.paper_rect("letter")
    CONTENT = MEDIABOX + (72, 72, -72, -72)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    story = fitz.Story(html=HTML)
    writer = fitz.DocumentWriter(str(OUT))

    more = 1
    n_pages = 0
    while more:
        dev = writer.begin_page(MEDIABOX)
        more, _ = story.place(CONTENT)
        story.draw(dev)
        writer.end_page()
        n_pages += 1

    writer.close()

    # Re-open to set metadata, then resave.
    doc = fitz.open(str(OUT))
    doc.set_metadata(
        {
            "title": "Nachi — A Primer",
            "author": "Nachi project",
            "subject": "About the Nachi reading app",
            "keywords": "nachi, naciketas, upanishad, reading, ai",
        }
    )
    doc.saveIncr()
    doc.close()

    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {n_pages} pages)")


if __name__ == "__main__":
    main()
