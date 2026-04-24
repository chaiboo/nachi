import { useCallback, useEffect, useRef, useState } from 'react'
import PDFViewer from './components/PDFViewer'
import ChatPanel from './components/ChatPanel'
import DocumentBar from './components/DocumentBar'
import NewAgentModal from './components/NewAgentModal'
import EditAgentModal from './components/EditAgentModal'
import AnnotationsPanel from './components/AnnotationsPanel'
import {
  listAgents,
  listAnnotations,
  listConversations,
  listDocuments,
  listMessageAnnotations,
  documentFileUrl,
} from './api'
import './App.css'

export default function App() {
  const [agents, setAgents] = useState([])
  const [agentId, setAgentIdState] = useState(null)
  const [documents, setDocuments] = useState([])
  const [currentDocId, setCurrentDocId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [annotations, setAnnotations] = useState([])
  const [messageAnnotations, setMessageAnnotations] = useState([])
  const [pendingAction, setPendingAction] = useState(null)
  const [focusAnnotationId, setFocusAnnotationId] = useState(null)
  const [focusConversationId, setFocusConversationIdRaw] = useState(null)
  const [focusSeq, setFocusSeq] = useState(0)

  // Bump seq on every focus request so the effect re-fires even when
  // focusing the same conversation (e.g. follow-up reply).
  const setFocusConversationId = useCallback((id) => {
    setFocusConversationIdRaw(id)
    setFocusSeq((s) => s + 1)
  }, [])
  const [showNewAgent, setShowNewAgent] = useState(false)
  const [editingAgentId, setEditingAgentId] = useState(null)
  const [showAnnotations, setShowAnnotations] = useState(false)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('nachi:theme') || 'light'
  })
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = parseFloat(localStorage.getItem('nachi:split') || '')
    return Number.isFinite(saved) && saved > 0.2 && saved < 0.8 ? saved : 0.58
  })
  const bodyRef = useRef(null)
  const dragState = useRef(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('nachi:theme', theme)
  }, [theme])

  const toggleTheme = () =>
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  function handleDragStart(e) {
    e.preventDefault()
    const rect = bodyRef.current?.getBoundingClientRect()
    if (!rect) return
    dragState.current = { left: rect.left, width: rect.width }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
  }

  function handleDragMove(e) {
    if (!dragState.current) return
    const { left, width } = dragState.current
    let ratio = (e.clientX - left) / width
    ratio = Math.max(0.2, Math.min(0.8, ratio))
    setSplitRatio(ratio)
  }

  function handleDragEnd() {
    dragState.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', handleDragEnd)
    // persist latest ratio
    setSplitRatio((r) => {
      localStorage.setItem('nachi:split', String(r))
      return r
    })
  }

  async function handleAgentSaved() {
    await refreshAgents()
  }

  const refreshAgents = useCallback(async () => {
    const a = await listAgents()
    setAgents(a)
    return a
  }, [])

  const refreshDocuments = useCallback(async () => {
    const docs = await listDocuments()
    setDocuments(docs)
    setCurrentDocId((cur) => cur || (docs.length ? docs[0].id : null))
  }, [])

  const refreshAll = useCallback(async () => {
    if (!currentDocId) {
      setConversations([])
      setAnnotations([])
      setMessageAnnotations([])
      return
    }
    const [convs, anns, mAnns] = await Promise.all([
      listConversations(currentDocId),
      listAnnotations(currentDocId),
      listMessageAnnotations(currentDocId),
    ])
    setConversations(convs)
    setAnnotations(anns)
    setMessageAnnotations(mAnns)
  }, [currentDocId])

  useEffect(() => {
    refreshAgents()
    refreshDocuments()
  }, [refreshAgents, refreshDocuments])

  useEffect(() => {
    refreshAll()
    setPendingAction(null)
    setFocusAnnotationId(null)
    setFocusConversationIdRaw(null)
  }, [currentDocId, refreshAll])

  // Restore the last-used scholar for the current document, fall back
  // to the first agent on the list. Per-doc: each document starts fresh
  // and only its own history sticks.
  useEffect(() => {
    if (!agents.length) return
    const key = currentDocId
      ? `nachi:scholar:${currentDocId}`
      : 'nachi:scholar:_global'
    const stored = localStorage.getItem(key)
    const known = agents.find((a) => a.id === stored)
    setAgentIdState(known ? stored : agents[0].id)
  }, [currentDocId, agents])

  // If the current doc has no activity (no annotations, no conversations),
  // it's effectively fresh — reset its scholar preference to the default
  // and clear any stale localStorage entry. Avoids the "I reset the doc
  // but it still defaults to The Jester" surprise.
  useEffect(() => {
    if (!currentDocId || !agents.length) return
    const hasActivity =
      (annotations?.length || 0) > 0 || (conversations?.length || 0) > 0
    if (hasActivity) return
    const key = `nachi:scholar:${currentDocId}`
    const stored = localStorage.getItem(key)
    if (stored && stored !== agents[0].id) {
      localStorage.removeItem(key)
      setAgentIdState(agents[0].id)
    }
  }, [currentDocId, annotations, conversations, agents])

  function setAgentId(id) {
    setAgentIdState(id)
    const key = currentDocId
      ? `nachi:scholar:${currentDocId}`
      : 'nachi:scholar:_global'
    if (id) localStorage.setItem(key, id)
  }

  // Non-persisting version: updates the active dropdown but does NOT
  // overwrite the stored default for this doc. Used by Also-Ask so a
  // one-off jump to another scholar doesn't stick as the doc's default.
  function setAgentIdEphemeral(id) {
    setAgentIdState(id)
  }

  function handleAnchorClick(annotationId) {
    if (annotationId) setFocusAnnotationId(annotationId)
  }

  function handlePdfAnnotationClick(ann) {
    // Clicking a highlighted PDF rect: if it's an ask annotation with a
    // linked conversation, jump to that conversation in the chat panel.
    // For plain highlights/notes, pulse the rect itself (via focus).
    setFocusAnnotationId(ann.id)
    if (ann.kind === 'ask') {
      const conv = conversations.find((c) => c.annotation_id === ann.id)
      if (conv) setFocusConversationId(conv.id)
    }
  }

  async function handleAgentCreated(agent) {
    const a = await refreshAgents()
    const match = a.find((x) => x.id === agent.id)
    if (match) setAgentIdState(match.id)
    setShowNewAgent(false)
  }

  return (
    <div className="app">
      <DocumentBar
        documents={documents}
        currentDocId={currentDocId}
        setCurrentDocId={setCurrentDocId}
        refreshDocuments={refreshDocuments}
        annotationCount={
          (annotations?.length || 0) + (messageAnnotations?.length || 0)
        }
        onOpenAnnotations={() => setShowAnnotations(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div className="app-body" ref={bodyRef}>
        <div
          className="pane pane-pdf"
          style={{ flex: `0 0 ${splitRatio * 100}%` }}
        >
          <PDFViewer
            fileUrl={currentDocId ? documentFileUrl(currentDocId) : null}
            annotations={annotations}
            focusAnnotationId={focusAnnotationId}
            onAction={setPendingAction}
            onAnnotationClick={handlePdfAnnotationClick}
          />
        </div>
        <div
          className="pane-resizer"
          onMouseDown={handleDragStart}
          title="Drag to resize"
          role="separator"
          aria-orientation="vertical"
        />
        <div className="pane pane-chat" style={{ flex: '1 1 auto' }}>
          <ChatPanel
            agents={agents}
            agentId={agentId}
            setAgentId={setAgentId}
            setAgentIdEphemeral={setAgentIdEphemeral}
            documentId={currentDocId}
            pendingAction={pendingAction}
            clearPendingAction={() => setPendingAction(null)}
            conversations={conversations}
            messageAnnotations={messageAnnotations}
            refreshAll={refreshAll}
            focusConversationId={focusConversationId}
            focusSeq={focusSeq}
            setFocusConversationId={setFocusConversationId}
            onAnchorClick={handleAnchorClick}
            onRequestNewAgent={() => setShowNewAgent(true)}
            onRequestEditAgent={(id) => setEditingAgentId(id)}
          />
        </div>
      </div>
      {showNewAgent && (
        <NewAgentModal
          onClose={() => setShowNewAgent(false)}
          onCreated={handleAgentCreated}
        />
      )}
      {editingAgentId && (
        <EditAgentModal
          agentId={editingAgentId}
          agents={agents}
          onClose={() => setEditingAgentId(null)}
          onSaved={handleAgentSaved}
        />
      )}
      {showAnnotations && (
        <AnnotationsPanel
          annotations={annotations}
          messageAnnotations={messageAnnotations}
          conversations={conversations}
          documentId={currentDocId}
          documentTitle={
            documents.find((d) => d.id === currentDocId)?.title
          }
          onClose={() => setShowAnnotations(false)}
          onJumpToAnnotation={(id) => setFocusAnnotationId(id)}
          onJumpToConversation={(id) => setFocusConversationId(id)}
          refreshAll={refreshAll}
        />
      )}
    </div>
  )
}
