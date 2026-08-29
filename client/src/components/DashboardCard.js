import React from 'react';

/**
 * DashboardCard
 * A reusable metric card for dashboards.
 *
 * Props:
 *   title    {string}  — Card label
 *   value    {string|number} — Main displayed value
 *   icon     {ReactNode}    — Icon element
 *   color    {string}  — Accent colour (hex / CSS colour)
 *   subtitle {string}  — Optional small text below value
 *   trend    {string}  — Optional trend label e.g. "+12% today"
 */
function DashboardCard({ title, value, icon, color = '#38bdf8', subtitle, trend }) {
  const styles = {
    card: {
      background: '#1e293b',
      border: `1px solid #334155`,
      borderRadius: '12px',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      minWidth: '180px',
      flex: '1',
      position: 'relative',
      overflow: 'hidden',
    },
    accent: {
      position: 'absolute',
      top: 0, left: 0,
      width: '4px',
      height: '100%',
      background: color,
      borderRadius: '12px 0 0 12px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: '12px',
      fontWeight: 600,
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    },
    iconWrap: {
      width: '36px', height: '36px',
      borderRadius: '8px',
      background: `${color}22`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color,
      fontSize: '18px',
    },
    value: {
      fontSize: '30px',
      fontWeight: 700,
      color: '#f1f5f9',
      lineHeight: 1,
    },
    subtitle: {
      fontSize: '12px',
      color: '#64748b',
    },
    trend: {
      fontSize: '11px',
      color: color,
      fontWeight: 600,
    },
  };

  return (
    <div style={styles.card}>
      <div style={styles.accent} />
      <div style={styles.header}>
        <span style={styles.title}>{title}</span>
        {icon && <span style={styles.iconWrap}>{icon}</span>}
      </div>
      <div style={styles.value}>{value ?? '—'}</div>
      {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
      {trend   && <div style={styles.trend}>{trend}</div>}
    </div>
  );
}

export default DashboardCard;
