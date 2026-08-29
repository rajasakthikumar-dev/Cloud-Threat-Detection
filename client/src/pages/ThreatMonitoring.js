import React, { useEffect, useState, useCallback } from 'react';
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
import { useSocket } from '../App';

// ─── Style tokens ────────────────────────────────────────────
const s = {
  wrapper:  { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a' },
  body:     { display: 'flex', flex: 1 },
  main:     { flex: 1, padding: '28px', overflow: 'auto' },
  heading:  { fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' },
  sub:      { fontSize: '13px', color: '#64748b', marginBottom: '24px' },
  toolbar:  { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
  select: {
    padding: '8px 12px', background: '#1e293b', border: '1px solid #334155',
    borderRadius: '8px', color: '#94a3b8', fontSize: '13px', outline: 'none',
  },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', background: '#0369a1', border: 'none',
    borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: 'pointer',
    marginLeft: 'auto',
  },
  cards:    { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' },
  grid2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' },
  section:  { fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px',
              textTransform: 'uppercase', letterSpacing: '0.06em' },
  tableWrap:{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  th: { padding: '10px 14px', fontSize: '11px', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' },
  td: { padding: '11px 14px', fontSize: '13px', color: '#94a3b8', borderTop: '1px solid #1e293b' },
  // Modal
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 2000, padding: '20px',
  },
  modal: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: '16px',
    width: '100%', maxWidth: '860px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 30px 60px -12px rgba(0,0,0,0.7)',
  },
  mHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px', borderBottom: '1px solid #334155', background: '#0f172a',
  },
  mBody:   { padding: '24px', overflow: 'auto', flex: 1 },
  mFoot: {
    padding: '14px 24px', borderTop: '1px solid #334155', background: '#0f172a',
    display: 'flex', justifyContent: 'flex-end',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  infoCard: {
    background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px 16px',
  },
  infoLabel: { fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase',
               letterSpacing: '0.08em', marginBottom: '4px' },
  infoValue: { fontSize: '14px', color: '#e2e8f0', fontWeight: 500 },
  badge: (bg, color) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 700, background: bg, color,
  }),
  sectionHead: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '12px', fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginTop: '20px', marginBottom: '10px',
  },
  actRow: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '8px 0', borderBottom: '1px solid #1e293b',
    fontSize: '12px', color: '#94a3b8',
  },
  closeBtn: {
    background: '#334155', border: 'none', borderRadius: '8px', color: '#e2e8f0',
    padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  },
};

const RISK_COLORS  = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
const RISK_BG      = { High: '#450a0a', Medium: '#1c1208', Low: '#052e16' };
const EVENT_ICONS  = {
  login:         <FiLogIn size={12} color="#38bdf8" />,
  logout:        <FiLogIn size={12} color="#64748b" />,
  file_upload:   <FiFolder size={12} color="#4ade80" />,
  file_download: <FiFolder size={12} color="#60a5fa" />,
  file_delete:   <FiFolder size={12} color="#f87171" />,
  threat_detected:<FiAlertCircle size={12} color="#ef4444" />,
};

// ─── Clickable KPI card wrapper ──────────────────────────────
function ClickCard({ title, value, icon, color, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        flex: '1 1 160px',
        outline: active ? `2px solid ${color}` : '2px solid transparent',
        outlineOffset: '2px',
        borderRadius: '12px',
        transition: 'outline 0.15s',
      }}
      title={`Click to filter by ${title}`}
    >
      <DashboardCard title={title} value={value} icon={icon} color={color} />
    </div>
  );
}

