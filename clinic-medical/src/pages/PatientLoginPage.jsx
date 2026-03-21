import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/PatientLoginPage.css';

function PatientLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const API_BASE_URL = resolveApiBaseUrl();
  const appointmentConfirmation = location.state?.appointmentConfirmation;
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const formatAppointmentDate = (value) => {
    if (!value) {
      return 'Date pending';
    }

    const parsedDate = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(parsedDate);
  };

  const formatAppointmentTime = (value) => {
    if (!value) {
      return 'Time pending';
    }

    const timeParts = String(value).split(':');
    const hour = Number(timeParts[0]);
    const minute = Number(timeParts[1]);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return String(value);
    }

    const normalized = new Date();
    normalized.setHours(hour, minute, 0, 0);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(normalized);
  };

  const handleCredentialChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username.trim(),
          password: credentials.password
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to log in right now.');
      }

      if (String(payload?.user?.role || '').toUpperCase() !== 'PATIENT') {
        throw new Error('This account does not have patient portal access.');
      }

      let patientId = payload?.user?.patient_id || null;
      if (!patientId && payload?.user?.user_id) {
        const patientLookupResponse = await fetch(`${API_BASE_URL}/api/patients/user/${payload.user.user_id}`);
        if (patientLookupResponse.ok) {
          const patientLookup = await patientLookupResponse.json();
          patientId = patientLookup?.patient_id || null;
        }
      }

      if (!patientId) {
        throw new Error('Unable to locate your patient profile. Please contact the front desk.');
      }

      const sessionData = {
        token: payload.token,
        userId: payload.user.user_id,
        patientId,
        username: payload.user.username,
        email: payload.user.email,
        role: payload.user.role
      };

      localStorage.setItem('patientPortalSession', JSON.stringify(sessionData));
      navigate('/patient-portal');
    } catch (error) {
      setLoginError(error.message || 'Unable to log in right now.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPasswordSubmit = (e) => {
    e.preventDefault();
    if (!forgotPasswordEmail.trim()) {
      setResetMessage('Please enter your email address.');
      return;
    }
    setResetMessage('If an account exists for that email, reset instructions will be sent.');
  };

  return (
    <main className="patient-login-page">
      <section className="patient-login-card">
        <p className="patient-login-label">Patient Portal</p>
        <h1>Patient Login</h1>
        <p className="patient-login-subtitle">
          Sign in to manage your appointments and medical intake details.
        </p>

        {location.state?.registrationSuccess && (
          <div className="patient-login-success-wrap">
            <p className="patient-login-success">Registration complete. Please log in below.</p>
            {appointmentConfirmation && (
              <div className="appointment-confirmation-card">
                <p className="appointment-confirmation-title">Your appointment request is reserved</p>
                <p><strong>Date:</strong> {formatAppointmentDate(appointmentConfirmation.date)}</p>
                <p>
                  <strong>Preferred Time:</strong> {formatAppointmentTime(appointmentConfirmation.startTime)}
                </p>
                {appointmentConfirmation.status && (
                  <p><strong>Status:</strong> {appointmentConfirmation.status.replaceAll('_', ' ')}</p>
                )}
                {appointmentConfirmation.doctorName && (
                  <p><strong>Provider:</strong> {appointmentConfirmation.doctorName}</p>
                )}
                {appointmentConfirmation.locationAddress && (
                  <p><strong>Location:</strong> {appointmentConfirmation.locationAddress}</p>
                )}
                {appointmentConfirmation.note && (
                  <p>{appointmentConfirmation.note}</p>
                )}
              </div>
            )}
          </div>
        )}

        <form className="patient-login-form" onSubmit={handleLoginSubmit}>
          <label>
            Username
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleCredentialChange}
              placeholder="Enter your username"
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
              placeholder="Enter your password"
              required
            />
          </label>

          <button type="submit" className="patient-login-submit" disabled={isLoggingIn}>
            {isLoggingIn ? 'Logging in...' : 'Login'}
          </button>
          {loginError && <p className="forgot-password-message">{loginError}</p>}
        </form>

        <button
          type="button"
          className="forgot-password-toggle"
          onClick={() => {
            setShowForgotPassword((prev) => !prev);
            setResetMessage('');
          }}
        >
          Forgot password?
        </button>

        {showForgotPassword && (
          <form className="forgot-password-form" onSubmit={handleForgotPasswordSubmit}>
            <label>
              Email Address
              <input
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder="name@email.com"
                required
              />
            </label>
            <button type="submit" className="forgot-password-submit">Send Reset Link</button>
            {resetMessage && <p className="forgot-password-message">{resetMessage}</p>}
          </form>
        )}

        <p className="signup-link-wrap">
          New patient? <Link to="/patient-registration">Sign Up!</Link>
        </p>
      </section>
    </main>
  );
}

export default PatientLoginPage;
