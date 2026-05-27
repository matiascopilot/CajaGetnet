import React, { useState, useEffect, useCallback } from 'react';
import { Usb, Wifi, RefreshCw, Cpu, HelpCircle, Power, CheckCircle, AlertTriangle, Zap, Unplug, MonitorSmartphone } from 'lucide-react';

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

  // ── Cargar puertos emparejados ────────────────────────────────────────────────
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

      // Auto-seleccionar el primero si no hay selección activa
      if (mapped.length > 0 && (!selectedPort || !selectedPort.startsWith('REAL'))) {
        setSelectedPort(mapped[0].id);
        setRealPort(mapped[0].portObj);
      }
    } catch (err) {
      addLog('ERROR', `Error al cargar puertos: ${err.message}`);
    }
  }, [selectedPort, setSelectedPort, setRealPort, addLog]);

  // ── Inicialización + listeners de hot-plug ────────────────────────────────────
  useEffect(() => {
    if (!('serial' in navigator)) {
      setWebSerialSupported(false);
      return;
    }

    setWebSerialSupported(true);
    loadRealPorts();

    const handleConnect = (e) => {
      const display = getPortDisplayInfo(e.target);
      addLog('SUCCESS', `🔌 Dispositivo conectado: ${display.label} (${display.subtitle})`);
      loadRealPorts();
    };

    const handleDisconnect = (e) => {
      const display = getPortDisplayInfo(e.target);
      addLog('WARNING', `⚡ Dispositivo desconectado: ${display.label} (${display.subtitle})`);

      // Si el puerto desconectado es el que estaba seleccionado, limpiarlo
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

  // ── Escanear puertos manualmente ──────────────────────────────────────────────
  const handleScanPorts = async () => {
    setIsScanning(true);
    addLog('EVENT', 'Escaneando puertos COM locales...');
    if (webSerialSupported) await loadRealPorts();
    setTimeout(() => {
      setIsScanning(false);
      addLog('SUCCESS', `Escaneo completo. ${ports.length} puerto(s) detectado(s).`);
    }, 800);
  };

  // ── Vincular nuevo puerto ─────────────────────────────────────────────────────
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
  };  const handlePortSelect = (port) => {
    setSelectedPort(port.id);
    setRealPort(port.portObj);
    addLog('INFO', `Puerto activo → ${port.name}`);
  };

  const handleUnbindPort = async (portToUnbind) => {
    if (selectedPort === portToUnbind.id) {
      if (connectionStatus === 'connected') {
        await onConnectToggle();
      }
      setSelectedPort('Ninguno');
      setRealPort(null);
    }
    try {
      if (portToUnbind.portObj && typeof portToUnbind.portObj.forget === 'function') {
        await portToUnbind.portObj.forget();
        addLog('SUCCESS', `Permiso del navegador revocado para: ${portToUnbind.name}`);
      }
    } catch (e) {
      console.warn("forget() no soportado:", e);
    }
    setPorts(prev => prev.filter(p => p.id !== portToUnbind.id));
    addLog('WARNING', `🔌 Puerto desvinculado: ${portToUnbind.name}`);
  };
  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="panel-card" style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title">
          <Usb size={18} className="text-primary" />
          Gestión de Conexión y Puertos COM
        </div>
        <div className="segmented-control" style={{ margin: 0 }}>
          <button type="button" className={`segment-btn ${connectionType === 'USB' ? 'active' : ''}`}
            onClick={() => { setConnectionType('USB'); addLog('INFO', 'Modo: USB / COM Serial.'); }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Usb size={13} /> USB (COM)
            </span>
          </button>
          <button type="button" className={`segment-btn ${connectionType === 'WIFI' ? 'active' : ''}`}
            onClick={() => { setConnectionType('WIFI'); addLog('INFO', 'Modo: WiFi / TCP.'); }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Wifi size={13} /> WiFi (TCP)
            </span>
          </button>
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {connectionType === 'USB' ? (
          <div>
            {/* Encabezado de puertos + badge de compatibilidad */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="selector-label" style={{ margin: 0 }}>Puertos COM detectados</div>
              <span style={{
                fontSize: '0.72rem', fontWeight: 'bold', padding: '0.2rem 0.55rem', borderRadius: '20px',
                backgroundColor: webSerialSupported ? 'var(--success-light)' : 'var(--danger-light)',
                color: webSerialSupported ? 'var(--success)' : 'var(--danger)',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                border: `1px solid ${webSerialSupported ? 'var(--success)' : 'var(--danger)'}`,
              }}>
                {webSerialSupported ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                {webSerialSupported ? 'Web Serial OK' : 'No Soportado'}
              </span>
            </div>

            {/* Baud Rate Selector */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Velocidad (Baud Rate)</label>
                <select
                  className="form-select"
                  value={baudRate}
                  onChange={(e) => {
                    setBaudRate(e.target.value);
                    addLog('INFO', `Baud rate → ${e.target.value} bps`);
                  }}
                  disabled={connectionStatus === 'connected'}
                >
                  {BAUD_RATES.map(br => (
                    <option key={br} value={br}>{br} bps {br === '115200' ? '(recomendado)' : ''}</option>
                  ))}
                </select>
              </div>
              <div style={{
                flex: 1, padding: '0.6rem 0.75rem', backgroundColor: 'var(--border-light)',
                borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1.1rem',
              }}>
                <MonitorSmartphone size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>Hot-plug activo: los dispositivos USB se detectan automáticamente al conectar/desconectar.</span>
              </div>
            </div>

            {/* Lista de puertos */}
            {ports.length > 0 ? (
              <div className="port-list" style={{ marginBottom: '1rem' }}>
                {ports.map((port) => (
                  <div
                    key={port.id}
                    className={`port-option ${selectedPort === port.id ? 'active' : ''}`}
                    onClick={() => handlePortSelect(port)}
                  >
                    <div className="port-option-left">
                      <div className="port-radio" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{port.name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {port.subtitle}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {port.vendor && (
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                          borderRadius: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)',
                          letterSpacing: '0.3px', border: '1px solid var(--border-accent)',
                        }}>
                          {port.vendor.split('(')[0].trim()}
                        </span>
                      )}
                      {selectedPort === port.id && (
                        <span className="port-badge" style={{ backgroundColor: 'var(--success)' }}>
                          ACTIVO
                        </span>
                      )}
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                          marginLeft: '0.25rem'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--danger-light)';
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnbindPort(port);
                        }}
                        title="Desvincular puerto COM"
                      >
                        <Unplug size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '2rem 1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px',
                textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.88rem',
                background: 'linear-gradient(135deg, var(--border-light) 0%, rgba(237,245,255,0.5) 100%)',
              }}>
                <Unplug size={28} style={{ color: 'var(--border-color)', marginBottom: '0.5rem' }} />
                <div>
                  {webSerialSupported
                    ? 'No hay puertos COM emparejados. Conecte un dispositivo USB y haga clic en "Vincular Puerto Real".'
                    : 'Web Serial no disponible en este navegador. Utilice Chrome, Edge u Opera.'}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1, height: '40px' }}
                onClick={handleScanPorts} disabled={isScanning || !webSerialSupported}>
                <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
                {isScanning ? 'Escaneando...' : 'Refrescar Puertos'}
              </button>
              <button type="button" className="btn-connect" style={{ flex: 1.2, height: '40px', justifyContent: 'center' }}
                onClick={handleRequestPortPermission} disabled={!webSerialSupported}>
                <Cpu size={15} />
                Vincular Puerto Real
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="selector-label">Configuración del Servidor TCP (POS)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Dirección IP del Dispositivo</label>
                <input type="text" className="form-input"
                  value={wifiConfig.ip} onChange={(e) => setWifiConfig({ ...wifiConfig, ip: e.target.value })}
                  placeholder="192.168.1.100" />
              </div>
              <div className="form-group">
                <label className="form-label">Puerto TCP</label>
                <input type="text" className="form-input"
                  value={wifiConfig.port} onChange={(e) => setWifiConfig({ ...wifiConfig, port: e.target.value })}
                  placeholder="8080" />
              </div>
            </div>
          </div>
        )}

        {/* Nota informativa */}
        <div style={{
          padding: '0.65rem 0.85rem', backgroundColor: 'var(--border-light)', borderRadius: '6px',
          fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
          borderLeft: '3px solid var(--primary)',
        }}>
          <HelpCircle size={16} className="text-primary" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            {connectionType === 'USB'
              ? 'La Web Serial API proporciona comunicación directa con puertos COM físicos. Los dispositivos conectados se detectan automáticamente. No se simulan puertos para garantizar pruebas reales.'
              : 'En modo WiFi, la caja se conecta al POS por TCP/IP. Asegúrese de estar en la misma red.'}
          </span>
        </div>

        {/* Botón conectar/desconectar */}
        <button type="button"
          className={`btn-connect ${connectionStatus === 'connected' ? 'connected' : ''}`}
          style={{ width: '100%', justifyContent: 'center', height: '46px', fontSize: '0.95rem' }}
          onClick={onConnectToggle}
          disabled={connectionStatus === 'connecting' || (connectionType === 'USB' && !realPort && connectionStatus !== 'connected')}
        >
          <Power size={16} />
          {connectionStatus === 'connected'
            ? 'Desconectar Canal'
            : connectionStatus === 'connecting'
              ? 'Abriendo Canal...'
              : `Iniciar Conexión ${connectionType === 'USB' ? `(${baudRate} bps)` : `(${wifiConfig.ip})`}`}
        </button>
      </div>
    </div>
  );
}
