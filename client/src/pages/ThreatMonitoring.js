import React, { useEffect, useState } from 'react';
import {
  FiRefreshCw, FiAlertTriangle, FiFilter, FiX,
  FiUser, FiClock, FiActivity, FiFolder, FiShield,
  FiInfo, FiLogIn, FiAlertCircle,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar    from '../components/Navbar';
import Sidebar   from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import { ThreatAreaChart, AttackCategoryBar, RiskLevelPie } from '../components/ThreatChart';
import { getThreats, getThreatStats, getThreatDetail } from '../services/api';
import { useSocket, useAuth } from '../App';

/**
 * ThreatMonitoring - Professional SOC Dashboard
 * IMPROVED: Large readable fonts (14-16px+), professional light theme, real data only
 * 
 * DATA FLOW:
 * - getThreatStats() → Returns aggregated data for charts (timeline, categories, risk distribution)
 * - getThreats() → Returns individual threat records for the detection log table
 * - All data comes from Firestore threat_logs collection
 * - NO fake/static data
 */

const RISK_COLORS  = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const RISK_BG      = { High: '#fee2e2', Medium: '#fef3c7', Low: '#dcfce7' };
const EVENT_ICONS  = {
  login:         <FiLogIn size={14} color="var(--info)" />,
  logout:        <FiLogIn size={14} color="var(--text-muted)" />,
  file_upload:   <FiFolder size={14} color="var(--success)" />,
  file_download: <FiFolder size={14} color="var(--info)" />,
  file_delete:   <FiFolder size={14} color="var(--danger)" />,
  threat_detected:<FiAlertCircle size={14} color="var(--danger)" />,
};

function ClickCard({ title, value, icon, color, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        flex: '1 1 200px',
        outline: active ? `2px solid ${color}` : '2px solid transparent',
        outlineOffset: '2px',
        borderRadius: 'var(--radius-lg)',
        transition: 'outline 0.15s',
      }}
      title={`Click to filter by ${title}`}
    >
      <DashboardCard title={title} value={value} icon={icon} color={color} />
    </div>
  );
}

