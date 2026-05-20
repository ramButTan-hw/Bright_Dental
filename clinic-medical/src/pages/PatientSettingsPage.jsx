import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatientPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/PatientPortalPage.css';

function PatientSettingsPage() {
  const navigate = useNavigate();
  const session = useMemo(() => getPatientPortalSession(), []);
  const API_BASE_URL = resolveApiBaseUrl();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMessage, setPwMessage] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    address: '', city: '', state: '', zipcode: '',
    emergencyContactName: '', emergencyContactPhone: ''
  });

  const formatPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const formatZip = (value) => String(value || '').replace(/\D/g, '').slice(0, 5);

  useEffect(() => {
    if (!session?.patientId) {
      navigate('/patient-login');
      return;
    }

    const loadProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}`);
        if (!res.ok) throw new Error('Unable to load profile');
        const patient = await res.json();
        setForm({
          firstName: patient.p_first_name || '',
          lastName: patient.p_last_name || '',
          phone: formatPhone(patient.p_phone || ''),
          email: patient.p_email || '',
          address: patient.p_address || '',
          city: patient.p_city || '',
          state: patient.p_state || '',
          zipcode: formatZip(patient.p_zipcode || ''),
          emergencyContactName: patient.p_emergency_contact_name || '',
          emergencyContactPhone: formatPhone(patient.p_emergency_contact_phone || '')
        });
      } catch (err) {
        setMessage(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [API_BASE_URL, navigate, session?.patientId]);

  const updateField = (e) => {
    const { name, value } = e.target;
    if (name === 'phone' || name === 'emergencyContactPhone') {
      setForm((prev) => ({ ...prev, [name]: formatPhone(value) }));
      return;
    }
    if (name === 'zipcode') {
      setForm((prev) => ({ ...prev, [name]: formatZip(value) }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    setSaving(true);

    const phoneDigits = String(form.phone || '').replace(/\D/g, '');
    const emergencyPhoneDigits = String(form.emergencyContactPhone || '').replace(/\D/g, '');
    const zipDigits = String(form.zipcode || '').replace(/\D/g, '');

    if (phoneDigits.length && phoneDigits.length !== 10) {
      setMessage('Phone number must contain exactly 10 digits.');
      setSaving(false);
      return;
    }
    if (emergencyPhoneDigits.length && emergencyPhoneDigits.length !== 10) {
      setMessage('Emergency contact phone must contain exactly 10 digits.');
      setSaving(false);
      return;
    }
    if (zipDigits.length && zipDigits.length !== 5) {
      setMessage('ZIP code must contain exactly 5 digits.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update profile');
      setMessage('Profile updated successfully.');
    } catch (err) {
      setMessage(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMessage('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMessage('New passwords do not match.');
      return;
    }
    if (pwForm.newPassword.length < 8 || !/[A-Z]/.test(pwForm.newPassword) || !/[a-z]/.test(pwForm.newPassword) || !/[0-9]/.test(pwForm.newPassword)) {
      setPwMessage('Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.');
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${session.userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to change password');
      setPwMessage('Password updated successfully.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMessage(err.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return <main className="patient-portal-page"><p className="portal-loading">Loading profile...</p></main>;
  }

  // Fetch last login from patient profile if available
  // The profile API should return account_last_login
  const [lastLogin, setLastLogin] = useState(null);
  useEffect(() => {
    if (!session?.patientId) return;
    fetch(`${API_BASE_URL}/api/patients/${session.patientId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setLastLogin(data?.account_last_login || null))
      .catch(() => setLastLogin(null));
  }, [API_BASE_URL, session?.patientId]);

  return (
    <main className="patient-portal-page">
      <section className="portal-header-card">
        <div>
          <p className="portal-label">Patient Portal</p>
          <h1>My Profile &amp; Settings</h1>
          {lastLogin && (
            <p style={{ margin: 0, color: '#2a7b2a', fontWeight: 500 }}>
              Last login: {new Date(lastLogin).toLocaleString()}
            </p>
          )}
        </div>
        <div className="portal-link-row">
          <button type="button" className="portal-secondary-btn" onClick={() => navigate('/patient-portal')}>Back to Portal</button>
        </div>
      </section>

      {message && <p className={message.includes('successfully') ? 'portal-success' : 'portal-error'}>{message}</p>}

      <section className="portal-card">
        <h2>Edit Profile</h2>
        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem' }}>
          <div className="portal-field">
            <label>First Name</label>
            <input name="firstName" value={form.firstName} onChange={updateField} required />
          </div>
          <div className="portal-field">
            <label>Last Name</label>
            <input name="lastName" value={form.lastName} onChange={updateField} required />
          </div>
          <div className="portal-field">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={updateField} required />
          </div>
          <div className="portal-field">
            <label>Phone</label>
            <input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}|[0-9]{10}" maxLength={12} value={form.phone} onChange={updateField} />
          </div>
          <div className="portal-field" style={{ gridColumn: '1 / -1' }}>
            <label>Address</label>
            <input name="address" value={form.address} onChange={updateField} />
          </div>
          <div className="portal-field">
            <label>City</label>
            <input name="city" value={form.city} onChange={updateField} />
          </div>
          <div className="portal-field">
            <label>State</label>
            <input name="state" value={form.state} onChange={updateField} maxLength={2} placeholder="TX" />
          </div>
          <div className="portal-field">
            <label>Zip Code</label>
            <input name="zipcode" inputMode="numeric" pattern="\d{5}" maxLength={5} value={form.zipcode} onChange={updateField} />
          </div>
          <div className="portal-field">
            <label>Emergency Contact Name</label>
            <input name="emergencyContactName" value={form.emergencyContactName} onChange={updateField} />
          </div>
          <div className="portal-field">
            <label>Emergency Contact Phone</label>
            <input name="emergencyContactPhone" type="tel" inputMode="numeric" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}|[0-9]{10}" maxLength={12} value={form.emergencyContactPhone} onChange={updateField} />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button type="submit" className="portal-primary-btn" disabled={saving} style={{ width: 'fit-content' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="portal-card" style={{ marginTop: '1.5rem' }}>
        <h2>Change Password</h2>
        {pwMessage && <p className={pwMessage.includes('successfully') ? 'portal-success' : 'portal-error'}>{pwMessage}</p>}
        <form onSubmit={handlePasswordChange} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem' }}>
          <div className="portal-field" style={{ gridColumn: '1 / -1' }}>
            <label>Current Password</label>
            <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))} required />
          </div>
          <div className="portal-field">
            <label>New Password</label>
            <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))} minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}" title="At least 8 characters, 1 uppercase, 1 lowercase, and 1 number" required />
          </div>
          <div className="portal-field">
            <label>Confirm New Password</label>
            <input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))} minLength={8} required />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button type="submit" className="portal-primary-btn" disabled={pwSaving} style={{ width: 'fit-content' }}>
              {pwSaving ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default PatientSettingsPage;
