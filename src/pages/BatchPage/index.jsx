import React, { useState } from 'react';
import { ShieldCheck, Award, FileSpreadsheet } from 'lucide-react';
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
  const [employeeId, setEmployeeId] = useState('EMP-001');
  const [forceClose, setForceClose] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const getPayloadsByMode = (ts, batchId, txCount, totalAmount) => {
    switch (integrationMode) {
      case 'Protocolo Simplificado':
        return {
          req: {
            cmd: 'CLS',
            op: employeeId,
            ts: ts
          },
          res: {
            rsp: 'OK',
            batch: batchId,
            txs: txCount,
            tot: totalAmount,
            msg: 'CIERRE EXITOSO'
          }
        };
      case 'C2C':
        const jsonRpcId = Math.floor(1000 + Math.random() * 9000);
        return {
          req: {
            jsonrpc: '2.0',
            method: 'c2c.batch.close',
            params: {
              operatorId: employeeId
            },
            id: jsonRpcId
          },
          res: {
            jsonrpc: '2.0',
            result: {
              status: 'CLOSED',
              batchId: batchId,
              totalTransactions: txCount,
              totalAmount: totalAmount
            },
            id: jsonRpcId
          }
        };
      case 'A2A':
        return {
          req: {
            intent: 'a2a.intent.BATCH_CLOSE',
            data: {
              cajaRegister: employeeId
            }
          },
          res: {
            intentResponse: 'a2a.response.BATCH_CLOSED',
            payload: {
              statusCode: 200,
              batchId: batchId,
              amountClosed: totalAmount
            }
          }
        };
      case 'SDK':
      default:
        return {
          req: {
            action: 'CLOSE_BATCH',
            employeeId: employeeId,
            force: forceClose,
            timestamp: ts
          },
          res: {
            status: 'SUCCESS',
            batchId: batchId,
            transactionsCount: txCount,
            totalAmount: totalAmount,
            currency: 'CLP',
            message: 'Cierre de Lote Completo y Sincronizado'
          }
        };
    }
  };

  const handleCloseBatch = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al realizar Cierre. Dispositivo no conectado.');
      setLastResponse({
        status: 'error',
        message: 'Dispositivo no conectado',
        subMessage: 'Por favor, establezca conexión en la pestaña de Conexión del menú superior.'
      });
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
        setLastReceipt({
          batchId: 'SDK-POS',
          txCount: 'Ver reporte impreso',
          totalAmount: 'Ver reporte impreso',
          date: new Date().toLocaleString(),
          operator: employeeId
        });
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
          const commandString = JSON.stringify(req) + "\r\n";
          await writer.write(encoder.encode(commandString));
          writer.releaseLock();
          addLog('INFO', `Comando CLOSE_BATCH físico enviado al puerto COM en formato [${integrationMode}]`);
        } catch (err) {
          addLog('ERROR', `Error al escribir en el puerto COM: ${err.message}`);
        }
      }

      addLog('RES', res);
      setLastResponse({
        status: 'success',
        message: `Cierre de Lote Exitoso [${integrationMode}]`,
        subMessage: `Lote #${batchId} | Transacciones: ${txCount} | Total: $${totalAmount}`
      });

      setLastReceipt({
        batchId,
        txCount,
        totalAmount,
        date: new Date().toLocaleString(),
        operator: employeeId
      });

      setIsExecuting(false);
    }, 1500);
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <div className="card-header">
        <div className="card-title">
          <ShieldCheck size={18} className="text-primary" />
          Cierre de Lote (Batch Close) - {integrationMode}
        </div>
      </div>
      
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">ID del Empleado Autorizante</label>
            <input
              type="text"
              className="form-input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Ej. EMP-001"
              disabled={isExecuting}
            />
          </div>

          <div className="form-group" style={{ justifyContent: 'center' }}>
            <label className="checkbox-label" style={{ marginTop: '1.5rem' }}>
              <input
                type="checkbox"
                className="checkbox-input"
                checked={forceClose}
                onChange={(e) => setForceClose(e.target.checked)}
                disabled={isExecuting}
              />
              Forzar Cierre de Lote
            </label>
          </div>
        </div>

        <button
          type="button"
          className="btn-connect"
          style={{ width: '100%', justifyContent: 'center', height: '42px' }}
          onClick={handleCloseBatch}
          disabled={isExecuting}
        >
          <Award size={16} />
          {isExecuting ? 'Consolidando Lote...' : 'Ejecutar Cierre Diario'}
        </button>

        {lastReceipt && (
          <div style={{ marginTop: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: '6px', padding: '1rem', backgroundColor: 'var(--border-light)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>CUPÓN DE CIERRE</span>
              <FileSpreadsheet size={16} className="text-primary" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-dark)' }}>
              <div>MODO PROTOCOLO: {integrationMode}</div>
              <div>LOTE NÚMERO   : {lastReceipt.batchId}</div>
              <div>CANT. VENTAS   : {lastReceipt.txCount}</div>
              <div>MONTO TOTAL   : ${lastReceipt.totalAmount} CLP</div>
              <div>OPERADOR      : {lastReceipt.operator}</div>
              <div>FECHA/HORA    : {lastReceipt.date}</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--success)', textAlign: 'center', fontWeight: 'bold' }}>
                *** TRANSACCIÓN SINCRONIZADA ***
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
