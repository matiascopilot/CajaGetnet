import React, { useState } from 'react';
import { ShieldCheck, Award, FileSpreadsheet, ChevronRight } from 'lucide-react';
import Getnet from '../../libs/getnet-adapter';

export default function BatchPage({
  connectionStatus,
  addLog,
  setLastResponse,
  setLatencies,
  realPort,
  connectionType,
  selectedPort,
  integrationMode
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [forceClose, setForceClose] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const getPayloadsByMode = (ts, batchId, txCount, totalAmount) => {
    switch (integrationMode) {
      case 'Protocolo Simplificado':
        return {
          req: { cmd: 'CLS', op: employeeId, ts },
          res: { rsp: 'OK', batch: batchId, txs: txCount, tot: totalAmount, msg: 'CIERRE EXITOSO' },
        };
      case 'C2C': {
        const jsonRpcId = Math.floor(1000 + Math.random() * 9000);
        return {
          req: { jsonrpc: '2.0', method: 'c2c.batch.close', params: { operatorId: employeeId }, id: jsonRpcId },
          res: { jsonrpc: '2.0', result: { status: 'CLOSED', batchId, totalTransactions: txCount, totalAmount }, id: jsonRpcId },
        };
      }
      case 'A2A':
        return {
          req: { intent: 'a2a.intent.BATCH_CLOSE', data: { cajaRegister: employeeId } },
          res: { intentResponse: 'a2a.response.BATCH_CLOSED', payload: { statusCode: 200, batchId, amountClosed: totalAmount } },
        };
      case 'SDK':
      default:
        return {
          req: { action: 'CLOSE_BATCH', employeeId, force: forceClose, timestamp: ts },
          res: { status: 'SUCCESS', batchId, transactionsCount: txCount, totalAmount, currency: 'CLP', message: 'Cierre de Lote Completo y Sincronizado' },
        };
    }
  };

  const handleCloseBatch = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al realizar Cierre. Dispositivo no conectado.');
      setLastResponse({ status: 'error', message: 'Dispositivo no conectado', subMessage: 'Establezca conexión en la pestaña Conexión del menú superior.' });
      return;
    }

    setIsExecuting(true);
    addLog('EVENT', `[${integrationMode}] Iniciando cierre de lote diario (Operador: ${employeeId})`);

    if (integrationMode === 'SDK') {
      try {
        Getnet.Close(true);
        addLog('INFO', 'Comando CLOSE_BATCH enviado al POS vía SDK.');
      } catch (err) {
        addLog('ERROR', `Error al invocar SDK Getnet: ${err.message}`);
      }
      setTimeout(() => {
        setIsExecuting(false);
        setLastReceipt({ batchId: 'SDK-POS', txCount: 'Ver reporte impreso', totalAmount: 'Ver reporte impreso', date: new Date().toLocaleString(), operator: employeeId });
      }, 2000);
      return;
    }

    const simulatedLatency = Math.floor(Math.random() * 50) + 50;
    setLatencies(prev => [...prev, simulatedLatency]);

    setTimeout(async () => {
      const ts = Math.floor(Date.now() / 1000);
      const txCount = Math.floor(Math.random() * 15) + 5;
      const totalAmount = txCount * 12500;
      const batchId = Math.floor(1000 + Math.random() * 9000).toString();
      const { req, res } = getPayloadsByMode(ts, batchId, txCount, totalAmount);

      addLog('REQ', req);

      if (realPort && realPort.writable) {
        try {
          const encoder = new TextEncoder();
          const writer = realPort.writable.getWriter();
          await writer.write(encoder.encode(JSON.stringify(req) + '\r\n'));
          writer.releaseLock();
          addLog('INFO', `Comando CLOSE_BATCH físico enviado al COM [${integrationMode}]`);
        } catch (err) {
          addLog('ERROR', `Error al escribir en el puerto COM: ${err.message}`);
        }
      }

      addLog('RES', res);
      setLastResponse({ status: 'success', message: `Cierre de Lote Exitoso [${integrationMode}]`, subMessage: `Lote #${batchId} | Tx: ${txCount} | $${totalAmount.toLocaleString('es-CL')}` });
      setLastReceipt({ batchId, txCount, totalAmount, date: new Date().toLocaleString(), operator: employeeId });
      setIsExecuting(false);
    }, 1500);
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      {/* ── Header ── */}
      <div className="card-header">
        <div className="card-title">
          <ShieldCheck size={16} className="text-primary" />
          Cierre de Lote (Batch Close)
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800,
          padding: '0.15rem 0.55rem', borderRadius: '20px',
          backgroundColor: 'var(--success-light)', color: 'var(--success)',
          border: '1px solid rgba(22,163,74,0.25)', letterSpacing: '0.3px',
        }}>
          {integrationMode}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        {/* Operador + Force toggle */}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="batch-employee">ID Empleado Autorizante</label>
            <input
              type="text"
              id="batch-employee"
              className="form-input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Ej. EMP-001"
              disabled={isExecuting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ visibility: 'hidden' }}>Opciones</label>
            <label
              id="toggle-force-close"
              className={`toggle-label ${forceClose ? 'checked' : ''}`}
              onClick={() => !isExecuting && setForceClose(v => !v)}
              role="button"
              tabIndex={0}
              style={{ height: 'var(--input-height)', width: '100%' }}
              onKeyDown={(e) => e.key === 'Enter' && !isExecuting && setForceClose(v => !v)}
            >
              <span className="toggle-switch">
                <input type="checkbox" checked={forceClose} onChange={() => {}} disabled={isExecuting} tabIndex={-1} />
                <span className="toggle-track" />
              </span>
              Forzar Cierre de Lote
            </label>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          id="btn-close-batch"
          className={`btn-cta ${isExecuting ? 'btn-cta-warning' : 'btn-cta-success'}`}
          style={{ marginTop: '0.15rem' }}
          onClick={handleCloseBatch}
          disabled={isExecuting}
        >
          <Award size={17} />
          {isExecuting ? 'Consolidando Lote...' : 'Ejecutar Cierre Diario'}
          {!isExecuting && <ChevronRight size={16} style={{ marginLeft: 'auto' }} />}
        </button>

        {/* Receipt */}
        {lastReceipt && (
          <div className="receipt-block anim-fade-in">
            <div className="receipt-header">
              <span>CUPÓN DE CIERRE</span>
              <FileSpreadsheet size={15} style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {[
                ['Modo Protocolo', integrationMode],
                ['Lote Número', lastReceipt.batchId],
                ['Cant. Ventas', lastReceipt.txCount],
                ['Monto Total', typeof lastReceipt.totalAmount === 'number'
                  ? `$${lastReceipt.totalAmount.toLocaleString('es-CL')} CLP`
                  : lastReceipt.totalAmount],
                ['Operador', lastReceipt.operator],
                ['Fecha / Hora', lastReceipt.date],
              ].map(([label, value]) => (
                <div key={label} className="receipt-row">
                  <span className="receipt-row-label">{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
            <div className="receipt-ok">✓ TRANSACCIÓN SINCRONIZADA</div>
          </div>
        )}
      </div>
    </div>
  );
}
