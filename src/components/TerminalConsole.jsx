import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, Copy, Send, Check, ArrowDownCircle, Terminal } from 'lucide-react';

const LOG_COLORS = {
  INIT:    { badge: '#4589ff', bg: 'rgba(69,137,255,0.08)',  border: 'rgba(69,137,255,0.18)' },
  SUCCESS: { badge: '#24a148', bg: 'rgba(36,161,72,0.07)',   border: 'rgba(36,161,72,0.18)'  },
  INFO:    { badge: '#f1c21b', bg: 'rgba(241,194,27,0.07)',  border: 'rgba(241,194,27,0.18)' },
  ERROR:   { badge: '#fa4d56', bg: 'rgba(250,77,86,0.08)',   border: 'rgba(250,77,86,0.2)'   },
  WARNING: { badge: '#ff832b', bg: 'rgba(255,131,43,0.07)',  border: 'rgba(255,131,43,0.18)' },
  EVENT:   { badge: '#878d96', bg: 'rgba(135,141,150,0.06)', border: 'rgba(135,141,150,0.14)'},
  REQ:     { badge: '#d12df7', bg: 'rgba(209,45,247,0.07)',  border: 'rgba(209,45,247,0.2)'  },
  RES:     { badge: '#00baad', bg: 'rgba(0,186,173,0.07)',   border: 'rgba(0,186,173,0.2)'   },
  RAW:     { badge: '#a78bfa', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.18)'},
};

function getLogColor(type) {
  return LOG_COLORS[type?.toUpperCase()] || LOG_COLORS['INFO'];
}

