import React, { useState } from 'react';
import { XCircle, Trash2, HelpCircle, ChevronRight } from 'lucide-react';
import Getnet from '../../libs/getnet-adapter';

export default function RefundPage({
  connectionStatus,
  addLog,
  setLastResponse,
  setLatencies,
  realPort,
  connectionType,
  selectedPort,
  integrationMode
}) {
  const [ticketToVoid, setTicketToVoid] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [voidReason, setVoidReason] = useState('Error de digitación');
  const [isExecuting, setIsExecuting] = useState(false);

  const getPayloadsByMode = (ts) => {
    const authCode = Math.floor(100000 + Math.random() * 900000).toString();
    switch (integrationMode) {
      case 'Protocolo Simplificado':
        return {
          req: { cmd: 'ANL', tk: ticketToVoid, op: employeeId, ts },
          res: { rsp: 'OK', tk: ticketToVoid, msg: 'ANULACION APROBADA' },
        };
      case 'C2C': {
        const jsonRpcId = Math.floor(1000 + Math.random() * 9000);
        return {
          req: { jsonrpc: '2.0', method: 'c2c.payment.void', params: { reference: ticketToVoid, operatorId: employeeId }, id: jsonRpcId },
          res: { jsonrpc: '2.0', result: { status: 'VOID_SUCCESS', reference: ticketToVoid }, id: jsonRpcId },
        };
      }
      case 'A2A':
        return {
          req: { intent: 'a2a.intent.VOID', data: { transactionId: ticketToVoid, cajaRegister: employeeId } },
          res: { intentResponse: 'a2a.response.VOID_SUCCESS', payload: { statusCode: 200, txRef: ticketToVoid } },
        };
      case 'SDK':
      default:
        return {
          req: { action: 'VOID', ticket: ticketToVoid, employeeId, reason: voidReason, timestamp: ts },
          res: { status: 'VOID_APPROVED', originalTicket: ticketToVoid, employeeId, message: 'Anulación Aprobada con Éxito' },
        };
    }
  };

  const handleExecuteRefund = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al ejecutar Anulación. Dispositivo no conectado.');
      setLastResponse({ status: 'error', message: 'Dispositivo no conectado', subMessage: 'Establezca conexión en la pestaña Conexión del menú superior.' });
      return;
    }
    if (!ticketToVoid) {
      addLog('ERROR', 'Error: Ingrese el ticket a anular.');
      setLastResponse({ status: 'error', message: 'Ticket Faltante', subMessage: 'Debe ingresar un número de ticket válido para anular.' });
      return;
    }

    setIsExecuting(true);
    addLog('EVENT', `[${integrationMode}] Iniciando Anulación del Ticket #${ticketToVoid}`);

    if (integrationMode === 'SDK') {
      try {
        Getnet.Refund(ticketToVoid, true);
        addLog('INFO', 'Comando de Anulación enviado al POS vía SDK.');
      } catch (err) {
        addLog('ERROR', `Error al invocar SDK Getnet: ${err.message}`);
      }
      setTimeout(() => setIsExecuting(false), 2000);
      return;
    }

    const simulatedLatency = Math.floor(Math.random() * 40) + 30;
    setLatencies(prev => [...prev, simulatedLatency]);

    setTimeout(async () => {
      const ts = Math.floor(Date.now() / 1000);
      const { req, res } = getPayloadsByMode(ts);
      addLog('REQ', req);

      if (realPort && realPort.writable) {
        try {
          const encoder = new TextEncoder();
          const writer = realPort.writable.getWriter();
          await writer.write(encoder.encode(JSON.stringify(req) + '\r\n'));
          writer.releaseLock();
          addLog('INFO', `Comando de Anulación físico enviado al COM [${integrationMode}]`);
        } catch (err) {
          addLog('ERROR', `Error al escribir en el puerto COM: ${err.message}`);
        }
      }

      addLog('RES', res);
      setLastResponse({ status: 'success', message: `Anulación Exitosa [${integrationMode}]`, subMessage: `El Ticket ${ticketToVoid} ha sido anulado.` });
      setIsExecuting(false);
    }, 1000);
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      {/* ── Header ── */}
      <div className="card-header">
        <div className="card-title">
          <XCircle size={16} className="text-primary" />
          Anulación de Transacción
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800,
          padding: '0.15rem 0.55rem', borderRadius: '20px',
          backgroundColor: 'var(--danger-light)', color: 'var(--danger)',
          border: '1px solid rgba(220,38,38,0.25)', letterSpacing: '0.3px',
        }}>
          {integrationMode}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        {/* Ticket a anular — full width */}
        <div className="form-group">
          <label className="form-label" htmlFor="ticket-void">N° Ticket / Boleta a Anular</label>
          <input
            type="text"
            id="ticket-void"
            className="form-input"
            value={ticketToVoid}
            onChange={(e) => setTicketToVoid(e.target.value)}
            placeholder="Ej. A1234"
            disabled={isExecuting}
          />
        </div>

        {/* Operador + Motivo */}
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="refund-employee">ID Operador (Caja)</label>
            <input
              type="text"
              id="refund-employee"
              className="form-input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Ej. EMP-001"
              disabled={isExecuting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="void-reason">Motivo de Anulación</label>
            <select
              id="void-reason"
              className="form-select"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              disabled={isExecuting}
            >
              <option value="Error de digitación">Error de digitación</option>
              <option value="Cliente desiste">Cliente desiste</option>
              <option value="Cobro duplicado">Cobro duplicado</option>
              <option value="Producto dañado/devuelto">Producto devuelto</option>
            </select>
          </div>
        </div>

        {/* Info banner */}
        <div className="info-banner warning">
          <HelpCircle size={15} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <span>
            La anulación requiere que el terminal POS esté sincronizado y que el lote no haya sido cerrado.
            Solo se pueden anular transacciones del día actual.
          </span>
        </div>

        {/* CTA */}
        <button
          type="button"
          id="btn-execute-refund"
          className={`btn-cta ${isExecuting ? 'btn-cta-warning' : 'btn-cta-danger'}`}
          onClick={handleExecuteRefund}
          disabled={isExecuting}
        >
          <Trash2 size={17} />
          {isExecuting ? 'Procesando Anulación...' : 'Ejecutar Anulación'}
          {!isExecuting && <ChevronRight size={16} style={{ marginLeft: 'auto' }} />}
        </button>
      </div>
    </div>
  );
}
