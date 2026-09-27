import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
import RestrictedPage from './pages/RestrictedPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword  from './pages/ResetPassword';
import BlockchainIntegrity from './pages/BlockchainIntegrity';

// Components
import ProtectedRoute from './components/ProtectedRoute';

// ─────────────────────────────────────────────
// AUTH CONTEXT
// Provides user state and auth helpers to the
// entire component tree without prop drilling.
//
// CRITICAL FIX: Per-tab session management
// - Each tab gets a unique session ID
// - Sessions are isolated from each other
// - No cross-tab contamination
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

/**
 * Generate a unique session ID for this browser tab.
 * CRITICAL: Use sessionStorage to persist the ID across page refreshes within the same tab.
 * Each tab gets its own isolated session, but refreshing within a tab preserves the session.
 */
function getOrCreateSessionId() {
  let sessionId = sessionStorage.getItem('kiro_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('kiro_session_id', sessionId);
  }
  return sessionId;
}

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────
function App() {
  const [user, setUser]           = useState(null);
  const [socket, setSocket]       = useState(null);
  const [initializing, setInitializing] = useState(true);
  
  // CRITICAL FIX: Each tab gets a unique session ID that persists across refreshes
  // sessionStorage persists within a tab but not across tabs
  const sessionIdRef = useRef(null);
  
  if (!sessionIdRef.current) {
    sessionIdRef.current = getOrCreateSessionId();
  }
  
  const sessionId = sessionIdRef.current;

  // Storage keys are per-session to prevent cross-tab contamination
  const getUserKey = () => `user_${sessionId}`;
  const getTokenKey = () => `token_${sessionId}`;

  // Rehydrate auth state from localStorage on mount
  // This MUST complete before we set initializing=false
  useEffect(() => {
    const stored = localStorage.getItem(getUserKey());
    if (stored) {
      try { 
        const userData = JSON.parse(stored);
        setUser(userData); 
      } catch { 
        // Corrupt data - clear it
        localStorage.removeItem(getUserKey());
        localStorage.removeItem(getTokenKey());
      }
    }
    // Only mark initialization complete AFTER attempting restoration
    setInitializing(false);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // CRITICAL FIX: Listen for storage events from OTHER tabs
  // Warn user if another tab logs in with a different account
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Only react to changes from OTHER tabs
      if (!e.key || !e.key.startsWith('user_')) return;
      
      // Check if a different user logged in from another tab
      if (e.newValue && user) {
        try {
          const otherUser = JSON.parse(e.newValue);
          if (otherUser.email !== user.email) {
            toast.warning(
              `Another user (${otherUser.email}) logged in from a different tab.`,
              { autoClose: 5000 }
            );
          }
        } catch { /* ignore */ }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  // Open Socket.io connection once user is authenticated
  useEffect(() => {
    if (!user) {
      // Disconnect any existing socket on logout
      if (socket) { socket.disconnect(); setSocket(null); }
      return;
    }

    const token = localStorage.getItem(getTokenKey());
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
  }, [user, sessionId]);

  // CRITICAL FIX: Auth helpers now use session-specific keys
  const login = (userData, token) => {
    localStorage.setItem(getUserKey(),  JSON.stringify(userData));
    localStorage.setItem(getTokenKey(), token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem(getUserKey());
    localStorage.removeItem(getTokenKey());
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout, sessionId }}>
      <SocketContext.Provider value={socket}>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login"            element={<Login />} />
            <Route path="/register"         element={<Register />} />
            <Route path="/forgot-password"  element={<ForgotPassword />} />
            <Route path="/reset-password"   element={<ResetPassword />} />
            {/* Restricted account landing — accessible while token is still valid */}
            <Route path="/restricted"       element={<RestrictedPage />} />

            {/* Admin-only routes */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/admin"                      element={<AdminDashboard />} />
              <Route path="/admin/users"                element={<UserManagement />} />
              <Route path="/admin/user-activity"        element={<UserActivity />} />
              <Route path="/admin/logs"                 element={<ActivityLogs />} />
              <Route path="/threats"                    element={<ThreatMonitoring />} />
              <Route path="/admin/blockchain-integrity" element={<BlockchainIntegrity />} />
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
