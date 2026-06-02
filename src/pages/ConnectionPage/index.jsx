import React, { useState, useEffect, useCallback } from 'react';
import { Usb, Wifi, RefreshCw, Cpu, HelpCircle, Power, CheckCircle, AlertTriangle, Unplug, MonitorSmartphone, Zap } from 'lucide-react';

// Base de datos simple de fabricantes USB comunes en terminales POS
const USB_VENDORS = {
  0x0403: 'FTDI (Future Technology Devices)',
  0x10C4: 'Silicon Labs CP210x',
  0x067B: 'Prolific PL2303',
  0x1A86: 'QinHeng CH340/CH341',
  0x2341: 'Arduino',
  0x0451: 'Texas Instruments',
  0x04B4: 'Cypress Semiconductor',
  0x0D28: 'ARM mbed',
  0x16C0: 'Teensyduino',
  0x239A: 'Adafruit',
  0x2E8A: 'Raspberry Pi Pico',
  0x1366: 'SEGGER J-Link',
  0x0483: 'STMicroelectronics',
  0x1FC9: 'NXP Semiconductors',
};

const BAUD_RATES = ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'];

function getPortDisplayInfo(port) {
  const info = port.getInfo();
  const vid = info.usbVendorId;
  const pid = info.usbProductId;
  const vidHex = vid ? `0x${vid.toString(16).toUpperCase().padStart(4, '0')}` : null;
  const pidHex = pid ? `0x${pid.toString(16).toUpperCase().padStart(4, '0')}` : null;
  const vendor = vid && USB_VENDORS[vid] ? USB_VENDORS[vid] : null;

  let label = 'Puerto COM Físico';
  if (vendor) {
    label = vendor;
  } else if (vidHex) {
    label = `USB Serial (VID: ${vidHex})`;
  }

  return {
    vid, pid, vidHex, pidHex, vendor, label,
    subtitle: vidHex ? `VID: ${vidHex} · PID: ${pidHex || 'N/A'}` : 'Sin información USB (puerto nativo)',
  };
}

