import React, { useState } from 'react';
import { Terminal, Download, Trash2, Search, Filter, FileText } from 'lucide-react';

export default function HistoryLogsPage({ logs, onClearLogs }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    let contentStr = '';
    if (typeof log.content === 'object') {
      contentStr = JSON.stringify(log.content).toLowerCase();
    } else {
      contentStr = String(log.content).toLowerCase();
    }
    const matchesSearch = contentStr.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || log.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleDownloadLogs = () => {
    if (logs.length === 0) return;
    const plainText = logs.map(log => {
      let content = log.content;
      if (typeof log.content === 'object') content = JSON.stringify(log.content, null, 2);
      return `[${log.time}] [${log.type}] ${content}`;
    }).join('\n');
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `caja_simulador_logs_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel-card" style={{ width: '100%' }}>
      {/* ── Header ── */}
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.65rem' }}>
        <div className="card-title">
          <Terminal size={16} className="text-primary" />
          Historial Completo de Trazas y Comunicaciones
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button" id="btn-export-logs"
            className="btn-secondary"
            style={{ height: 'var(--input-height-sm)', fontSize: '0.8rem', padding: '0 0.75rem' }}
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
          >
            <Download size={13} />
            Exportar TXT
          </button>
          <button
            type="button" id="btn-clear-logs"
            className="btn-secondary"
            style={{ height: 'var(--input-height-sm)', fontSize: '0.8rem', padding: '0 0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={onClearLogs}
            disabled={logs.length === 0}
          >
            <Trash2 size={13} />
            Limpiar
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        {/* Search + Filter */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '0.65rem' }}>
          <div className="input-container">
            <span className="input-icon-left"><Search size={15} /></span>
            <input
              type="text"
              id="logs-search"
              className="form-input form-input-icon"
              placeholder="Buscar en trazas (ej: SALE, amount, ticket)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="input-container">
            <span className="input-icon-left"><Filter size={15} /></span>
            <select
              id="logs-type-filter"
              className="form-select"
              style={{ paddingLeft: '2.1rem' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">Todos los eventos</option>
              <option value="REQ">Solicitudes (REQ)</option>
              <option value="RES">Respuestas (RES)</option>
              <option value="EVENT">Eventos de Caja</option>
              <option value="SUCCESS">Aprobaciones</option>
              <option value="ERROR">Errores</option>
              <option value="INFO">Información</option>
              <option value="WARNING">Advertencias</option>
            </select>
          </div>
        </div>

        {/* Log console */}
        <div style={{
          backgroundColor: 'var(--term-bg)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #1e293b',
          minHeight: 400,
          maxHeight: 560,
          overflowY: 'auto',
          padding: '1rem 1.1rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.83rem',
          lineHeight: 1.55,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{ color: 'var(--term-timestamp)', fontStyle: 'italic', textAlign: 'center', margin: '4rem auto' }}>
              No se encontraron registros que coincidan con la búsqueda.
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const isJson = typeof log.content === 'object';
              return (
                <div key={index} className="log-line" style={{ borderBottom: '1px solid #111e30', paddingBottom: '0.35rem' }}>
                  <div className="log-meta">
                    <span className="log-time" style={{ fontSize: '0.73rem' }}>{log.time}</span>
                    <span className={`log-badge ${log.type.toLowerCase()}`} style={{ fontSize: '0.68rem' }}>
                      {log.type}
                    </span>
                    {!isJson && <span className="log-content">{log.content}</span>}
                  </div>
                  {isJson && (
                    <pre className={`log-json ${log.type.toLowerCase()}`} style={{ margin: '0.3rem 0 0 1rem', padding: '0.45rem 0.75rem', background: '#090e17' }}>
                      {JSON.stringify(log.content, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Mostrando <strong>{filteredLogs.length}</strong> de <strong>{logs.length}</strong> trazas de comunicación</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-subtle)' }}>
            <FileText size={12} />
            Almacenamiento temporal en memoria del navegador
          </span>
        </div>
      </div>
    </div>
  );
}
