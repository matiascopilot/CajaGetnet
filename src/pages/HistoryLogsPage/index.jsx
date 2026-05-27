import React, { useState } from 'react';
import { Terminal, Download, Trash2, Search, Filter, RefreshCw, FileText } from 'lucide-react';

export default function HistoryLogsPage({
  logs,
  onClearLogs
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    // Filtrar por término de búsqueda
    let contentStr = '';
    if (typeof log.content === 'object') {
      contentStr = JSON.stringify(log.content).toLowerCase();
    } else {
      contentStr = String(log.content).toLowerCase();
    }
    const matchesSearch = contentStr.includes(searchTerm.toLowerCase());

    // Filtrar por tipo
    const matchesType = typeFilter === 'ALL' || log.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const handleDownloadLogs = () => {
    if (logs.length === 0) return;
    
    const plainText = logs.map(log => {
      let content = log.content;
      if (typeof log.content === 'object') {
        content = JSON.stringify(log.content, null, 2);
      }
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
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="card-title">
          <Terminal size={18} className="text-primary" />
          Historial Completo de Trazas y Comunicaciones
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ height: '34px', fontSize: '0.8rem', padding: '0 0.75rem' }}
            onClick={handleDownloadLogs}
            disabled={logs.length === 0}
          >
            <Download size={14} />
            Exportar TXT
          </button>
          
          <button
            type="button"
            className="btn-secondary"
            style={{ height: '34px', fontSize: '0.8rem', borderColor: 'var(--danger)', color: 'var(--danger)', padding: '0 0.75rem' }}
            onClick={onClearLogs}
            disabled={logs.length === 0}
          >
            <Trash2 size={14} />
            Limpiar Historial
          </button>
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Controles de Búsqueda y Filtros */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '0.75rem' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2rem', height: '38px' }}
              placeholder="Buscar palabras clave en trazas (ej: SALE, amount, ticket)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Filter size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
            <select
              className="form-select"
              style={{ paddingLeft: '2rem', height: '38px' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">Todos los eventos</option>
              <option value="REQ">Solicitudes (REQ)</option>
              <option value="RES">Respuestas (RES)</option>
              <option value="EVENT">Eventos de Caja</option>
              <option value="SUCCESS">Aprobaciones</option>
              <option value="ERROR">Errores (ERROR)</option>
              <option value="INFO">Información</option>
            </select>
          </div>
        </div>

        {/* Consola de Historial */}
        <div style={{
          backgroundColor: 'var(--term-bg)',
          borderRadius: '8px',
          border: '1px solid #1e293b',
          minHeight: '400px',
          maxHeight: '600px',
          overflowY: 'auto',
          padding: '1.25rem',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem',
          lineHeight: '1.5',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{ color: 'var(--term-timestamp)', fontStyle: 'italic', textAlign: 'center', margin: '4rem auto' }}>
              No se encontraron registros que coincidan con la búsqueda.
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const isJson = typeof log.content === 'object';
              
              return (
                <div key={index} className="log-line" style={{ borderBottom: '1px solid #111e30', paddingBottom: '0.4rem' }}>
                  <div className="log-meta" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="log-time" style={{ color: 'var(--term-timestamp)', fontSize: '0.75rem' }}>{log.time}</span>
                    <span className={`log-badge ${log.type.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>
                      {log.type}
                    </span>
                    {!isJson && <span className="log-content" style={{ color: 'var(--term-text)' }}>{log.content}</span>}
                  </div>
                  {isJson && (
                    <pre className={`log-json ${log.type.toLowerCase()}`} style={{ margin: '0.35rem 0 0 1rem', padding: '0.5rem', background: '#090e17' }}>
                      {JSON.stringify(log.content, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Mostrando {filteredLogs.length} de {logs.length} trazas de comunicación.</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <FileText size={12} />
            Los registros se almacenan temporalmente en la memoria del navegador.
          </span>
        </div>
      </div>
    </div>
  );
}
