import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiShield, FiMail, FiArrowLeft, FiSend } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { forgotPassword } from '../services/api';

/**
 * ForgotPassword
 * ---------------
 * Completely separate from the Restricted Account flow.
 * A restricted user who lands here is doing password recovery,
 * not bypassing their restriction — the restriction stays intact.
 *
 * Styling matches Login.js exactly (same CSS vars, same card layout).
 */
export default function ForgotPassword() {
  const [email,     setEmail]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const inputStyle = {
    width:        '100%',
    padding:      '0.875rem 1rem 0.875rem 3rem',
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
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword({ email: email.trim() });
      setSubmitted(true);
    } catch {
      // Even on network/server error show the success state —
      // prevents leaking whether the email exists
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:       '100vh',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      background:      'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
      padding:         '1.5rem',
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     '480px',
        background:   'var(--bg-primary)',
        border:       '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        padding:      '3rem 2.75rem',
        boxShadow:    'var(--shadow-xl)',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{
            width: '54px', height: '54px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(37,99,235,0.3)',
          }}>
            <FiShield size={28} color="#fff" />
          </div>
          <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Secure Cloud Storage
          </span>
        </div>

        {!submitted ? (
          /* ── Request form ── */
          <>
            <h1 style={{ textAlign: 'center', fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              Forgot Password
            </h1>
            <p style={{ textAlign: 'center', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginBottom: '2.25rem', lineHeight: 1.6 }}>
              Enter your registered email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Email Address
              </label>
              <div style={{ position: 'relative', marginBottom: '1.75rem' }}>
                <FiMail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e  => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width:           '100%',
                  padding:         '1rem',
                  background:      loading ? 'rgba(37,99,235,0.5)' : 'var(--primary)',
                  border:          'none',
                  borderRadius:    'var(--radius-md)',
                  color:           '#fff',
                  fontWeight:      700,
                  fontSize:        'var(--font-size-base)',
                  cursor:          loading ? 'not-allowed' : 'pointer',
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  gap:             '0.625rem',
                  transition:      'var(--transition)',
                  boxShadow:       loading ? 'none' : 'var(--shadow-md)',
                  fontFamily:      'inherit',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = loading ? 'none' : 'var(--shadow-md)'; }}
              >
                <FiSend size={18} />
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          /* ── Success state ── */
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--success-light)',
                border: '2px solid rgba(34,197,94,0.3)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <FiSend size={28} color="var(--success)" />
              </div>
              <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Check your inbox
              </h1>
              <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                If an account with <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> exists,
                a password reset link has been sent.
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                The link expires in <strong>15 minutes</strong>. Check your spam folder if you don't see it.
              </p>
            </div>
          </>
        )}

        {/* Back to login */}
        <p style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
          <Link
            to="/login"
            style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <FiArrowLeft size={16} />
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
