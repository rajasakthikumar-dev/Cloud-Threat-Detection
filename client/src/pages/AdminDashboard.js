import React, { useEffect, useState } from 'react';
import { FiUsers, FiAlertTriangle, FiFolder, FiActivity, FiShield } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import AlertBox from '../components/AlertBox';
import ThreatChart, { AttackCategoryBar, RiskLevelPie } from '../components/ThreatChart';
import { getAdminStats, getRecentThreats } from '../services/api';
import { useSocket, useAuth } from '../App';

/**
 * AdminDashboard - platform overview with real-time threat alerts
 * FIXED: Added auth initialization check to prevent race conditions
 */

const PLACEHOLDER = {
  stats:  { users:0, files:0, threats:0, alerts:0 },
  area:   [],
  bar:    [],
  pie:    [{ name:'Low', value:60 }, { name:'Medium', value:30 }, { name:'High', value:10 }],
  recent: [],
};

export default function AdminDashboard() {
  const socket = useSocket();
  const { initializing } = useAuth();
  const [stats,    setStats]    = useState(PLACEHOLDER.stats);
  const [area,     setArea]     = useState(PLACEHOLDER.area);
  const [bar,      setBar]      = useState(PLACEHOLDER.bar);
  const [pie,      setPie]      = useState(PLACEHOLDER.pie);
  const [recent,   setRecent]   = useState(PLACEHOLDER.recent);
  const [rtAlerts, setRtAlerts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    // FIX: Wait for auth to initialize
    if (initializing) return;
    
    async function fetchAll() {
      setError(null);
      try {
        const [statsRes, threatsRes] = await Promise.all([getAdminStats(), getRecentThreats()]);
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

function RecentThreatsTable({ rows, loading }) {
  const riskColor = r => r === 'High' ? 'var(--danger)' : r === 'Medium' ? 'var(--warning)' : 'var(--success)';
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
