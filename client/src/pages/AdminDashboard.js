import React, { useEffect, useState } from 'react';
import {
  FiUsers, FiAlertTriangle, FiFolder, FiActivity, FiShield,
  FiLock, FiCpu, FiUserCheck, FiLogIn, FiAlertCircle,
  FiUnlock, FiKey,
} from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import AlertBox from '../components/AlertBox';
import ThreatChart, { AttackCategoryBar, RiskLevelPie } from '../components/ThreatChart';
import { getAdminStats, getRecentThreats, getAdminSecuritySummary } from '../services/api';
import { useSocket, useAuth } from '../App';

/**
 * AdminDashboard - platform overview with real-time threat alerts
 * FIXED: Added auth initialization check to prevent race conditions
 */

const PLACEHOLDER = {
  stats:    { users:0, files:0, threats:0, alerts:0 },
  area:     [],
  bar:      [],
  pie:      [{ name:'Low', value:60 }, { name:'Medium', value:30 }, { name:'High', value:10 }],
  recent:   [],
  security: null,
};

export default function AdminDashboard() {
  const socket = useSocket();
  const { initializing } = useAuth();
  const [stats,    setStats]    = useState(PLACEHOLDER.stats);
  const [area,     setArea]     = useState(PLACEHOLDER.area);
  const [bar,      setBar]      = useState(PLACEHOLDER.bar);
  const [pie,      setPie]      = useState(PLACEHOLDER.pie);
  const [recent,   setRecent]   = useState(PLACEHOLDER.recent);
  const [security, setSecurity] = useState(PLACEHOLDER.security);
  const [rtAlerts, setRtAlerts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    // FIX: Wait for auth to initialize
    if (initializing) return;
    
    async function fetchAll() {
      setError(null);
      try {
        const [statsRes, threatsRes, secRes] = await Promise.all([
          getAdminStats(),
          getRecentThreats(),
          getAdminSecuritySummary(),
        ]);
        const d = statsRes.data;
        setStats({ 
          users: d.totalUsers || 0, 
          files: d.totalFiles || 0, 
          threats: d.totalThreats || 0, 
          alerts: d.activeAlerts || 0 
        });
        setArea(d.trafficTimeline  || []);
        setBar(d.categoryBreakdown || []);
        setPie(d.riskDistribution  || PLACEHOLDER.pie);
        setRecent(threatsRes.data.threats || []);
        setSecurity(secRes.data || null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard data.');
      } finally { 
        setLoading(false); 
      }
    }
    fetchAll();
  }, [initializing]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setRtAlerts(prev => [data, ...prev].slice(0, 5));
      setStats(prev => ({ 
        ...prev, 
        alerts: prev.alerts + 1, 
        threats: prev.threats + 1 
      }));
    };
    socket.on('threat_alert', handler);
    return () => socket.off('threat_alert', handler);
  }, [socket]);

  const sectionTitle = { 
    fontSize: 'var(--font-size-xs)', 
    fontWeight: 700, 
    color: 'var(--text-secondary)', 
    textTransform: 'uppercase', 
    letterSpacing: '0.1em', 
    marginBottom: '1rem', 
    marginTop: '0.25rem' 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem', animation: 'fadeInUp 0.35s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.5rem' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: 'var(--radius-lg)', 
                background: 'var(--primary)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                boxShadow: 'var(--shadow-md)' 
              }}>
                <FiShield size={24} color="white" />
              </div>
              <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Admin Dashboard
              </h1>
            </div>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '62px' }}>
              Real-time overview of platform activity and threat intelligence
            </p>
          </div>

          {/* Error state */}
          {error && (
            <div style={{ marginBottom: '2rem' }}>
              <AlertBox type="error" title="Failed to Load Dashboard" message={error} />
            </div>
          )}

          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <DashboardCard title="Total Users"    value={stats.users}   icon={<FiUsers />}         color="var(--primary)" subtitle="Registered accounts" />
            <DashboardCard title="Files in S3"    value={stats.files}   icon={<FiFolder />}        color="var(--success)" subtitle="Uploaded files" />
            <DashboardCard title="Threats Logged" value={stats.threats} icon={<FiAlertTriangle />} color="var(--danger)" subtitle="All-time detections" />
            <DashboardCard title="Active Alerts"  value={stats.alerts}  icon={<FiActivity />}      color="var(--warning)" subtitle="Pending review" />
          </div>

          {/* Real-time alerts */}
          {rtAlerts.length > 0 && (
            <>
              <p style={sectionTitle}>Live Threat Alerts</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                {rtAlerts.map((alert, i) => (
                  <AlertBox
                    key={i}
                    type={alert.risk_level === 'High' ? 'error' : alert.risk_level === 'Medium' ? 'warning' : 'info'}
                    title={`${alert.attack_type} — ${alert.risk_level} Risk`}
                    message={`Confidence: ${alert.confidence_score}%`}
                    details={{ 
                      'Attack Type': alert.attack_type, 
                      'Risk Level': alert.risk_level, 
                      'Confidence': `${alert.confidence_score}%` 
                    }}
                    onDismiss={() => setRtAlerts(prev => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            </>
          )}

          {/* Traffic chart */}
          {!loading && !error && (
            <>
              <p style={sectionTitle}>Traffic Overview</p>
              <div style={{ marginBottom: '1.75rem' }}>
                <ThreatChart type="area" data={area} />
              </div>

              {/* Bar + Pie */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <AttackCategoryBar data={bar} />
                <RiskLevelPie data={pie} />
              </div>

              {/* Recent threats */}
              <p style={sectionTitle}>Recent Threats</p>
              <RecentThreatsTable rows={recent} loading={loading} />

              {/* ═══ NEW SECURITY SECTIONS ═══════════════════════════ */}

              {/* ── Section 1: Restricted Accounts ── */}
              <p style={{ ...sectionTitle, marginTop: '2.5rem' }}>Restricted Accounts</p>
              <RestrictedAccountsSection data={security?.restrictedAccounts} />

              {/* ── Section 2: Security Response ── */}
              <p style={{ ...sectionTitle, marginTop: '2.5rem' }}>Security Response</p>
              <SecurityResponseSection data={security?.securityResponse} />

              {/* ── Section 3: Recent Security Activity ── */}
              <p style={{ ...sectionTitle, marginTop: '2.5rem' }}>Recent Security Activity</p>
              <RecentSecurityActivity rows={security?.recentSecurityActivity} />
            </>
          )}

          {loading && !error && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)' }}>
              Loading dashboard data...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function RecentThreatsTable({ rows, loading }) {  const riskColor = r => r === 'High' ? 'var(--danger)' : r === 'Medium' ? 'var(--warning)' : 'var(--success)';
  const riskBg    = r => r === 'High' ? 'var(--danger-light)' : r === 'Medium' ? 'var(--warning-light)' : 'var(--success-light)';

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date).replace(',', '');
    } catch {
      return '—';
    }
  };

  return (
    <div style={{ 
      background: 'var(--bg-primary)', 
      border: '1px solid var(--border-color)', 
      borderRadius: 'var(--radius-lg)', 
      overflow: 'hidden',
      boxShadow: 'var(--shadow-md)'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-secondary)' }}>
            <tr>
              {['Attack Type', 'Risk Level', 'Confidence', 'Source IP', 'Time'].map(h => (
                <th key={h} style={{ 
                  padding: '0.875rem 1rem', 
                  fontSize: 'var(--font-size-sm)', 
                  fontWeight: 700, 
                  color: 'var(--text-secondary)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em', 
                  textAlign: 'left',
                  borderBottom: '2px solid var(--border-color)'
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: 'var(--text-secondary)', 
                  fontSize: 'var(--font-size-base)' 
                }}>
                  Loading recent threats...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ 
                  padding: '2rem', 
                  textAlign: 'center', 
                  color: 'var(--text-muted)', 
                  fontSize: 'var(--font-size-base)' 
                }}>
                  No threats logged yet
                </td>
              </tr>
            ) : rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {r.attack_type}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <span style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.375rem', 
                    padding: '0.375rem 0.75rem', 
                    borderRadius: '999px', 
                    fontSize: 'var(--font-size-xs)', 
                    fontWeight: 700, 
                    background: riskBg(r.risk_level), 
                    color: riskColor(r.risk_level),
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {r.risk_level}
                  </span>
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
                  {r.confidence_score}%
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-base)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {r.source_ip || '—'}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
                  {formatTimestamp(r.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 1: Restricted Accounts
// Shows current restriction breakdown by source
// ─────────────────────────────────────────────────────────────
function RestrictedAccountsSection({ data }) {
  const total    = data?.total    ?? '—';
  const manual   = data?.manual   ?? '—';
  const mlAuto   = data?.mlAuto   ?? '—';
  const authRule = data?.authRule ?? '—';

  const tiles = [
    {
      label: 'Total Restricted',
      value: total,
      icon: <FiLock size={22} />,
      color: 'var(--danger)',
      bg:    'var(--danger-light)',
      border: 'rgba(239,68,68,0.25)',
      desc:  'Accounts blocked right now',
    },
    {
      label: 'Manual (Admin)',
      value: manual,
      icon: <FiUserCheck size={22} />,
      color: 'var(--warning)',
      bg:    'var(--warning-light)',
      border: 'rgba(251,146,60,0.25)',
      desc:  'Admin-applied restrictions',
    },
    {
      label: 'ML Auto-Restricted',
      value: mlAuto,
      icon: <FiCpu size={22} />,
      color: 'var(--purple, #7c3aed)',
      bg:    'rgba(139,92,246,0.08)',
      border: 'rgba(139,92,246,0.25)',
      desc:  'LSTM HIGH-risk detections',
    },
    {
      label: 'Auth Rule',
      value: authRule,
      icon: <FiAlertCircle size={22} />,
      color: 'var(--info)',
      bg:    'var(--info-light)',
      border: 'rgba(6,182,212,0.25)',
      desc:  'Brute-force threshold triggered',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '0.5rem' }}>
      {tiles.map(t => (
        <div key={t.label} style={{
          background: 'var(--bg-primary)',
          border: `1px solid var(--border-color)`,
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
          transition: 'var(--transition)',
        }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = t.border; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
            background: t.bg, border: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: t.color,
          }}>
            {t.icon}
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: t.value > 0 ? t.color : 'var(--text-primary)', lineHeight: 1 }}>
              {t.value}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              {t.label}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
              {t.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 2: Security Response
// All-time restriction event counters + current state
// ─────────────────────────────────────────────────────────────
function SecurityResponseSection({ data }) {
  const rows = [
    {
      label: 'ML Automatic Restrictions',
      value: data?.mlAutoRestrictions   ?? '—',
      icon:  <FiCpu size={16} />,
      color: 'var(--purple, #7c3aed)',
      bg:    'rgba(139,92,246,0.08)',
      desc:  'Triggered by LSTM HIGH-risk prediction',
    },
    {
      label: 'Authentication Rule Restrictions',
      value: data?.authRuleRestrictions ?? '—',
      icon:  <FiAlertCircle size={16} />,
      color: 'var(--info)',
      bg:    'var(--info-light)',
      desc:  'Triggered by repeated failed-login threshold',
    },
    {
      label: 'Manual Admin Restrictions',
      value: data?.manualRestrictions   ?? '—',
      icon:  <FiUserCheck size={16} />,
      color: 'var(--warning)',
      bg:    'var(--warning-light)',
      desc:  'Applied manually by an administrator',
    },
    {
      label: 'Restrictions Released',
      value: data?.restrictionsReleased ?? '—',
      icon:  <FiUnlock size={16} />,
      color: 'var(--success)',
      bg:    'var(--success-light)',
      desc:  'Manually released by admin',
    },
    {
      label: 'Currently Restricted',
      value: data?.currentlyRestricted  ?? '—',
      icon:  <FiLock size={16} />,
      color: data?.currentlyRestricted > 0 ? 'var(--danger)' : 'var(--success)',
      bg:    data?.currentlyRestricted > 0 ? 'var(--danger-light)' : 'var(--success-light)',
      desc:  'Active blocks right now',
    },
  ];

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: '0.5rem',
    }}>
      {rows.map((row, i) => (
        <div key={row.label} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: i < rows.length - 1 ? '1px solid var(--border-color)' : 'none',
          transition: 'var(--transition)',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
              background: row.bg, color: row.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {row.icon}
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {row.label}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                {row.desc}
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 800,
            color: row.color,
            minWidth: '2.5rem',
            textAlign: 'right',
          }}>
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 3: Recent Security Activity
// Last 20 security-relevant events across all users
// ─────────────────────────────────────────────────────────────
function RecentSecurityActivity({ rows }) {
  const formatTs = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: true,
      }).format(d).replace(',', '');
    } catch { return '—'; }
  };

  const EVENT_META = {
    login: {
      label: 'Login Success',
      icon:  <FiLogIn size={14} />,
      color: 'var(--success)',
      bg:    'var(--success-light)',
    },
    login_failed: {
      label: 'Login Failed',
      icon:  <FiAlertTriangle size={14} />,
      color: 'var(--danger)',
      bg:    'var(--danger-light)',
    },
    threat_detected: {
      label: 'Threat Detected',
      icon:  <FiAlertCircle size={14} />,
      color: 'var(--warning)',
      bg:    'var(--warning-light)',
    },
    user_restricted: {
      label: 'Account Restricted',
      icon:  <FiLock size={14} />,
      color: 'var(--danger)',
      bg:    'var(--danger-light)',
    },
    restriction_released: {
      label: 'Restriction Released',
      icon:  <FiUnlock size={14} />,
      color: 'var(--success)',
      bg:    'var(--success-light)',
    },
    password_reset_requested: {
      label: 'Password Reset Requested',
      icon:  <FiKey size={14} />,
      color: 'var(--info)',
      bg:    'var(--info-light)',
    },
    password_reset_completed: {
      label: 'Password Reset Completed',
      icon:  <FiKey size={14} />,
      color: 'var(--success)',
      bg:    'var(--success-light)',
    },
  };

  if (!rows || rows.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)', padding: '2rem',
        textAlign: 'center', color: 'var(--text-muted)',
        fontSize: 'var(--font-size-base)', boxShadow: 'var(--shadow-sm)',
        marginBottom: '0.5rem',
      }}>
        No recent security events
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: '0.5rem',
    }}>
      {rows.map((row, i) => {
        const meta = EVENT_META[row.event_type] || {
          label: row.event_type,
          icon:  <FiActivity size={14} />,
          color: 'var(--text-secondary)',
          bg:    'var(--bg-secondary)',
        };
        return (
          <div key={row.id || i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.875rem 1.5rem',
            borderBottom: i < rows.length - 1 ? '1px solid var(--border-color)' : 'none',
            transition: 'var(--transition)',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Event type badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.3rem 0.7rem',
              borderRadius: '999px',
              background: meta.bg,
              color: meta.color,
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              minWidth: '155px',
              justifyContent: 'center',
            }}>
              {meta.icon}
              {meta.label}
            </div>

            {/* Email */}
            <span style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-primary)',
              fontWeight: 500,
              flex: '0 0 auto',
              minWidth: '180px',
              maxWidth: '220px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace',
            }}>
              {row.user_email}
            </span>

            {/* Details */}
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }} title={row.details}>
              {row.details || '—'}
            </span>

            {/* IP */}
            {row.ip_address && row.ip_address !== '—' && (
              <span style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
                flexShrink: 0,
              }}>
                {row.ip_address}
              </span>
            )}

            {/* Timestamp */}
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)',
              flexShrink: 0,
              minWidth: '120px',
              textAlign: 'right',
            }}>
              {formatTs(row.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
