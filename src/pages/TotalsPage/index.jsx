import React, { useState } from 'react';
import { BarChart3, ListCollapse, Layers } from 'lucide-react';
import Getnet from '../../libs/getnet-adapter';

export default function TotalsPage({
  connectionStatus,
  addLog,
  setLastResponse,
  setLatencies,
  realPort,
  connectionType,
  selectedPort,
  integrationMode,
  txHistory
}) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [totals, setTotals] = useState(null);
  const [details, setDetails] = useState([]);

  const getTotalsPayload = (ts) => {
    switch (integrationMode) {
      case 'Protocolo Simplificado':
        return {
          req: { cmd: 'TOT', ts: ts },
          res: { rsp: 'OK', salesAmount: 145000, voidAmount: 25000, netAmount: 120000 }
        };
      case 'C2C':
        const rpcId = Math.floor(1000 + Math.random() * 9000);
        return {
          req: { jsonrpc: '2.0', method: 'c2c.totals.get', id: rpcId },
          res: {
            jsonrpc: '2.0',
            result: { salesAmount: 145000, voidAmount: 25000, netAmount: 120000 },
            id: rpcId
          }
        };
      case 'A2A':
        return {
          req: { intent: 'a2a.intent.GET_TOTALS' },
          res: { intentResponse: 'a2a.response.TOTALS', payload: { statusCode: 200, salesAmount: 145000, voidAmount: 25000, netAmount: 120000 } }
        };
      case 'SDK':
      default:
        return {
          req: { action: 'GET_TOTALS', timestamp: ts },
          res: { status: 'SUCCESS', totals: { salesAmount: 145000, voidAmount: 25000, netAmount: 120000 } }
        };
    }
  };

  const getDetailsPayload = (ts) => {
    const detailsArray = [
      { id: '1', ticket: 'A1230', amount: 15000, status: 'APPROVED', type: 'Compra' },
      { id: '2', ticket: 'A1231', amount: 25000, status: 'VOIDED', type: 'Compra' },
      { id: '3', ticket: 'A1232', amount: 10500, status: 'APPROVED', type: 'Compra' },
      { id: '4', ticket: 'A1233', amount: 8000, status: 'APPROVED', type: 'Sin Tasa' },
      { id: '5', ticket: 'A1234', amount: 25000, status: 'APPROVED', type: 'Compra' }
    ];

    switch (integrationMode) {
      case 'Protocolo Simplificado':
        return {
          req: { cmd: 'DET', limit: 5, ts: ts },
          res: { rsp: 'OK', txs: detailsArray }
        };
      case 'C2C':
        const rpcId = Math.floor(1000 + Math.random() * 9000);
        return {
          req: { jsonrpc: '2.0', method: 'c2c.transactions.list', params: { limit: 5 }, id: rpcId },
          res: { jsonrpc: '2.0', result: { list: detailsArray }, id: rpcId }
        };
      case 'A2A':
        return {
          req: { intent: 'a2a.intent.GET_DETAILS', limit: 5 },
          res: { intentResponse: 'a2a.response.DETAILS', payload: { statusCode: 200, list: detailsArray } }
        };
      case 'SDK':
      default:
        return {
          req: { action: 'GET_DETAILS', limit: 5, timestamp: ts },
          res: detailsArray
        };
    }
  };

  const handleGetTotals = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al consultar totales. Dispositivo no conectado.');
      setLastResponse({
        status: 'error',
        message: 'Dispositivo no conectado',
        subMessage: 'Por favor, configure y conecte el simulador.'
      });
      return;
    }

    setIsExecuting(true);
    addLog('EVENT', `[${integrationMode}] Solicitando totales acumulados...`);

    if (integrationMode === 'SDK') {
      try {
        Getnet.Totals(true);
        addLog('INFO', 'Comando de Totales enviado al POS vía SDK.');
      } catch (err) {
        addLog('ERROR', `Error al invocar SDK Getnet: ${err.message}`);
      }

      setTimeout(() => {
        setIsExecuting(false);
        setTotals({ salesAmount: 'Ver POS', voidAmount: 'Ver POS', netAmount: 'Ver POS' });
      }, 2000);
      return;
    }

    const simulatedLatency = Math.floor(Math.random() * 30) + 20;
    setLatencies(prev => [...prev, simulatedLatency]);

    setTimeout(() => {
      const ts = Math.floor(Date.now() / 1000);
      const { req, res } = getTotalsPayload(ts);
      addLog('REQ', req);

      const netAmount = 120000;
      addLog('RES', res);
      setLastResponse({
        status: 'success',
        message: `Totales Recuperados [${integrationMode}]`,
        subMessage: `Ventas Netas: $${netAmount}`
      });

      setTotals({ salesAmount: 145000, voidAmount: 25000, netAmount: 120000 });
      setIsExecuting(false);
    }, 800);
  };

  const handleGetDetails = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al consultar detalles. Dispositivo no conectado.');
      setLastResponse({
        status: 'error',
        message: 'Dispositivo no conectado',
        subMessage: 'Por favor, configure y conecte el simulador.'
      });
      return;
    }

    setIsExecuting(true);
    addLog('EVENT', `[${integrationMode}] Solicitando detalle de transacciones...`);

    if (integrationMode === 'SDK') {
      try {
        Getnet.Details(true);
        addLog('INFO', 'Comando de Detalle de Transacciones enviado al POS vía SDK.');
      } catch (err) {
        addLog('ERROR', `Error al invocar SDK Getnet: ${err.message}`);
      }

      setTimeout(() => {
        setIsExecuting(false);
        setDetails(txHistory && txHistory.length > 0 ? txHistory : [
          { id: '1', ticket: 'Ver Impreso', amount: 0, status: 'APPROVED', type: 'SDK POS' }
        ]);
      }, 2000);
      return;
    }

    const simulatedLatency = Math.floor(Math.random() * 30) + 20;
    setLatencies(prev => [...prev, simulatedLatency]);

    setTimeout(() => {
      const ts = Math.floor(Date.now() / 1000);
      const { req, res } = getDetailsPayload(ts);
      addLog('REQ', req);

      const detailsArray = [
        { id: '1', ticket: 'A1230', amount: 15000, status: 'APPROVED', type: 'Compra' },
        { id: '2', ticket: 'A1231', amount: 25000, status: 'VOIDED', type: 'Compra' },
        { id: '3', ticket: 'A1232', amount: 10500, status: 'APPROVED', type: 'Compra' },
        { id: '4', ticket: 'A1233', amount: 8000, status: 'APPROVED', type: 'Sin Tasa' },
        { id: '5', ticket: 'A1234', amount: 25000, status: 'APPROVED', type: 'Compra' }
      ];

      addLog('RES', res);
      setLastResponse({
        status: 'success',
        message: `Detalle Recuperado [${integrationMode}]`,
        subMessage: `Cargadas ${detailsArray.length} transacciones en la UI`
      });

      setDetails(detailsArray);
      setIsExecuting(false);
    }, 900);
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      <div className="card-header">
        <div className="card-title">
          <BarChart3 size={18} className="text-primary" />
          Totales y Detalle de Lote ({integrationMode})
        </div>
      </div>
      
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, height: '40px' }}
            onClick={handleGetTotals}
            disabled={isExecuting}
          >
            <Layers size={16} />
            Obtener Totales
          </button>
          
          <button
            type="button"
            className="btn-secondary"
            style={{ flex: 1, height: '40px' }}
            onClick={handleGetDetails}
            disabled={isExecuting}
          >
            <ListCollapse size={16} />
            Cargar Detalles
          </button>
        </div>

        {totals && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', backgroundColor: 'var(--border-light)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>VENTAS BRUTAS</span>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--success)' }}>${totals.salesAmount}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>ANULACIONES</span>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--danger)' }}>${totals.voidAmount}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>TOTAL NETO</span>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>${totals.netAmount}</span>
            </div>
          </div>
        )}

        {details.length > 0 ? (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--border-light)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>ID</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Ticket</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Monto</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Tipo</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {details.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-mono)' }}>{tx.id}</td>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 'bold' }}>{tx.ticket}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>${tx.amount}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{tx.type}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        backgroundColor: tx.status === 'APPROVED' ? 'var(--success-light)' : 'var(--danger-light)',
                        color: tx.status === 'APPROVED' ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          totals && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: '0.5rem 0' }}>Haga clic en 'Cargar Detalles' para ver el listado de transacciones.</div>
        )}
      </div>
    </div>
  );
}