export default function ConnectionPage({
  connectionType, setConnectionType,
  selectedPort, setSelectedPort,
  wifiConfig, setWifiConfig,
  realPort, setRealPort,
  baudRate, setBaudRate,
  addLog,
  connectionStatus,
  onConnectToggle
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [ports, setPorts] = useState([]);
  const [webSerialSupported, setWebSerialSupported] = useState(false);

  // ── Cargar puertos emparejados ─────────────────────────────────────────────
  const loadRealPorts = useCallback(async () => {
    if (!('serial' in navigator)) return;
    try {
      const realPorts = await navigator.serial.getPorts();
      const mapped = realPorts.map((port, idx) => {
        const display = getPortDisplayInfo(port);
        return {
          id: `REAL-COM-${idx}-${display.vidHex || 'NATIVE'}`,
          name: display.label,
          subtitle: display.subtitle,
          vendor: display.vendor,
          vidHex: display.vidHex,
          pidHex: display.pidHex,
          portObj: port,
        };
      });
      setPorts(mapped);
      if (mapped.length > 0 && (!selectedPort || !selectedPort.startsWith('REAL'))) {
        setSelectedPort(mapped[0].id);
        setRealPort(mapped[0].portObj);
      }
    } catch (err) {
      addLog('ERROR', `Error al cargar puertos: ${err.message}`);
    }
  }, [selectedPort, setSelectedPort, setRealPort, addLog]);

  // ── Inicialización + listeners hot-plug ───────────────────────────────────
  useEffect(() => {
    if (!('serial' in navigator)) {
      setWebSerialSupported(false);
      return;
    }
    setWebSerialSupported(true);
    loadRealPorts();

    const handleConnect = (e) => {
      const display = getPortDisplayInfo(e.target);
      addLog('SUCCESS', `Dispositivo conectado: ${display.label} (${display.subtitle})`);
      loadRealPorts();
    };
    const handleDisconnect = (e) => {
      const display = getPortDisplayInfo(e.target);
      addLog('WARNING', `Dispositivo desconectado: ${display.label} (${display.subtitle})`);
      if (realPort === e.target) {
        setRealPort(null);
        setSelectedPort('Ninguno');
        addLog('EVENT', 'Puerto activo fue removido. Seleccione otro o reconecte.');
      }
      loadRealPorts();
    };

    navigator.serial.addEventListener('connect', handleConnect);
    navigator.serial.addEventListener('disconnect', handleDisconnect);
    return () => {
      navigator.serial.removeEventListener('connect', handleConnect);
      navigator.serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, [loadRealPorts, realPort, setRealPort, setSelectedPort, addLog]);

  // ── Escanear puertos manualmente ──────────────────────────────────────────
  const handleScanPorts = async () => {
    setIsScanning(true);
    addLog('EVENT', 'Escaneando puertos COM locales...');
    if (webSerialSupported) await loadRealPorts();
    setTimeout(() => {
      setIsScanning(false);
      addLog('SUCCESS', `Escaneo completo. ${ports.length} puerto(s) detectado(s).`);
    }, 800);
  };

  // ── Vincular nuevo puerto ─────────────────────────────────────────────────
  const handleRequestPortPermission = async () => {
    if (!webSerialSupported) {
      addLog('ERROR', 'Web Serial API no disponible. Use Chrome, Edge u Opera.');
      return;
    }
    try {
      addLog('INFO', 'Solicitando permiso de puerto serial...');
      const port = await navigator.serial.requestPort();
      const display = getPortDisplayInfo(port);
      const newId = `REAL-USB-${display.vidHex || 'XX'}-${display.pidHex || 'XX'}-${Date.now()}`;
      const newItem = {
        id: newId,
        name: display.label,
        subtitle: display.subtitle,
        vendor: display.vendor,
        vidHex: display.vidHex,
        pidHex: display.pidHex,
        portObj: port,
      };
      setPorts(prev => [newItem, ...prev.filter(p => p.portObj !== port)]);
      setSelectedPort(newId);
      setRealPort(port);
      addLog('SUCCESS', `Puerto vinculado: ${display.label} — ${display.subtitle}`);
    } catch (err) {
      if (err.name === 'NotFoundError') {
        addLog('INFO', 'Vinculación cancelada por el usuario.');
      } else {
        addLog('ERROR', `Error al vincular: ${err.message}`);
      }
    }
  };

  const handlePortSelect = (port) => {
    setSelectedPort(port.id);
    setRealPort(port.portObj);
    addLog('INFO', `Puerto activo → ${port.name}`);
  };

  const handleUnbindPort = async (portToUnbind) => {
    if (selectedPort === portToUnbind.id) {
      if (connectionStatus === 'connected') await onConnectToggle();
      setSelectedPort('Ninguno');
      setRealPort(null);
    }
    try {
      if (portToUnbind.portObj && typeof portToUnbind.portObj.forget === 'function') {
        await portToUnbind.portObj.forget();
        addLog('SUCCESS', `Permiso revocado para: ${portToUnbind.name}`);
      }
    } catch (e) {
      console.warn('forget() no soportado:', e);
    }
    setPorts(prev => prev.filter(p => p.id !== portToUnbind.id));
    addLog('WARNING', `Puerto desvinculado: ${portToUnbind.name}`);
  };

  // ── Derivados de estado ───────────────────────────────────────────────────
  const isConnected   = connectionStatus === 'connected';
  const isConnecting  = connectionStatus === 'connecting';
  const canConnect    = connectionType === 'USB'
    ? !!realPort || isConnected
    : !!(wifiConfig.ip && wifiConfig.port);

  const ctaLabel = isConnected
    ? 'Desconectar Canal'
    : isConnecting
      ? 'Abriendo Canal...'
      : connectionType === 'USB'
        ? `Iniciar Conexión (${baudRate} bps)`
        : `Conectar a ${wifiConfig.ip}:${wifiConfig.port}`;

  const ctaClass = isConnected
    ? 'btn-cta btn-cta-danger'
    : isConnecting
      ? 'btn-cta btn-cta-warning'
      : 'btn-cta btn-cta-primary';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="panel-card" style={{ maxWidth: 860, margin: '0 auto', width: '100%' }}>

      {/* ── Header ── */}
      <div className="card-header">
        <div className="card-title">
          <Usb size={16} className="text-primary" />
          Gestión de Conexión y Puertos COM
        </div>
        <div className="segmented-control" style={{ margin: 0 }}>
          <button
            type="button"
            id="tab-usb"
            className={`segment-btn ${connectionType === 'USB' ? 'active' : ''}`}
            onClick={() => { setConnectionType('USB'); addLog('INFO', 'Modo: USB / COM Serial.'); }}
          >
            <Usb size={13} /> USB (COM)
          </button>
          <button
            type="button"
            id="tab-wifi"
            className={`segment-btn ${connectionType === 'WIFI' ? 'active' : ''}`}
            onClick={() => { setConnectionType('WIFI'); addLog('INFO', 'Modo: WiFi / TCP.'); }}
          >
            <Wifi size={13} /> WiFi (TCP)
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        {connectionType === 'USB' ? (
          <>
            {/* ── Baud Rate + Hot-plug ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="baud-rate-select">Velocidad de Comunicación</label>
                <select
                  id="baud-rate-select"
                  className="form-select"
                  value={baudRate}
                  onChange={(e) => {
                    setBaudRate(e.target.value);
                    addLog('INFO', `Baud rate → ${e.target.value} bps`);
                  }}
                  disabled={isConnected}
                >
                  {BAUD_RATES.map(br => (
                    <option key={br} value={br}>{br} bps{br === '115200' ? ' — recomendado' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="hotplug-card">
                <MonitorSmartphone size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: '#1e40af', lineHeight: 1.4 }}>
                  Hot-plug activo — los dispositivos USB se detectan automáticamente.
                </span>
              </div>
            </div>

            {/* ── Header puertos ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="selector-label">Puertos COM detectados</span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: '20px',
                backgroundColor: webSerialSupported ? 'var(--success-light)' : 'var(--danger-light)',
                color: webSerialSupported ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${webSerialSupported ? 'var(--success)' : 'var(--danger)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}>
                {webSerialSupported ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                {webSerialSupported ? 'Web Serial OK' : 'No Soportado'}
              </span>
            </div>

            {/* ── Lista de puertos ── */}
            {ports.length > 0 ? (
              <div className="port-list">
                {ports.map((port) => (
                  <div
                    key={port.id}
                    id={`port-${port.id}`}
                    className={`port-option ${selectedPort === port.id ? 'active' : ''}`}
                    onClick={() => handlePortSelect(port)}
                    role="radio"
                    aria-checked={selectedPort === port.id}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handlePortSelect(port)}
                  >
                    <div className="port-option-left">
                      <div className="port-radio" aria-hidden="true" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-dark)' }}>
                          {port.name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {port.subtitle}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      {port.vendor && (
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 800, padding: '0.1rem 0.4rem',
                          borderRadius: '4px', backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)', letterSpacing: '0.3px',
                          border: '1px solid var(--border-accent)',
                        }}>
                          {port.vendor.split('(')[0].trim()}
                        </span>
                      )}
                      {selectedPort === port.id && (
                        <span className="port-badge">ACTIVO</span>
                      )}
                      <button
                        type="button"
                        id={`unbind-${port.id}`}
                        title="Desvincular puerto COM"
                        style={{
                          background: 'none', border: 'none',
                          color: 'var(--text-subtle)', cursor: 'pointer',
                          padding: '0.25rem', borderRadius: '4px',
                          display: 'flex', alignItems: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--danger)';
                          e.currentTarget.style.background = 'var(--danger-light)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-subtle)';
                          e.currentTarget.style.background = 'none';
                        }}
                        onClick={(e) => { e.stopPropagation(); handleUnbindPort(port); }}
                      >
                        <Unplug size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Unplug size={28} className="empty-state-icon" />
                <p className="empty-state-text">
                  {webSerialSupported
                    ? 'No hay puertos COM emparejados. Conecte un dispositivo USB y haga clic en "Vincular Puerto Real".'
                    : 'Web Serial no disponible en este navegador. Utilice Chrome, Edge u Opera.'}
                </p>
              </div>
            )}

            {/* ── Botones de acción ── */}
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                id="btn-refresh-ports"
                className="btn-secondary"
                style={{ flex: 1, height: 'var(--btn-height)' }}
                onClick={handleScanPorts}
                disabled={isScanning || !webSerialSupported}
              >
                <RefreshCw size={14} style={{ animation: isScanning ? 'spin 1s linear infinite' : 'none' }} />
                {isScanning ? 'Escaneando...' : 'Refrescar Puertos'}
              </button>
              <button
                type="button"
                id="btn-bind-port"
                className="btn-primary"
                style={{ flex: 1.4, height: 'var(--btn-height)' }}
                onClick={handleRequestPortPermission}
                disabled={!webSerialSupported}
              >
                <Cpu size={15} />
                Vincular Puerto Real
              </button>
            </div>
          </>
        ) : (
          /* ── WiFi Config ── */
          <div className="wifi-fields">
            <div className="form-section-title">Configuración del Servidor TCP (POS)</div>
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label" htmlFor="wifi-ip">Dirección IP del Dispositivo</label>
                <input
                  type="text"
                  id="wifi-ip"
                  className="form-input"
                  value={wifiConfig.ip}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, ip: e.target.value })}
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="wifi-port">Puerto TCP</label>
                <input
                  type="text"
                  id="wifi-port"
                  className="form-input"
                  value={wifiConfig.port}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, port: e.target.value })}
                  placeholder="8080"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Nota informativa ── */}
        <div className="info-banner">
          <HelpCircle size={15} className="text-primary" />
          <span>
            {connectionType === 'USB'
              ? 'La Web Serial API proporciona comunicación directa con puertos COM físicos. Los dispositivos se detectan automáticamente. No se simulan puertos para garantizar pruebas reales.'
              : 'En modo WiFi, la caja se conecta al POS por TCP/IP. Asegúrese de que ambos dispositivos estén en la misma red local.'}
          </span>
        </div>

        {/* ── CTA Conectar / Desconectar ── */}
        <button
          type="button"
          id="btn-connect-toggle"
          className={ctaClass}
          onClick={onConnectToggle}
          disabled={isConnecting || (!canConnect && !isConnected)}
        >
          <Power size={17} />
          {ctaLabel}
        </button>
      </div>

      {/* Spin keyframe inline */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