export default function TerminalConsole({ logs, onClearLogs, onSendCommand }) {
  const [inputVal, setInputVal]     = useState('');
  const [copied, setCopied]         = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newCount, setNewCount]     = useState(0);

  const bodyRef    = useRef(null);
  const endRef     = useRef(null);
  const prevLen    = useRef(0);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setIsAtBottom(atBottom);
    if (atBottom) setNewCount(0);
  }, []);

  // Auto-scroll only if already at bottom
  useEffect(() => {
    const added = logs.length - prevLen.current;
    prevLen.current = logs.length;
    if (added <= 0) return;

    if (isAtBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewCount(0);
    } else {
      setNewCount(c => c + added);
    }
  }, [logs, isAtBottom]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewCount(0);
  };

  const handleCopyLogs = () => {
    if (!logs.length) return;
    const text = logs.map(l => {
      const c = typeof l.content === 'object' ? JSON.stringify(l.content, null, 2) : l.content;
      return `[${l.time}] [${l.type}] ${c}`;
    }).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    onSendCommand(inputVal);
    setInputVal('');
  };

  return (
    <div className="terminal-card">
      {/* ── Header ── */}
      <div className="terminal-header">
        <div className="terminal-title">
          <div className="terminal-dots">
            <div className="term-dot red" />
            <div className="term-dot yellow" />
            <div className="term-dot green" />
          </div>
          <Terminal size={13} style={{ marginLeft: '0.6rem', color: '#4589ff' }} />
          <span style={{ marginLeft: '0.3rem', letterSpacing: '0.4px' }}>
            REGISTRO DE DATOS
          </span>
          {logs.length > 0 && (
            <span style={{
              marginLeft: '0.5rem',
              background: 'rgba(69,137,255,0.18)',
              color: '#4589ff',
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '10px',
              letterSpacing: '0.2px',
            }}>
              {logs.length}
            </span>
          )}
        </div>

        <div className="terminal-actions">
          <button type="button" className="terminal-action-btn" onClick={onClearLogs} title="Limpiar consola">
            <Trash2 size={13} />
            <span>Limpiar</span>
          </button>
          <button
            type="button"
            className="terminal-action-btn"
            onClick={handleCopyLogs}
            disabled={!logs.length}
            title="Copiar todos los logs"
          >
            {copied
              ? <Check size={13} style={{ color: '#24a148' }} />
              : <Copy size={13} />}
            <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* ── Log Body ── */}
      <div
        className="terminal-body"
        ref={bodyRef}
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="terminal-empty">
            <Terminal size={28} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
            <span>Consola vacía.</span>
            <span style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
              Conecte el POS o envíe una transacción para ver los registros.
            </span>
          </div>
        ) : (
          logs.map((log, i) => {
            const isJson = typeof log.content === 'object';
            const color  = getLogColor(log.type);
            const isLast = i === logs.length - 1;

            return (
              <div
                key={i}
                className="log-row"
                style={{
                  '--log-bg':     color.bg,
                  '--log-border': color.border,
                  animation: isLast ? 'logSlideIn 0.18s ease-out both' : 'none',
                }}
              >
                <div className="log-meta">
                  <span className="log-time-chip">{log.time}</span>
                  <span
                    className="log-type-chip"
                    style={{ background: color.bg, color: color.badge, borderColor: color.border }}
                  >
                    {log.type}
                  </span>
                  {!isJson && (
                    <span className="log-text">{log.content}</span>
                  )}
                </div>
                {isJson && (
                  <pre
                    className="log-json-block"
                    style={{ borderLeftColor: color.badge }}
                  >
                    {JSON.stringify(log.content, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* ── Scroll-to-bottom FAB ── */}
      {!isAtBottom && (
        <button
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
          title="Ir al final"
        >
          <ArrowDownCircle size={16} />
          {newCount > 0 && (
            <span className="scroll-badge">{newCount > 99 ? '99+' : newCount}</span>
          )}
        </button>
      )}

      {/* ── Input Bar ── */}
      <form className="terminal-input-bar" onSubmit={handleSubmit}>
        <span className="terminal-prompt">$</span>
        <input
          type="text"
          className="terminal-input"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          placeholder="Comando (ej. /poll, /status, /cierre, /help)..."
        />
        <button type="submit" className="terminal-send-btn" title="Enviar">
          <Send size={15} />
        </button>
      </form>

      <style>{`
        /* ── Log rows ── */
        .log-row {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding: 0.38rem 0.6rem;
          border-radius: 6px;
          border: 1px solid transparent;
          transition: background 0.12s ease, border-color 0.12s ease;
          cursor: default;
        }
        .log-row:hover {
          background: var(--log-bg, rgba(255,255,255,0.03));
          border-color: var(--log-border, rgba(255,255,255,0.08));
        }

        /* Meta row */
        .log-meta {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        /* Time chip */
        .log-time-chip {
          font-size: 0.68rem;
          color: #4a5568;
          font-family: var(--font-mono);
          white-space: nowrap;
          letter-spacing: 0.2px;
        }

        /* Type chip */
        .log-type-chip {
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid transparent;
          white-space: nowrap;
          font-family: var(--font-mono);
        }

        /* Log text */
        .log-text {
          font-size: 0.82rem;
          color: #c9d1db;
          word-break: break-word;
          line-height: 1.45;
        }

        /* JSON block */
        .log-json-block {
          font-size: 0.78rem;
          background: rgba(0,0,0,0.25);
          border-left: 2px solid #334155;
          border-radius: 0 4px 4px 0;
          padding: 0.45rem 0.8rem;
          margin: 0.15rem 0 0.15rem 1.1rem;
          white-space: pre-wrap;
          word-break: break-all;
          color: #94a3b8;
          line-height: 1.5;
          overflow-x: auto;
        }

        /* Empty state */
        .terminal-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #4a5568;
          font-style: italic;
          text-align: center;
          flex: 1;
          min-height: 200px;
          gap: 0.1rem;
        }

        /* Scroll-to-bottom button */
        .scroll-to-bottom-btn {
          position: absolute;
          bottom: 60px;
          right: 14px;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(59,130,246,0.85);
          color: #fff;
          border: none;
          border-radius: 20px;
          padding: 0.35rem 0.7rem;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(59,130,246,0.4);
          transition: background 0.15s ease, transform 0.12s ease;
          backdrop-filter: blur(4px);
          z-index: 10;
          font-family: var(--font-sans);
          letter-spacing: 0.2px;
        }
        .scroll-to-bottom-btn:hover {
          background: rgba(37,99,235,0.95);
          transform: translateY(-2px);
        }

        .scroll-badge {
          background: #ef4444;
          color: #fff;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 0 4px;
          border-radius: 8px;
          min-width: 16px;
          text-align: center;
        }

        /* Slide-in animation for new logs */
        @keyframes logSlideIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
      `}</style>
    </div>
  );
}
