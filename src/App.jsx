import React, { useState, useEffect, useRef } from 'react';
import { Bell, Settings, HelpCircle, Activity, CreditCard, Trash2, ShieldCheck, BarChart3, ChevronDown } from 'lucide-react';
import TerminalConsole from './components/TerminalConsole';
import ResponseStats from './components/ResponseStats';
import Getnet from './libs/getnet';

import SalePage from './pages/SalePage/index';
import RefundPage from './pages/RefundPage/index';
import BatchPage from './pages/BatchPage/index';
import TotalsPage from './pages/TotalsPage/index';
import ConnectionPage from './pages/ConnectionPage/index';
import HistoryLogsPage from './pages/HistoryLogsPage/index';

function App() {
  // ── Navegación ────────────────────────────────────────────────────────────────
  const [mainTab, setMainTab]               = useState('conexion'); // conexion primero
  const [activeTab, setActiveTab]           = useState('sale');
  const [integrationMode, setIntegrationMode] = useState('SDK');

  // ── Conexión ─────────────────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionType, setConnectionType]     = useState('USB');
  const [selectedPort, setSelectedPort]         = useState('Ninguno');
  const [wifiConfig, setWifiConfig]             = useState({ ip: '192.168.1.100', port: '8080' });
  const [realPort, setRealPort]                 = useState(null);
  const [baudRate, setBaudRate]                 = useState('115200');

  // ── Datos de sesión ───────────────────────────────────────────────────────────
  const [logs, setLogs]           = useState([]);
  const [txHistory, setTxHistory] = useState([]);
  const [lastResponse, setLastResponse] = useState({
    status: 'error',
    message: 'Sin actividad reciente',
    subMessage: 'Conecte el POS y ejecute una operación.'
  });
  const [latencies, setLatencies] = useState([42]);

  const readerRef = useRef(null);

  // ── Utilidades ────────────────────────────────────────────────────────────────
  const getTime = () => new Date().toTimeString().split(' ')[0];

  const addLog = (type, content) =>
    setLogs(prev => [...prev, { time: getTime(), type, content }]);

  const addTransaction = (tx) =>
    setTxHistory(prev => [...prev, { ...tx, id: `TX-${Date.now()}` }]);

  const handlePOSResponse = (resp) => {
    const isApproved = resp.ResponseCode === '00' || resp.ResponseCode === 0 || resp.ResponseCode === '0' || resp.ResponseCode === 'APPROVED';
    const msg = resp.ResponseMessage || resp.Message || (isApproved ? 'Aprobada' : 'Rechazada');
    const auth = resp.AuthorizationCode || resp.AuthCode || '—';
    const amount = resp.Amount || 0;
    const ticket = resp.TicketNumber || resp.Reference || '—';

    // The FunctionCodes map to the Getnet.POSCommands.Function numbers:
    // Sale=100, Refund=102, Close=103, Totals=104, Details=105, Poll=106, Return=108, CancelSale=116
    switch (resp.FunctionCode) {
      case 100: // Sale
        if (isApproved) {
          setLastResponse({
            status: 'success',
            message: 'Venta Aprobada',
            subMessage: `Auth: ${auth} | Ticket: ${ticket} | $${amount}`
          });
          addTransaction({
            amount: parseFloat(amount),
            status: 'APPROVED',
            ticket: ticket,
            type: 'Compra',
            authCode: auth
          });
        } else {
          setLastResponse({
            status: 'error',
            message: `Venta Rechazada (${resp.ResponseCode || 'ERR'})`,
            subMessage: msg
          });
        }
        break;

      case 102: // Refund (Anulación)
      case 108: // Return (Devolución)
        if (isApproved) {
          setLastResponse({
            status: 'success',
            message: 'Anulación Exitosa',
            subMessage: `Ticket: ${ticket} anulado correctamente.`
          });
          setTxHistory(prev => prev.map(tx => tx.ticket === ticket ? { ...tx, status: 'VOIDED' } : tx));
        } else {
          setLastResponse({
            status: 'error',
            message: `Anulación Fallida (${resp.ResponseCode || 'ERR'})`,
            subMessage: msg
          });
        }
        break;

      case 103: // Close (Cierre)
        if (isApproved) {
          setLastResponse({
            status: 'success',
            message: 'Cierre Exitoso',
            subMessage: `Lote cerrado. Transacciones: ${resp.TransactionsCount || 0} | Total: $${resp.TotalAmount || 0}`
          });
        } else {
          setLastResponse({
            status: 'error',
            message: 'Cierre Fallido',
            subMessage: msg
          });
        }
        break;

      case 104: // Totals
        if (isApproved) {
          setLastResponse({
            status: 'success',
            message: 'Totales Recuperados',
            subMessage: `Ventas Netas: $${resp.NetAmount || 0}`
          });
        } else {
          setLastResponse({
            status: 'error',
            message: 'Error Totales',
            subMessage: msg
          });
        }
        break;

      case 105: // Details
        if (isApproved) {
          setLastResponse({
            status: 'success',
            message: 'Detalle Recuperado',
            subMessage: `Consulte los logs para ver las transacciones`
          });
        } else {
          setLastResponse({
            status: 'error',
            message: 'Error Detalle',
            subMessage: msg
          });
        }
        break;

      case 106: // Poll
        addLog('INFO', `POS Poll responde: ${isApproved ? 'READY' : 'ERROR'}`);
        break;

      default:
        addLog('INFO', `Comando POS respondido: Código Función ${resp.FunctionCode}`);
        break;
    }
  };

  useEffect(() => {
    setLogs([
      { time: getTime(), type: 'INIT', content: 'Simulador de Caja iniciado. Ir a Conexión para vincular el POS.' },
    ]);

    // Set up Getnet SDK callbacks
    Getnet.SetCallback((data) => {
      if (data.Received) {
        addLog('RES', { received: true, message: 'POS ha recibido el comando.' });
        return;
      }

      if (data.JsonSerialized) {
        try {
          const resp = JSON.parse(data.JsonSerialized);
          addLog('RES', resp);
          handlePOSResponse(resp);
        } catch (e) {
          addLog('ERROR', `Error al procesar respuesta JSON: ${e.message}`);
        }
      } else {
        addLog('RES', data);
      }
    });

    Getnet.SetLogCallback((text) => {
      try {
        const parsed = JSON.parse(text);
        addLog('RAW', parsed);
      } catch (e) {
        addLog('RAW', text);
      }
    });

    Getnet.SetTimeErrorCallback(() => {
      addLog('ERROR', 'Timeout: El dispositivo POS no respondió en el tiempo límite.');
      setLastResponse({
        status: 'error',
        message: 'Timeout Excedido',
        subMessage: 'El terminal POS no respondió a la solicitud.'
      });
    });
  }, []); // eslint-disable-line

  // ── Serial Reader ─────────────────────────────────────────────────────────────
  const startReading = (port) => {
    const decoder = new TextDecoder();
    let buffer = '';

    const readLoop = async () => {
      let reader;
      try {
        reader = port.readable.getReader();
        readerRef.current = reader;
        addLog('INFO', 'Lector serial activo — escuchando respuestas del POS...');

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop();

          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try { addLog('RES', JSON.parse(t)); }
            catch { addLog('RES', `[COM←] ${t}`); }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') addLog('ERROR', `Lectura COM: ${err.message}`);
      } finally {
        if (reader) { try { reader.releaseLock(); } catch (_) {} }
        readerRef.current = null;
      }
    };

    readLoop();
  };

  const stopReading = async () => {
    if (readerRef.current) {
      try { await readerRef.current.cancel(); } catch (_) {}
      readerRef.current = null;
    }
  };

  // ── Conectar / Desconectar ────────────────────────────────────────────────────
  const handleConnectToggle = () => {
    if (connectionStatus === 'connected') {
      addLog('EVENT', 'Desconectando del dispositivo...');
      (async () => {
        if (integrationMode === 'SDK') {
          await Getnet.Desconectar();
          if (realPort) {
            try { await realPort.close(); } catch (_) {}
          }
        } else {
          await stopReading();
          if (realPort) {
            try { await realPort.close(); addLog('INFO', 'Puerto COM cerrado.'); }
            catch (e) { addLog('WARNING', `Al cerrar puerto: ${e.message}`); }
          }
        }
        setConnectionStatus('disconnected');
        addLog('EVENT', 'Conexión cerrada.');
      })();
      return;
    }

    if (connectionStatus === 'disconnected') {
      if (integrationMode !== 'SDK' && connectionType === 'USB' && !realPort) {
        addLog('ERROR', 'Vincule un puerto COM real en la pestaña Conexión primero.');
        setLastResponse({ status: 'error', message: 'Sin Puerto COM', subMessage: 'Ir a Conexión → Vincular Puerto Real.' });
        return;
      }

      setConnectionStatus('connecting');
      addLog('EVENT', `Iniciando conexión ${connectionType === 'USB' ? `COM (${baudRate} bps)` : `TCP (${wifiConfig.ip}:${wifiConfig.port})`}...`);

      setTimeout(async () => {
        if (integrationMode === 'SDK') {
          if (connectionType === 'USB' && realPort) {
            try {
              addLog('INFO', `Vinculando puerto manual al SDK Getnet a ${baudRate} bps...`);
              // AWAIT so the port is fully open and writer is ready before continuing
              await Getnet.establecerPuertoManual(realPort, baudRate);
              addLog('SUCCESS', `Puerto vinculado al SDK de Getnet.`);
            } catch (err) {
              addLog('ERROR', `Error al vincular puerto al SDK: ${err.message}`);
              setConnectionStatus('disconnected');
              return;
            }
          } else {
            addLog('INFO', 'Modo SDK: No se especificó puerto físico. Se solicitará en la primera transacción.');
          }

          setConnectionStatus('connected');
          addLog('SUCCESS', 'SDK Getnet listo y a la escucha.');

          // Poll the terminal using SDK — writer is guaranteed ready here
          addLog('EVENT', 'Enviando comando Poll inicial...');
          Getnet.Poll();
          return;
        }

        if (connectionType === 'USB' && realPort) {
          try {
            // If port is already open, close it first to avoid 'already open' errors
            if (realPort && realPort.readable) {
              await realPort.close();
              addLog('INFO', 'Puerto previamente abierto cerrado antes de reabrir.');
            }
            addLog('INFO', `Abriendo puerto a ${baudRate} bps...`);
            await realPort.open({ baudRate: parseInt(baudRate) });
            addLog('SUCCESS', `Puerto abierto a ${baudRate} bps.`);
            startReading(realPort);
          } catch (err) {
            addLog('ERROR', `Error al abrir COM: ${err.message}`);
            addLog('INFO', 'El puerto puede estar en uso por otra aplicación.');
            setConnectionStatus('disconnected');
            return;
          }
        }

        setConnectionStatus('connected');
        addLog('SUCCESS', 'Handshake OK.');

        const ts = Math.floor(Date.now() / 1000);
        let pollReq = { action: 'POLL', timestamp: ts };
        let pollRes = { status: 'READY', model: 'POS-VX520', id: 'POS-8821' };
        if (integrationMode === 'Protocolo Simplificado') { pollReq = { cmd: 'POL', ts }; pollRes = { rsp: 'ACK' }; }
        if (integrationMode === 'C2C') { pollReq = { jsonrpc: '2.0', method: 'c2c.terminal.poll', id: 1 }; pollRes = { jsonrpc: '2.0', result: { status: 'READY' }, id: 1 }; }

        addLog('REQ', pollReq);
        addLog('RES', pollRes);
        addLog('EVENT', 'Esperando instrucciones del operador...');
      }, 1000);
    }
  };

  // ── Comandos de Terminal ──────────────────────────────────────────────────────
  const handleSendCommand = (cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed.startsWith('/')) {
      addLog('EVENT', `Operador: "${trimmed}"`);
      if (connectionStatus === 'connected') {
        addLog('REQ', { action: 'SEND_MESSAGE', message: trimmed });
        setTimeout(() => addLog('RES', { status: 'DELIVERED' }), 50);
      }
      return;
    }

    const [command, ...args] = trimmed.split(' ');
    switch (command.toLowerCase()) {
      case '/help':
        addLog('INFO', 'Comandos: /poll · /status · /clear · /cierre · /venta [monto] · /help');
        break;
      case '/clear':
        setLogs([]);
        break;
      case '/poll':
        if (connectionStatus !== 'connected') { addLog('ERROR', 'No conectado.'); return; }
        if (integrationMode === 'SDK') {
          addLog('INFO', 'Enviando Poll vía SDK Getnet...');
          Getnet.Poll();
        } else {
          addLog('REQ', { action: 'POLL', timestamp: Math.floor(Date.now() / 1000) });
          setTimeout(() => addLog('RES', { status: 'READY', model: 'POS-VX520' }), 40);
        }
        break;
      case '/status':
        addLog('INFO', `${connectionStatus.toUpperCase()} | ${connectionType} | ${baudRate} bps | ${integrationMode}`);
        break;
      case '/cierre': {
        if (connectionStatus !== 'connected') { addLog('ERROR', 'No conectado.'); return; }
        if (integrationMode === 'SDK') {
          addLog('INFO', 'Enviando Cierre de Lote vía SDK Getnet...');
          Getnet.Close(true);
        } else {
          addLog('REQ', { action: 'CLOSE_BATCH', timestamp: Math.floor(Date.now() / 1000) });
          setTimeout(() => {
            const n = Math.floor(Math.random() * 15) + 5;
            const tot = n * 12500;
            addLog('RES', { status: 'SUCCESS', batchId: '0054', transactionsCount: n, totalAmount: tot });
            setLastResponse({ status: 'success', message: 'Cierre Exitoso', subMessage: `Lote #0054 | Tx: ${n} | $${tot}` });
          }, 800);
        }
        break;
      }
      case '/venta': {
        const amt = args[0] || '1000';
        if (connectionStatus !== 'connected') { addLog('ERROR', 'No conectado.'); return; }
        if (integrationMode === 'SDK') {
          addLog('INFO', `Iniciando Venta de $${amt} vía SDK Getnet...`);
          const ticket = Math.floor(1000 + Math.random() * 9000).toString();
          Getnet.Sale(parseFloat(amt), ticket, true, 0, false, 1);
        } else {
          addLog('INFO', `Venta vía terminal: $${amt}`);
          addLog('REQ', { action: 'SALE', amount: parseFloat(amt) });
          setTimeout(() => {
            const auth = Math.floor(100000 + Math.random() * 900000).toString();
            addLog('RES', { status: 'APPROVED', authCode: auth, amount: amt });
            setLastResponse({ status: 'success', message: 'Venta Aprobada', subMessage: `Auth: ${auth} | $${amt}` });
            addTransaction({ amount: parseFloat(amt), status: 'APPROVED', ticket: `T-${auth.slice(-4)}`, type: 'Compra', authCode: auth });
          }, 1000);
        }
        break;
      }
      default:
        addLog('WARNING', `Comando desconocido: ${command}. /help`);
    }
  };

  const handleClearLogs = () => setLogs([]);

  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const isFullPage = mainTab === 'conexion' || mainTab === 'logs';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-left">
          <div className="brand-title">Sim<span style={{ color: '#3b82f6' }}>Caja</span></div>

          <nav className="nav-links">
            {/* Conexión es el primero */}
            <a href="#conexion"   className={`nav-link ${mainTab === 'conexion'   ? 'active' : ''}`} onClick={e => { e.preventDefault(); setMainTab('conexion');   }}>Conexión</a>
            <a href="#simulador"  className={`nav-link ${mainTab === 'simulador'  ? 'active' : ''}`} onClick={e => { e.preventDefault(); setMainTab('simulador');  }}>Simulador</a>
            <a href="#logs"       className={`nav-link ${mainTab === 'logs'       ? 'active' : ''}`} onClick={e => { e.preventDefault(); setMainTab('logs');       }}>Logs Históricos</a>
          </nav>

          {/* Divider */}
          <div style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.12)', margin: '0 0.5rem' }} />

          {/* ── Selector de Integración en el TOPBAR ── */}
          <div className="header-integration-selector">
            <span className="header-integration-label">INTEGRACIÓN</span>
            <div className="header-select-wrapper">
              <select
                className="header-select"
                value={integrationMode}
                onChange={async e => {
                  const newMode = e.target.value;
                  setIntegrationMode(newMode);
                  addLog('INFO', `Integración → ${newMode}`);
                  if (connectionStatus === 'connected') {
                    addLog('WARNING', 'Cambio de modo detectado. Desconectando para aplicar cambios.');
                    if (integrationMode === 'SDK') {
                      await Getnet.Desconectar();
                    } else {
                      await stopReading();
                    }
                    if (realPort) {
                      try { await realPort.close(); } catch (_) {}
                    }
                    setConnectionStatus('disconnected');
                  }
                }}
              >
                <option value="SDK">Modo Integrado SDK</option>
                <option value="Protocolo Simplificado">Protocolo Simplificado</option>
                <option value="C2C">C2C (Cloud to Cloud)</option>
                <option value="A2A">A2A (App to App)</option>
              </select>
              <ChevronDown size={12} className="header-select-icon" />
            </div>
          </div>
        </div>

        <div className="header-right">
          {/* Indicador de estado */}
          {connectionStatus === 'connected' && (
            <div className="header-status-pill connected">
              <span className="header-status-dot" />
              {connectionType === 'USB' ? `COM · ${baudRate}` : wifiConfig.ip}
            </div>
          )}
          {connectionStatus === 'connecting' && (
            <div className="header-status-pill connecting">
              <span className="header-status-dot" />
              Conectando...
            </div>
          )}

          <div className="header-icons">
            <button className="header-icon-btn" title="Notificaciones" onClick={() => addLog('INFO', 'Sin nuevas alertas.')}>
              <Bell size={17} />
            </button>
            <button className="header-icon-btn" title="Configuración" onClick={() => setMainTab('conexion')}>
              <Settings size={17} />
            </button>
            <button className="header-icon-btn" title="Ayuda" onClick={() => addLog('INFO', '/help en la consola para ver comandos.')}>
              <HelpCircle size={17} />
            </button>
          </div>

          <button
            className={`btn-connect ${connectionStatus === 'connected' ? 'connected' : ''} ${connectionStatus === 'connecting' ? 'connecting' : ''}`}
            onClick={handleConnectToggle}
            disabled={connectionStatus === 'connecting' || (connectionType === 'USB' && !realPort && connectionStatus !== 'connected')}
          >
            <Activity size={15} />
            {connectionStatus === 'connected'    && 'Desconectar'}
            {connectionStatus === 'connecting'   && 'Conectando...'}
            {connectionStatus === 'disconnected' && 'Conectar POS'}
          </button>
        </div>
      </header>

      {/* ── BARRA DE ESTADO DELGADA ──────────────────────────────────────── */}
      <div className="status-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
         <div className="logo-getnet">
            <img
              src="./src/assets/getnet.png"
              alt="Getnet"
              className="logo-image"
            />
          </div>
          <span className="status-strip-badge" style={{
            backgroundColor: connectionStatus === 'connected' ? 'var(--success-light)' : 'var(--border-light)',
            color: connectionStatus === 'connected' ? 'var(--success)' : 'var(--text-muted)',
            border: `1px solid ${connectionStatus === 'connected' ? 'var(--success)' : 'var(--border-color)'}`,
          }}>
            {connectionStatus === 'connected' ? '● CONECTADO' : '○ DESCONECTADO'}
          </span>
        </div>

        <div className="status-strip-info">
          <span>Canal: <strong>{connectionType}</strong></span>
          <span className="status-sep">·</span>
          <span>{connectionType === 'USB' ? 'Puerto' : 'IP'}:{' '}
            <strong style={{ color: connectionStatus === 'connected' ? 'var(--success)' : 'var(--text-muted)' }}>
              {connectionStatus === 'connected' ? (connectionType === 'USB' ? selectedPort : wifiConfig.ip) : '—'}
            </strong>
          </span>
          {connectionStatus === 'connected' && connectionType === 'USB' && (
            <><span className="status-sep">·</span><span>Baud: <strong>{baudRate}</strong></span></>
          )}
          {txHistory.length > 0 && (
            <><span className="status-sep">·</span>
            <span>Sesión: <strong style={{ color: 'var(--primary)' }}>{txHistory.filter(t => t.status === 'APPROVED').length} ventas / {txHistory.filter(t => t.status === 'VOIDED').length} anulaciones</strong></span></>
          )}
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL ───────────────────────────────────────────── */}
      <main className="main-content" style={isFullPage ? { gridTemplateColumns: '1fr' } : {}}>

        {mainTab === 'conexion' && (
          <ConnectionPage
            connectionType={connectionType}    setConnectionType={setConnectionType}
            selectedPort={selectedPort}        setSelectedPort={setSelectedPort}
            wifiConfig={wifiConfig}            setWifiConfig={setWifiConfig}
            realPort={realPort}                setRealPort={setRealPort}
            baudRate={baudRate}                setBaudRate={setBaudRate}
            addLog={addLog}
            connectionStatus={connectionStatus}
            onConnectToggle={handleConnectToggle}
          />
        )}

        {mainTab === 'logs' && (
          <HistoryLogsPage logs={logs} onClearLogs={handleClearLogs} />
        )}

        {mainTab === 'simulador' && (
          <>
            {/* ── Panel izquierdo ── */}
            <div className="left-panel" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem', alignItems: 'start' }}>
              <div className="tab-sidebar">
                {[
                  { id: 'sale',   icon: <CreditCard size={20} />, label: 'Ventas'  },
                  { id: 'refund', icon: <Trash2     size={20} />, label: 'Anular'  },
                  { id: 'batch',  icon: <ShieldCheck size={20}/>, label: 'Cierre'  },
                  { id: 'totals', icon: <BarChart3  size={20} />, label: 'Totales' },
                ].map(({ id, icon, label }) => (
                  <button key={id} type="button"
                    className={`sidebar-tab-btn ${activeTab === id ? 'active' : ''}`}
                    onClick={() => setActiveTab(id)} title={label}
                  >
                    {icon}
                    <span className="sidebar-tab-label">{label}</span>
                  </button>
                ))}
              </div>

              <div className="tab-content">
                {activeTab === 'sale'   && <SalePage   connectionStatus={connectionStatus} addLog={addLog} setLastResponse={setLastResponse} setLatencies={setLatencies} realPort={realPort} connectionType={connectionType} selectedPort={selectedPort} integrationMode={integrationMode} addTransaction={addTransaction} />}
                {activeTab === 'refund' && <RefundPage  connectionStatus={connectionStatus} addLog={addLog} setLastResponse={setLastResponse} setLatencies={setLatencies} realPort={realPort} connectionType={connectionType} selectedPort={selectedPort} integrationMode={integrationMode} addTransaction={addTransaction} />}
                {activeTab === 'batch'  && <BatchPage   connectionStatus={connectionStatus} addLog={addLog} setLastResponse={setLastResponse} setLatencies={setLatencies} realPort={realPort} connectionType={connectionType} selectedPort={selectedPort} integrationMode={integrationMode} />}
                {activeTab === 'totals' && <TotalsPage  connectionStatus={connectionStatus} addLog={addLog} setLastResponse={setLastResponse} setLatencies={setLatencies} realPort={realPort} connectionType={connectionType} selectedPort={selectedPort} integrationMode={integrationMode} txHistory={txHistory} />}
              </div>
            </div>

            {/* ── Panel derecho ── */}
            <div className="right-panel">
              <TerminalConsole logs={logs} onClearLogs={handleClearLogs} onSendCommand={handleSendCommand} />
              <ResponseStats lastResponse={lastResponse} averageLatency={avgLatency} />
            </div>
          </>
        )}
      </main>

      {/* ── Estilos inline ─────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Header integration selector ── */
        .header-integration-selector {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .header-integration-label {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.6px;
          color: rgba(255,255,255,0.35);
          text-transform: uppercase;
          white-space: nowrap;
        }
        .header-select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .header-select {
          appearance: none;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.9);
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.3rem 1.8rem 0.3rem 0.65rem;
          border-radius: 6px;
          cursor: pointer;
          outline: none;
          transition: background 0.15s ease, border-color 0.15s ease;
          min-width: 170px;
        }
        .header-select:hover {
          background: rgba(255,255,255,0.12);
          border-color: rgba(255,255,255,0.25);
        }
        .header-select:focus {
          border-color: #3b82f6;
          background: rgba(59,130,246,0.12);
        }
        .header-select option {
          background: #0f1e33;
          color: #e0e6ed;
        }
        .header-select-icon {
          position: absolute;
          right: 0.55rem;
          color: rgba(255,255,255,0.45);
          pointer-events: none;
        }

        /* ── Header status pill ── */
        .header-status-pill {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          border-radius: 20px;
          letter-spacing: 0.3px;
        }
        .header-status-pill.connected {
          background: rgba(25, 128, 56, 0.18);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.3);
        }
        .header-status-pill.connecting {
          background: rgba(245, 196, 0, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(251,191,36,0.3);
        }
        .header-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite ease-in-out;
        }

        /* ── Status strip ── */
        .status-strip {
          background-color: var(--bg-card);
          border-bottom: 1px solid var(--border-color);
          padding: 0.5rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .status-strip-badge {
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.15rem 0.55rem;
          border-radius: 20px;
          letter-spacing: 0.4px;
        }
        .status-strip-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .status-sep { color: var(--border-color); }

        /* ── Mini Sidebar ── */
        .tab-sidebar {
          display: flex; flex-direction: column; gap: 0.5rem;
          background: var(--bg-card); border: 1px solid var(--border-color);
          border-radius: 8px; padding: 0.6rem 0.4rem; align-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .sidebar-tab-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          width: 66px; height: 66px; border-radius: 8px; border: none;
          background: none; color: var(--text-muted); cursor: pointer;
          transition: var(--transition-fast); gap: 0.35rem;
        }
        .sidebar-tab-btn:hover { background: var(--border-light); color: var(--text-dark); }
        .sidebar-tab-btn.active {
          background: var(--primary-light); color: var(--primary);
          border: 1px solid var(--border-accent);
        }
        .sidebar-tab-label {
          font-size: 0.6rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.2px;
        }
        .tab-content { flex: 1; }
      `}} />
    </div>
  );
}

export default App;
