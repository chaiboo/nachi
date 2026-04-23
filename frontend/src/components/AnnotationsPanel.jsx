import { useMemo } from 'react'
import { deleteAnnotation, deleteMessageAnnotation } from '../api'

export default function AnnotationsPanel({
  annotations,
  messageAnnotations,
  conversations,
  documentTitle,
  onClose,
  onJumpToAnnotation,
  onJumpToConversation,
  refreshAll,
}) {
  const { highlights, notes } = useMemo(() => {
    const h = []
    const n = []
    for (const a of annotations || []) {
      if (a.kind === 'highlight') h.push(a)
      else if (a.kind === 'note') n.push(a)
      else if (a.kind === 'ask') h.push(a) // ask annotations show as highlights with chat
    }
    return { highlights: h, notes: n }
  }, [annotations])

  const msgAnnsByConv = useMemo(() => {
    const m = {}
    for (const ma of messageAnnotations || []) {
      const conv = (conversations || []).find((c) =>
        c.messages.some((x) => x.id === ma.message_id),
      )
      if (!conv) continue
      if (!m[conv.id]) m[conv.id] = []
      m[conv.id].push(ma)
    }
    return m
  }, [messageAnnotations, conversations])

  async function handleDelete(ann) {
    if (!confirm('Delete this annotation?')) return
    await deleteAnnotation(ann.id)
    refreshAll()
  }

  async function handleDeleteMsg(ma) {
    if (!confirm('Delete this response annotation?')) return
    await deleteMessageAnnotation(ma.id)
    refreshAll()
  }

  const empty =
    highlights.length === 0 &&
    notes.length === 0 &&
    (messageAnnotations || []).length === 0

  function formatExport() {
    const lines = []
    const title = documentTitle || 'Document'
    lines.push(`# Annotations — ${title}`)
    lines.push(`Exported ${new Date().toISOString().slice(0, 10)}`)
    lines.push('')

    if (highlights.length > 0) {
      lines.push(`## Highlights (${highlights.length})`)
      lines.push('')
      for (const a of highlights) {
        lines.push(`- p. ${a.page} — "${a.selected_text}"`)
      }
      lines.push('')
    }

    if (notes.length > 0) {
      lines.push(`## Notes (${notes.length})`)
      lines.push('')
      for (const a of notes) {
        lines.push(`- p. ${a.page} — "${a.selected_text}"`)
        if (a.note_text) lines.push(`  note: ${a.note_text}`)
      }
      lines.push('')
    }

    if (Object.keys(msgAnnsByConv).length > 0) {
      lines.push(`## On scholar responses`)
      lines.push('')
      for (const [convId, items] of Object.entries(msgAnnsByConv)) {
        const conv = conversations.find((c) => c.id === convId)
        if (conv?.selected_text) {
          lines.push(`### re: "${conv.selected_text.slice(0, 80)}"`)
        }
        for (const ma of items) {
          lines.push(`- [${ma.kind}] "${ma.selected_text}"`)
          if (ma.note_text) lines.push(`  note: ${ma.note_text}`)
        }
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatExport())
      alert('Copied to clipboard.')
    } catch (err) {
      alert('Copy failed: ' + err.message)
    }
  }

  function handleDownload() {
    const blob = new Blob([formatExport()], {
      type: 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeTitle = (documentTitle || 'annotations')
      .replace(/[^a-z0-9_\-]+/gi, '_')
      .slice(0, 60)
    a.download = `${safeTitle}_annotations.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="ann-overlay" onClick={onClose}>
      <div className="ann-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ann-header">
          <h3>Annotations</h3>
          <div className="ann-header-actions">
            {!empty && (
              <>
                <button
                  className="ann-export-btn"
                  onClick={handleCopy}
                  title="Copy all annotations as text"
                >
                  Copy
                </button>
                <button
                  className="ann-export-btn"
                  onClick={handleDownload}
                  title="Download as .txt file"
                >
                  ⬇ .txt
                </button>
              </>
            )}
            <button className="ann-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="ann-body">
          {empty && (
            <div className="ann-empty">
              Nothing yet. Select text in the PDF to highlight, note, or ask.
            </div>
          )}

          {highlights.length > 0 && (
            <section className="ann-section">
              <h4>Highlights ({highlights.length})</h4>
              {highlights.map((a) => (
                <div key={a.id} className="ann-item">
                  <div
                    className="ann-swatch"
                    style={{ background: a.color || '#e8b800' }}
                  />
                  <div className="ann-content">
                    <div className="ann-meta">p. {a.page}</div>
                    <button
                      className="ann-quote"
                      onClick={() => {
                        onJumpToAnnotation(a.id)
                        onClose()
                      }}
                    >
                      "{a.selected_text}"
                    </button>
                  </div>
                  <button
                    className="ann-del"
                    onClick={() => handleDelete(a)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </section>
          )}

          {notes.length > 0 && (
            <section className="ann-section">
              <h4>Notes ({notes.length})</h4>
              {notes.map((a) => (
                <div key={a.id} className="ann-item">
                  <div
                    className="ann-swatch"
                    style={{ background: a.color || '#4a90e2' }}
                  />
                  <div className="ann-content">
                    <div className="ann-meta">p. {a.page}</div>
                    <button
                      className="ann-quote"
                      onClick={() => {
                        onJumpToAnnotation(a.id)
                        onClose()
                      }}
                    >
                      "{a.selected_text}"
                    </button>
                    {a.note_text && (
                      <div className="ann-note">— {a.note_text}</div>
                    )}
                  </div>
                  <button
                    className="ann-del"
                    onClick={() => handleDelete(a)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </section>
          )}

          {Object.keys(msgAnnsByConv).length > 0 && (
            <section className="ann-section">
              <h4>
                On scholar responses (
                {(messageAnnotations || []).length})
              </h4>
              {Object.entries(msgAnnsByConv).map(([convId, items]) => {
                const conv = conversations.find((c) => c.id === convId)
                return (
                  <div key={convId} className="ann-subsection">
                    <div className="ann-subhead">
                      {conv?.selected_text
                        ? `re: "${conv.selected_text.slice(0, 60)}${
                            conv.selected_text.length > 60 ? '…' : ''
                          }"`
                        : 'Conversation'}
                    </div>
                    {items.map((ma) => (
                      <div key={ma.id} className="ann-item">
                        <div
                          className="ann-swatch"
                          style={{
                            background:
                              ma.kind === 'note' ? '#4a90e2' : '#e8b800',
                          }}
                        />
                        <div className="ann-content">
                          <button
                            className="ann-quote"
                            onClick={() => {
                              onJumpToConversation(convId)
                              onClose()
                            }}
                          >
                            "{ma.selected_text}"
                          </button>
                          {ma.note_text && (
                            <div className="ann-note">— {ma.note_text}</div>
                          )}
                        </div>
                        <button
                          className="ann-del"
                          onClick={() => handleDeleteMsg(ma)}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
