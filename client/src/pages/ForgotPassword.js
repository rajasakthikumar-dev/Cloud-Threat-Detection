import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShield, FiMail, FiArrowLeft, FiSend, FiLock, FiCheckCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { forgotPassword, resetPassword } from '../services/api';

/**
 * ForgotPassword - OTP-Based Password Reset
 * -------------------------------------------
 * Three-step flow:
 * 1. Enter email → backend sends OTP
 * 2. Enter 6-digit OTP + new password → backend validates and resets
 * 3. Success → redirect to login
 *
 * SECURITY:
 * - OTP expires in 5 minutes
 * - Max 5 attempts per OTP
 * - OTP is hashed before storage
 * - Generic messages prevent email enumeration
 * - Restricted accounts remain restricted after password reset
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  
  // Step 1: Email submission
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1); // 1=email, 2=otp+password, 3=success
  
  // Step 2: OTP and password
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(false);

  const inputStyle = {
    width: '100%',
    padding: '0.875rem 1rem 0.875rem 3rem',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-base)',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'var(--transition)',
  };

  // ── STEP 1: Request OTP ─────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    
    setLoading(true);
    try {
      await forgotPassword({ email: email.trim() });
      // Always show success to prevent email enumeration
      setStep(2);
      toast.success('Verification code sent! Check your email.');
    } catch (err) {
      // Even on error, proceed to step 2 to prevent email enumeration
      setStep(2);
      toast.info('If an account exists, a verification code has been sent.');
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2: Verify OTP and Reset Password ───────────────
  const handlePasswordReset = async (e) => {
    e.preventDefault();

    // Validation
    if (!otp.trim()) {
      toast.error('Please enter the verification code.');
      return;
    }
    if (otp.trim().length !== 6 || !/^\d{6}$/.test(otp.trim())) {
      toast.error('Verification code must be exactly 6 digits.');
      return;
    }
    if (!newPassword || !confirmPassword) {
      toast.error('Please enter and confirm your new password.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      setStep(3);
      toast.success('Password reset successful!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Password reset failed. The code may have expired or been used.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────
  const handleResend = async () => {
    setLoading(true);
    try {
      await forgotPassword({ email: email.trim() });
      toast.success('New verification code sent!');
      setOtp(''); // Clear the old OTP input
    } catch {
      toast.info('If an account exists, a new code has been sent.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        padding: '3rem 2.75rem',
        boxShadow: 'var(--shadow-xl)',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(37,99,235,0.3)',
          }}>
            <FiShield size={28} color="#fff" />
          </div>
          <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Secure Cloud Storage
          </span>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* STEP 1: Email Submission                           */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 1 && (
          <>
            <h1 style={{ textAlign: 'center', fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              Forgot Password
            </h1>
            <p style={{ textAlign: 'center', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginBottom: '2.25rem', lineHeight: 1.6 }}>
              Enter your registered email to receive a verification code.
            </p>

            <form onSubmit={handleEmailSubmit}>
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
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: loading ? 'rgba(37,99,235,0.5)' : 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-base)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.625rem',
                  transition: 'var(--transition)',
                  boxShadow: loading ? 'none' : 'var(--shadow-md)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = loading ? 'none' : 'var(--shadow-md)'; }}
              >
                <FiSend size={18} />
                {loading ? 'Sending…' : 'Send Verification Code'}
              </button>
            </form>
          </>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* STEP 2: OTP + New Password                         */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 2 && (
          <>
            <h1 style={{ textAlign: 'center', fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
              Enter Verification Code
            </h1>
            <p style={{ textAlign: 'center', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginBottom: '2.25rem', lineHeight: 1.6 }}>
              A 6-digit code has been sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
            </p>

            <form onSubmit={handlePasswordReset}>
              {/* OTP Input */}
              <label style={{ display: 'block', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Verification Code
              </label>
              <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <FiMail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={{
                    ...inputStyle,
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 600,
                    letterSpacing: '0.3em',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                  }}
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  maxLength={6}
                  autoComplete="off"
                  disabled={loading}
                />
              </div>

              {/* Resend Link */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Didn't receive the code? Resend
                </button>
              </div>

              {/* New Password */}
              <label style={{ display: 'block', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                New Password
              </label>
              <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <FiLock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={inputStyle}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none'; }}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  tabIndex={-1}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>

              {/* Confirm Password */}
              <label style={{ display: 'block', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative', marginBottom: '1.75rem' }}>
                <FiLock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  style={{
                    ...inputStyle,
                    borderColor: confirmPassword && confirmPassword !== newPassword ? 'var(--danger)' : undefined,
                  }}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = 'none';
                    e.target.style.borderColor = (confirmPassword && confirmPassword !== newPassword) ? 'var(--danger)' : 'var(--border-color)';
                  }}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  tabIndex={-1}
                >
                  {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>

              {/* Mismatch Warning */}
              {confirmPassword && confirmPassword !== newPassword && (
                <p style={{ margin: '-1.25rem 0 1.25rem', fontSize: 'var(--font-size-sm)', color: 'var(--danger)' }}>
                  Passwords do not match
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: loading ? 'rgba(37,99,235,0.5)' : 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 'var(--font-size-base)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.625rem',
                  transition: 'var(--transition)',
                  boxShadow: loading ? 'none' : 'var(--shadow-md)',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = loading ? 'none' : 'var(--shadow-md)'; }}
              >
                <FiLock size={18} />
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* STEP 3: Success                                    */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--success-light)',
              border: '2px solid rgba(34,197,94,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}>
              <FiCheckCircle size={28} color="var(--success)" />
            </div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Password Reset!
            </h1>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                display: 'inline-block',
                padding: '0.875rem 2.5rem',
                background: 'var(--primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 'var(--font-size-base)',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-md)',
                fontFamily: 'inherit',
              }}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Back to login (shown on steps 1 and 2 only) */}
        {step < 3 && (
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
