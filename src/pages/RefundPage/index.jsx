import React, { useState } from 'react';
import { XCircle, Trash2, HelpCircle } from 'lucide-react';
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
  const [ticketToVoid, setTicketToVoid] = useState('A1234');
  const [employeeId, setEmployeeId] = useState('EMP-001');
  const [voidReason, setVoidReason] = useState('Error de digitación');
  const [isExecuting, setIsExecuting] = useState(false);

  const getPayloadsByMode = (ts) => {
    const authCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    switch (integrationMode) {
      case 'Protocolo Simplificado':
        return {
          req: {
            cmd: 'ANL',
            tk: ticketToVoid,
            op: employeeId,
            ts: ts
          },
          res: {
            rsp: 'OK',
            tk: ticketToVoid,
            msg: 'ANULACION APROBADA'
          }
        };
      case 'C2C':
        const jsonRpcId = Math.floor(1000 + Math.random() * 9000);
        return {
          req: {
            jsonrpc: '2.0',
            method: 'c2c.payment.void',
            params: {
              reference: ticketToVoid,
              operatorId: employeeId
            },
            id: jsonRpcId
          },
          res: {
            jsonrpc: '2.0',
            result: {
              status: 'VOID_SUCCESS',
              reference: ticketToVoid
            },
            id: jsonRpcId
          }
        };
      case 'A2A':
        return {
          req: {
            intent: 'a2a.intent.VOID',
            data: {
              transactionId: ticketToVoid,
              cajaRegister: employeeId
            }
          },
          res: {
            intentResponse: 'a2a.response.VOID_SUCCESS',
            payload: {
              statusCode: 200,
              txRef: ticketToVoid
            }
          }
        };
      case 'SDK':
      default:
        return {
          req: {
            action: 'VOID',
            ticket: ticketToVoid,
            employeeId: employeeId,
            reason: voidReason,
            timestamp: ts
          },
          res: {
            status: 'VOID_APPROVED',
            originalTicket: ticketToVoid,
            employeeId: employeeId,
            message: 'Anulación Aprobada con Éxito'
          }
        };
    }
  };

  const handleExecuteRefund = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al ejecutar Anulación. Dispositivo no conectado.');
      setLastResponse({
        status: 'error',
        message: 'Dispositivo no conectado',
        subMessage: 'Por favor, establezca conexión en la pestaña de Conexión del menú superior.'
      });
      return;
    }

    if (!ticketToVoid) {
      addLog('ERROR', 'Error: Ingrese el ticket a anular.');
      setLastResponse({
        status: 'error',
        message: 'Ticket Faltante',
        subMessage: 'Debe ingresar un número de ticket válido para anular.'
      });
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

      setTimeout(() => {
        setIsExecuting(false);
      }, 2000);
      return;
    }

    const simulatedLatency = Math.floor(Math.random() * 40) + 30; // 30ms a 70ms
    setLatencies(prev => [...prev, simulatedLatency]);

    setTimeout(async () => {
      const ts = Math.floor(Date.now() / 1000);
      const { req, res } = getPayloadsByMode(ts);

      addLog('REQ', req);

      // Si tenemos puerto COM real conectado
      if (realPort && realPort.writable) {
        try {
          const encoder = new TextEncoder();
          const writer = realPort.writable.getWriter();
          const commandString = JSON.stringify(req) + "\r\n";
          await writer.write(encoder.encode(commandString));
          writer.releaseLock();
          addLog('INFO', `Comando de Anulación físico enviado al puerto COM en formato [${integrationMode}]`);
        } catch (err) {
          addLog('ERROR', `Error al escribir en el puerto COM: ${err.message}`);
        }
      }

      addLog('RES', res);
      setLastResponse({
        status: 'success',
        message: `Anulación Exitosa [${integrationMode}]`,
        subMessage: `El Ticket ${ticketToVoid} ha sido anulado.`
      });

      setIsExecuting(false);
    }, 1000);
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <div className="card-header">
        <div className="card-title">
          <XCircle size={18} className="text-primary" />
          Anulación de Transacción ({integrationMode})
        </div>
      </div>
      
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label">Número de Ticket / Boleta a Anular</label>
          <input
            type="text"
            className="form-input"
            value={ticketToVoid}
            onChange={(e) => setTicketToVoid(e.target.value)}
            placeholder="Ej. A1234"
            disabled={isExecuting}
          />
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">ID de Operador (Caja)</label>
            <input
              type="text"
              className="form-input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Ej. EMP-001"
              disabled={isExecuting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Motivo de la Anulación</label>
            <select
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

        <div style={{ padding: '0.75rem', backgroundColor: 'var(--border-light)', borderRadius: '6px', borderLeft: '3px solid var(--primary)', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <HelpCircle size={16} className="text-primary" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            La anulación requiere que el terminal POS esté sincronizado y que el lote no haya sido cerrado aún. Solo se pueden anular transacciones del día actual.
          </span>
        </div>

        <button
          type="button"
          className="btn-connect"
          style={{ width: '100%', justifyContent: 'center', height: '42px', backgroundColor: 'var(--danger)', opacity: isExecuting ? 0.7 : 1 }}
          onClick={handleExecuteRefund}
          disabled={isExecuting}
        >
          <Trash2 size={16} />
          {isExecuting ? 'Procesando Anulación...' : 'Ejecutar Anulación'}
        </button>
      </div>
    </div>
  );
}
