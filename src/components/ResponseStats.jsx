import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, Zap, TrendingUp } from 'lucide-react';

function LatencyBar({ ms }) {
  // Colour thresholds: green <80, yellow <200, red otherwise
  const pct   = Math.min(100, (ms / 300) * 100);
  const color  = ms < 80 ? '#24a148' : ms < 200 ? '#f1c21b' : '#fa4d56';
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{
        height: 4,
        background: 'rgba(255,255,255,0.07)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 6px ${color}88`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
        <span style={{ fontSize: '0.65rem', color: '#4a5568' }}>0 ms</span>
        <span style={{ fontSize: '0.65rem', color: '#4a5568' }}>300 ms</span>
      </div>
    </div>
  );
}

export default function ResponseStats({ lastResponse, averageLatency }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!lastResponse) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [lastResponse]);

  const isSuccess = lastResponse?.status === 'success';
  const isError   = lastResponse?.status === 'error';

  const statusColor  = isSuccess ? '#24a148' : isError ? '#fa4d56' : '#4589ff';
  const statusBg     = isSuccess
    ? 'rgba(36,161,72,0.09)'
    : isError
      ? 'rgba(250,77,86,0.09)'
      : 'rgba(69,137,255,0.09)';
  const statusBorder = isSuccess
    ? 'rgba(36,161,72,0.22)'
    : isError
      ? 'rgba(250,77,86,0.22)'
      : 'rgba(69,137,255,0.22)';

  const latencyColor = averageLatency < 80
    ? '#24a148'
    : averageLatency < 200
      ? '#f1c21b'
      : '#fa4d56';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>

      {/* ── Última Respuesta ── */}
      <div
        style={{
          background: statusBg,
          border: `1px solid ${statusBorder}`,
          borderRadius: 10,
          padding: '0.9rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          transition: 'background 0.3s ease, border-color 0.3s ease',
          animation: flash ? 'statsFlash 0.5s ease-out' : 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow accent line */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: statusColor,
          opacity: 0.7,
          borderRadius: '10px 10px 0 0',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: 8,
            background: `${statusColor}22`,
            border: `1px solid ${statusColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isSuccess
              ? <CheckCircle size={15} style={{ color: statusColor }} />
              : isError
                ? <AlertCircle size={15} style={{ color: statusColor }} />
                : <Info size={15} style={{ color: statusColor }} />
            }
          </div>
          <span style={{
            fontSize: '0.63rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: '#6b7280',
          }}>
            Última Respuesta
          </span>
        </div>

        <div>
          <div style={{
            fontSize: '0.88rem',
            fontWeight: 700,
            color: statusColor,
            lineHeight: 1.3,
          }}>
            {lastResponse?.message || 'Esperando transacción...'}
          </div>
          {lastResponse?.subMessage && (
            <div style={{
              fontSize: '0.72rem',
              color: '#6b7280',
              marginTop: '0.2rem',
              lineHeight: 1.4,
            }}>
              {lastResponse.subMessage}
            </div>
          )}
        </div>
      </div>

      {/* ── Latencia ── */}
      <div style={{
        background: 'rgba(69,137,255,0.07)',
        border: '1px solid rgba(69,137,255,0.18)',
        borderRadius: 10,
        padding: '0.9rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top accent */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: 'linear-gradient(90deg, #4589ff, #8b5cf6)',
          opacity: 0.7,
          borderRadius: '10px 10px 0 0',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 30, height: 30,
            borderRadius: 8,
            background: 'rgba(69,137,255,0.15)',
            border: '1px solid rgba(69,137,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={15} style={{ color: '#4589ff' }} />
          </div>
          <span style={{
            fontSize: '0.63rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: '#6b7280',
          }}>
            Latencia Promedio
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
          <span style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: averageLatency > 0 ? latencyColor : '#4a5568',
            lineHeight: 1,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '-1px',
          }}>
            {averageLatency > 0 ? averageLatency : '—'}
          </span>
          {averageLatency > 0 && (
            <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>ms</span>
          )}
        </div>

        {averageLatency > 0 && <LatencyBar ms={averageLatency} />}

        {averageLatency > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            marginTop: '0.1rem',
          }}>
            <TrendingUp size={11} style={{ color: latencyColor }} />
            <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>
              {averageLatency < 80 ? 'Excelente' : averageLatency < 200 ? 'Normal' : 'Lento'}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes statsFlash {
          0%   { transform: scale(1);    box-shadow: none; }
          30%  { transform: scale(1.01); box-shadow: 0 0 14px var(--flash-color, #4589ff44); }
          100% { transform: scale(1);    box-shadow: none; }
        }
      `}</style>
    </div>
  );
}
