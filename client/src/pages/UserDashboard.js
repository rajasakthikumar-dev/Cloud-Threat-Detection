import React, { useEffect, useState } from 'react';
import { FiFolder, FiUpload, FiFile, FiActivity } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import DashboardCard from '../components/DashboardCard';
import { useAuth } from '../App';
import { getUserStats } from '../services/api';

const layout = {
  wrapper: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a' },
  body:    { display: 'flex', flex: 1 },
  main:    { flex: 1, padding: '28px', overflow: 'auto' },
  heading: { fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' },
  sub:     { fontSize: '13px', color: '#64748b', marginBottom: '24px' },
  cards:   { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' },
  section: { fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '12px',
             textTransform: 'uppercase', letterSpacing: '0.06em' },
  infoBox: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
    padding: '24px', marginBottom: '20px',
  },
  infoTitle: { fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px' },
  infoText:  { fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 },
};

export default function UserDashboard() {
  const { user }  = useAuth();
  const [stats, setStats] = useState({ files: 0, threats: 0, lastScan: '—' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await getUserStats();
        const d = res.data;
        // Backend returns: myFiles, myThreats, lastScan, status
        setStats({
          files:        d.myFiles   || 0,
          threats:      d.myThreats || 0,
          lastScan:     d.lastScan  || '—',
        });
      } catch (_) {}
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  return (
    <div style={layout.wrapper}>
      <Navbar />
      <div style={layout.body}>
        <Sidebar />
        <main style={layout.main}>
          <h1 style={layout.heading}>Welcome, {user?.name || 'User'}</h1>
          <p style={layout.sub}>Your personal dashboard — manage files and monitor activity.</p>

          <div style={layout.cards}>
            <DashboardCard
              title="My Files"
              value={stats.files}
              icon={<FiFolder />}
              color="#38bdf8"
              subtitle="Stored in cloud"
            />
            <DashboardCard
              title="Threats Detected"
              value={stats.threats}
              icon={<FiActivity />}
              color="#ef4444"
              subtitle="On your account"
            />
            <DashboardCard
              title="Last Scan"
              value={stats.lastScan}
              icon={<FiUpload />}
              color="#a855f7"
              subtitle="Most recent analysis"
            />
          </div>

          {/* Quick Actions Info */}
          <p style={layout.section}>Quick Actions</p>
          <div style={layout.infoBox}>
            <h3 style={layout.infoTitle}><FiFile style={{ marginRight: '8px', verticalAlign: 'middle' }} />File Management</h3>
            <p style={layout.infoText}>
              Upload, view, and manage your files. Navigate to <strong>My Files</strong> from the sidebar to access file management tools.
            </p>
          </div>

          <div style={layout.infoBox}>
            <h3 style={layout.infoTitle}><FiActivity style={{ marginRight: '8px', verticalAlign: 'middle' }} />Platform Features</h3>
            <p style={layout.infoText}>
              • <strong>My Files:</strong> Upload, preview, download, and manage your private cloud documents securely<br />
              • <strong>AI Threat Protection:</strong> Automated LSTM-powered threat detection actively monitors and safeguards your account
            </p>
          </div>

          {loading && (
            <p style={{ ...layout.sub, textAlign: 'center', marginTop: '40px' }}>Loading dashboard data…</p>
          )}
        </main>
      </div>
    </div>
  );
}
