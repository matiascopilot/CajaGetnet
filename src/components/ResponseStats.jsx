import React from 'react';
import { AlertCircle, CheckCircle, Info, Timer } from 'lucide-react';

export default function ResponseStats({
  lastResponse,
  averageLatency
}) {
  
  const renderResponseIcon = () => {
    if (!lastResponse) {
      return (
        <div className="stats-icon-wrapper info">
          <Info size={20} />
        </div>
      );
    }
    
    if (lastResponse.status === 'success') {
      return (
        <div className="stats-icon-wrapper success">
          <CheckCircle size={20} />
        </div>
      );
    } else if (lastResponse.status === 'error') {
      return (
        <div className="stats-icon-wrapper danger">
          <AlertCircle size={20} />
        </div>
      );
    } else {
      return (
        <div className="stats-icon-wrapper info">
          <Info size={20} />
        </div>
      );
    }
  };

  const getResponseText = () => {
    if (!lastResponse) return 'Esperando transacción...';
    return lastResponse.message;
  };

  return (
    <div className="stats-section">
      {/* Última Respuesta Card */}
      <div className="stats-card">
        {renderResponseIcon()}
        <div className="stats-info">
          <span className="stats-label">Última Respuesta</span>
          <span className="stats-value">{getResponseText()}</span>
          {lastResponse && lastResponse.subMessage && (
            <span className="stats-subvalue">{lastResponse.subMessage}</span>
          )}
        </div>
      </div>

      {/* Tiempo de Respuesta Card */}
      <div className="stats-card">
        <div className="stats-icon-wrapper info">
          <Timer size={20} />
        </div>
        <div className="stats-info">
          <span className="stats-label">Tiempo de Respuesta</span>
          <span className="stats-value">
            Latencia Promedio: {averageLatency > 0 ? `${averageLatency}ms` : '--'}
          </span>
          {averageLatency > 0 && (
            <span className="stats-subvalue">Velocidad de procesamiento de red local</span>
          )}
        </div>
      </div>
    </div>
  );
}
