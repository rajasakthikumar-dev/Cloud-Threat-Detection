import React, { useEffect, useState } from 'react';
import { FiUsers, FiFolder, FiClock, FiSearch, FiRefreshCw, FiShield, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import { getUserActivity } from '../services/api';
import { useAuth } from '../App';

/**
 * UserActivity - admin view of all user accounts with file storage metrics
 * FIXED: Removed useCallback infinite loop, added auth check, professional light theme
 */

export default function UserActivity() {
  const { initializing } = useAuth();
  const [users,    setUsers]    = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error,    setError]    = useState(null);

  // FIX: Removed useCallback - plain function prevents infinite loop
  const loadData = async () => {
    if (initializing) return;
    
    setError(null);
    setSpinning(true);
    try {
      const res = await getUserActivity();
      setUsers(res.data.userActivity || []);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to load user activity data.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  };

  useEffect(() => {
    if (!initializing) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing]);

  const totalUsers = users.length;
  const totalStoredFiles = users.reduce((acc, u) => acc + (u.filesStored || 0), 0);
  const activeUsersCount = users.filter(u => u.lastActivity).length;

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const rolePill = (role) => ({
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: role === 'admin' ? 'rgba(139, 92, 246, 0.15)' : 'var(--info-light)',
    color: role === 'admin' ? 'var(--purple)' : 'var(--info)',
  });

  const fileBadge = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    color: 'var(--info)',
    fontWeight: 600,
    fontSize: 'var(--font-size-base)',
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'No activity';
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return 'No activity';
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date).replace(',', '');
    } catch {
      return 'No activity';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(date);
    } catch {
      return '—';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              User Activity
            </h1>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
              Administrative oversight of user accounts, real storage metrics, and activity history
            </p>
          </div>

          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <DashboardCard
              title="Registered Users"
              value={totalUsers}
              icon={<FiUsers />}
              color="var(--info)"
              subtitle="Total accounts"
            />
            <DashboardCard
              title="Total User Files"
              value={totalStoredFiles}
              icon={<FiFolder />}
              color="var(--success)"
              subtitle="Files stored across all users"
            />
            <DashboardCard
              title="Active Accounts"
              value={activeUsersCount}
              icon={<FiClock />}
              color="var(--purple)"
              subtitle="With recorded activity"
            />
          </div>

          {/* User Activity Table Card */}
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
              background: 'var(--bg-secondary)',
              flexWrap: 'wrap'
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
                <input
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'inherit'
                  }}
                  placeholder="Search user by name, email, or role..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
                  background: 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-white)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onClick={loadData}
                disabled={spinning}
                title="Refresh table"
                onMouseEnter={e => !spinning && (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <FiRefreshCw size={16} style={spinning ? { animation: 'spin 1s linear infinite' } : {}} />
                Refresh
              </button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    {['User Name', 'Email', 'Role', 'Files Stored', 'Last Activity', 'Account Created'].map(h => (
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
                        Loading user activity records...
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
                        {search ? 'No users match your search criteria.' : 'No user activity recorded.'}
                      </td>
                    </tr>
                  ) : filtered.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.625rem',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          fontSize: 'var(--font-size-base)'
                        }}>
                          {u.role === 'admin' ? (
                            <FiShield size={16} color="var(--purple)" />
                          ) : (
                            <FiUser size={16} color="var(--text-muted)" />
                          )}
                          {u.name}
                        </span>
                      </td>
                      <td style={{
                        padding: '0.875rem 1rem',
                        fontFamily: 'monospace',
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--text-secondary)'
                      }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={rolePill(u.role)}>{u.role}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={fileBadge}>
                          <FiFolder size={14} />
                          {u.filesStored} file{u.filesStored !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td style={{
                        padding: '0.875rem 1rem',
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--text-secondary)'
                      }}>
                        {formatTimestamp(u.lastActivity)}
                      </td>
                      <td style={{
                        padding: '0.875rem 1rem',
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--text-secondary)'
                      }}>
                        {formatDate(u.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      
      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
