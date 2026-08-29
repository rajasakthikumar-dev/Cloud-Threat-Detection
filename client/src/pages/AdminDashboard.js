import React, { useEffect, useState } from 'react';
import { FiUsers, FiAlertTriangle, FiFolder, FiActivity, FiShield } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import AlertBox from '../components/AlertBox';
import ThreatChart, { AttackCategoryBar, RiskLevelPie } from '../components/ThreatChart';
import { getAdminStats, getRecentThreats } from '../services/api';
import { useSocket } from '../App';

const layout = {
  wrapper:  { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a' },
  body:     { display: 'flex', flex: 1 },
  main:     { flex: 1, padding: '28px', overflow: 'auto' },
  heading:  { fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' },
  sub:      { fontSize: '13px', color: '#64748b', marginBottom: '24px' },
  cards:    { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' },
  grid2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' },
  grid3:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '28px' },
  alertList:{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' },
  sectionTitle: { fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px',
                  textTransform: 'uppercase', letterSpacing: '0.06em' },
};

// Placeholder data shown until the API responds
const PLACEHOLDER = {
  stats:  { users: 0, files: 0, threats: 0, alerts: 0 },
  area:   [],
  bar:    [],
  pie:    [{ name: 'Low', value: 60 }, { name: 'Medium', value: 30 }, { name: 'High', value: 10 }],
  recent: [],
};

export default function AdminDashboard() {
  const socket = useSocket();
  const [stats,   setStats]   = useState(PLACEHOLDER.stats);
  const [area,    setArea]    = useState(PLACEHOLDER.area);
  const [bar,     setBar]     = useState(PLACEHOLDER.bar);
  const [pie,     setPie]     = useState(PLACEHOLDER.pie);
  const [recent,  setRecent]  = useState(PLACEHOLDER.recent);
  const [rtAlerts, setRtAlerts] = useState([]);   // real-time socket alerts
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [statsRes, threatsRes] = await Promise.all([
          getAdminStats(),
          getRecentThreats(),
        ]);
        const d = statsRes.data;
        setStats({ users: d.totalUsers, files: d.totalFiles, threats: d.totalThreats, alerts: d.activeAlerts });
        setArea(d.trafficTimeline  || []);
        setBar(d.categoryBreakdown || []);
        setPie(d.riskDistribution  || PLACEHOLDER.pie);
        setRecent(threatsRes.data.threats || []);
      } catch (_) { /* use placeholder data on error */ }
      finally { setLoading(false); }
    }
    fetchAll();
  }, []);

  // Accumulate real-time threat alerts from Socket.io
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setRtAlerts(prev => [data, ...prev].slice(0, 5));
      setStats(prev => ({ ...prev, alerts: prev.alerts + 1, threats: prev.threats + 1 }));
    };
    socket.on('threat_alert', handler);
    return () => socket.off('threat_alert', handler);
  }, [socket]);

  return (
    <div style={layout.wrapper}>
      <Navbar />
      <div style={layout.body}>
        <Sidebar />
        <main style={layout.main}>
          <h1 style={layout.heading}>Admin Dashboard</h1>
          <p style={layout.sub}>Real-time overview of platform activity and threat intelligence.</p>

          {/* ── KPI Cards ── */}
          <div style={layout.cards}>
            <DashboardCard title="Total Users"    value={stats.users}   icon={<FiUsers />}         color="#38bdf8" subtitle="Registered accounts" />
            <DashboardCard title="Files in S3"    value={stats.files}   icon={<FiFolder />}        color="#22c55e" subtitle="Uploaded files" />
            <DashboardCard title="Threats Logged" value={stats.threats} icon={<FiAlertTriangle />} color="#ef4444" subtitle="All-time detections" />
            <DashboardCard title="Active Alerts"  value={stats.alerts}  icon={<FiShield />}        color="#f59e0b" subtitle="Pending review" />
          </div>

          {/* ── Real-time alerts from socket ── */}
          {rtAlerts.length > 0 && (
            <>
              <p style={layout.sectionTitle}>Live Threat Alerts</p>
              <div style={layout.alertList}>
                {rtAlerts.map((alert, i) => (
                  <AlertBox
                    key={i}
                    type={alert.risk_level === 'High' ? 'error' : alert.risk_level === 'Medium' ? 'warning' : 'info'}
                    title={`${alert.attack_type} — ${alert.risk_level} Risk`}
                    message={`Confidence: ${alert.confidence_score}%`}
                    details={{ 'Attack Type': alert.attack_type, 'Risk Level': alert.risk_level, 'Confidence': `${alert.confidence_score}%` }}
                    onDismiss={() => setRtAlerts(prev => prev.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Traffic chart ── */}
          <p style={layout.sectionTitle}>Traffic Overview</p>
          <div style={{ marginBottom: '24px' }}>
            <ThreatChart type="area" data={area} />
          </div>

          {/* ── Bar + Pie ── */}
          <div style={layout.grid2}>
            <AttackCategoryBar data={bar} />
            <RiskLevelPie data={pie} />
          </div>

          {/* ── Recent threats table ── */}
          <p style={layout.sectionTitle}>Recent Threats</p>
          <RecentThreatsTable rows={recent} loading={loading} />
        </main>
      </div>
    </div>
  );
}

function RecentThreatsTable({ rows, loading }) {
  const th = { padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#475569',
               textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' };
  const td = { padding: '11px 14px', fontSize: '13px', color: '#94a3b8', borderTop: '1px solid #1e293b' };
  const riskColor = r => r === 'High' ? '#ef4444' : r === 'Medium' ? '#f59e0b' : '#22c55e';

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#0f172a' }}>
          <tr>
            {['Attack Type', 'Risk Level', 'Confidence', 'Source IP', 'Time'].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#475569' }}>Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#475569' }}>No threats logged yet.</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i}>
              <td style={td}>{r.attack_type}</td>
              <td style={td}><span style={{ color: riskColor(r.risk_level), fontWeight: 600 }}>{r.risk_level}</span></td>
              <td style={td}>{r.confidence_score}%</td>
              <td style={{ ...td, fontFamily: 'monospace', fontSize: '12px' }}>{r.source_ip || '—'}</td>
              <td style={td}>{r.timestamp ? new Date(r.timestamp).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
