import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ask,
  createAnnotation,
  createMessageAnnotation,
  reply,
} from '../api'

export default function ChatPanel({
  agents,
  agentId,
  setAgentId,
  setAgentIdEphemeral,
  documentId,
  pendingAction,
  clearPendingAction,
  conversations,
  messageAnnotations,
  refreshAll,
  focusConversationId,
  focusSeq,
  onAnchorClick,
  onRequestNewAgent,
  onRequestEditAgent,
  setFocusConversationId,
}) {
  const [question, setQuestion] = useState('')
  const [noteText, setNoteText] = useState('')
  const [useFullBook, setUseFullBook] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [msgPopup, setMsgPopup] = useState(null)
  const [replyState, setReplyState] = useState(null) // {conversationId, quote}
  const [replyText, setReplyText] = useState('')
  // { convId, agentId } identifying the specific also-ask chip in flight.
  const [alsoAskLoading, setAlsoAskLoading] = useState(null)
  // Optimistic placeholders for in-flight asks. We support multiple in
  // parallel so the user can fire and keep reading without being blocked.
  // Each entry: { id, agentId, agentName, agentColor, displayQuestion,
  //               selected_text, page, started_at, kind }
  const [pendingAsks, setPendingAsks] = useState([])
  const convRefs = useRef({})

  useEffect(() => {
    if (!documentId) {
      setUseFullBook(false)
      return
    }
    const v = localStorage.getItem(`nachi:fullbook:${documentId}`)
    setUseFullBook(v === '1')
  }, [documentId])

  function toggleFullBook(next) {
    setUseFullBook(next)
    if (documentId) {
      localStorage.setItem(`nachi:fullbook:${documentId}`, next ? '1' : '0')
    }
  }

  useEffect(() => {
    if (focusConversationId && convRefs.current[focusConversationId]) {
      convRefs.current[focusConversationId].scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [focusConversationId, focusSeq])

  // Plain highlight: save immediately, no form
  useEffect(() => {
    if (pendingAction?.kind === 'highlight') {
      (async () => {
        try {
          await createAnnotation({
            document_id: documentId,
            selected_text: pendingAction.text,
            page: pendingAction.page,
            paragraph: pendingAction.paragraph,
            rects: pendingAction.rects,
            kind: 'highlight',
          })
          clearPendingAction()
          refreshAll()
        } catch (err) {
          setError(String(err.message || err))
          clearPendingAction()
        }
      })()
    }
  }, [pendingAction, documentId, clearPendingAction, refreshAll])

  // The scholar's default "do your thing" label. Used when the user hits submit
  // with an empty textarea — the action_prompt (or the action label, if no
  // richer prompt is set) becomes the question sent to the scholar.
  const activeAgent = agents.find((a) => a.id === agentId)
  const scholarAction = activeAgent?.action || 'Ask'
  const scholarDefaultPrompt =
    activeAgent?.action_prompt?.trim() || scholarAction

  async function handleAskSubmit(e) {
    e.preventDefault()
    if (!pendingAction || !documentId || !agentId) return
    const typed = question.trim()
    const prompt = typed || scholarDefaultPrompt
    const displayQuestion = typed ? null : scholarAction
    // Capture pendingAction values up front so we don't depend on the
    // closure after we clear it (and so subsequent asks don't trample).
    const sel = pendingAction.text
    const para = pendingAction.paragraph
    const pg = pendingAction.page
    const rects = pendingAction.rects
    const useBook = useFullBook
    const askId = `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setError(null)
    // Optimistic placeholder for THIS ask. Multiple can stack up.
    setPendingAsks((prev) => [
      ...prev,
      {
        id: askId,
        agentId,
        agentName: activeAgent?.name || agentId,
        agentColor: activeAgent?.color || '#888',
        displayQuestion: displayQuestion || prompt,
        selected_text: sel,
        page: pg,
        started_at: Date.now(),
        kind: 'ask',
      },
    ])
    setQuestion('')
    clearPendingAction()
    try {
      const res = await ask({
        agent_id: agentId,
        document_id: documentId,
        selected_text: sel,
        paragraph: para,
        page: pg,
        rects,
        use_full_book: useBook,
        question: prompt,
        display_question: displayQuestion,
      })
      await refreshAll()
      if (res?.conversation_id) {
        setFocusConversationId?.(res.conversation_id)
      }
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAsks((prev) => prev.filter((p) => p.id !== askId))
    }
  }

  async function handleNoteSubmit(e) {
    e.preventDefault()
    if (!pendingAction || !noteText.trim() || !documentId) return
    setLoading(true)
    setError(null)
    try {
      await createAnnotation({
        document_id: documentId,
        selected_text: pendingAction.text,
        page: pendingAction.page,
        paragraph: pendingAction.paragraph,
        rects: pendingAction.rects,
        kind: 'note',
        note_text: noteText.trim(),
      })
      setNoteText('')
      clearPendingAction()
      refreshAll()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  async function handleAlsoAsk(conv, targetAgentId) {
    const firstUser = conv.messages.find((m) => m.role === 'user')
    if (!firstUser || !conv.selected_text) return
    let rects = null
    if (conv.rects_json) {
      try {
        rects = JSON.parse(conv.rects_json)
      } catch {
        rects = null
      }
    }

    // If the original user message was a scholar's default (either the
    // short action label like "Joke", OR the full action_prompt that was
    // stored before we added display_question handling), use the TARGET
    // scholar's own framing instead of forwarding the original scholar's
    // prompt. Otherwise pass through the user's actual typed question.
    const target = agents.find((a) => a.id === targetAgentId)
    const content = firstUser.content || ''
    const isShortAction = agents.some((a) => a.action === content)
    const isFullActionPrompt = agents.some(
      (a) => a.action_prompt && a.action_prompt.trim() === content.trim(),
    )
    const looksLikeAction = isShortAction || isFullActionPrompt
    const prompt =
      looksLikeAction && target
        ? target.action_prompt?.trim() || target.action || 'Ask'
        : content
    const displayQuestion = looksLikeAction ? target?.action || 'Ask' : null

    setAlsoAskLoading({ convId: conv.id, agentId: targetAgentId })
    setError(null)
    try {
      const askId = `also-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setPendingAsks((prev) => [
        ...prev,
        {
          id: askId,
          agentId: targetAgentId,
          agentName: target?.name || targetAgentId,
          agentColor: target?.color || '#888',
          displayQuestion: displayQuestion || prompt,
          selected_text: conv.selected_text,
          page: conv.page,
          started_at: Date.now(),
          kind: 'also_ask',
        },
      ])
      try {
        const res = await ask({
          agent_id: targetAgentId,
          document_id: documentId,
          selected_text: conv.selected_text,
          paragraph: conv.paragraph || null,
          page: conv.page,
          rects,
          use_full_book: false,
          question: prompt,
          display_question: displayQuestion,
        })
        await refreshAll()
        setAgentIdEphemeral?.(targetAgentId)
        if (res?.conversation_id) {
          setFocusConversationId?.(res.conversation_id)
        }
      } finally {
        setPendingAsks((prev) => prev.filter((p) => p.id !== askId))
      }
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setAlsoAskLoading(null)
    }
  }

  // Global cursor feedback: only the user-blocking ones (submit-pressed
  // forms) put the page in progress state. Background asks shouldn't make
  // the whole UI feel busy.
  useEffect(() => {
    const busy = loading
    const root = document.documentElement
    if (busy) root.classList.add('nachi-busy')
    else root.classList.remove('nachi-busy')
    return () => root.classList.remove('nachi-busy')
  }, [loading])


  async function handleReplySubmit(e) {
    e.preventDefault()
    if (!replyState || !replyText.trim()) return
    const convId = replyState.conversationId
    const conv = conversations.find((c) => c.id === convId)
    const agent = agents.find((a) => a.id === conv?.agent_id)
    const replyContent = replyText.trim()
    const quote = replyState.quote
    const displayContent = quote
      ? `[quoting: ${quote}]\n\n${replyContent}`
      : replyContent
    const askId = `reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setError(null)
    setPendingAsks((prev) => [
      ...prev,
      {
        id: askId,
        agentId: conv?.agent_id,
        agentName: agent?.name || conv?.agent_id || 'Scholar',
        agentColor: conv?.color || agent?.color || '#888',
        displayQuestion: displayContent,
        selected_text: null,
        page: conv?.page,
        started_at: Date.now(),
        kind: 'reply',
        conversationId: convId,
      },
    ])
    setReplyText('')
    setReplyState(null)
    try {
      await reply({
        conversation_id: convId,
        question: replyContent,
        quote,
      })
      await refreshAll()
      setFocusConversationId?.(convId)
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setPendingAsks((prev) => prev.filter((p) => p.id !== askId))
    }
  }

  function handleAgentSelectChange(e) {
    const v = e.target.value
    if (v === '__new__') {
      onRequestNewAgent()
      return
    }
    setAgentId(v)
  }

  const canEditAgent = !!agentId

  function handleMessageMouseUp(messageId, e) {
    const sel = window.getSelection()
    const text = sel ? sel.toString().trim() : ''
    if (!text || text.length < 2) return
    const node = sel.anchorNode
    if (!node) return
    const container = e.currentTarget
    if (!container.contains(node)) return

    // Compute flat offset in container's innerText
    const { start, end } = getFlatTextOffsets(container, sel.getRangeAt(0))
    if (start === end) return

    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const POPUP_WIDTH = 300
    const MARGIN = 8
    const maxX = window.innerWidth - POPUP_WIDTH - MARGIN
    const clampedX = Math.max(MARGIN, Math.min(rect.right, maxX))
    setMsgPopup({
      messageId,
      text,
      start,
      end,
      x: clampedX,
      y: rect.bottom + window.scrollY + 6,
    })
  }

  async function handleMsgAction(kind, popup) {
    if (kind === 'reply') {
      // Find the conversation this message belongs to
      const conv = conversations.find((c) =>
        c.messages.some((m) => m.id === popup.messageId),
      )
      if (!conv) return
      setReplyState({ conversationId: conv.id, quote: popup.text })
      setMsgPopup(null)
      window.getSelection()?.removeAllRanges()
      return
    }
    if (kind === 'highlight' || kind === 'note') {
      const note = kind === 'note' ? prompt('Note:') : null
      if (kind === 'note' && !note) {
        setMsgPopup(null)
        return
      }
      try {
        await createMessageAnnotation({
          message_id: popup.messageId,
          kind,
          start_offset: popup.start,
          end_offset: popup.end,
          selected_text: popup.text,
          note_text: note,
        })
        setMsgPopup(null)
        window.getSelection()?.removeAllRanges()
        refreshAll()
      } catch (err) {
        setError(String(err.message || err))
      }
    }
  }

  const annotationsByMessage = useMemo(() => {
    const m = {}
    for (const a of messageAnnotations || []) {
      if (!m[a.message_id]) m[a.message_id] = []
      m[a.message_id].push(a)
    }
    return m
  }, [messageAnnotations])

  const showAsk = pendingAction?.kind === 'ask'
  const showNote = pendingAction?.kind === 'note'
  const hasContent =
    conversations.length > 0 ||
    (messageAnnotations || []).length > 0 ||
    pendingAction ||
    replyState ||
    pendingAsks.length > 0

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <label className="agent-label">Scholar</label>
        <select
          value={agentId || ''}
          onChange={handleAgentSelectChange}
          className="agent-select"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
          <option value="__new__">+ New scholar…</option>
        </select>
        <button
          className="agent-edit-btn"
          onClick={() => canEditAgent && onRequestEditAgent?.(agentId)}
          disabled={!canEditAgent}
          title={
            canEditAgent
              ? 'Edit this scholar'
              : 'Select a specific scholar to edit'
          }
          aria-label="Edit scholar"
        >
          ✎
        </button>
      </div>

      <div className="chat-body">
        {!hasContent && (
          <div className="chat-empty">
            <p>
              Select a passage in the PDF. Use <em>Highlight</em> to mark it,{' '}
              <em>Note</em> to add a thought, or <em>Ask →</em> to summon a
              scholar.
            </p>
          </div>
        )}

        {conversations.map((c) => (
          <div
            key={c.id}
            ref={(el) => {
              if (el) convRefs.current[c.id] = el
            }}
            className={
              'conv' + (c.id === focusConversationId ? ' conv-focus' : '')
            }
          >
            {c.selected_text && (
              <button
                className="conv-anchor"
                style={{ borderLeftColor: c.color || '#888' }}
                onClick={() => onAnchorClick?.(c.annotation_id)}
              >
                <div
                  className="anchor-label"
                  style={{ color: c.color || '#888' }}
                >
                  {c.page ? `p. ${c.page}` : '—'} ·{' '}
                  {(c.agent_id || '').replace(/_/g, ' ')}
                </div>
                <div className="anchor-text">"{c.selected_text}"</div>
              </button>
            )}
            {c.messages.map((m) => {
              const anns = annotationsByMessage[m.id] || []
              const agent = agents.find((a) => a.id === c.agent_id)
              const agentName =
                agent?.name || (c.agent_id || '').replace(/_/g, ' ')
              return (
                <div key={m.id} className={`msg msg-${m.role}`}>
                  {m.role === 'user' ? (
                    <div className="msg-user-text">{m.content}</div>
                  ) : (
                    <>
                      <div
                        className="msg-agent-label"
                        style={{ color: c.color || '#888' }}
                      >
                        <span
                          className="msg-agent-dot"
                          style={{ background: c.color || '#888' }}
                        />
                        {agentName}
                        <span
                          className={
                            'src-badge ' + (m.used_web ? 'src-web' : 'src-model')
                          }
                          title={
                            m.used_web
                              ? 'Used web search — see cited sources'
                              : 'Model knowledge only (may be outdated; no sources)'
                          }
                        >
                          {m.used_web ? '🔎 web' : '📖 model'}
                        </span>
                      </div>
                      <div
                        className="msg-assistant-text"
                        onMouseUp={(e) => handleMessageMouseUp(m.id, e)}
                      >
                        <AnnotatedMarkdown
                          content={m.content}
                          annotations={anns}
                        />
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            <div className="conv-actions">
              <button
                className="reply-btn"
                onClick={() =>
                  setReplyState({ conversationId: c.id, quote: null })
                }
              >
                Follow up ↵
              </button>
              {c.selected_text && (
                <div className="also-ask">
                  <span className="also-ask-label">Also ask:</span>
                  {agents
                    .filter((a) => a.id !== c.agent_id)
                    .map((a) => {
                      const isThisOne =
                        alsoAskLoading?.convId === c.id &&
                        alsoAskLoading?.agentId === a.id
                      const anyBusy =
                        loading || alsoAskLoading !== null
                      return (
                        <button
                          key={a.id}
                          className={
                            'also-ask-chip' +
                            (isThisOne ? ' loading' : '')
                          }
                          style={{ borderColor: a.color, color: a.color }}
                          onClick={() => handleAlsoAsk(c, a.id)}
                          disabled={anyBusy}
                          title={`Ask ${a.name} the same question`}
                        >
                          {isThisOne ? '⟳ asking…' : a.name}
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        ))}

        {pendingAsks.map((p) => (
          <PendingAsk key={p.id} pending={p} />
        ))}

        {showAsk && (
          <form className="ask-form" onSubmit={handleAskSubmit}>
            <SelectedQuote sel={pendingAction} />
            <textarea
              autoFocus
              placeholder={`Optional: ask something specific. Or just hit ${scholarAction.toLowerCase()}.`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                  handleAskSubmit(e)
              }}
              rows={3}
              disabled={loading}
            />
            <div className="ask-options">
              <label
                className={'opt-toggle' + (useFullBook ? ' active' : '')}
                title="Include the entire document text. Sticky per document. Anthropic prompt-caches for 5 min."
              >
                <input
                  type="checkbox"
                  checked={useFullBook}
                  onChange={(e) => toggleFullBook(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  {useFullBook ? '📖 Full book on' : 'Include full book'}
                </span>
              </label>
            </div>
            <div className="ask-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={clearPendingAction}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading
                  ? useFullBook
                    ? 'Reading book…'
                    : 'Thinking…'
                  : question.trim()
                  ? 'Ask'
                  : scholarAction}
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </form>
        )}

        {showNote && (
          <form className="ask-form note-form" onSubmit={handleNoteSubmit}>
            <SelectedQuote sel={pendingAction} />
            <textarea
              autoFocus
              placeholder="Your note…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                  handleNoteSubmit(e)
              }}
              rows={3}
              disabled={loading}
            />
            <div className="ask-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={clearPendingAction}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !noteText.trim()}
              >
                {loading ? 'Saving…' : 'Save note'}
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </form>
        )}

        {replyState && (
          <form className="ask-form reply-form" onSubmit={handleReplySubmit}>
            {replyState.quote && (
              <div className="selected-quote">
                <div className="quote-label">Quoting response</div>
                <div className="quote-text">"{replyState.quote}"</div>
              </div>
            )}
            <textarea
              autoFocus
              placeholder={
                replyState.quote
                  ? 'Follow up on this specifically…'
                  : 'Follow-up question…'
              }
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                  handleReplySubmit(e)
              }}
              rows={3}
              disabled={loading}
            />
            <div className="ask-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setReplyState(null)
                  setReplyText('')
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !replyText.trim()}
              >
                {loading ? 'Thinking…' : 'Send'}
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </form>
        )}
      </div>

      {msgPopup && (
        <div
          className="msg-popup"
          style={{ left: msgPopup.x, top: msgPopup.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            className="pop-btn"
            onClick={() => handleMsgAction('highlight', msgPopup)}
          >
            Highlight
          </button>
          <button
            className="pop-btn"
            onClick={() => handleMsgAction('note', msgPopup)}
          >
            Note
          </button>
          <button
            className="pop-btn primary"
            onClick={() => handleMsgAction('reply', msgPopup)}
          >
            Quote reply →
          </button>
        </div>
      )}
    </div>
  )
}

function SelectedQuote({ sel }) {
  return (
    <div className="selected-quote">
      <div className="quote-label">
        Selected{sel.page ? ` · p. ${sel.page}` : ''}
      </div>
      <div className="quote-text">"{sel.text}"</div>
    </div>
  )
}

/**
 * Walk a container's DOM and compute the flat text offsets of a Range's
 * start and end against innerText-equivalent content.
 */
function getFlatTextOffsets(container, range) {
  function offsetTo(node, nodeOffset) {
    let total = 0
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
    )
    let n
    while ((n = walker.nextNode())) {
      if (n === node) return total + nodeOffset
      total += n.textContent.length
    }
    return total
  }
  return {
    start: offsetTo(range.startContainer, range.startOffset),
    end: offsetTo(range.endContainer, range.endOffset),
  }
}

/**
 * Render markdown and overlay highlight spans based on flat-text offsets.
 * Rough: applies background styles to text nodes by walking the rendered
 * DOM after mount and wrapping matching ranges with spans.
 */
function PendingAsk({ pending }) {
  // Optimistic placeholder for an in-flight ask. Renders the user's question
  // and a "thinking…" beat for the scholar.
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])
  return (
    <div className="conv conv-pending" ref={ref}>
      {pending.selected_text && (
        <div
          className="conv-anchor pending-anchor"
          style={{
            borderLeftColor: pending.agentColor,
            borderRightColor: pending.agentColor,
          }}
        >
          <div
            className="anchor-label"
            style={{ color: pending.agentColor }}
          >
            {pending.page ? `p. ${pending.page}` : '—'} ·{' '}
            {pending.agentName}
          </div>
          <div className="anchor-text">"{pending.selected_text}"</div>
        </div>
      )}
      <div className="msg msg-user">
        <div className="msg-user-text">{pending.displayQuestion}</div>
      </div>
      <div className="msg msg-assistant">
        <div
          className="msg-agent-label"
          style={{ color: pending.agentColor }}
        >
          <span
            className="msg-agent-dot"
            style={{ background: pending.agentColor }}
          />
          {pending.agentName}
        </div>
        <div className="msg-assistant-text msg-pending">
          <span className="pending-dots">
            <span></span><span></span><span></span>
          </span>
          <span className="pending-elapsed">thinking…</span>
        </div>
      </div>
    </div>
  )
}

function AnnotatedMarkdown({ content, annotations }) {
  // NOTE: visual highlighting of text within a rendered markdown tree is
  // fragile (DOM mutation conflicts with React). For now, render the markdown
  // normally and show highlight snippets separately. Revisit with a custom
  // renderer later.
  const anns = (annotations || []).filter((a) => a.selected_text)
  return (
    <div>
      <ReactMarkdown>{content}</ReactMarkdown>
      {anns.length > 0 && (
        <div className="msg-annotations">
          {anns.map((a) => (
            <div
              key={a.id}
              className={`msg-ann msg-ann-${a.kind}`}
              title={a.note_text || a.selected_text}
            >
              <span className="msg-ann-dot" />
              <span className="msg-ann-text">"{a.selected_text}"</span>
              {a.note_text && (
                <span className="msg-ann-note"> — {a.note_text}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

