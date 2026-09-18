import React, { useEffect, useState } from 'react';
import { FiUsers, FiFolder, FiClock, FiSearch, FiRefreshCw, FiShield, FiUser, FiMonitor, FiAlertCircle, FiX, FiCheckCircle, FiXCircle, FiLogOut } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import { getUserActivity } from '../services/api';
import { useAuth } from '../App';

/**
 * UserActivity - admin view of all user accounts with file storage metrics
 * MODULE 2: Added login behavior, device info, and risk history
 * UI IMPROVEMENT: Login history grouped by date (mobile call-history style) + clickable user detail modal
 */

export default function UserActivity() {
  const { initializing } = useAuth();
  const [users,    setUsers]    = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error,    setError]    = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

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

  // Group login history by date (call-history style)
  const groupLoginHistoryByDate = (loginHistory) => {
    if (!loginHistory || loginHistory.length === 0) return {};
    
    const grouped = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    loginHistory.forEach(event => {
      if (!event.timestamp) return;
      
      const eventDate = new Date(event.timestamp);
      const eventDateOnly = new Date(eventDate);
      eventDateOnly.setHours(0, 0, 0, 0);
      
      let dateKey;
      if (eventDateOnly.getTime() === today.getTime()) {
        dateKey = 'TODAY';
      } else {
        dateKey = new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }).format(eventDate);
      }
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    return grouped;
  };

  // Get event icon and color
  const getEventStyle = (eventType) => {
    switch (eventType) {
      case 'login':
        return { icon: <FiCheckCircle size={14} />, color: 'var(--success)', label: 'Login' };
      case 'login_failed':
        return { icon: <FiXCircle size={14} />, color: 'var(--danger)', label: 'Login Failed' };
      case 'logout':
        return { icon: <FiLogOut size={14} />, color: 'var(--text-muted)', label: 'Logout' };
      default:
        return { icon: <FiClock size={14} />, color: 'var(--text-secondary)', label: eventType };
    }
  };

  // Format time only
  const formatTime = (timestamp) => {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
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
                    {['User Name', 'Email', 'Role', 'Recent Login Activity', 'Files', 'Last Activity'].map(h => (
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
                  ) : filtered.map(u => {
                    const groupedHistory = groupLoginHistoryByDate(u.loginHistory || []);
                    const dateKeys = Object.keys(groupedHistory);
                    const mostRecentDate = dateKeys[0];
                    const recentEvents = mostRecentDate ? groupedHistory[mostRecentDate].slice(0, 3) : [];
                    
                    return (
                      <tr 
                        key={u.id} 
                        style={{ 
                          borderBottom: '1px solid var(--border-color)', 
                          transition: 'var(--transition)',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => setSelectedUser(u)}
                        title="Click to view full details"
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
                        {/* Compact Login History Preview */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          {recentEvents.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {mostRecentDate === 'TODAY' && (
                                <span style={{ 
                                  fontSize: 'var(--font-size-xs)', 
                                  fontWeight: 600, 
                                  color: 'var(--text-primary)',
                                  marginBottom: '0.125rem'
                                }}>
                                  TODAY
                                </span>
                              )}
                              {recentEvents.map((event, idx) => {
                                const style = getEventStyle(event.event_type);
                                return (
                                  <div key={idx} style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.5rem',
                                    fontSize: 'var(--font-size-sm)'
                                  }}>
                                    <span style={{ color: style.color, display: 'flex', alignItems: 'center' }}>
                                      {style.icon}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                      {style.label}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                                      {formatTime(event.timestamp)}
                                    </span>
                                  </div>
                                );
                              })}
                              {(u.loginHistory?.length || 0) > 3 && (
                                <span style={{ 
                                  fontSize: 'var(--font-size-xs)', 
                                  color: 'var(--info)', 
                                  fontStyle: 'italic',
                                  marginTop: '0.125rem'
                                }}>
                                  +{(u.loginHistory?.length || 0) - 3} more events
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                              No login history
                            </span>
                          )}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setSelectedUser(null)}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: 'var(--shadow-lg)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.5rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div>
                <h2 style={{ 
                  fontSize: 'var(--font-size-xl)', 
                  fontWeight: 700, 
                  color: 'var(--text-primary)',
                  marginBottom: '0.25rem'
                }}>
                  {selectedUser.name}
                </h2>
                <p style={{ 
                  fontSize: 'var(--font-size-sm)', 
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace'
                }}>
                  {selectedUser.email}
                </p>
              </div>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-md)',
                  transition: 'var(--transition)'
                }}
                onClick={() => setSelectedUser(null)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              {/* User Info Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                <div style={{
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Role
                  </p>
                  <span style={rolePill(selectedUser.role)}>{selectedUser.role}</span>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Files Stored
                  </p>
                  <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--info)' }}>
                    {selectedUser.filesStored}
                  </p>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Joined
                  </p>
                  <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatDate(selectedUser.createdAt)}
                  </p>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Last Activity
                  </p>
                  <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatTimestamp(selectedUser.lastActivity)}
                  </p>
                </div>
              </div>

              {/* Device Info Section */}
              {(selectedUser.device && selectedUser.device !== '—') && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ 
                    fontSize: 'var(--font-size-lg)', 
                    fontWeight: 700, 
                    color: 'var(--text-primary)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <FiMonitor size={20} />
                    Device Information
                  </h3>
                  <div style={{
                    padding: '1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Device:</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                          {selectedUser.device}
                        </span>
                      </div>
                      {selectedUser.os && selectedUser.os !== '—' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>OS:</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                            {selectedUser.os}
                          </span>
                        </div>
                      )}
                      {selectedUser.browser && selectedUser.browser !== '—' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Browser:</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                            {selectedUser.browser}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Login History Section - Grouped by Date */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ 
                  fontSize: 'var(--font-size-lg)', 
                  fontWeight: 700, 
                  color: 'var(--text-primary)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <FiClock size={20} />
                  Complete Login History
                </h3>
                
                {selectedUser.loginHistory && selectedUser.loginHistory.length > 0 ? (
                  (() => {
                    const groupedHistory = groupLoginHistoryByDate(selectedUser.loginHistory);
                    const dateKeys = Object.keys(groupedHistory);
                    
                    return dateKeys.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {dateKeys.map(dateKey => (
                          <div key={dateKey}>
                            {/* Date Header */}
                            <div style={{
                              padding: '0.5rem 0.75rem',
                              background: dateKey === 'TODAY' ? 'var(--info-light)' : 'var(--bg-secondary)',
                              borderRadius: 'var(--radius-md)',
                              marginBottom: '0.75rem',
                              border: dateKey === 'TODAY' ? '1px solid var(--info)' : '1px solid var(--border-color)'
                            }}>
                              <p style={{ 
                                fontSize: 'var(--font-size-sm)', 
                                fontWeight: 700, 
                                color: dateKey === 'TODAY' ? 'var(--info)' : 'var(--text-primary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                {dateKey === 'TODAY' ? 'TODAY — ' + new Intl.DateTimeFormat('en-GB', {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric'
                                }).format(new Date()) : dateKey}
                              </p>
                            </div>
                            
                            {/* Events for this date */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem' }}>
                              {groupedHistory[dateKey].map((event, idx) => {
                                const style = getEventStyle(event.event_type);
                                return (
                                  <div 
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '0.75rem',
                                      padding: '0.75rem 1rem',
                                      background: 'var(--bg-secondary)',
                                      borderRadius: 'var(--radius-md)',
                                      border: '1px solid var(--border-color)',
                                      transition: 'var(--transition)'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = style.color; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                                  >
                                    <span style={{ color: style.color, display: 'flex', paddingTop: '0.125rem' }}>
                                      {style.icon}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                      <p style={{ 
                                        fontSize: 'var(--font-size-base)', 
                                        fontWeight: 600, 
                                        color: style.color,
                                        marginBottom: '0.25rem'
                                      }}>
                                        {style.label}
                                      </p>
                                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                        {formatTime(event.timestamp)}
                                      </p>
                                      {event.ip_address && event.ip_address !== '—' && (
                                        <p style={{ 
                                          fontSize: 'var(--font-size-xs)', 
                                          color: 'var(--text-muted)', 
                                          fontFamily: 'monospace',
                                          marginTop: '0.25rem'
                                        }}>
                                          IP: {event.ip_address}
                                        </p>
                                      )}
                                      {event.device && event.device !== '—' && (
                                        <p style={{ 
                                          fontSize: 'var(--font-size-xs)', 
                                          color: 'var(--text-muted)',
                                          marginTop: '0.125rem'
                                        }}>
                                          {event.device} • {event.os || '—'} • {event.browser || '—'}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-base)' }}>
                        No login history available
                      </p>
                    );
                  })()
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-base)' }}>
                    No login history recorded
                  </p>
                )}
              </div>

              {/* Risk History Section */}
              {selectedUser.riskHistory && selectedUser.riskHistory.length > 0 && (
                <div>
                  <h3 style={{ 
                    fontSize: 'var(--font-size-lg)', 
                    fontWeight: 700, 
                    color: 'var(--text-primary)',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <FiAlertCircle size={20} />
                    Threat Detection History
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedUser.riskHistory.map((risk, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: '1rem',
                          background: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <p style={{ 
                            fontSize: 'var(--font-size-base)', 
                            fontWeight: 600, 
                            color: risk.risk_level === 'High' ? 'var(--danger)' : 
                                   risk.risk_level === 'Medium' ? 'var(--warning)' : 'var(--success)',
                            marginBottom: '0.25rem'
                          }}>
                            {risk.risk_level} Risk — {risk.attack_type}
                          </p>
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                            {risk.timestamp ? formatTimestamp(risk.timestamp) : 'No timestamp'}
                          </p>
                        </div>
                        <div style={{
                          padding: '0.375rem 0.75rem',
                          background: 'var(--bg-primary)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)'
                        }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {risk.confidence_score}% confidence
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
