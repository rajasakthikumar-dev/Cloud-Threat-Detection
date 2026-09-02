import React, { useEffect, useState } from 'react';
import { FiSearch, FiUsers, FiTrash2, FiEdit2, FiUser, FiShield } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { getAllUsers, deleteUser, updateUserRole } from '../services/api';
import { useAuth } from '../App';

/**
 * UserManagement - admin-only user list with role management
 * FIXED: Added auth initialization check, proper error handling, professional light theme
 */

export default function UserManagement() {
  const { initializing } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    // FIX: Wait for auth to initialize
    if (initializing) return;
    
    async function fetchUsers() {
      setError(null);
      try {
        const res = await getAllUsers();
        setUsers(res.data.users || []);
      } catch (err) {
        const errorMsg = err.response?.data?.message || 'Failed to load users.';
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [initializing]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove user "${name}"? This cannot be undone.`)) return;
    try {
      await deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(`User "${name}" removed.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const handleRoleToggle = async (id, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await updateUserRole(id, newRole);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      toast.success(`Role updated to "${newRole}".`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role.');
    }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const rolePill = (role) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.75rem',
    borderRadius: '999px',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: role === 'admin' ? 'rgba(139, 92, 246, 0.15)' : 'var(--info-light)',
    color: role === 'admin' ? 'var(--purple)' : 'var(--info)',
    border: `1px solid ${role === 'admin' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
  });

  const iconBtn = (color, onClick, title, Icon) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: 'var(--radius-md)',
        color,
        padding: '0.5rem 0.625rem',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        transition: 'var(--transition)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}18`; }}
    >
      <Icon size={16} />
    </button>
  );

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
                <FiUsers size={24} color="white" />
              </div>
              <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                User Management
              </h1>
            </div>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginLeft: '62px' }}>
              Manage registered users, roles, and access permissions
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
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {filtered.length} user{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    {['User', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
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
                        Loading users...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={5} style={{
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
                      <td colSpan={5} style={{
                        padding: '2rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--font-size-base)'
                      }}>
                        {search ? 'No users match your search.' : 'No users found.'}
                      </td>
                    </tr>
                  ) : filtered.map(u => (
                    <tr
                      key={u.id}
                      style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.625rem',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: 'var(--font-size-base)'
                        }}>
                          {u.role === 'admin' ? (
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-md)',
                              background: 'linear-gradient(135deg, var(--purple), var(--purple-2))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <FiShield size={16} color="white" />
                            </div>
                          ) : (
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--info-light)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <FiUser size={16} color="var(--info)" />
                            </div>
                          )}
                          {u.name}
                        </span>
                      </td>
                      <td style={{
                        padding: '0.875rem 1rem',
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace'
                      }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={rolePill(u.role)}>{u.role}</span>
                      </td>
                      <td style={{
                        padding: '0.875rem 1rem',
                        fontSize: 'var(--font-size-base)',
                        color: 'var(--text-secondary)'
                      }}>
                        {formatDate(u.createdAt)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{ display: 'flex', gap: '0.5rem' }}>
                          {iconBtn('var(--primary)', () => handleRoleToggle(u.id, u.role), `Switch to ${u.role === 'admin' ? 'user' : 'admin'}`, FiEdit2)}
                          {iconBtn('var(--danger)', () => handleDelete(u.id, u.name), 'Delete user', FiTrash2)}
                        </span>
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
