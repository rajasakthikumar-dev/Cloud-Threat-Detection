import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiShield, FiLock, FiArrowLeft, FiCheckCircle, FiAlertTriangle, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { resetPassword } from '../services/api';

/**
 * ResetPassword
 * --------------
 * Reads `?token=` from the URL — the raw token sent in the reset email.
 * Submits { token, newPassword } to POST /api/auth/reset-password.
 *
 * IMPORTANT: Password reset does NOT remove account restrictions.
 * If the account was restricted, it stays restricted after password change.
 * The user will see the Restricted Account page on their next login attempt
 * until the restriction expires or an admin releases it.
 *
 * Styling matches Login.js exactly.
 */
export default function ResetPassword() {
  const [searchParams]                = useSearchParams();
  const [form, setForm]               = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  const token = searchParams.get('token') || '';

  useEffect(() => {
    if (!token) setTokenMissing(true);
  }, [token]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const inputStyle = {
    width:        '100%',
    padding:      '0.875rem 3rem',         // room for left icon + right eye toggle
    background:   'var(--bg-primary)',
    border:       '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color:        'var(--text-primary)',
    fontSize:     'var(--font-size-base)',
    outline:      'none',
    boxSizing:    'border-box',
    fontFamily:   'inherit',
    transition:   'var(--transition)',
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!form.newPassword || !form.confirmPassword) {
      toast.error('Please fill in both fields.');
      return;
    }
    if (form.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, newPassword: form.newPassword });
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Password reset failed. The link may have expired.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Missing token state ──────────────────────────────────────
  if (tokenMissing) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
        padding: '1.5rem',
      }}>
        <div style={{
          width: '100%', maxWidth: '480px',
          background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)', padding: '3rem 2.75rem', boxShadow: 'var(--shadow-xl)',
          textAlign: 'center',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'var(--danger-light)', border: '2px solid rgba(239,68,68,0.3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem',
          }}>
            <FiAlertTriangle size={28} color="var(--danger)" />
          </div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Invalid Reset Link
          </h1>
          <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            This password reset link is missing or malformed. Please request a new one.
          </p>
          <Link to="/forgot-password" style={{
            display: 'inline-block', padding: '0.875rem 2rem',
            background: 'var(--primary)', borderRadius: 'var(--radius-md)',
            color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-base)', textDecoration: 'none',
          }}>
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%', maxWidth: '480px',
        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)', padding: '3rem 2.75rem', boxShadow: 'var(--shadow-xl)',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{
            width: '54px', height: '54px', borderRadius: 'var(--radius-lg)',
            background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(37,99,235,0.3)',
          }}>
            <FiShield size={28} color="#fff" />
          </div>
          <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Secure Cloud Storage
          </span>
        </div>

        {!success ? (
          /* ── Reset form ── */
          <>
            <h1 style={{ textAlign: 'center', fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              Reset Password
            </h1>
            <p style={{ textAlign: 'center', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginBottom: '2.25rem' }}>
              Enter your new password below.
            </p>

            <form onSubmit={handleSubmit}>
              {/* New password */}
              <label style={{ display: 'block', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                New Password
              </label>
              <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <FiLock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={inputStyle}
                  type={showNew ? 'text' : 'password'}
                  name="newPassword"
                  placeholder="Min. 6 characters"
                  value={form.newPassword}
                  onChange={handleChange}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e  => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  tabIndex={-1}
                >
                  {showNew ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>

              {/* Confirm password */}
              <label style={{ display: 'block', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative', marginBottom: '1.75rem' }}>
                <FiLock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={{
                    ...inputStyle,
                    borderColor: form.confirmPassword && form.confirmPassword !== form.newPassword ? 'var(--danger)' : undefined,
                  }}
                  type={showConfirm ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Repeat new password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e  => {
                    e.target.style.boxShadow = 'none';
                    e.target.style.borderColor = (form.confirmPassword && form.confirmPassword !== form.newPassword)
                      ? 'var(--danger)' : 'var(--border-color)';
                  }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  tabIndex={-1}
                >
                  {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              {/* Live mismatch hint */}
              {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                <p style={{ margin: '-1.25rem 0 1.25rem', fontSize: 'var(--font-size-sm)', color: 'var(--danger)' }}>
                  Passwords do not match
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '1rem',
                  background: loading ? 'rgba(37,99,235,0.5)' : 'var(--primary)',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-base)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                  transition: 'var(--transition)', boxShadow: loading ? 'none' : 'var(--shadow-md)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = loading ? 'none' : 'var(--shadow-md)'; }}
              >
                <FiLock size={18} />
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          </>
        ) : (
          /* ── Success state ── */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'var(--success-light)', border: '2px solid rgba(34,197,94,0.3)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1.25rem',
            }}>
              <FiCheckCircle size={28} color="var(--success)" />
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Password Reset!
            </h1>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              Your password has been updated successfully.
              You can now sign in with your new password.
            </p>
            <Link
              to="/login"
              style={{
                display: 'inline-block', padding: '0.875rem 2.5rem',
                background: 'var(--primary)', borderRadius: 'var(--radius-md)',
                color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-base)',
                textDecoration: 'none', boxShadow: 'var(--shadow-md)',
              }}
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Back link — only shown on the form, not after success */}
        {!success && (
          <p style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
            <Link
              to="/login"
              style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <FiArrowLeft size={16} />
              Back to Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