// ─── Raw-input key-value table ────────────────────────────────
function RawInputTable({ data }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (!entries.length) return <p style={{ color: '#475569', fontSize: '12px' }}>No raw input captured.</p>;
  return (
    <div style={{ overflowX: 'auto', maxHeight: '160px', overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600,
                           borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap', width: '35%' }}>
                {k}
              </td>
              <td style={{ padding: '4px 8px', color: '#e2e8f0', fontFamily: 'monospace',
                           borderBottom: '1px solid #1e293b', wordBreak: 'break-all' }}>
                {String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function ThreatMonitoring() {
  const socket = useSocket();

  const [stats,      setStats]      = useState({ total: 0, high: 0, medium: 0, low: 0 });
  const [threats,    setThreats]    = useState([]);
  const [timeline,   setTimeline]   = useState([]);
  const [catData,    setCatData]    = useState([]);
  const [riskData,   setRiskData]   = useState([]);
  const [riskFilter, setRiskFilter] = useState('All');
  const [loading,    setLoading]    = useState(true);
  const [spinning,   setSpinning]   = useState(false);

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [detail,       setDetail]       = useState(null);  // { threat, loginAttempts, relatedActivity, fileActivity }

  // ── Load all threats + stats ────────────────────────────────
  const load = useCallback(async () => {
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
    } catch { toast.error('Failed to load threat data.'); }
    finally { setLoading(false); setSpinning(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Real-time socket threats ────────────────────────────────
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

  // ── KPI card click → set risk filter ───────────────────────
  const handleCardClick = (level) => {
    setRiskFilter(prev => prev === level ? 'All' : level);
  };

  // ── Row click → open detail modal ──────────────────────────
  const openDetail = async (threat) => {
    // If threat has no Firestore ID (e.g. live socket event before page refresh),
    // show what we have without fetching.
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

  // ── Filtered table rows ─────────────────────────────────────
  const filtered = riskFilter === 'All'
    ? threats
    : threats.filter(t => t.risk_level === riskFilter);

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={s.wrapper}>
      <Navbar />
      <div style={s.body}>
        <Sidebar />
        <main style={s.main}>
          <h1 style={s.heading}>Threat Monitoring</h1>
          <p style={s.sub}>Live LSTM-powered threat detection. Click a card or row for full details.</p>

          {/* ── Toolbar ── */}
          <div style={s.toolbar}>
            <FiFilter size={14} color="#475569" />
            <select style={s.select} value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
              {['All', 'High', 'Medium', 'Low'].map(v => <option key={v}>{v}</option>)}
            </select>
            {riskFilter !== 'All' && (
              <button
                onClick={() => setRiskFilter('All')}
                style={{ ...s.refreshBtn, background: '#334155', marginLeft: 0 }}
              >
                <FiX size={13} /> Clear filter
              </button>
            )}
            <button style={s.refreshBtn} onClick={load} disabled={spinning}>
              <FiRefreshCw size={14} style={spinning ? { animation: 'spin 1s linear infinite' } : {}} />
              Refresh
            </button>
          </div>

          {/* ── KPI cards — each is clickable to filter ── */}
          <div style={s.cards}>
            <ClickCard
              title="Total Threats" value={stats.total}
              icon={<FiAlertTriangle />} color="#38bdf8"
              active={riskFilter === 'All'}
              onClick={() => setRiskFilter('All')}
            />
            <ClickCard
              title="High Risk" value={stats.high}
              icon={<FiAlertTriangle />} color="#ef4444"
              active={riskFilter === 'High'}
              onClick={() => handleCardClick('High')}
            />
            <ClickCard
              title="Medium Risk" value={stats.medium}
              icon={<FiAlertTriangle />} color="#f59e0b"
              active={riskFilter === 'Medium'}
              onClick={() => handleCardClick('Medium')}
            />
            <ClickCard
              title="Low Risk" value={stats.low}
              icon={<FiAlertTriangle />} color="#22c55e"
              active={riskFilter === 'Low'}
              onClick={() => handleCardClick('Low')}
            />
          </div>

          {/* ── Charts ── */}
          <div style={{ marginBottom: '24px' }}>
            <ThreatAreaChart data={timeline} />
          </div>
          <div style={s.grid2}>
            <AttackCategoryBar data={catData} />
            <RiskLevelPie      data={riskData} />
          </div>

          {/* ── Detection log table ── */}
          <p style={s.section}>
            Detection Log ({filtered.length})
            {riskFilter !== 'All' && (
              <span style={{ marginLeft: '8px', fontSize: '12px', color: RISK_COLORS[riskFilter], fontWeight: 400 }}>
                — filtered: {riskFilter} risk
              </span>
            )}
          </p>
          <div style={s.tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#0f172a' }}>
                <tr>
                  {['User', 'Attack Type', 'Risk Level', 'Confidence', 'Source IP', 'Timestamp'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center' }}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#475569' }}>
                    No threats found{riskFilter !== 'All' ? ` for ${riskFilter} risk` : ''}.
                  </td></tr>
                ) : filtered.slice(0, 100).map((t, i) => (
                  <tr
                    key={t.id || i}
                    onClick={() => openDetail(t)}
                    style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#0f172a'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title="Click for full threat details"
                  >
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '12px' }}>
                      {t.user_email || '—'}
                    </td>
                    <td style={s.td}>{t.attack_type || '—'}</td>
                    <td style={s.td}>
                      <span style={{ color: RISK_COLORS[t.risk_level] || '#94a3b8', fontWeight: 600 }}>
                        {t.risk_level || '—'}
                      </span>
                    </td>
                    <td style={s.td}>{t.confidence_score != null ? `${t.confidence_score}%` : '—'}</td>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '12px' }}>{t.source_ip || '—'}</td>
                    <td style={s.td}>{t.timestamp ? new Date(t.timestamp).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <p style={{ padding: '10px 14px', fontSize: '12px', color: '#475569', borderTop: '1px solid #1e293b' }}>
                Showing first 100 of {filtered.length}. Use the risk filter to narrow results.
              </p>
            )}
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════
          THREAT DETAIL MODAL
          ════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={s.mHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FiShield size={20} color="#ef4444" />
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                    Threat Detail
                  </h2>
                  {detail?.threat && (
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      {detail.threat.attack_type} — {detail.threat.user_email}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={s.mBody}>
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                  <FiRefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
                  <p>Loading threat details from Firestore…</p>
                </div>
              ) : detail ? (
                <ThreatDetailBody detail={detail} />
              ) : null}
            </div>

            {/* Footer */}
            <div style={s.mFoot}>
              <button style={s.closeBtn} onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Spin keyframe — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Detail body rendered inside the modal ───────────────────
function ThreatDetailBody({ detail }) {
  const { threat, loginAttempts, relatedActivity, fileActivity } = detail;
  const riskColor = RISK_COLORS[threat.risk_level] || '#94a3b8';
  const riskBg    = RISK_BG[threat.risk_level]    || '#1e293b';

  return (
    <>
      {/* ── Row 1: identity + risk ── */}
      <div style={s.row2}>
        <InfoCard icon={<FiUser size={13} color="#38bdf8" />} label="User Email" value={threat.user_email || '—'} mono />
        <InfoCard icon={<FiShield size={13} color={riskColor} />} label="Risk Level">
          <span style={s.badge(riskBg, riskColor)}>{threat.risk_level || '—'}</span>
        </InfoCard>
      </div>

      {/* ── Row 2: attack + confidence ── */}
      <div style={s.row2}>
        <InfoCard icon={<FiAlertTriangle size={13} color="#f59e0b" />} label="Attack / Threat Type" value={threat.attack_type || '—'} />
        <InfoCard icon={<FiActivity size={13} color="#a78bfa" />} label="ML Confidence Score" value={threat.confidence_score != null ? `${threat.confidence_score}%` : '—'} />
      </div>

      {/* ── Row 3: IP + timestamp ── */}
      <div style={s.row2}>
        <InfoCard icon={<FiInfo size={13} color="#60a5fa" />} label="Source IP Address" value={threat.source_ip || '—'} mono />
        <InfoCard icon={<FiClock size={13} color="#34d399" />} label="Detection Timestamp"
          value={threat.timestamp ? new Date(threat.timestamp).toLocaleString() : '—'} />
      </div>

      {/* ── Row 4: logins ── */}
      {loginAttempts && (
        <div style={s.row2}>
          <InfoCard icon={<FiLogIn size={13} color="#4ade80" />} label="Successful Logins (all time)" value={String(loginAttempts.successful)} />
          <InfoCard icon={<FiLogIn size={13} color="#f87171" />} label="Failed Login Attempts" value={String(loginAttempts.failed)} />
        </div>
      )}

      {/* ── Last login time ── */}
      {loginAttempts?.lastLogin && (
        <div style={{ marginBottom: '16px' }}>
          <InfoCard icon={<FiClock size={13} color="#94a3b8" />} label="Last Login Before This Threat"
            value={new Date(loginAttempts.lastLogin).toLocaleString()} />
        </div>
      )}

      {/* ── Suspicious activity that caused the threat (related activity) ── */}
      <div style={s.sectionHead}>
        <FiAlertCircle size={13} />
        Suspicious / Related Activity (±30 min window)
        <span style={{ fontWeight: 400, color: '#475569', marginLeft: '4px' }}>
          {relatedActivity?.length || 0} events
        </span>
      </div>
      {(!relatedActivity || relatedActivity.length === 0) ? (
        <p style={{ color: '#475569', fontSize: '12px', marginBottom: '16px' }}>
          No correlated activity found in the ±30-minute window.
        </p>
      ) : (
        <div style={{ ...s.infoCard, padding: '8px 12px', marginBottom: '16px', maxHeight: '180px', overflowY: 'auto' }}>
          {relatedActivity.map((a, i) => (
            <div key={a.id || i} style={s.actRow}>
              <span style={{ marginTop: '1px' }}>{EVENT_ICONS[a.event_type] || <FiActivity size={12} color="#94a3b8" />}</span>
              <div style={{ flex: 1 }}>
                <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                  {a.event_type?.replace(/_/g, ' ').toUpperCase() || 'EVENT'}
                </span>
                {a.details && <span style={{ color: '#64748b', marginLeft: '8px' }}>{a.details}</span>}
              </div>
              <span style={{ color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>
                {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── File activity ── */}
      {fileActivity?.length > 0 && (
        <>
          <div style={s.sectionHead}>
            <FiFolder size={13} />
            File Activity Related to This Threat
            <span style={{ fontWeight: 400, color: '#475569', marginLeft: '4px' }}>
              {fileActivity.length} events
            </span>
          </div>
          <div style={{ ...s.infoCard, padding: '8px 12px', marginBottom: '16px', maxHeight: '140px', overflowY: 'auto' }}>
            {fileActivity.map((a, i) => (
              <div key={a.id || i} style={s.actRow}>
                <span style={{ marginTop: '1px' }}>{EVENT_ICONS[a.event_type] || <FiFolder size={12} />}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                    {a.event_type?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  {a.details && <span style={{ color: '#64748b', marginLeft: '8px' }}>{a.details}</span>}
                </div>
                <span style={{ color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>
                  {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Raw ML input features ── */}
      {threat.raw_input && Object.keys(threat.raw_input).length > 0 && (
        <>
          <div style={s.sectionHead}>
            <FiInfo size={13} />
            Raw ML Input Features (what triggered the LSTM)
          </div>
          <div style={{ ...s.infoCard, marginBottom: '8px' }}>
            <RawInputTable data={threat.raw_input} />
          </div>
        </>
      )}
    </>
  );
}

// ─── Small info card used inside the modal ───────────────────
function InfoCard({ icon, label, value, mono, children }) {
  return (
    <div style={s.infoCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', ...{ ...s.infoLabel } }}>
        {icon}
        {label}
      </div>
      {children
        ? <div style={{ marginTop: '4px' }}>{children}</div>
        : <div style={{ ...s.infoValue, fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? '12px' : '14px' }}>
            {value || '—'}
          </div>
      }
    </div>
  );
}
