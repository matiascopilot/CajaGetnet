import React, { useState } from 'react';
import { CreditCard, ShoppingBag, XCircle } from 'lucide-react';
import Getnet from '../../libs/getnet-adapter';

export default function SalePage({
  connectionStatus,
  addLog,
  setLastResponse,
  setLatencies,
  realPort,
  connectionType,
  selectedPort,
  integrationMode
}) {
  const [amount, setAmount] = useState('25000');
  const [saleType, setSaleType] = useState('Compra');
  const [ticketNumber, setTicketNumber] = useState('1');
  const [employeeId, setEmployeeId] = useState('1');
  const [printOnPos, setPrintOnPos] = useState(true);
  const [sendMessages, setSendMessages] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const getPayloadsByMode = (ts) => {
    const numericAmount = parseFloat(amount) || 0;
    const authCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    switch (integrationMode) {
      case 'Protocolo Simplificado':
        return {
          req: {
            cmd: 'VTE',
            amt: numericAmount,
            tk: ticketNumber,
            op: employeeId,
            prn: printOnPos ? 1 : 0,
            ts: ts
          },
          res: {
            rsp: 'OK',
            auth: authCode,
            term: 'POS-8821',
            amt: numericAmount,
            tk: ticketNumber,
            msg: 'APROBADA'
          },
          authCode,
          refTicket: ticketNumber
        };
      case 'C2C':
        const jsonRpcId = Math.floor(1000 + Math.random() * 9000);
        return {
          req: {
            jsonrpc: '2.0',
            method: 'c2c.payment.create',
            params: {
              amount: numericAmount,
              reference: ticketNumber,
              operatorId: employeeId,
              clientSystem: 'SimCaja-Client'
            },
            id: jsonRpcId
          },
          res: {
            jsonrpc: '2.0',
            result: {
              status: 'SUCCESS',
              authorizationCode: authCode,
              posTerminalId: 'POS-8821',
              paidAmount: numericAmount,
              reference: ticketNumber
            },
            id: jsonRpcId
          },
          authCode,
          refTicket: ticketNumber
        };
      case 'A2A':
        return {
          req: {
            intent: 'a2a.intent.PAYMENT',
            data: {
              value: numericAmount,
              transactionId: ticketNumber,
              cajaRegister: employeeId,
              scheme: 'getnet.pay'
            },
            callbackUrl: 'http://localhost:5173/callback'
          },
          res: {
            intentResponse: 'a2a.response.SUCCESS',
            payload: {
              statusCode: 200,
              authNumber: authCode,
              txRef: ticketNumber,
              amountPaid: numericAmount
            }
          },
          authCode,
          refTicket: ticketNumber
        };
      case 'SDK':
      default:
        return {
          req: {
            action: 'SALE',
            amount: numericAmount,
            type: saleType,
            ticket: ticketNumber,
            employeeId: employeeId,
            printOnPos: printOnPos,
            sendMessages: sendMessages,
            timestamp: ts
          },
          res: {
            status: 'APPROVED',
            authCode,
            terminalId: 'POS-8821',
            amount: numericAmount,
            ticket: ticketNumber,
            message: 'Transacción Aprobada'
          },
          authCode,
          refTicket: ticketNumber
        };
    }
  };

  const handleExecuteSale = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al ejecutar Venta. Dispositivo no conectado.');
      setLastResponse({
        status: 'error',
        message: 'Dispositivo no conectado',
        subMessage: 'Por favor, establezca conexión en la pestaña de Conexión del menú superior.'
      });
      return;
    }

    if (!amount || amount === '0' || parseFloat(amount) <= 0) {
      addLog('ERROR', 'Error: Monto Inválido.');
      setLastResponse({
        status: 'error',
        message: 'Monto Inválido',
        subMessage: 'Ingrese un monto mayor a cero.'
      });
      return;
    }

    setIsExecuting(true);
    addLog('EVENT', `[${integrationMode}] Iniciando transacción de Venta por $${amount}`);

    if (integrationMode === 'SDK') {
      let saleTypeMapped = Getnet.POSCommands.SaleType.Sale;
      if (saleType === 'Afecta') {
        saleTypeMapped = Getnet.POSCommands.SaleType.SaleAffects;
      } else if (saleType === 'No Afecta') {
        saleTypeMapped = Getnet.POSCommands.SaleType.SaleExempted;
      }
      
      try {
        Getnet.Sale(
          parseFloat(amount),
          ticketNumber,
          printOnPos,
          saleTypeMapped,
          sendMessages,
          parseInt(employeeId) || 1
        );
        addLog('INFO', 'Comando de Venta enviado al POS vía SDK.');
      } catch (err) {
        addLog('ERROR', `Error al invocar SDK Getnet: ${err.message}`);
      }

      setTimeout(() => {
        setIsExecuting(false);
      }, 2000);
      return;
    }

    const simulatedLatency = Math.floor(Math.random() * 60) + 40;
    setLatencies(prev => [...prev, simulatedLatency]);

    setTimeout(async () => {
      const ts = Math.floor(Date.now() / 1000);
      const { req, res, authCode, refTicket } = getPayloadsByMode(ts);

      addLog('REQ', req);

      if (realPort && realPort.writable) {
        try {
          const encoder = new TextEncoder();
          const writer = realPort.writable.getWriter();
          const commandString = JSON.stringify(req) + "\r\n";
          await writer.write(encoder.encode(commandString));
          writer.releaseLock();
          addLog('INFO', `Comando físico enviado al puerto COM en formato [${integrationMode}]`);
        } catch (err) {
          addLog('ERROR', `Error al escribir en el puerto COM real: ${err.message}`);
        }
      }

      addLog('RES', res);
      setLastResponse({
        status: 'success',
        message: `Venta Aprobada [${integrationMode}]`,
        subMessage: `Autorización: ${authCode} | Ticket: ${refTicket}`
      });
      setIsExecuting(false);
    }, 1200);
  };

  const handleAbortSale = () => {
    if (connectionStatus !== 'connected') return;

    if (integrationMode === 'SDK') {
      addLog('INFO', 'Enviando comando Cancelar Venta al POS vía SDK...');
      try {
        Getnet.CancelSale();
      } catch (err) {
        addLog('ERROR', `Error al cancelar venta vía SDK: ${err.message}`);
      }
      setIsExecuting(false);
      return;
    }
    
    let abortReq = { action: 'ABORT_TRANSACTION', timestamp: Math.floor(Date.now() / 1000) };
    if (integrationMode === 'Protocolo Simplificado') {
      abortReq = { cmd: 'CNL', ts: Math.floor(Date.now() / 1000) };
    } else if (integrationMode === 'C2C') {
      abortReq = { jsonrpc: '2.0', method: 'c2c.payment.abort', id: Math.floor(1000 + Math.random() * 9000) };
    }
    
    addLog('REQ', abortReq);
    addLog('RES', { status: 'ERROR', errorCode: '404', message: 'Cancelada por Operador' });
    setLastResponse({
      status: 'error',
      message: 'Transacción Cancelada',
      subMessage: 'La operación de venta fue abortada por el operador.'
    });
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <div className="card-header">
        <div className="card-title">
          <CreditCard size={18} className="text-primary" />
          Operación de Venta ({integrationMode})
        </div>
      </div>
      
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Monto de Venta</label>
            <div className="input-container">
              <span className="input-prefix">$</span>
              <input
                type="number"
                className="form-input form-input-prefixed"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 10000"
                disabled={isExecuting}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de Transacción</label>
            <select
              className="form-select"
              value={saleType}
              onChange={(e) => setSaleType(e.target.value)}
              disabled={isExecuting}
            >
              <option value="Afecta">Afecta</option>
              <option value="No Afecta">Exenta</option>
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Número de Ticket / Boleta</label>
            <input
              type="text"
              className="form-input"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              placeholder="Ej. A1234"
              disabled={isExecuting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">ID de Operador (Caja)</label>
            <input
              type="text"
              className="form-input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Ej. OP-99"
              disabled={isExecuting}
            />
          </div>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              className="checkbox-input"
              checked={printOnPos}
              onChange={(e) => setPrintOnPos(e.target.checked)}
              disabled={isExecuting}
            />
            Imprimir váucher en POS
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              className="checkbox-input"
              checked={sendMessages}
              onChange={(e) => setSendMessages(e.target.checked)}
              disabled={isExecuting}
            />
            Enviar logs en tiempo real
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn-connect"
            style={{ flex: 2, justifyContent: 'center', height: '42px', opacity: isExecuting ? 0.7 : 1 }}
            onClick={handleExecuteSale}
            disabled={isExecuting}
          >
            <ShoppingBag size={16} />
            {isExecuting ? 'Procesando Venta...' : 'Ejecutar Venta'}
          </button>
          
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)', height: '42px' }}
            onClick={handleAbortSale}
            disabled={isExecuting || connectionStatus !== 'connected'}
          >
            <XCircle size={16} />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
