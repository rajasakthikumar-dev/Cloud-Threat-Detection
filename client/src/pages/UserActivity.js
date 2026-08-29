import React, { useEffect, useState, useCallback } from 'react';
import {
  FiUsers,
  FiFolder,
  FiClock,
  FiSearch,
  FiRefreshCw,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import { getUserActivity } from '../services/api';

const layout = {
  wrapper: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a' },
  body:    { display: 'flex', flex: 1 },
  main:    { flex: 1, padding: '28px', overflow: 'auto' },
  heading: { fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' },
  sub:     { fontSize: '13px', color: '#64748b', marginBottom: '24px' },
  cards:   { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' },
  card:    { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px',
             borderBottom: '1px solid #334155', flexWrap: 'wrap' },
  searchBar: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1,
               background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '13px' },
  refreshBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                background: '#0369a1', border: 'none', borderRadius: '8px',
                color: '#fff', fontSize: '13px', cursor: 'pointer' },
  th: { padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: '#0f172a' },
  td: { padding: '13px 16px', fontSize: '13px', color: '#94a3b8', borderTop: '1px solid #1e293b' },
  rolePill: (role) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
    background: role === 'admin' ? '#4c1d95' : '#0c4a6e',
    color: role === 'admin' ? '#c4b5fd' : '#7dd3fc',
  }),
  fileBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '3px 10px', borderRadius: '6px',
    background: '#0f172a', border: '1px solid #334155',
    color: '#38bdf8', fontWeight: 600, fontSize: '12px',
  },
};

export default function UserActivity() {
  const [users,    setUsers]    = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [spinning, setSpinning] = useState(false);

  const loadData = useCallback(async () => {
    setSpinning(true);
    try {
      const res = await getUserActivity();
      setUsers(res.data.userActivity || []);
    } catch (err) {
      toast.error('Failed to load user activity data.');
    } finally {
      setLoading(false);
      setSpinning(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalUsers = users.length;
  const totalStoredFiles = users.reduce((acc, u) => acc + (u.filesStored || 0), 0);
  const activeUsersCount = users.filter(u => u.lastActivity).length;

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={layout.wrapper}>
      <Navbar />
      <div style={layout.body}>
        <Sidebar />
        <main style={layout.main}>
          <h1 style={layout.heading}>User Activity</h1>
          <p style={layout.sub}>
            Administrative oversight of user accounts, real storage metrics, and activity history.
          </p>

          {/* KPI Cards */}
          <div style={layout.cards}>
            <DashboardCard
              title="Registered Users"
              value={totalUsers}
              icon={<FiUsers />}
              color="#38bdf8"
              subtitle="Total accounts"
            />
            <DashboardCard
              title="Total User Files"
              value={totalStoredFiles}
              icon={<FiFolder />}
              color="#22c55e"
              subtitle="Files stored across all users"
            />
            <DashboardCard
              title="Active Accounts"
              value={activeUsersCount}
              icon={<FiClock />}
              color="#a855f7"
              subtitle="With recorded activity"
            />
          </div>

          {/* User Activity Table Card */}
          <div style={layout.card}>
            {/* Toolbar */}
            <div style={layout.toolbar}>
              <div style={layout.searchBar}>
                <FiSearch size={14} color="#475569" />
                <input
                  style={layout.searchInput}
                  placeholder="Search user by name, email, or role…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                style={layout.refreshBtn}
                onClick={loadData}
                disabled={spinning}
                title="Refresh table"
              >
                <FiRefreshCw size={13} style={spinning ? { animation: 'spin 1s linear infinite' } : {}} />
                Refresh
              </button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['User Name', 'Email', 'Role', 'Files Stored', 'Last Activity', 'Account Created'].map(h => (
                      <th key={h} style={layout.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ ...layout.td, textAlign: 'center' }}>
                        Loading user activity records…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...layout.td, textAlign: 'center', color: '#475569' }}>
                        {search ? 'No users match your search criteria.' : 'No user activity recorded.'}
                      </td>
                    </tr>
                  ) : filtered.map(u => (
                    <tr key={u.id} style={{ transition: 'background 0.15s' }}>
                      <td style={layout.td}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f1f5f9', fontWeight: 500 }}>
                          {u.role === 'admin' ? <FiShield size={14} color="#a855f7" /> : <FiUser size={14} color="#64748b" />}
                          {u.name}
                        </span>
                      </td>
                      <td style={{ ...layout.td, fontFamily: 'monospace', fontSize: '12px' }}>
                        {u.email}
                      </td>
                      <td style={layout.td}>
                        <span style={layout.rolePill(u.role)}>{u.role}</span>
                      </td>
                      <td style={layout.td}>
                        <span style={layout.fileBadge}>
                          <FiFolder size={12} />
                          {u.filesStored} file{u.filesStored !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td style={layout.td}>
                        {u.lastActivity ? new Date(u.lastActivity).toLocaleString() : 'No activity'}
                      </td>
                      <td style={layout.td}>
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
