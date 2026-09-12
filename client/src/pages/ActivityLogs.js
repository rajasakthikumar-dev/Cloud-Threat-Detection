import React, { useEffect, useState } from 'react';
import { FiRefreshCw, FiSearch, FiFilter, FiDownload, FiActivity } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { getActivityLogs } from '../services/api';
import { useAuth } from '../App';

/* ── All logic identical to original — only UI/styles updated ── */

function EventBadge({ type }) {
  const EVENT_COLORS = {
    login:           { bg: 'var(--info-light)',    color: 'var(--info)' },
    logout:          { bg: 'var(--bg-secondary)',  color: 'var(--text-secondary)' },
    file_upload:     { bg: 'var(--success-light)', color: 'var(--success)' },
    file_download:   { bg: 'var(--info-light)',    color: 'var(--info)' },
    file_delete:     { bg: 'var(--danger-light)',  color: 'var(--danger)' },
    threat_detected: { bg: 'var(--danger-light)',  color: 'var(--danger)' },
    user_created:    { bg: 'var(--success-light)', color: 'var(--success)' },
    user_deleted:    { bg: 'var(--danger-light)',  color: 'var(--danger)' },
    role_changed:    { bg: 'var(--warning-light)', color: 'var(--warning)' },
  };
  
  const cfg = EVENT_COLORS[type] || { bg: 'var(--bg-secondary)', color: 'var(--text-muted)' };
  return (
    <span style={{ 
      padding: '0.375rem 0.75rem', 
      borderRadius: '999px', 
      fontSize: 'var(--font-size-xs)', 
      fontWeight: 700, 
      background: cfg.bg, 
      color: cfg.color, 
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      {type?.replace(/_/g, ' ') || 'EVENT'}
    </span>
  );
}

export default function ActivityLogs() {
  const { user, initializing } = useAuth();
  const [logs,      setLogs]    = useState([]);
  const [search,    setSearch]  = useState('');
  const [typeFilter, setType]   = useState('All');
  const [loading,   setLoading] = useState(true);
  const [spinning,  setSpin]    = useState(false);
  const [error,     setError]   = useState(null);

  // FIX: Remove useCallback - it causes infinite re-renders
  // because load is a dependency of useEffect, and useEffect
  // creates a new load reference on every render
  const load = async () => {
    // Wait for auth to initialize to prevent race conditions
    if (initializing) return;
    
    setError(null);
    setSpin(true);
    
    try {
      const res = await getActivityLogs();
      const fetchedLogs = res.data.logs || [];
      setLogs(fetchedLogs);
      
      // Distinguish between SUCCESS + EMPTY vs REQUEST FAILURE
      if (fetchedLogs.length === 0 && !error) {
        // Success but no data - don't show error toast
        setError(null);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to load activity logs.';
      setError(errorMsg);
      // Only show toast once per error
      toast.error(errorMsg);
    } finally { 
      setLoading(false); 
      setSpin(false); 
    }
  };

  // FIX: Only run once on mount after auth is ready
  useEffect(() => {
    if (!initializing) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing]); // Only re-run when initializing changes

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      // Handle Firestore timestamp, ISO string, or JS Date
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(date.getTime())) return '—';
      
      // Format as: 01 Sep 2026, 09:45 PM
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

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type:'application/json' });
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

  const EVENT_COLORS = {
    login:           { bg: 'var(--info-light)',    color: 'var(--info)' },
    logout:          { bg: 'var(--bg-secondary)',  color: 'var(--text-secondary)' },
    file_upload:     { bg: 'var(--success-light)', color: 'var(--success)' },
    file_download:   { bg: 'var(--info-light)',    color: 'var(--info)' },
    file_delete:     { bg: 'var(--danger-light)',  color: 'var(--danger)' },
    threat_detected: { bg: 'var(--danger-light)',  color: 'var(--danger)' },
    user_created:    { bg: 'var(--success-light)', color: 'var(--success)' },
    user_deleted:    { bg: 'var(--danger-light)',  color: 'var(--danger)' },
    role_changed:    { bg: 'var(--warning-light)', color: 'var(--warning)' },
  };

  const inputStyle = { 
    flex: 1, 
    background: 'none', 
    border: 'none', 
    outline: 'none', 
    color: 'var(--text-primary)', 
    fontSize: 'var(--font-size-base)', 
    fontFamily: 'inherit' 
  };
  
  const selectStyle = { 
    padding: '0.625rem 0.875rem', 
    background: 'var(--bg-primary)', 
    border: '1px solid var(--border-color)', 
    borderRadius: 'var(--radius-md)', 
    color: 'var(--text-primary)', 
    fontSize: 'var(--font-size-base)', 
    outline: 'none', 
    fontFamily: 'inherit',
    cursor: 'pointer'
  };
  
  const btnStyle = (bgColor) => ({ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '0.5rem', 
    padding: '0.625rem 1rem', 
    background: bgColor, 
    border: 'none', 
    borderRadius: 'var(--radius-md)', 
    color: 'var(--text-white)', 
    fontSize: 'var(--font-size-base)', 
    fontWeight: 600, 
    cursor: 'pointer', 
    transition: 'var(--transition)',
    boxShadow: 'var(--shadow-sm)'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
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
                <FiActivity size={24} color="white" />
              </div>
              <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Activity Logs
              </h1>
            </div>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginLeft: '60px' }}>
              Complete audit trail — all user and system events from Firebase
            </p>
          </div>

          {/* Card container */}
          <div style={{ 
            background: 'var(--bg-primary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: 'var(--radius-lg)', 
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)'
          }}>
            {/* Toolbar */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              padding: '1.25rem 1.5rem', 
              borderBottom: '1px solid var(--border-color)', 
              flexWrap: 'wrap', 
              background: 'var(--bg-secondary)' 
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem', 
                flex: 1, 
                background: 'var(--bg-primary)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)', 
                padding: '0.625rem 1rem', 
                minWidth: '250px' 
              }}>
                <FiSearch size={18} color="var(--text-muted)" />
                <input style={inputStyle} placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              
              <FiFilter size={18} color="var(--text-secondary)" />
              <select style={selectStyle} value={typeFilter} onChange={e => setType(e.target.value)}>
                {eventTypes.map(t => <option key={t}>{t}</option>)}
              </select>
              
              <button 
                style={btnStyle('var(--primary)')} 
                onClick={load} 
                disabled={spinning}
                onMouseEnter={e => !spinning && (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <FiRefreshCw size={16} style={spinning ? { animation: 'spin 1s linear infinite' } : {}} />
                Refresh
              </button>
              
              <button 
                style={btnStyle('var(--success)')} 
                onClick={handleExport}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <FiDownload size={16} />
                Export
              </button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    {['Event', 'User', 'Details', 'Device Info', 'IP Address', 'Timestamp'].map(h => (
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
                      <td colSpan={6} style={{ 
                        padding: '2rem', 
                        textAlign: 'center', 
                        color: 'var(--text-secondary)', 
                        fontSize: 'var(--font-size-base)' 
                      }}>
                        Loading activity logs...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} style={{ 
                        padding: '2rem', 
                        textAlign: 'center', 
                        color: 'var(--danger)', 
                        fontSize: 'var(--font-size-base)' 
                      }}>
                        {error}
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ 
                        padding: '2rem', 
                        textAlign: 'center', 
                        color: 'var(--text-muted)', 
                        fontSize: 'var(--font-size-base)' 
                      }}>
                        {logs.length === 0 ? 'No activity logs found.' : 'No logs match your filters.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(0, 100).map((l, i) => (
                      <tr 
                        key={i} 
                        style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <EventBadge type={l.event_type} />
                        </td>
                        <td style={{ 
                          padding: '0.875rem 1rem', 
                          fontSize: 'var(--font-size-base)', 
                          color: 'var(--text-primary)', 
                          fontFamily: 'monospace' 
                        }}>
                          {l.user_email || '—'}
                        </td>
                        <td style={{ 
                          padding: '0.875rem 1rem', 
                          fontSize: 'var(--font-size-base)', 
                          color: 'var(--text-secondary)' 
                        }}>
                          {l.details || '—'}
                        </td>
                        <td style={{ 
                          padding: '0.875rem 1rem', 
                          fontSize: 'var(--font-size-sm)', 
                          color: 'var(--text-primary)' 
                        }}>
                          {l.device || l.os || l.browser ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {l.device && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ 
                                    display: 'inline-block', 
                                    width: '6px', 
                                    height: '6px', 
                                    borderRadius: '50%', 
                                    background: 'var(--info)' 
                                  }}></span>
                                  <span style={{ fontWeight: 600 }}>{l.device}</span>
                                </div>
                              )}
                              {l.os && (
                                <div style={{ paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                                  {l.os}
                                </div>
                              )}
                              {l.browser && (
                                <div style={{ paddingLeft: '1rem', color: 'var(--text-secondary)' }}>
                                  {l.browser}
                                </div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ 
                          padding: '0.875rem 1rem', 
                          fontSize: 'var(--font-size-base)', 
                          color: 'var(--text-muted)', 
                          fontFamily: 'monospace' 
                        }}>
                          {l.ip_address || '—'}
                        </td>
                        <td style={{ 
                          padding: '0.875rem 1rem', 
                          fontSize: 'var(--font-size-base)', 
                          color: 'var(--text-secondary)' 
                        }}>
                          {formatTimestamp(l.timestamp)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {filtered.length > 100 && (
              <p style={{ 
                padding: '1rem 1.5rem', 
                fontSize: 'var(--font-size-sm)', 
                color: 'var(--text-muted)', 
                borderTop: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)'
              }}>
                Showing first 100 of {filtered.length} records. Use filters to narrow results.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
