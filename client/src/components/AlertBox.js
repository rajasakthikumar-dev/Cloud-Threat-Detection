import React, { useState } from 'react';
import { FiAlertTriangle, FiAlertCircle, FiInfo, FiCheckCircle, FiX } from 'react-icons/fi';

/**
 * AlertBox — dismissible inline alert banner.
 * Props: type, title, message, details, onDismiss
 * Identical API to original; only styles changed for dark navy theme.
 */

const CONFIG = {
  error: {
    bg:     'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.4)',
    accent: '#ef4444',
    color:  '#fca5a5',
    Icon:   FiAlertCircle,
    label:  'CRITICAL',
  },
  warning: {
    bg:     'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.4)',
    accent: '#f59e0b',
    color:  '#fcd34d',
    Icon:   FiAlertTriangle,
    label:  'WARNING',
  },
  info: {
    bg:     'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.35)',
    accent: '#06b6d4',
    color:  '#22d3ee',
    Icon:   FiInfo,
    label:  'INFO',
  },
  success: {
    bg:     'rgba(34, 197, 94, 0.15)',
    border: 'rgba(34, 197, 94, 0.35)',
    accent: '#22c55e',
    color:  '#86efac',
    Icon:   FiCheckCircle,
    label:  'OK',
  },
};

function AlertBox({ type = 'info', title, message, details, onDismiss }) {
  const [visible, setVisible] = useState(true);
  const cfg = CONFIG[type] || CONFIG.info;
  if (!visible) return null;

  const dismiss = () => { setVisible(false); if (onDismiss) onDismiss(); };

  return (
    <div style={{
      background: cfg.bg,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: `1px solid ${cfg.border}`,
      borderLeft: `4px solid ${cfg.accent}`,
      borderRadius: '12px',
      padding: '16px 18px',
      display: 'flex',
      gap: '14px',
      alignItems: 'flex-start',
      boxShadow: `0 4px 20px ${cfg.accent}22`,
    }}>
      <span style={{ color: cfg.color, flexShrink: 0, paddingTop: '3px' }}>
        <cfg.Icon size={20} />
      </span>

      <div style={{ flex: 1 }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 9px',
          borderRadius: '999px',
          fontSize: '0.8125rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          background: `${cfg.accent}30`,
          color: cfg.color,
          marginBottom: '6px',
        }}>
          {cfg.label}
        </span>
        {title   && <div style={{ fontSize: '1rem', fontWeight: 600, color: cfg.color, marginBottom: '6px' }}>{title}</div>}
        {message && <div style={{ fontSize: '0.9375rem', color: 'rgba(203, 213, 225, 0.85)', lineHeight: 1.6 }}>{message}</div>}
        {details && Object.keys(details).length > 0 && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', fontSize: '0.875rem' }}>
            {Object.entries(details).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                <span style={{ color: 'rgba(148, 163, 184, 0.8)', minWidth: '140px' }}>{k}</span>
                <span style={{ color: 'rgba(203, 213, 225, 0.9)' }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(203, 213, 225, 0.5)', padding: '2px', flexShrink: 0 }}
        onClick={dismiss}
        title="Dismiss"
      >
        <FiX size={18} />
      </button>
    </div>
  );
}

export default AlertBox;
