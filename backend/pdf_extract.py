import fitz


def extract_text(pdf_path: str) -> tuple[str, int]:
    """Return (full_text, num_pages). Pages are joined with page markers."""
    doc = fitz.open(pdf_path)
    pages = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text("text")
        pages.append(f"[PAGE {i}]\n{text.strip()}")
    n = len(doc)
    doc.close()
    return "\n\n".join(pages), n


def extract_metadata(pdf_path: str) -> dict:
    """Return {'title': str|None, 'author': str|None} from PDF metadata."""
    doc = fitz.open(pdf_path)
    meta = doc.metadata or {}
    doc.close()
    title = (meta.get("title") or "").strip() or None
    author = (meta.get("author") or "").strip() or None
    # PyMuPDF sometimes returns junk like '()' or 'untitled'
    if title and title.lower() in {"untitled", "()", "unknown"}:
        title = None
    return {"title": title, "author": author}
