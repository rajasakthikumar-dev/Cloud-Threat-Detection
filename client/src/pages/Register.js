import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiShield, FiUser, FiMail, FiLock, FiUserPlus } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { registerUser } from '../services/api';

/**
 * Register page - professional styling with 16px+ fonts
 * FIXED: Updated to professional light theme with proper readability
 */
export default function Register() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error('All fields are required.'); return; }
    if (form.password !== form.confirmPassword)       { toast.error('Passwords do not match.'); return; }
    if (form.password.length < 6)                     { toast.error('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await registerUser({ name: form.name, email: form.email, password: form.password });
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally { setLoading(false); }
  };

  const inputStyle = {
    width:'100%', 
    padding:'0.875rem 1rem 0.875rem 3rem',
    background:'var(--bg-primary)',
    border:'1px solid var(--border-color)',
    borderRadius:'var(--radius-md)', 
    color:'var(--text-primary)', 
    fontSize:'var(--font-size-base)',
    outline:'none', 
    boxSizing:'border-box', 
    fontFamily:'inherit',
    transition:'var(--transition)',
  };
  const inputFocus = e => { 
    e.target.style.borderColor = 'var(--primary)'; 
    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'; 
  };
  const inputBlur  = e => { 
    e.target.style.borderColor = 'var(--border-color)'; 
    e.target.style.boxShadow = 'none'; 
  };
  const labelStyle = { 
    display:'block', 
    fontSize:'var(--font-size-base)', 
    fontWeight:600, 
    color:'var(--text-primary)', 
    marginBottom:'0.5rem' 
  };
  const iconStyle  = { 
    position:'absolute', 
    left:'1rem', 
    top:'50%', 
    transform:'translateY(-50%)', 
    color:'var(--text-muted)' 
  };

  return (
    <div style={{
      minHeight:'100vh',
      display:'flex', 
      alignItems:'center', 
      justifyContent:'center',
      background:'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
      padding:'1.5rem',
    }}>
      <div style={{
        width:'100%', 
        maxWidth:'540px',
        background:'var(--bg-primary)',
        border:'1px solid var(--border-color)',
        borderRadius:'var(--radius-xl)', 
        padding:'3rem 2.75rem',
        boxShadow:'var(--shadow-xl)',
      }}>
        {/* Logo */}
        <div style={{ 
          display:'flex', 
          alignItems:'center', 
          justifyContent:'center', 
          gap:'1rem', 
          marginBottom:'2rem' 
        }}>
          <div style={{ 
            width:'54px', 
            height:'54px', 
            borderRadius:'var(--radius-lg)', 
            background:'var(--primary)', 
            display:'flex', 
            alignItems:'center', 
            justifyContent:'center', 
            boxShadow:'0 8px 20px rgba(37, 99, 235, 0.3)' 
          }}>
            <FiShield size={28} color="#fff" />
          </div>
          <span style={{ 
            fontSize:'var(--font-size-xl)', 
            fontWeight:800, 
            letterSpacing:'-0.02em', 
            color:'var(--text-primary)' 
          }}>
            AI Threat Detection
          </span>
        </div>

        <h1 style={{ 
          textAlign:'center', 
          fontSize:'var(--font-size-3xl)', 
          fontWeight:800, 
          color:'var(--text-primary)', 
          marginBottom:'0.5rem', 
          letterSpacing:'-0.02em' 
        }}>
          Create Account
        </h1>
        <p style={{ 
          textAlign:'center', 
          fontSize:'var(--font-size-base)', 
          color:'var(--text-secondary)', 
          marginBottom:'2.25rem' 
        }}>
          Join the cybersecurity monitoring platform
        </p>

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <label style={labelStyle}>Full Name</label>
          <div style={{ position:'relative', marginBottom:'1.25rem' }}>
            <FiUser size={18} style={iconStyle} />
            <input 
              style={inputStyle} 
              type="text" 
              name="name" 
              placeholder="John Doe" 
              value={form.name} 
              onChange={handleChange} 
              onFocus={inputFocus} 
              onBlur={inputBlur} 
            />
          </div>

          {/* Email */}
          <label style={labelStyle}>Email Address</label>
          <div style={{ position:'relative', marginBottom:'1.25rem' }}>
            <FiMail size={18} style={iconStyle} />
            <input 
              style={inputStyle} 
              type="email" 
              name="email" 
              placeholder="you@example.com" 
              value={form.email} 
              onChange={handleChange} 
              onFocus={inputFocus} 
              onBlur={inputBlur} 
            />
          </div>

          {/* Password row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.75rem' }}>
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position:'relative' }}>
                <FiLock size={18} style={iconStyle} />
                <input 
                  style={inputStyle} 
                  type="password" 
                  name="password" 
                  placeholder="Min 6 chars" 
                  value={form.password} 
                  onChange={handleChange} 
                  onFocus={inputFocus} 
                  onBlur={inputBlur} 
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Confirm</label>
              <div style={{ position:'relative' }}>
                <FiLock size={18} style={iconStyle} />
                <input 
                  style={inputStyle} 
                  type="password" 
                  name="confirmPassword" 
                  placeholder="Repeat" 
                  value={form.confirmPassword} 
                  onChange={handleChange} 
                  onFocus={inputFocus} 
                  onBlur={inputBlur} 
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width:'100%', 
              padding:'1rem',
              background: loading ? 'rgba(34, 197, 94, 0.5)' : 'var(--success)',
              border:'none', 
              borderRadius:'var(--radius-md)',
              color:'#fff', 
              fontWeight:700, 
              fontSize:'var(--font-size-base)',
              cursor: loading ? 'not-allowed' : 'pointer',
              display:'flex', 
              alignItems:'center', 
              justifyContent:'center', 
              gap:'0.625rem',
              transition:'var(--transition)',
              boxShadow: loading ? 'none' : 'var(--shadow-md)',
              fontFamily:'inherit',
            }}
            onMouseEnter={e => { 
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)'; 
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.transform = 'none'; 
              e.currentTarget.style.boxShadow = loading ? 'none' : 'var(--shadow-md)';
            }}
          >
            <FiUserPlus size={18} />
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p style={{ 
          textAlign:'center', 
          marginTop:'1.625rem', 
          fontSize:'var(--font-size-base)', 
          color:'var(--text-secondary)' 
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{ 
            color:'var(--primary)', 
            fontWeight:600, 
            textDecoration:'none' 
          }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
