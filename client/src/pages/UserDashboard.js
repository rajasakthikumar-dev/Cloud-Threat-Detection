import React, { useEffect, useState } from 'react';
import { FiFolder, FiShield, FiCheckCircle, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import { useAuth } from '../App';
import { getUserStats } from '../services/api';

/**
 * UserDashboard - simplified user's personal overview with file and integrity stats
 */

export default function UserDashboard() {
  const { user, initializing }  = useAuth();
  const [stats,   setStats]   = useState({ 
    files: 0, 
    blockchainProtected: 0,
    integrityVerified: 0,
    integrityFailures: 0
  });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    // Wait for auth to initialize
    if (initializing) return;
    
    async function fetchData() {
      setError(null);
      try {
        const res = await getUserStats();
        const d = res.data;
        setStats({ 
          files: d.myFiles || 0, 
          blockchainProtected: d.blockchainProtected || 0,
          integrityVerified: d.integrityVerified || 0,
          integrityFailures: d.integrityFailures || 0
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard data.');
      } finally { 
        setLoading(false); 
      }
    }
    fetchData();
  }, [initializing]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem', animation: 'fadeInUp 0.35s ease' }}>
            <h1 style={{ 
              fontSize: 'var(--font-size-4xl)', 
              fontWeight: 800, 
              color: 'var(--text-primary)', 
              letterSpacing: '-0.02em', 
              marginBottom: '0.5rem' 
            }}>
              Welcome, {user?.name?.split(' ')[0] || 'User'} 👋
            </h1>
            <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Your personal security dashboard — manage your secure cloud files and verify their integrity.
            </p>
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}

          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <DashboardCard 
              title="My Files" 
              value={stats.files} 
              icon={<FiFolder />} 
              color="var(--info)" 
              subtitle="Stored in cloud" 
            />
            <DashboardCard 
              title="Blockchain Protected" 
              value={stats.blockchainProtected} 
              icon={<FiShield />} 
              color="var(--primary)" 
              subtitle="Tamper-proof files" 
            />
            <DashboardCard 
              title="Integrity Verified" 
              value={stats.integrityVerified} 
              icon={<FiCheckCircle />} 
              color="var(--success)" 
              subtitle="Successfully verified" 
            />
            <DashboardCard 
              title="Integrity Failures" 
              value={stats.integrityFailures} 
              icon={<FiAlertTriangle />} 
              color="var(--danger)" 
              subtitle="Hash mismatches detected" 
            />
          </div>

          {/* Quick actions */}
          <p style={{ 
            fontSize: 'var(--font-size-xs)', 
            fontWeight: 700, 
            color: 'var(--text-secondary)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em', 
            marginBottom: '1.25rem' 
          }}>
            Quick Actions
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

            <Link to="/files" style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.75rem 2rem',
                cursor: 'pointer',
                transition: 'var(--transition)',
                boxShadow: 'var(--shadow-md)'
              }}
                onMouseEnter={e => { 
                  e.currentTarget.style.transform = 'translateY(-3px)'; 
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; 
                }}
                onMouseLeave={e => { 
                  e.currentTarget.style.transform = 'none'; 
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'; 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ 
                    width: '52px', 
                    height: '52px', 
                    borderRadius: 'var(--radius-lg)', 
                    background: 'var(--info)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    boxShadow: 'var(--shadow-md)' 
                  }}>
                    <FiFolder size={26} color="white" />
                  </div>
                  <FiArrowRight size={22} color="var(--text-muted)" />
                </div>
                <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.625rem' }}>
                  My Files
                </h3>
                <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Upload, preview, download, and manage your private cloud documents securely.
                </p>
              </div>
            </Link>

          </div>
        </main>
      </div>
    </div>
  );
}
