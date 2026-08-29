import React, { useEffect, useState } from 'react';
import { FiUserPlus, FiTrash2, FiEdit2, FiSearch, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { getAllUsers, deleteUser, updateUserRole } from '../services/api';

const layout = {
  wrapper: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a' },
  body:    { display: 'flex', flex: 1 },
  main:    { flex: 1, padding: '28px', overflow: 'auto' },
  heading: { fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' },
  sub:     { fontSize: '13px', color: '#64748b', marginBottom: '24px' },
  card:    { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' },
  toolbar: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px',
             borderBottom: '1px solid #334155', flexWrap: 'wrap' },
  searchBar:{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1,
              background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px' },
  searchInput:{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '13px' },
  th: { padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: '#0f172a' },
  td: { padding: '12px 16px', fontSize: '13px', color: '#94a3b8', borderTop: '1px solid #1e293b' },
  rolePill: (role) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
    background: role === 'admin' ? '#4c1d95' : '#0c4a6e',
    color: role === 'admin' ? '#c4b5fd' : '#7dd3fc',
  }),
  actionBtn: (color) => ({
    background: 'none', border: 'none', cursor: 'pointer', color,
    padding: '4px', display: 'inline-flex', borderRadius: '4px',
  }),
};

export default function UserManagement() {
  const [users,   setUsers]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [editId,  setEditId]  = useState(null);

  useEffect(() => {
    getAllUsers()
      .then(res => setUsers(res.data.users || []))
      .catch(() => toast.error('Failed to load users.'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove user "${name}"?`)) return;
    try {
      await deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(`User "${name}" removed.`);
    } catch { toast.error('Failed to delete user.'); }
  };

  const handleRoleToggle = async (id, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await updateUserRole(id, newRole);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      toast.success(`Role updated to "${newRole}".`);
    } catch { toast.error('Failed to update role.'); }
    setEditId(null);
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={layout.wrapper}>
      <Navbar />
      <div style={layout.body}>
        <Sidebar />
        <main style={layout.main}>
          <h1 style={layout.heading}>User Management</h1>
          <p style={layout.sub}>Manage registered users, roles, and access permissions.</p>

          <div style={layout.card}>
            {/* Toolbar */}
            <div style={layout.toolbar}>
              <div style={layout.searchBar}>
                <FiSearch size={14} color="#475569" />
                <input style={layout.searchInput} placeholder="Search by name or email…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <span style={{ fontSize: '13px', color: '#475569' }}>
                {filtered.length} user{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['User', 'Email', 'Role', 'Joined', 'Actions'].map(h =>
                  <th key={h} style={layout.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ ...layout.td, textAlign: 'center' }}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...layout.td, textAlign: 'center', color: '#475569' }}>No users found.</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id}>
                    <td style={layout.td}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiUser size={14} color="#64748b" />
                        {u.name}
                      </span>
                    </td>
                    <td style={{ ...layout.td, fontFamily: 'monospace', fontSize: '12px' }}>{u.email}</td>
                    <td style={layout.td}>
                      <span style={layout.rolePill(u.role)}>{u.role}</span>
                    </td>
                    <td style={layout.td}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    <td style={layout.td}>
                      <span style={{ display: 'flex', gap: '8px' }}>
                        <button style={layout.actionBtn('#38bdf8')}
                          onClick={() => handleRoleToggle(u.id, u.role)}
                          title={`Switch to ${u.role === 'admin' ? 'user' : 'admin'}`}>
                          <FiEdit2 size={14} />
                        </button>
                        <button style={layout.actionBtn('#ef4444')}
                          onClick={() => handleDelete(u.id, u.name)} title="Delete">
                          <FiTrash2 size={14} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
