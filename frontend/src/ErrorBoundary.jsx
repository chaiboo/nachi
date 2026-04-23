import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { err: null, info: null }
  }
  static getDerivedStateFromError(err) {
    return { err }
  }
  componentDidCatch(err, info) {
    console.error('[Nachi ErrorBoundary]', err, info)
    this.setState({ info })
  }
  render() {
    if (this.state.err) {
      return (
        <div
          style={{
            padding: '2rem',
            fontFamily: 'ui-monospace, monospace',
            color: '#a63232',
            background: '#fff5f5',
            minHeight: '100vh',
            whiteSpace: 'pre-wrap',
          }}
        >
          <h2 style={{ margin: '0 0 1rem 0' }}>Nachi crashed</h2>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {String(this.state.err.message || this.state.err)}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            {this.state.err.stack}
          </div>
          {this.state.info && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
              {this.state.info.componentStack}
            </div>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
