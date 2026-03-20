import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { role: 'Admin',           desc: 'Full system access',      username: 'admin' },
  { role: 'Doctor',          desc: 'Patient care & records',  username: 'dr.smith' },
  { role: 'Receptionist',    desc: 'Appointments & billing',  username: 'reception1' },
  { role: 'Dental Assistant',desc: 'Vitals & patient prep',   username: 'assistant1' },
  { role: 'Patient',         desc: 'View own records',        username: 'patient1' },
];

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const DEMO_PASSWORDS = { admin: 'admin', 'dr.smith': 'admin', reception1: 'admin', assistant1: 'admin', patient1: 'admin' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Demo shortcut — works without a backend
    if (DEMO_PASSWORDS[username] !== undefined && password === DEMO_PASSWORDS[username]) {
      login({ user_username: username, user_role: username === 'admin' ? 'admin' : username });
      navigate(username === 'patient1' ? '/portal/my-appointments' : '/portal/dashboard');
      setLoading(false);
      return;
    }

    try {
      const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      login(data.user);
      navigate('/portal/dashboard');
    } catch {
      setError('Unable to connect to server. Use a demo account with password: admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>

      {/* Logo + title */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ width: '72px', height: '72px', background: '#d6eae6', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="36" height="36" fill="none" stroke="#2d7a6e" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a2332', margin: 0 }}>MedClinic</h1>
        <p style={{ color: '#6b8a8a', fontSize: '0.95rem', margin: '6px 0 0' }}>Practice Management System</p>
      </div>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '36px', width: '100%', maxWidth: '460px' }}>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: '#1a2332', marginBottom: '8px' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                style={{ width: '100%', padding: '11px 14px 11px 42px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: '#1a2332', marginBottom: '8px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{ width: '100%', padding: '11px 14px 11px 42px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo accounts */}
        <div style={{ marginTop: '28px', borderTop: '1px solid #f3f4f6', paddingTop: '22px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Demo Accounts</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.username}
                type="button"
                onClick={() => { setUsername(a.username); setPassword('admin'); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}
              >
                <span>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1a2332' }}>{a.role}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '8px' }}>{a.desc}</span>
                </span>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'monospace' }}>{a.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
