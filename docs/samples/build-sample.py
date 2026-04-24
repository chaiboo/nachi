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

<h1>Nachi: A Primer</h1>
<p class="subtitle">Like Claude Code and Zotero had 15 babies. Open source Coreading app for researchers.</p>

<p><span class="dropcap">N</span>achi is a reader for academic texts with a chat panel full of scholars in it. You open a PDF, select a passage, and ask whichever scholar you feel like (a Literary Theorist, a Historian, a Philologist, a Willful Misreader, a Jester) for their take. Each response is tagged <em>web</em> or <em>model</em> so you know whether the scholar actually went and looked something up or is confabulating from training. Everything runs locally. Every scholar is editable. You can write new ones.</p>

<p>The app is named after Naciketas, whose story is short and worth telling in full before the rest of this makes sense.</p>

<h2>The story</h2>

<p>Vājaśravasa is performing a sacrifice that requires him to give away everything he owns. His young son Naciketas is watching, and notices that the cows his father is handing over are old, barren, past milking. Useless animals being passed off as gift. The boy asks, with the specific irritation of a child who has caught a grown-up lying: <em>"And me, to whom will you give me?"</em></p>

<p>He asks three times. His father, losing patience, snaps back: <strong>"I give you to Death."</strong></p>

<p>Naciketas takes him at his word. He walks to Yama's house (Yama being the god of death), and when Yama is not home, the boy sits on the threshold and waits. Three days and three nights, no food, no water, a Brahmin child on the doorstep of Death. When Yama returns and finds him there, the breach of hospitality is severe enough that he offers the boy three boons to set the ledger straight.</p>

<p>First boon: return to his father, alive and forgiven. Second: the knowledge of a certain fire-sacrifice that leads to heaven. Granted, granted. Then the third, which is the one the boy actually came for:</p>

<blockquote>"When a man has died, some say he still exists, and some say he does not. I want to know the truth of this. Teach me."</blockquote>

<p>Yama tries to wriggle out. He tells the boy this question is subtle, the gods themselves have struggled with it, ask for something else. Naciketas does not ask for something else. So Yama tries to bribe him. He offers, by name: gold, elephants, horses, sons and grandsons who will live a hundred years, kingdoms on earth, long life, women beautiful as apsarases with chariots and lutes (<em>women such as are not to be had by mortals</em>), every pleasure available in the three worlds. He lists them. Naciketas listens to the whole list and answers:</p>

<blockquote>"All these wear out. They wear down the senses that enjoy them. Life is short even at its longest. Keep your horses, keep your songs, keep your dancing girls. I will not take anything less than what I came here for."</blockquote>

<p>Yama, cornered, teaches him.</p>

<h2>Why that story, for this tool</h2>

<p>The Kaṭha Upaniṣad has a specific pair of words for what is going on in that exchange. Yama is offering <em>preyas</em>: the pleasing, the agreeable, what you want to hear. Naciketas is holding out for <em>śreyas</em>: the good, the real, the thing that is actually true whether or not it flatters you. The whole Upaniṣad turns on the distinction. The two are explicitly, structurally opposed; the text is clear that almost everyone takes <em>preyas</em> and loses.</p>

<p>An AI reader of academic texts will default, at every step, to <em>preyas</em>. The smooth summary that sounds like an answer. The confident restatement of the thing you already brought to the conversation. The plausible invention that fills the gap where real inquiry would have had to go sit on a threshold for three days. This is not a failure mode. It is what the underlying thing is optimised for. It is trained to please.</p>

<p>Nachi is built around the assumption that you, the reader, are the one who has to keep asking. The tool's job is to make the difference between <em>preyas</em> and <em>śreyas</em> visible enough that you can catch it when the scholar hands you the first and pretends it's the second.</p>

<p>Three features carry that:</p>

<ol>
<li><strong>Source surfacing.</strong> Every response is tagged <em>web</em> (the scholar ran a search; ask them what they actually found) or <em>model</em> (from training, which might be wrong, outdated, or confidently made up). You always know which you're reading.</li>
<li><strong>Distinct voices.</strong> The scholars have argumentative positions, not neutral ones. Asking the same passage of two scholars isn't redundancy. It's how you find the seam where the real disagreement sits.</li>
<li><strong>Editability.</strong> Every persona is a file you can rewrite. Tell a scholar what to refuse, what to dwell on, what they're allowed to admit they don't know. Write new ones. The roster is yours.</li>
</ol>

<h2>Some passages to try</h2>

<p>Select any of these in a Kaṭha translation and ask. Then ask a second scholar the same thing and watch where the readings collide.</p>

<blockquote>"To whom will you give me?"</blockquote>

<p>Ask the Philosopher first. They'll reach for agency, gift, whether a person can be given. Then the Historian, who will want to know when and where the Kaṭha was compiled and what kind of sacrifice is actually being described. Then The Crank, to put the two readings in a fight and see which one is doing work the other has to deny.</p>

<blockquote>"Some say he exists, and some say he does not."</blockquote>

<p>The Religious Studies Scholar on whether this is a question about metaphysics or about grief. The Willful Misreader for the worst possible interpretation, on purpose. The Philologist on what the Sanskrit actually says and whose translation you happen to be holding.</p>

<blockquote>"Keep your horses, your songs, your dancers."</blockquote>

<p>The Literary Theorist on the rhetoric of the refusal: why the pleasures are named specifically rather than abstracted. The Philologist on <em>preyas</em> and <em>śreyas</em> as they sit in this passage. The Dangling Modifier, for mischief, on the dancers.</p>

<h2>A note on what Naciketas was after</h2>

<p>The Kaṭha is precise about this. What Naciketas wanted was not information, not a fact, not the name of a thing. It was <em>śreyas</em>: the real, which the text defines largely by its opposition to <em>preyas</em>, the pleasing. The boy's achievement was not that he walked to Death's house. Plenty of people do that, eventually. It was that once he got there, he refused everything that was not what he came for, by name, one at a time, all the way down the list.</p>

<p>Your AI reader will hand you <em>preyas</em> first. It has to. The point of this tool is to help you keep asking for the other thing.</p>

</body>
</html>
"""


def main() -> None:
    # Use the Story / DocumentWriter pipeline; it auto-paginates HTML across
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
            "title": "Nachi: A Primer",
            "author": "Nachi",
            "subject": "About the Nachi reading app",
            "keywords": "nachi, naciketas, upanishad, reading, ai",
        }
    )
    doc.saveIncr()
    doc.close()

    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {n_pages} pages)")


if __name__ == "__main__":
    main()
