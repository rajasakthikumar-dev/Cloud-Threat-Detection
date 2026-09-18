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
 * Each tab gets its own session to prevent cross-contamination.
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────
function App() {
  const [user, setUser]           = useState(null);
  const [socket, setSocket]       = useState(null);
  const [initializing, setInitializing] = useState(true);
  
  // CRITICAL FIX: Each tab gets a unique session ID
  // This prevents cross-tab session contamination
  const sessionIdRef = useRef(null);
  
  if (!sessionIdRef.current) {
    sessionIdRef.current = generateSessionId();
  }
  
  const sessionId = sessionIdRef.current;

  // CRITICAL FIX: Storage keys are now per-session
  const getUserKey = () => `user_${sessionId}`;
  const getTokenKey = () => `token_${sessionId}`;

  // Rehydrate auth state from localStorage on first load
  // FIXED: Use session-specific keys
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
    setInitializing(false);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // CRITICAL FIX: Listen for storage events from OTHER tabs
  // If another tab logs in/out, warn the user but don't auto-switch
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Only react to changes from OTHER tabs (e.key is set for external changes)
      if (!e.key) return;
      
      // Check if a different session was created (another tab logged in)
      if (e.key.startsWith('user_') && e.key !== getUserKey() && e.newValue) {
        try {
          const otherUser = JSON.parse(e.newValue);
          if (user && otherUser.email !== user.email) {
            toast.warning(
              `Another user (${otherUser.email}) logged in from a different tab. ` +
              `Your current session remains active.`,
              { autoClose: 8000 }
            );
          }
        } catch { /* ignore */ }
      }
      
      // If OUR session's data was removed (shouldn't happen, but handle it)
      if (e.key === getUserKey() && !e.newValue && user) {
        toast.error('Your session was cleared. Please log in again.');
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // CRITICAL FIX: Provide sessionId to context for API calls
  // Also expose it globally for axios interceptors
  useEffect(() => {
    window.__KIRO_SESSION_ID__ = sessionId;
    return () => {
      delete window.__KIRO_SESSION_ID__;
    };
  }, [sessionId]);

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout, sessionId }}>
      <SocketContext.Provider value={socket}>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login"      element={<Login />} />
            <Route path="/register"   element={<Register />} />
            {/* Restricted account landing — accessible while token is still valid */}
            <Route path="/restricted" element={<RestrictedPage />} />

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
