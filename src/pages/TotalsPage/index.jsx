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
        return { req: { cmd: 'TOT', ts }, res: { rsp: 'OK', salesAmount: 145000, voidAmount: 25000, netAmount: 120000 } };
      case 'C2C': {
        const rpcId = Math.floor(1000 + Math.random() * 9000);
        return { req: { jsonrpc: '2.0', method: 'c2c.totals.get', id: rpcId }, res: { jsonrpc: '2.0', result: { salesAmount: 145000, voidAmount: 25000, netAmount: 120000 }, id: rpcId } };
      }
      case 'A2A':
        return { req: { intent: 'a2a.intent.GET_TOTALS' }, res: { intentResponse: 'a2a.response.TOTALS', payload: { statusCode: 200, salesAmount: 145000, voidAmount: 25000, netAmount: 120000 } } };
      case 'SDK':
      default:
        return { req: { action: 'GET_TOTALS', timestamp: ts }, res: { status: 'SUCCESS', totals: { salesAmount: 145000, voidAmount: 25000, netAmount: 120000 } } };
    }
  };

  const getDetailsPayload = (ts) => {
    const arr = [
      { id: '1', ticket: 'A1230', amount: 15000, status: 'APPROVED', type: 'Compra' },
      { id: '2', ticket: 'A1231', amount: 25000, status: 'VOIDED',   type: 'Compra' },
      { id: '3', ticket: 'A1232', amount: 10500, status: 'APPROVED', type: 'Compra' },
      { id: '4', ticket: 'A1233', amount: 8000,  status: 'APPROVED', type: 'Sin Tasa' },
      { id: '5', ticket: 'A1234', amount: 25000, status: 'APPROVED', type: 'Compra' },
    ];
    switch (integrationMode) {
      case 'Protocolo Simplificado':
        return { req: { cmd: 'DET', limit: 5, ts }, res: { rsp: 'OK', txs: arr } };
      case 'C2C': {
        const rpcId = Math.floor(1000 + Math.random() * 9000);
        return { req: { jsonrpc: '2.0', method: 'c2c.transactions.list', params: { limit: 5 }, id: rpcId }, res: { jsonrpc: '2.0', result: { list: arr }, id: rpcId } };
      }
      case 'A2A':
        return { req: { intent: 'a2a.intent.GET_DETAILS', limit: 5 }, res: { intentResponse: 'a2a.response.DETAILS', payload: { statusCode: 200, list: arr } } };
      case 'SDK':
      default:
        return { req: { action: 'GET_DETAILS', limit: 5, timestamp: ts }, res: arr };
    }
  };

  const handleGetTotals = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al consultar totales. Dispositivo no conectado.');
      setLastResponse({ status: 'error', message: 'Dispositivo no conectado', subMessage: 'Establezca conexión en la pestaña Conexión.' });
      return;
    }
    setIsExecuting(true);
    addLog('EVENT', `[${integrationMode}] Solicitando totales acumulados...`);

    if (integrationMode === 'SDK') {
      try { Getnet.Totals(true); addLog('INFO', 'Comando de Totales enviado al POS vía SDK.'); }
      catch (err) { addLog('ERROR', `Error al invocar SDK: ${err.message}`); }
      setTimeout(() => { setIsExecuting(false); setTotals({ salesAmount: 'Ver POS', voidAmount: 'Ver POS', netAmount: 'Ver POS' }); }, 2000);
      return;
    }

    setLatencies(prev => [...prev, Math.floor(Math.random() * 30) + 20]);
    setTimeout(() => {
      const ts = Math.floor(Date.now() / 1000);
      const { req, res } = getTotalsPayload(ts);
      addLog('REQ', req);
      addLog('RES', res);
      setLastResponse({ status: 'success', message: `Totales Recuperados [${integrationMode}]`, subMessage: `Ventas Netas: $120.000` });
      setTotals({ salesAmount: 145000, voidAmount: 25000, netAmount: 120000 });
      setIsExecuting(false);
    }, 800);
  };

  const handleGetDetails = () => {
    if (connectionStatus !== 'connected') {
      addLog('ERROR', 'Error al consultar detalles. Dispositivo no conectado.');
      setLastResponse({ status: 'error', message: 'Dispositivo no conectado', subMessage: 'Establezca conexión en la pestaña Conexión.' });
      return;
    }
    setIsExecuting(true);
    addLog('EVENT', `[${integrationMode}] Solicitando detalle de transacciones...`);

    if (integrationMode === 'SDK') {
      try { Getnet.Details(true); addLog('INFO', 'Comando de Detalle enviado al POS vía SDK.'); }
      catch (err) { addLog('ERROR', `Error al invocar SDK: ${err.message}`); }
      setTimeout(() => {
        setIsExecuting(false);
        setDetails(txHistory && txHistory.length > 0 ? txHistory : [{ id: '1', ticket: 'Ver Impreso', amount: 0, status: 'APPROVED', type: 'SDK POS' }]);
      }, 2000);
      return;
    }

    setLatencies(prev => [...prev, Math.floor(Math.random() * 30) + 20]);
    setTimeout(() => {
      const ts = Math.floor(Date.now() / 1000);
      const { req, res } = getDetailsPayload(ts);
      addLog('REQ', req);
      addLog('RES', res);
      const detailsArr = [
        { id: '1', ticket: 'A1230', amount: 15000, status: 'APPROVED', type: 'Compra' },
        { id: '2', ticket: 'A1231', amount: 25000, status: 'VOIDED',   type: 'Compra' },
        { id: '3', ticket: 'A1232', amount: 10500, status: 'APPROVED', type: 'Compra' },
        { id: '4', ticket: 'A1233', amount: 8000,  status: 'APPROVED', type: 'Sin Tasa' },
        { id: '5', ticket: 'A1234', amount: 25000, status: 'APPROVED', type: 'Compra' },
      ];
      setLastResponse({ status: 'success', message: `Detalle Recuperado [${integrationMode}]`, subMessage: `${detailsArr.length} transacciones cargadas` });
      setDetails(detailsArr);
      setIsExecuting(false);
    }, 900);
  };

  return (
    <div className="panel-card" style={{ flex: 1 }}>
      {/* ── Header ── */}
      <div className="card-header">
        <div className="card-title">
          <BarChart3 size={16} className="text-primary" />
          Totales y Detalle de Lote
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.55rem',
          borderRadius: '20px', backgroundColor: 'var(--primary-light)',
          color: 'var(--primary)', border: '1px solid var(--border-accent)', letterSpacing: '0.3px',
        }}>
          {integrationMode}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            type="button" id="btn-get-totals"
            className="btn-primary"
            style={{ height: 'var(--btn-height)' }}
            onClick={handleGetTotals}
            disabled={isExecuting}
          >
            <Layers size={15} />
            Obtener Totales
          </button>
          <button
            type="button" id="btn-get-details"
            className="btn-secondary"
            style={{ height: 'var(--btn-height)' }}
            onClick={handleGetDetails}
            disabled={isExecuting}
          >
            <ListCollapse size={15} />
            Cargar Detalles
          </button>
        </div>

        {/* Totals display */}
        {totals && (
          <div className="totals-grid anim-fade-in">
            <div className="total-item">
              <span className="total-item-label">Ventas Brutas</span>
              <span className="total-item-value success">
                {typeof totals.salesAmount === 'number' ? `$${totals.salesAmount.toLocaleString('es-CL')}` : totals.salesAmount}
              </span>
            </div>
            <div className="total-item">
              <span className="total-item-label">Anulaciones</span>
              <span className="total-item-value danger">
                {typeof totals.voidAmount === 'number' ? `$${totals.voidAmount.toLocaleString('es-CL')}` : totals.voidAmount}
              </span>
            </div>
            <div className="total-item">
              <span className="total-item-label">Total Neto</span>
              <span className="total-item-value primary">
                {typeof totals.netAmount === 'number' ? `$${totals.netAmount.toLocaleString('es-CL')}` : totals.netAmount}
              </span>
            </div>
          </div>
        )}

        {/* Details table */}
        {details.length > 0 ? (
          <div className="data-table-wrap anim-fade-in">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ticket</th>
                  <th>Monto</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {details.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{tx.id}</td>
                    <td style={{ fontWeight: 700 }}>{tx.ticket}</td>
                    <td>${typeof tx.amount === 'number' ? tx.amount.toLocaleString('es-CL') : tx.amount}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{tx.type}</td>
                    <td>
                      <span className={`status-badge ${tx.status === 'APPROVED' ? 'approved' : 'voided'}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          totals && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
              Haga clic en "Cargar Detalles" para ver el listado de transacciones.
            </p>
          )
        )}
      </div>
    </div>
  );
}
