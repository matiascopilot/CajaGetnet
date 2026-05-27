import React, { useRef, useEffect, useState } from 'react';
import { Trash2, Copy, Send, Check } from 'lucide-react';

export default function TerminalConsole({
  logs,
  onClearLogs,
  onSendCommand
}) {
  const [inputVal, setInputVal] = useState('');
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef(null);
  const terminalBodyRef = useRef(null);

  // Auto-scroll: only the terminal body scrolls, not the page
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    
    const plainText = logs.map(log => {
      let content = log.content;
      if (typeof log.content === 'object') {
        content = JSON.stringify(log.content, null, 2);
      }
      return `[${log.time}] [${log.type}] ${content}`;
    }).join('\n');

    navigator.clipboard.writeText(plainText).then(() => {
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
      <div className="terminal-header">
        <div className="terminal-title">
          <div className="terminal-dots">
            <div className="term-dot red" />
            <div className="term-dot yellow" />
            <div className="term-dot green" />
          </div>
          <span style={{ marginLeft: '0.5rem' }}>REGISTRO DE DATOS - DATA_LOG_001.txt</span>
        </div>
        
        <div className="terminal-actions">
          <button
            type="button"
            className="terminal-action-btn"
            onClick={onClearLogs}
          >
            <Trash2 size={13} />
            <span>Limpiar</span>
          </button>
          
          <button
            type="button"
            className="terminal-action-btn"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
          >
            {copied ? <Check size={13} style={{ color: 'var(--term-success)' }} /> : <Copy size={13} />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      <div className="terminal-body" ref={terminalBodyRef}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--term-timestamp)', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
            Consola vacía. Inicie una conexión o envíe una transacción para ver los registros.
          </div>
        ) : (
          logs.map((log, index) => {
            const isJson = typeof log.content === 'object';
            
            return (
              <div key={index} className="log-line">
                <div className="log-meta">
                  <span className="log-time">[{log.time}]</span>
                  <span className={`log-badge ${log.type.toLowerCase()}`}>
                    {log.type}
                  </span>
                  {!isJson && <span className="log-content">{log.content}</span>}
                </div>
                {isJson && (
                  <pre className={`log-json ${log.type.toLowerCase()}`}>
                    {JSON.stringify(log.content, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      <form className="terminal-input-bar" onSubmit={handleSubmit}>
        <span className="terminal-prompt">$</span>
        <input
          type="text"
          className="terminal-input"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Comando manual (ej. /poll, /status, /help, /cierre)..."
        />
        <button type="submit" className="terminal-send-btn">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
