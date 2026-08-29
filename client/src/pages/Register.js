import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiShield, FiUser, FiMail, FiLock, FiUserPlus } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { registerUser } from '../services/api';

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#0f172a',
  },
  card: {
    width: '100%', maxWidth: '420px',
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
  row:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label:    { display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' },
  inputWrap:{ position: 'relative', marginBottom: '16px' },
  icon:     { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569' },
  input: {
    width: '100%', padding: '10px 12px 10px 38px',
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: '8px', color: '#e2e8f0', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '10px 12px',
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: '8px', color: '#e2e8f0', fontSize: '14px',
    outline: 'none', marginBottom: '16px', boxSizing: 'border-box',
  },
  btn: {
    width: '100%', padding: '12px', marginTop: '8px',
    background: '#059669', border: 'none', borderRadius: '8px',
    color: '#fff', fontWeight: 600, fontSize: '15px',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '8px',
  },
  footer: { textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#64748b' },
  link:   { color: '#38bdf8', textDecoration: 'none' },
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error('All fields are required.'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match.'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      // NOTE: role is NOT sent — backend always assigns 'user'
      await registerUser({ name: form.name, email: form.email, password: form.password });
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}><FiShield size={28} /> AI Threat Detection</div>
        <h1 style={s.title}>Create Account</h1>
        <p style={s.subtitle}>Join the cybersecurity monitoring platform</p>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Full Name</label>
          <div style={s.inputWrap}>
            <FiUser size={15} style={s.icon} />
            <input style={s.input} type="text" name="name" placeholder="John Doe"
              value={form.name} onChange={handleChange} />
          </div>
          <label style={s.label}>Email Address</label>
          <div style={s.inputWrap}>
            <FiMail size={15} style={s.icon} />
            <input style={s.input} type="email" name="email" placeholder="you@example.com"
              value={form.email} onChange={handleChange} />
          </div>
          <div style={s.row}>
            <div>
              <label style={s.label}>Password</label>
              <div style={s.inputWrap}>
                <FiLock size={15} style={s.icon} />
                <input style={s.input} type="password" name="password" placeholder="Min 6 chars"
                  value={form.password} onChange={handleChange} />
              </div>
            </div>
            <div>
              <label style={s.label}>Confirm Password</label>
              <div style={s.inputWrap}>
                <FiLock size={15} style={s.icon} />
                <input style={s.input} type="password" name="confirmPassword" placeholder="Repeat"
                  value={form.confirmPassword} onChange={handleChange} />
              </div>
            </div>
          </div>
          <button style={s.btn} type="submit" disabled={loading}>
            <FiUserPlus size={16} />
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p style={s.footer}>
          Already have an account?{' '}
          <Link to="/login" style={s.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
