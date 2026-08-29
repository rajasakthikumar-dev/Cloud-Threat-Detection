import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

// Pages
import Login          from './pages/Login';
import Register       from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard  from './pages/UserDashboard';
import FileManagement from './pages/FileManagement';
import ThreatMonitoring from './pages/ThreatMonitoring';
import UserManagement from './pages/UserManagement';
import UserActivity   from './pages/UserActivity';
import ActivityLogs   from './pages/ActivityLogs';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// ─────────────────────────────────────────────
// AUTH CONTEXT
// Provides user state and auth helpers to the
// entire component tree without prop drilling.
// ─────────────────────────────────────────────
export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// ─────────────────────────────────────────────
// SOCKET CONTEXT
// Single Socket.io connection shared app-wide.
// ─────────────────────────────────────────────
export const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────
function App() {
  const [user, setUser]           = useState(null);
  const [socket, setSocket]       = useState(null);
  // initializing stays true until localStorage has been read.
  // ProtectedRoute must wait for this before deciding to redirect,
  // otherwise the very first render (user===null, before useEffect runs)
  // redirects every authenticated user to /login on page refresh.
  const [initializing, setInitializing] = useState(true);

  // Rehydrate auth state from localStorage on first load
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore corrupt data */ }
    }
    setInitializing(false);   // ← unblock ProtectedRoute now that we've checked
  }, []);

  // Open Socket.io connection once user is authenticated
  useEffect(() => {
    if (!user) {
      // Disconnect any existing socket on logout
      if (socket) { socket.disconnect(); setSocket(null); }
      return;
    }

    const token = localStorage.getItem('token');
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
    });

    // Real-time threat alert from server
    newSocket.on('threat_alert', (data) => {
      const level = data.risk_level?.toUpperCase() || 'UNKNOWN';
      const msg   = `⚠ Threat Detected: ${data.attack_type || 'Unknown'} — Risk: ${level} (${data.confidence_score}%)`;
      if (level === 'HIGH') {
        toast.error(msg, { autoClose: 10000 });
      } else if (level === 'MEDIUM') {
        toast.warning(msg);
      } else {
        toast.info(msg);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Auth helpers
  const login = (userData, token) => {
    localStorage.setItem('user',  JSON.stringify(userData));
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout }}>
      <SocketContext.Provider value={socket}>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Admin-only routes */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/admin"               element={<AdminDashboard />} />
              <Route path="/admin/users"         element={<UserManagement />} />
              <Route path="/admin/user-activity" element={<UserActivity />} />
              <Route path="/admin/logs"          element={<ActivityLogs />} />
              <Route path="/threats"             element={<ThreatMonitoring />} />
            </Route>

            {/* Authenticated user routes (admin + user) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard"        element={<UserDashboard />} />
              <Route path="/files"            element={<FileManagement />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;
