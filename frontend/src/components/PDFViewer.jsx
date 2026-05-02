import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

const PAGE_WIDTH = 780

export default function PDFViewer({
  fileUrl,
  annotations,
  focusAnnotationId,
  onAction,
  onAnnotationClick,
}) {
  const [numPages, setNumPages] = useState(null)
  const [pageSizes, setPageSizes] = useState({})
  const [popup, setPopup] = useState(null)
  const [annPopup, setAnnPopup] = useState(null) // { x, y, anns }
  const containerRef = useRef(null)
  const pageRefs = useRef({})

  const annotationsByPage = useMemo(() => {
    const m = {}
    for (const a of annotations || []) {
      if (!a.rects || !a.rects.length) continue
      if (!m[a.page]) m[a.page] = []
      m[a.page].push(a)
    }
    return m
  }, [annotations])

  useEffect(() => {
    function handleMouseUp(e) {
      // Ignore clicks that started on the popup itself
      if (e.target.closest?.('.ask-popup')) return
      const sel = window.getSelection()
      const text = sel ? sel.toString().trim() : ''
      if (!text || text.length < 2) {
        setPopup(null)
        return
      }
      if (!containerRef.current?.contains(sel.anchorNode)) {
        setPopup(null)
        return
      }

      const range = sel.getRangeAt(0)
      const pageEl = findPageElement(sel.anchorNode)
      if (!pageEl) {
        setPopup(null)
        return
      }
      const pageNum = parseInt(pageEl.dataset.pageNumber, 10)
      const pageRect = pageEl.getBoundingClientRect()

      const rawRects = Array.from(range.getClientRects())
      const rects = rawRects
        .filter((r) => r.width > 0 && r.height > 0)
        .filter(
          (r) =>
            r.top >= pageRect.top - 2 && r.bottom <= pageRect.bottom + 2,
        )
        .map((r) => ({
          x: (r.left - pageRect.left) / pageRect.width,
          y: (r.top - pageRect.top) / pageRect.height,
          w: r.width / pageRect.width,
          h: r.height / pageRect.height,
        }))

      const paragraph = inferParagraph(sel)
      const lastRect = rawRects[rawRects.length - 1]
      const containerRect = containerRef.current.getBoundingClientRect()

      const POPUP_WIDTH = 240
      const POPUP_MARGIN = 8
      const rawX =
        lastRect.right - containerRect.left + containerRef.current.scrollLeft
      const maxX = containerRect.width - POPUP_WIDTH - POPUP_MARGIN
      const clampedX = Math.max(POPUP_MARGIN, Math.min(rawX, maxX))

      setPopup({
        text,
        paragraph,
        page: pageNum,
        rects,
        x: clampedX,
        y: lastRect.bottom - containerRect.top + containerRef.current.scrollTop + 6,
      })
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  function pickAction(kind) {
    if (!popup) return
    onAction({
      kind,
      text: popup.text,
      paragraph: popup.paragraph,
      page: popup.page,
      rects: popup.rects,
    })
    setPopup(null)
    window.getSelection()?.removeAllRanges()
  }

  useEffect(() => {
    if (!focusAnnotationId || !annotations) return
    const ann = annotations.find((a) => a.id === focusAnnotationId)
    if (!ann) return
    const pageEl = pageRefs.current[ann.page]
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Only scroll when focusAnnotationId itself changes — not when the
    // annotations list updates (e.g. after creating a new highlight). That
    // re-fire was causing the PDF to jump to a stale focus target every
    // time the user added a highlight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAnnotationId])

  // Dismiss the annotation picker on any outside click or Escape.
  useEffect(() => {
    if (!annPopup) return
    function handleClick(e) {
      if (
        e.target.closest?.('.ann-picker') ||
        e.target.closest?.('.highlight-rect.clickable')
      )
        return
      setAnnPopup(null)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setAnnPopup(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [annPopup])

  return (
    <div className="pdf-viewer" ref={containerRef}>
      {fileUrl ? (
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<div className="pdf-loading">Loading PDF…</div>}
          error={<div className="pdf-error">Failed to load PDF.</div>}
        >
          {Array.from({ length: numPages || 0 }, (_, i) => i + 1).map(
            (pageNum) => {
              const size = pageSizes[pageNum]
              const pageAnns = annotationsByPage[pageNum] || []
              return (
                <div
                  key={`page-${pageNum}`}
                  className="page-wrapper"
                  ref={(el) => {
                    if (el) pageRefs.current[pageNum] = el
                  }}
                >
                  <Page
                    pageNumber={pageNum}
                    width={PAGE_WIDTH}
                    renderTextLayer
                    renderAnnotationLayer={false}
                    className="pdf-page"
                    onRenderSuccess={(page) => {
                      const vp = page.getViewport({ scale: 1 })
                      const height = (PAGE_WIDTH / vp.width) * vp.height
                      setPageSizes((s) =>
                        s[pageNum]?.h === height
                          ? s
                          : { ...s, [pageNum]: { w: PAGE_WIDTH, h: height } },
                      )
                    }}
                  />
                  {size && (
                    <div
                      className="highlight-layer"
                      style={{ width: size.w, height: size.h }}
                    >
                      {pageAnns.map((ann) =>
                        ann.rects.map((r, i) => (
                          <div
                            key={`${ann.id}-${i}`}
                            className={
                              'highlight-rect' +
                              (ann.id === focusAnnotationId ? ' focus' : '') +
                              ` kind-${ann.kind || 'ask'}` +
                              (onAnnotationClick ? ' clickable' : '')
                            }
                            style={{
                              left: r.x * size.w,
                              top: r.y * size.h,
                              width: r.w * size.w,
                              height: r.h * size.h,
                              background: hexToRgba(ann.color, 0.14),
                              borderBottom: `2px solid ${ann.color}`,
                            }}
                            title={
                              ann.note_text
                                ? `Note: ${ann.note_text}`
                                : ann.kind === 'ask'
                                ? 'Click to jump to response'
                                : ann.selected_text
                            }
                            onClick={(e) => {
                              if (!onAnnotationClick) return
                              e.stopPropagation()
                              const overlapping = pageAnns.filter(
                                (other) =>
                                  other.id === ann.id ||
                                  annotationsOverlap(other, ann),
                              )
                              if (overlapping.length <= 1) {
                                onAnnotationClick(ann)
                                return
                              }
                              // Multiple annotations at this spot — show picker.
                              const containerRect =
                                containerRef.current.getBoundingClientRect()
                              setAnnPopup({
                                x:
                                  e.clientX -
                                  containerRect.left +
                                  containerRef.current.scrollLeft,
                                y:
                                  e.clientY -
                                  containerRect.top +
                                  containerRef.current.scrollTop +
                                  8,
                                anns: overlapping,
                              })
                            }}
                          />
                        )),
                      )}
                      {pageAnns
                        .filter((a) => a.kind === 'note' && a.note_text)
                        .map((ann) => {
                          const r = ann.rects[0]
                          if (!r) return null
                          return (
                            <div
                              key={`note-${ann.id}`}
                              className="note-marker"
                              style={{
                                left: r.x * size.w + r.w * size.w + 4,
                                top: r.y * size.h - 2,
                                background: ann.color,
                              }}
                              title={ann.note_text}
                            >
                              ✎
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            },
          )}
        </Document>
      ) : (
        <div className="pdf-empty">
          <p>No document loaded.</p>
          <p className="muted">Upload a PDF to begin.</p>
        </div>
      )}
      {popup && (
        <div
          className="ask-popup"
          style={{ left: popup.x, top: popup.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button className="pop-btn" onClick={() => pickAction('highlight')}>
            Highlight
          </button>
          <button className="pop-btn" onClick={() => pickAction('note')}>
            Note
          </button>
          <button className="pop-btn primary" onClick={() => pickAction('ask')}>
            Ask →
          </button>
        </div>
      )}
      {annPopup && (
        <div
          className="ann-picker"
          style={{ left: annPopup.x, top: annPopup.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="ann-picker-header">
            {annPopup.anns.length} annotations here
          </div>
          {annPopup.anns.map((a) => (
            <button
              key={a.id}
              className="ann-picker-item"
              onClick={() => {
                setAnnPopup(null)
                onAnnotationClick?.(a)
              }}
            >
              <span
                className="ann-picker-dot"
                style={{ background: a.color }}
              />
              <span className="ann-picker-kind">
                {a.kind === 'ask'
                  ? (a.agent_id || '').replace(/_/g, ' ') || 'ask'
                  : a.kind}
              </span>
              <span className="ann-picker-snippet">
                {a.note_text
                  ? a.note_text.slice(0, 60)
                  : (a.selected_text || '').slice(0, 60)}
                {(a.note_text || a.selected_text || '').length > 60 ? '…' : ''}
              </span>
            </button>
          ))}
          <button
            className="ann-picker-close"
            onClick={() => setAnnPopup(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  )
}

function annotationsOverlap(a1, a2) {
  for (const r1 of a1.rects || []) {
    for (const r2 of a2.rects || []) {
      if (rectsOverlap(r1, r2)) return true
    }
  }
  return false
}

function findPageElement(node) {
  let n = node?.nodeType === 3 ? node.parentNode : node
  while (n) {
    if (n.dataset && n.dataset.pageNumber) return n
    n = n.parentNode
  }
  return null
}

function inferParagraph(sel) {
  const pageEl = findPageElement(sel.anchorNode)
  if (!pageEl) return null
  const textLayer = pageEl.querySelector('.textLayer')
  if (!textLayer) return null
  return textLayer.textContent?.trim().slice(0, 6000) || null
}

function hexToRgba(hex, alpha) {
  const m = hex.replace('#', '')
  const bigint = parseInt(m, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
