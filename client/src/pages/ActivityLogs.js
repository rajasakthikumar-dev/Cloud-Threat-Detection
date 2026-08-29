import React, { useEffect, useState, useCallback } from 'react';
import { FiRefreshCw, FiSearch, FiFilter, FiDownload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { getActivityLogs } from '../services/api';

const layout = {
  wrapper: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a' },
  body:    { display: 'flex', flex: 1 },
  main:    { flex: 1, padding: '28px', overflow: 'auto' },
  heading: { fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' },
  sub:     { fontSize: '13px', color: '#64748b', marginBottom: '24px' },
  card:    { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px',
             borderBottom: '1px solid #334155', flexWrap: 'wrap' },
  searchBar: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1,
               background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '13px' },
  select: { padding: '8px 12px', background: '#0f172a', border: '1px solid #334155',
            borderRadius: '8px', color: '#94a3b8', fontSize: '13px', outline: 'none' },
  refreshBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                background: '#0369a1', border: 'none', borderRadius: '8px',
                color: '#fff', fontSize: '13px', cursor: 'pointer' },
  th: { padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: '#0f172a' },
  td: { padding: '11px 16px', fontSize: '13px', color: '#94a3b8', borderTop: '1px solid #1e293b' },
};

const EVENT_COLORS = {
  login:          { bg: '#0c4a6e', color: '#38bdf8' },
  logout:         { bg: '#1e293b', color: '#64748b' },
  file_upload:    { bg: '#14532d', color: '#4ade80' },
  file_download:  { bg: '#1e3a5f', color: '#60a5fa' },
  file_delete:    { bg: '#450a0a', color: '#f87171' },
  threat_detected:{ bg: '#450a0a', color: '#ef4444' },
  user_created:   { bg: '#2e1065', color: '#c084fc' },
  user_deleted:   { bg: '#450a0a', color: '#f87171' },
  role_changed:   { bg: '#1c1208', color: '#fbbf24' },
};

function EventBadge({ type }) {
  const cfg = EVENT_COLORS[type] || { bg: '#1e293b', color: '#94a3b8' };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '999px', fontSize: '11px',
      fontWeight: 600, background: cfg.bg, color: cfg.color,
    }}>
      {type?.replace(/_/g, ' ').toUpperCase() || 'EVENT'}
    </span>
  );
}

export default function ActivityLogs() {
  const [logs,    setLogs]    = useState([]);
  const [search,  setSearch]  = useState('');
  const [typeFilter, setType] = useState('All');
  const [loading, setLoading] = useState(true);
  const [spinning,setSpin]    = useState(false);

  const load = useCallback(async () => {
    setSpin(true);
    try {
      const res = await getActivityLogs();
      setLogs(res.data.logs || []);
    } catch { toast.error('Failed to load activity logs.'); }
    finally { setLoading(false); setSpin(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Export logs as JSON file
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `activity-logs-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const eventTypes = ['All', ...new Set(logs.map(l => l.event_type).filter(Boolean))];

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      l.event_type?.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || l.event_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div style={layout.wrapper}>
      <Navbar />
      <div style={layout.body}>
        <Sidebar />
        <main style={layout.main}>
          <h1 style={layout.heading}>Activity Logs</h1>
          <p style={layout.sub}>Complete audit trail stored in Firebase — all user and system events.</p>

          <div style={layout.card}>
            {/* Toolbar */}
            <div style={layout.toolbar}>
              <div style={layout.searchBar}>
                <FiSearch size={14} color="#475569" />
                <input style={layout.searchInput} placeholder="Search logs…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <FiFilter size={14} color="#475569" />
              <select style={layout.select} value={typeFilter} onChange={e => setType(e.target.value)}>
                {eventTypes.map(t => <option key={t}>{t}</option>)}
              </select>
              <button style={layout.refreshBtn} onClick={load} disabled={spinning}>
                <FiRefreshCw size={13} style={spinning ? { animation: 'spin 1s linear infinite' } : {}} />
                Refresh
              </button>
              <button style={{ ...layout.refreshBtn, background: '#064e3b' }} onClick={handleExport}>
                <FiDownload size={13} /> Export
              </button>
            </div>

            {/* Logs table */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Event','User','Details','IP Address','Timestamp'].map(h =>
                  <th key={h} style={layout.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ ...layout.td, textAlign: 'center' }}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...layout.td, textAlign: 'center', color: '#475569' }}>
                    No logs match your filters.
                  </td></tr>
                ) : filtered.slice(0, 100).map((l, i) => (
                  <tr key={i}>
                    <td style={layout.td}><EventBadge type={l.event_type} /></td>
                    <td style={{ ...layout.td, fontFamily: 'monospace', fontSize: '12px' }}>{l.user_email || '—'}</td>
                    <td style={layout.td}>{l.details || '—'}</td>
                    <td style={{ ...layout.td, fontFamily: 'monospace', fontSize: '12px' }}>{l.ip_address || '—'}</td>
                    <td style={layout.td}>{l.timestamp ? new Date(l.timestamp).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <p style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', borderTop: '1px solid #1e293b' }}>
                Showing first 100 of {filtered.length} records. Use filters to narrow results.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
