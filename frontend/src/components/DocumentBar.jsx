import { useRef, useState } from 'react'
import { uploadDocument, duplicateDocument, deleteDocument } from '../api'
import Logo from './Logo'

export default function DocumentBar({
  documents,
  currentDocId,
  setCurrentDocId,
  refreshDocuments,
  annotationCount = 0,
  onOpenAnnotations,
  theme,
  onToggleTheme,
}) {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Title/author auto-detected server-side from PDF metadata.
      const doc = await uploadDocument(file, null, null)
      await refreshDocuments()
      setCurrentDocId(doc.id)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDuplicate() {
    if (!currentDocId) return
    try {
      const copy = await duplicateDocument(currentDocId)
      await refreshDocuments()
      setCurrentDocId(copy.id)
    } catch (err) {
      alert('Duplicate failed: ' + err.message)
    }
  }

  async function handleDelete() {
    if (!currentDocId) return
    const current = documents.find((d) => d.id === currentDocId)
    const title = current?.title || 'this document'
    const ok = confirm(
      `Delete "${title}"?\n\nThe PDF, all annotations, conversations, and scholar sessions tied to it will be permanently removed. This cannot be undone.`,
    )
    if (!ok) return
    try {
      await deleteDocument(currentDocId)
      // Clean up per-doc client state so we don't leak localStorage keys.
      localStorage.removeItem(`nachi:scholar:${currentDocId}`)
      localStorage.removeItem(`nachi:fullbook:${currentDocId}`)
      // Pick the next document if there is one, else null.
      const remaining = documents.filter((d) => d.id !== currentDocId)
      setCurrentDocId(remaining.length ? remaining[0].id : null)
      await refreshDocuments()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  const current = documents.find((d) => d.id === currentDocId)

  return (
    <div className="doc-bar">
      <div className="doc-brand">
        <Logo size={26} />
        <span>Nachi</span>
      </div>
      <div className="doc-picker">
        <select
          className="doc-select"
          value={currentDocId || ''}
          onChange={(e) => setCurrentDocId(e.target.value || null)}
        >
          <option value="">— Select document —</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}{d.author ? ` · ${d.author}` : ''}
            </option>
          ))}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <button
          className="doc-upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Upload a new PDF"
        >
          {uploading ? '…' : '+ Upload'}
        </button>
        {currentDocId && (
          <button
            className="doc-duplicate"
            onClick={handleDuplicate}
            aria-label="Duplicate"
            title="Duplicate: make a fresh copy of this PDF with no annotations"
          >
            ⎘
          </button>
        )}
        {currentDocId && (
          <button
            className="doc-duplicate doc-delete"
            onClick={handleDelete}
            aria-label="Delete"
            title="Delete this document permanently (PDF, annotations, conversations)"
          >
            ✕
          </button>
        )}
      </div>
      {current && current.author && (
        <div className="doc-author muted">by {current.author}</div>
      )}
      <div className="doc-spacer" />
      {currentDocId && (
        <button
          className="doc-ann-btn"
          onClick={onOpenAnnotations}
          title="Highlights & notes"
        >
          ✎ Annotations
          {annotationCount > 0 && (
            <span className="doc-ann-count">{annotationCount}</span>
          )}
        </button>
      )}
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  )
}