function RawInputTable({ data }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (!entries.length) return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-base)' }}>No raw input captured.</p>;
  return (
    <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontWeight: 600,
                           borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap', width: '35%' }}>
                {k}
              </td>
              <td style={{ padding: '0.5rem', color: 'var(--text-primary)', fontFamily: 'monospace',
                           borderBottom: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                {String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ThreatMonitoring() {
  const socket = useSocket();
  const { initializing } = useAuth();

  const [stats,      setStats]      = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [threats,    setThreats]    = useState([]);
  const [timeline,   setTimeline]   = useState([]);
  const [catData,    setCatData]    = useState([]);
  const [riskData,   setRiskData]   = useState([]);
  const [riskFilter, setRiskFilter] = useState('All');
  const [loading,    setLoading]    = useState(true);
  const [spinning,   setSpinning]   = useState(false);
  const [error,      setError]      = useState(null);

  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [detail,       setDetail]       = useState(null);

  // Load threat data - uses REAL Firestore data
  const load = async () => {
    if (initializing) return;
    
    setError(null);
    setSpinning(true);
    try {
      const [tRes, sRes] = await Promise.all([getThreats(), getThreatStats()]);
      const ts = tRes.data.threats || [];
      setThreats(ts);
      const s = sRes.data;
      setStats({ total: s.total || ts.length, high: s.high || 0, medium: s.medium || 0, low: s.low || 0 });
      setTimeline(s.timeline  || []);
      setCatData(s.categories || []);
      setRiskData([
        { name: 'Low',    value: s.low    || 0 },
        { name: 'Medium', value: s.medium || 0 },
        { name: 'High',   value: s.high   || 0 },
      ]);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to load threat data.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  };

  useEffect(() => {
    if (!initializing) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing]);

  useEffect(() => {
    if (!socket) return;
    const handler = data => {
      setThreats(prev => [{ ...data, timestamp: new Date().toISOString() }, ...prev].slice(0, 200));
      setStats(prev => ({
        ...prev,
        total:  prev.total + 1,
        high:   data.risk_level === 'High'   ? prev.high   + 1 : prev.high,
        medium: data.risk_level === 'Medium' ? prev.medium + 1 : prev.medium,
        low:    data.risk_level === 'Low'    ? prev.low    + 1 : prev.low,
      }));
    };
    socket.on('threat_alert', handler);
    return () => socket.off('threat_alert', handler);
  }, [socket]);

  const handleCardClick = (level) => {
    setRiskFilter(prev => prev === level ? 'All' : level);
  };

  const openDetail = async (threat) => {
    if (!threat.id) {
      setDetail({ threat, loginAttempts: null, relatedActivity: [], fileActivity: [] });
      setModalOpen(true);
      return;
    }
    setDetail(null);
    setModalOpen(true);
    setModalLoading(true);
    try {
      const res = await getThreatDetail(threat.id);
      setDetail(res.data);
    } catch (err) {
      toast.error('Could not load threat details.');
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setDetail(null);
    setModalLoading(false);
  };

  const filtered = riskFilter === 'All'
    ? threats
    : threats.filter(t => t.risk_level === riskFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2.5rem', overflow: 'auto', maxWidth: '1800px', margin: '0 auto', width: '100%' }}>
          {/* Page Header - Large readable title */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ 
              fontSize: '1.875rem',  // 30px - large page title
              fontWeight: 800, 
              color: 'var(--text-primary)', 
              marginBottom: '0.625rem',
              letterSpacing: '-0.02em'
            }}>
              Threat Monitoring Dashboard
            </h1>
            <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-secondary)' }}>
              Real-time LSTM-powered threat detection and analysis
            </p>
          </div>

          {/* Toolbar - Large fonts */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <FiFilter size={18} color="var(--text-secondary)" />
              <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Filter:
              </span>
            </div>
            <select style={{
              padding: '0.75rem 1.125rem',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-base)',  // 16px
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }} value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
              {['All', 'High', 'Medium', 'Low'].map(v => <option key={v}>{v}</option>)}
            </select>
            {riskFilter !== 'All' && (
              <button
                onClick={() => setRiskFilter('All')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.125rem', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: 'var(--font-size-base)',
                  fontWeight: 600, cursor: 'pointer', transition: 'var(--transition)',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              >
                <FiX size={16} /> Clear filter
              </button>
            )}
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.75rem 1.25rem', background: 'var(--primary)',
                border: 'none', borderRadius: 'var(--radius-md)',
                color: 'var(--text-white)', fontSize: 'var(--font-size-base)',
                fontWeight: 600, cursor: 'pointer', marginLeft: 'auto',
                transition: 'var(--transition)', boxShadow: 'var(--shadow-md)'
              }}
              onClick={load}
              disabled={spinning}
              onMouseEnter={e => !spinning && (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <FiRefreshCw size={16} style={spinning ? { animation: 'spin 1s linear infinite' } : {}} />
              Refresh Data
            </button>
          </div>

          {/* KPI Cards - Clickable filters */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
            <ClickCard
              title="Total Threats" value={stats.total}
              icon={<FiAlertTriangle />} color="var(--info)"
              active={riskFilter === 'All'}
              onClick={() => setRiskFilter('All')}
            />
            <ClickCard
              title="High Risk" value={stats.high}
              icon={<FiAlertTriangle />} color="var(--danger)"
              active={riskFilter === 'High'}
              onClick={() => handleCardClick('High')}
            />
            <ClickCard
              title="Medium Risk" value={stats.medium}
              icon={<FiAlertTriangle />} color="var(--warning)"
              active={riskFilter === 'Medium'}
              onClick={() => handleCardClick('Medium')}
            />
            <ClickCard
              title="Low Risk" value={stats.low}
              icon={<FiAlertTriangle />} color="var(--success)"
              active={riskFilter === 'Low'}
              onClick={() => handleCardClick('Low')}
            />
          </div>

          {/* Charts - Professional SOC dashboard appearance */}
          <div style={{ marginBottom: '2.5rem' }}>
            <ThreatAreaChart data={timeline} />
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', 
            gap: '1.5rem', 
            marginBottom: '2.5rem' 
          }}>
            <AttackCategoryBar data={catData} />
            <RiskLevelPie data={riskData} />
          </div>

          {/* Detection Log - Large readable table */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ 
              fontSize: '1.25rem',  // 20px
              fontWeight: 700, 
              color: 'var(--text-primary)',
              marginBottom: '0.25rem',
              letterSpacing: '-0.01em'
            }}>
              Detection Log
              <span style={{ 
                marginLeft: '0.75rem', 
                fontSize: 'var(--font-size-base)', 
                fontWeight: 600,
                color: 'var(--text-secondary)' 
              }}>
                ({filtered.length} {filtered.length === 1 ? 'record' : 'records'})
              </span>
            </h2>
            {riskFilter !== 'All' && (
              <p style={{ 
                fontSize: 'var(--font-size-base)', 
                color: RISK_COLORS[riskFilter],
                fontWeight: 600,
                marginTop: '0.25rem'
              }}>
                Filtered by {riskFilter} risk level
              </p>
            )}
          </div>

          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                <thead style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    {['User', 'Attack Type', 'Risk Level', 'Confidence', 'Source IP', 'Timestamp'].map(h => (
                      <th key={h} style={{
                        padding: '1rem 1.25rem',
                        fontSize: '0.9375rem',  // 15px
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        textAlign: 'left',
                        borderBottom: '2px solid var(--border-color)'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ 
                      padding: '3rem', 
                      textAlign: 'center', 
                      color: 'var(--text-secondary)', 
                      fontSize: 'var(--font-size-lg)' 
                    }}>
                      <FiRefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem' }} />
                      Loading threat data...
                    </td></tr>
                  ) : error ? (
                    <tr><td colSpan={6} style={{ 
                      padding: '3rem', 
                      textAlign: 'center', 
                      color: 'var(--danger)', 
                      fontSize: 'var(--font-size-base)' 
                    }}>
                      <FiAlertTriangle size={24} style={{ marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem' }} />
                      {error}
                    </td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ 
                      padding: '3rem', 
                      textAlign: 'center', 
                      color: 'var(--text-muted)', 
                      fontSize: 'var(--font-size-base)' 
                    }}>
                      <FiShield size={32} style={{ opacity: 0.3, marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem' }} />
                      {riskFilter !== 'All' 
                        ? `No ${riskFilter} risk threats detected.` 
                        : 'No threats detected. Your system is secure.'}
                    </td></tr>
                  ) : filtered.slice(0, 100).map((t, i) => (
                    <tr
                      key={t.id || i}
                      onClick={() => openDetail(t)}
                      style={{ 
                        cursor: 'pointer', 
                        borderBottom: '1px solid var(--border-color)', 
                        transition: 'var(--transition)' 
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      title="Click for detailed threat analysis"
                    >
                      <td style={{ 
                        padding: '1rem 1.25rem', 
                        fontFamily: 'monospace', 
                        fontSize: '0.9375rem',  // 15px
                        color: 'var(--text-primary)',
                        fontWeight: 500
                      }}>
                        {t.user_email || '—'}
                      </td>
                      <td style={{ 
                        padding: '1rem 1.25rem', 
                        fontSize: 'var(--font-size-base)',  // 16px
                        color: 'var(--text-secondary)',
                        fontWeight: 500
                      }}>
                        {t.attack_type || '—'}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.375rem 0.875rem',
                          borderRadius: '999px',
                          fontSize: '0.875rem',  // 14px
                          fontWeight: 700,
                          background: RISK_BG[t.risk_level] || 'var(--bg-secondary)',
                          color: RISK_COLORS[t.risk_level] || 'var(--text-primary)'
                        }}>
                          {t.risk_level || '—'}
                        </span>
                      </td>
                      <td style={{ 
                        padding: '1rem 1.25rem', 
                        fontSize: 'var(--font-size-base)',  // 16px
                        color: 'var(--text-secondary)',
                        fontWeight: 600
                      }}>
                        {t.confidence_score != null ? `${t.confidence_score}%` : '—'}
                      </td>
                      <td style={{ 
                        padding: '1rem 1.25rem', 
                        fontFamily: 'monospace', 
                        fontSize: '0.9375rem',  // 15px
                        color: 'var(--text-secondary)' 
                      }}>
                        {t.source_ip || '—'}
                      </td>
                      <td style={{ 
                        padding: '1rem 1.25rem', 
                        fontSize: '0.9375rem',  // 15px
                        color: 'var(--text-secondary)' 
                      }}>
                        {t.timestamp ? new Date(t.timestamp).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 100 && (
              <div style={{ 
                padding: '1rem 1.25rem', 
                fontSize: 'var(--font-size-base)', 
                color: 'var(--text-muted)', 
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)'
              }}>
                <FiInfo size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Showing first 100 of {filtered.length} records. Use the risk filter to narrow results.
              </div>
            )}
          </div>
        </main>
      </div>

      {/* THREAT DETAIL MODAL */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '20px',
        }} onClick={closeModal}>
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '950px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: 'var(--shadow-xl)'
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <FiShield size={24} color="var(--danger)" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Threat Analysis Detail
                  </h2>
                  {detail?.threat && (
                    <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', margin: 0 }}>
                      {detail.threat.attack_type} — {detail.threat.user_email}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer', 
                  padding: '0.25rem',
                  fontSize: '1.5rem',
                  lineHeight: 1
                }}
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '2rem', overflow: 'auto', flex: 1 }}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <FiRefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
                  <p style={{ fontSize: 'var(--font-size-lg)' }}>Loading detailed threat analysis…</p>
                </div>
              ) : detail ? (
                <ThreatDetailBody detail={detail} />
              ) : null}
            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 2rem', borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end'
            }}>
              <button style={{
                background: 'var(--primary)', border: 'none',
                borderRadius: 'var(--radius-md)', color: 'var(--text-white)',
                padding: '0.75rem 1.75rem', fontSize: 'var(--font-size-base)',
                fontWeight: 600, cursor: 'pointer', transition: 'var(--transition)',
                boxShadow: 'var(--shadow-sm)'
              }} onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ThreatDetailBody({ detail }) {
  const { threat, loginAttempts, relatedActivity } = detail;
  const riskColor = RISK_COLORS[threat.risk_level] || 'var(--text-secondary)';
  const riskBg    = RISK_BG[threat.risk_level]    || 'var(--bg-secondary)';

  const infoCardStyle = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', padding: '1.25rem 1.5rem'
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem',
                        fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
                        letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
            <FiUser size={14} color="var(--info)" />
            User Email
          </div>
          <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'monospace' }}>
            {threat.user_email || '—'}
          </div>
        </div>
        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem',
                        fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
                        letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
            <FiShield size={14} color={riskColor} />
            Risk Level
          </div>
          <span style={{
            display: 'inline-block', padding: '0.5rem 1.125rem', borderRadius: '999px',
            fontSize: 'var(--font-size-base)', fontWeight: 700,
            background: riskBg, color: riskColor
          }}>{threat.risk_level || '—'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem',
                        fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
                        letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
            <FiAlertTriangle size={14} color="var(--warning)" />
            Attack Type
          </div>
          <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', fontWeight: 500 }}>
            {threat.attack_type || '—'}
          </div>
        </div>
        <div style={infoCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem',
                        fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
                        letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
            <FiActivity size={14} color="var(--purple)" />
            ML Confidence Score
          </div>
          <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', fontWeight: 600 }}>
            {threat.confidence_score != null ? `${threat.confidence_score}%` : '—'}
          </div>
        </div>
      </div>

      {loginAttempts && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={infoCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem',
                            fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
                            letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                <FiLogIn size={14} color="var(--success)" />
                Successful Logins (All Time)
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)', fontWeight: 600 }}>
                {String(loginAttempts.successful)}
              </div>
            </div>
            <div style={infoCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem',
                            fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
                            letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                <FiLogIn size={14} color="var(--danger)" />
                Failed Login Attempts
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', color: 'var(--danger)', fontWeight: 600 }}>
                {String(loginAttempts.failed)}
              </div>
            </div>
          </div>
          {loginAttempts?.lastLogin && (
            <div style={{ ...infoCardStyle, marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem',
                            fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase',
                            letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                <FiClock size={14} color="var(--text-muted)" />
                Last Login Before This Threat
              </div>
              <div style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', fontWeight: 500 }}>
                {new Date(loginAttempts.lastLogin).toLocaleString()}
              </div>
            </div>
          )}
        </>
      )}

      {relatedActivity && relatedActivity.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: 'var(--font-size-base)',
                        fontWeight: 700, color: 'var(--text-primary)',
                        marginTop: '2rem', marginBottom: '1rem' }}>
            <FiAlertCircle size={16} />
            Related Activity (±30 min window)
            <span style={{ fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
              {relatedActivity.length} events
            </span>
          </div>
          <div style={{ ...infoCardStyle, padding: '0.75rem', maxHeight: '220px', overflowY: 'auto' }}>
            {relatedActivity.map((a, i) => (
              <div key={a.id || i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                padding: '0.75rem', borderBottom: i < relatedActivity.length - 1 ? '1px solid var(--border-color)' : 'none',
                fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)'
              }}>
                <span style={{ marginTop: '2px' }}>{EVENT_ICONS[a.event_type] || <FiActivity size={14} />}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {a.event_type?.replace(/_/g, ' ').toUpperCase() || 'EVENT'}
                  </span>
                  {a.details && <span style={{ color: 'var(--text-secondary)', marginLeft: '0.625rem' }}>{a.details}</span>}
                </div>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                  {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {threat.raw_input && Object.keys(threat.raw_input).length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: 'var(--font-size-base)',
                        fontWeight: 700, color: 'var(--text-primary)',
                        marginTop: '2rem', marginBottom: '1rem' }}>
            <FiInfo size={16} />
            Raw ML Input Features (LSTM Inputs)
          </div>
          <div style={infoCardStyle}>
            <RawInputTable data={threat.raw_input} />
          </div>
        </>
      )}
    </>
  );
}
