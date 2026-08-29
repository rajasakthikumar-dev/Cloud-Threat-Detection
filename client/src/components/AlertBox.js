import React, { useState } from 'react';
import { FiAlertTriangle, FiAlertCircle, FiInfo, FiCheckCircle, FiX } from 'react-icons/fi';

/**
 * AlertBox
 * A dismissible inline alert banner.
 *
 * Props:
 *   type     {'error'|'warning'|'info'|'success'}  — visual style
 *   title    {string}  — bold heading
 *   message  {string}  — detail text
 *   details  {object}  — optional key/value pairs to show (e.g., threat data)
 *   onDismiss {fn}     — called when the user clicks ×
 */

const CONFIG = {
  error: {
    bg:     '#1c0a0a',
    border: '#7f1d1d',
    color:  '#fca5a5',
    Icon:   FiAlertCircle,
    label:  'CRITICAL',
  },
  warning: {
    bg:     '#1c1208',
    border: '#78350f',
    color:  '#fcd34d',
    Icon:   FiAlertTriangle,
    label:  'WARNING',
  },
  info: {
    bg:     '#071520',
    border: '#0c4a6e',
    color:  '#7dd3fc',
    Icon:   FiInfo,
    label:  'INFO',
  },
  success: {
    bg:     '#071a0e',
    border: '#14532d',
    color:  '#86efac',
    Icon:   FiCheckCircle,
    label:  'OK',
  },
};

function AlertBox({ type = 'info', title, message, details, onDismiss }) {
  const [visible, setVisible] = useState(true);
  const cfg = CONFIG[type] || CONFIG.info;

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  const styles = {
    box: {
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderLeft: `4px solid ${cfg.color}`,
      borderRadius: '8px',
      padding: '14px 16px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      position: 'relative',
    },
    iconWrap: { color: cfg.color, flexShrink: 0, paddingTop: '2px' },
    body:     { flex: 1 },
    pill: {
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: '999px',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      background: cfg.border,
      color: cfg.color,
      marginBottom: '4px',
    },
    title: {
      fontSize: '14px',
      fontWeight: 600,
      color: cfg.color,
      marginBottom: '4px',
    },
    message: {
      fontSize: '13px',
      color: '#94a3b8',
      lineHeight: 1.5,
    },
    details: {
      marginTop: '10px',
      padding: '10px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '6px',
      fontSize: '12px',
      color: '#64748b',
    },
    detailRow: {
      display: 'flex',
      gap: '8px',
      marginBottom: '3px',
    },
    detailKey: { color: '#475569', minWidth: '130px' },
    detailVal: { color: '#94a3b8' },
    closeBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#475569',
      padding: '2px',
      flexShrink: 0,
    },
  };

  return (
    <div style={styles.box}>
      <span style={styles.iconWrap}><cfg.Icon size={18} /></span>

      <div style={styles.body}>
        <span style={styles.pill}>{cfg.label}</span>
        {title   && <div style={styles.title}>{title}</div>}
        {message && <div style={styles.message}>{message}</div>}

        {/* Optional key-value detail block */}
        {details && Object.keys(details).length > 0 && (
          <div style={styles.details}>
            {Object.entries(details).map(([k, v]) => (
              <div key={k} style={styles.detailRow}>
                <span style={styles.detailKey}>{k}</span>
                <span style={styles.detailVal}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button style={styles.closeBtn} onClick={dismiss} title="Dismiss">
        <FiX size={16} />
      </button>
    </div>
  );
}

export default AlertBox;
