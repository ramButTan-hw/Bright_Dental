import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveApiBaseUrl, setAdminPortalSession, setDentistPortalSession, setReceptionPortalSession } from '../utils/patientPortal';
import '../styles/PatientLoginPage.css';

function StaffLoginPage() {
  const navigate = useNavigate();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleCredentialChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    const username = credentials.username.trim();
    const password = credentials.password;

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Invalid staff credentials.');
      }

      const resolvedRole = payload?.user?.role || payload?.user?.user_role || payload?.role || payload?.user_role || '';
      const userRole = String(resolvedRole).trim().toUpperCase();
      const resolvedUserId = payload?.user?.user_id || payload?.user?.userId || payload?.user_id || payload?.userId || null;
      const resolvedStaffId = payload?.user?.staff_id || payload?.user?.staffId || payload?.staff_id || payload?.staffId || null;
      const resolvedDoctorIdFromLogin = payload?.user?.doctor_id || payload?.user?.doctorId || payload?.doctor_id || payload?.doctorId || null;
      if (userRole === 'ADMIN') {
        setAdminPortalSession({
          username: payload?.user?.username || username,
          isAdmin: true,
          loggedInAt: new Date().toISOString()
        });
        navigate('/admin');
        return;
      }

      if (userRole === 'DOCTOR' || userRole === 'DENTIST') {
        let resolvedDoctorId = resolvedDoctorIdFromLogin;
        if (!resolvedDoctorId && resolvedUserId) {
          const profileRes = await fetch(`${API_BASE_URL}/api/dentist/profile?userId=${resolvedUserId}`);
          const profilePayload = await profileRes.json().catch(() => ({}));
          if (profileRes.ok) {
            resolvedDoctorId = profilePayload?.doctor_id || null;
          }
        }

        setDentistPortalSession({
          userId: resolvedUserId,
          staffId: resolvedStaffId,
          doctorId: resolvedDoctorId,
          username: payload?.user?.username || username,
          fullName: payload?.user?.full_name || 'Doctor',
          loggedInAt: new Date().toISOString()
        });
        navigate('/dentist-login');
        return;
      }

      if (userRole === 'RECEPTIONIST') {
        setReceptionPortalSession({
          userId: resolvedUserId,
          staffId: resolvedStaffId,
          username: payload?.user?.username || username,
          fullName: payload?.user?.full_name || 'Receptionist',
          loggedInAt: new Date().toISOString()
        });
        navigate('/receptionist');
        return;
      }

      setLoginError(`Login succeeded but role "${userRole || 'UNKNOWN'}" is not enabled for this page yet.`);
    } catch (err) {
      setLoginError(err.message || 'Invalid staff credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <main className="patient-login-page">
      <section className="patient-login-card">
        <p className="patient-login-label">Staff Access</p>
        <h1>Staff Login</h1>
        <p className="patient-login-subtitle">
          Sign in to access the clinic staff portal.
        </p>

        <form className="patient-login-form" onSubmit={handleLoginSubmit}>
          <label>
            Username
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleCredentialChange}
              placeholder="Enter staff username"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={credentials.password}
              onChange={handleCredentialChange}
              placeholder="Enter staff password"
              required
            />
          </label>

          <button type="submit" className="patient-login-submit" disabled={isLoggingIn}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
          {loginError && <p className="forgot-password-message">{loginError}</p>}
        </form>
      </section>
    </main>
  );
}

export default StaffLoginPage;
