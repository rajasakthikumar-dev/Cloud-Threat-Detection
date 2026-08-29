import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiShield, FiMail, FiLock, FiLogIn } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../App';
import { loginUser } from '../services/api';

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0f172a',
  },
  card: {
    width: '100%', maxWidth: '400px',
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: '16px', padding: '40px 36px',
  },
  logo: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', marginBottom: '28px',
    color: '#38bdf8', fontSize: '20px', fontWeight: 700,
  },
  title:    { textAlign: 'center', fontSize: '22px', fontWeight: 700, color: '#f1f5f9', marginBottom: '6px' },
  subtitle: { textAlign: 'center', fontSize: '13px', color: '#64748b', marginBottom: '28px' },
  label:    { display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' },
  inputWrap:{ position: 'relative', marginBottom: '16px' },
  icon:     { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569' },
  input: {
    width: '100%', padding: '10px 12px 10px 38px',
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: '8px', color: '#e2e8f0', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
  },
  btn: {
    width: '100%', padding: '12px', marginTop: '8px',
    background: '#0369a1', border: 'none', borderRadius: '8px',
    color: '#fff', fontWeight: 600, fontSize: '15px',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '8px', transition: 'background 0.2s',
  },
  footer: { textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#64748b' },
  link:   { color: '#38bdf8', textDecoration: 'none' },
};

export default function Login() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
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
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}><FiShield size={28} /> AI Threat Detection</div>
        <h1 style={s.title}>Sign In</h1>
        <p style={s.subtitle}>Enter your credentials to access the platform</p>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Email Address</label>
          <div style={s.inputWrap}>
            <FiMail size={15} style={s.icon} />
            <input style={s.input} type="email" name="email"
              placeholder="you@example.com" value={form.email} onChange={handleChange} />
          </div>
          <label style={s.label}>Password</label>
          <div style={s.inputWrap}>
            <FiLock size={15} style={s.icon} />
            <input style={s.input} type="password" name="password"
              placeholder="••••••••" value={form.password} onChange={handleChange} />
          </div>
          <button style={s.btn} type="submit" disabled={loading}>
            <FiLogIn size={16} />
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={s.footer}>
          Don't have an account?{' '}
          <Link to="/register" style={s.link}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
