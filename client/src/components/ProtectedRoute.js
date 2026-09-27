import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { getMe } from '../services/api';

/**
 * ProtectedRoute
 * ---------------
 * Wraps <Outlet> with:
 *   1. Authentication check  — redirects to /login if not logged in
 *   2. Role check            — redirects to /dashboard if wrong role
 *   3. Restriction polling   — periodically calls GET /auth/me so that
 *      a restriction applied by admin is detected within ~30 seconds
 *      without requiring a page refresh.
 *
 * WHY 30-SECOND POLLING IS INTENTIONAL:
 * - If admin restricts a user's account, the user should be redirected to
 *   /restricted within 30 seconds, even if they're idle (no API calls).
 * - The api.js interceptor handles IMMEDIATE restriction detection on any
 *   API call that returns 403 ACCOUNT_RESTRICTED.
 * - This poll handles the case where user is idle (no requests being made).
 *
 * RATE LIMITING:
 * - GET /auth/me uses sessionLimiter (50 per 15 min) in server.js
 * - This is separate from authLimiter (20 per 15 min) used for login
 * - 30-second polling = ~30 requests per 15 min (well under 50 limit)
 * - Login/password operations remain protected by strict rate limiting
 *
 * Poll interval: 30 seconds
 * The poll is stopped when the component unmounts (page navigation / logout).
 */

const POLL_INTERVAL_MS = 30_000; // 30 seconds

function ProtectedRoute({ requiredRole }) {
  const { user, initializing } = useAuth();
  const navigate               = useNavigate();
  const pollRef                = useRef(null);

  useEffect(() => {
    // Only poll when there is a logged-in non-admin user
    if (!user || user.role === 'admin') return;

    const checkRestriction = async () => {
      try {
        const res = await getMe();
        const userData = res.data?.user;

        // Backend reports this user is currently restricted — redirect immediately
        if (userData && userData.restricted === true) {
          // Store info for RestrictedPage display
          try {
            sessionStorage.setItem(
              'restriction_info',
              JSON.stringify({
                message:           userData.restrictionSource === 'ml_auto'
                  ? 'Your account has been temporarily restricted because suspicious activity was detected by our security system.'
                  : 'Your account is temporarily restricted. Please contact an administrator.',
                restrictionReason: userData.restrictionReason || null,
                restrictionExpiry: userData.restrictionExpiry
                  ? new Date(userData.restrictionExpiry).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : null,
                restrictionSource: userData.restrictionSource || 'manual',
              })
            );
          } catch { /* ignore */ }

          navigate('/restricted', { replace: true });
        }
      } catch {
        // Any error (401, 403, network) is handled by the api.js interceptor.
      }
    };

    // Start periodic poll
    pollRef.current = setInterval(checkRestriction, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, navigate]);

  // Still reading localStorage — don't redirect yet
  if (initializing) return null;

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role → redirect to their own dashboard
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
