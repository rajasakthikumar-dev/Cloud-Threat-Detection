import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiShield, FiMail, FiLock, FiLogIn } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../App';
import { loginUser } from '../services/api';

/**
 * Login page - professional styling with 16px+ fonts
 * FIXED: Updated to professional light theme with proper readability
 */
export default function Login() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const res = await loginUser(form);
      login(res.data.user, res.data.token);
      toast.success(`Welcome back, ${res.data.user.name}!`);
      navigate(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
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
      {/* Card */}
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
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'1rem', marginBottom:'2rem' }}>
          <div style={{
            width:'54px', height:'54px',
            borderRadius: 'var(--radius-lg)',
            background:'var(--primary)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 8px 20px rgba(37, 99, 235, 0.3)',
          }}>
            <FiShield size={28} color="#fff" />
          </div>
          <span style={{
            fontSize:'var(--font-size-xl)', 
            fontWeight:800, 
            letterSpacing:'-0.02em',
            color: 'var(--text-primary)',
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
          Welcome Back
        </h1>
        <p style={{ 
          textAlign:'center', 
          fontSize:'var(--font-size-base)', 
          color:'var(--text-secondary)', 
          marginBottom:'2.25rem' 
        }}>
          Sign in to access the security platform
        </p>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <label style={{ 
            display:'block', 
            fontSize:'var(--font-size-base)', 
            fontWeight:600, 
            color:'var(--text-primary)', 
            marginBottom:'0.5rem' 
          }}>
            Email Address
          </label>
          <div style={{ position:'relative', marginBottom:'1.25rem' }}>
            <FiMail size={18} style={{ 
              position:'absolute', 
              left:'1rem', 
              top:'50%', 
              transform:'translateY(-50%)', 
              color:'var(--text-muted)' 
            }} />
            <input
              style={{
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
              }}
              type="email" name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              onFocus={e => { 
                e.target.style.borderColor = 'var(--primary)'; 
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'; 
              }}
              onBlur={e  => { 
                e.target.style.borderColor = 'var(--border-color)'; 
                e.target.style.boxShadow = 'none'; 
              }}
            />
          </div>

          {/* Password */}
          <label style={{ 
            display:'block', 
            fontSize:'var(--font-size-base)', 
            fontWeight:600, 
            color:'var(--text-primary)', 
            marginBottom:'0.5rem' 
          }}>
            Password
          </label>
          <div style={{ position:'relative', marginBottom:'1.75rem' }}>
            <FiLock size={18} style={{ 
              position:'absolute', 
              left:'1rem', 
              top:'50%', 
              transform:'translateY(-50%)', 
              color:'var(--text-muted)' 
            }} />
            <input
              style={{
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
              }}
              type="password" name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              onFocus={e => { 
                e.target.style.borderColor = 'var(--primary)'; 
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'; 
              }}
              onBlur={e  => { 
                e.target.style.borderColor = 'var(--border-color)'; 
                e.target.style.boxShadow = 'none'; 
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width:'100%', 
              padding:'1rem',
              background: loading ? 'rgba(37, 99, 235, 0.5)' : 'var(--primary)',
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
            <FiLogIn size={18} />
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ 
          textAlign:'center', 
          marginTop:'1.625rem', 
          fontSize:'var(--font-size-base)', 
          color:'var(--text-secondary)' 
        }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ 
            color:'var(--primary)', 
            fontWeight:600, 
            textDecoration:'none' 
          }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
