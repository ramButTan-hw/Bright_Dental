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

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    address: '', city: '', state: '', zipcode: '',
    emergencyContactName: '', emergencyContactPhone: ''
  });

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
          phone: patient.p_phone || '',
          email: patient.p_email || '',
          address: patient.p_address || '',
          city: patient.p_city || '',
          state: patient.p_state || '',
          zipcode: patient.p_zipcode || '',
          emergencyContactName: patient.p_emergency_contact_name || '',
          emergencyContactPhone: patient.p_emergency_contact_phone || ''
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
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    setSaving(true);

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

  if (loading) {
    return <main className="patient-portal-page"><p className="portal-loading">Loading profile...</p></main>;
  }

  return (
    <main className="patient-portal-page">
      <section className="portal-header-card">
        <div>
          <p className="portal-label">Patient Portal</p>
          <h1>My Profile &amp; Settings</h1>
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
            <input name="phone" type="tel" value={form.phone} onChange={updateField} />
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
            <input name="zipcode" value={form.zipcode} onChange={updateField} />
          </div>
          <div className="portal-field">
            <label>Emergency Contact Name</label>
            <input name="emergencyContactName" value={form.emergencyContactName} onChange={updateField} />
          </div>
          <div className="portal-field">
            <label>Emergency Contact Phone</label>
            <input name="emergencyContactPhone" type="tel" value={form.emergencyContactPhone} onChange={updateField} />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button type="submit" className="portal-primary-btn" disabled={saving} style={{ width: 'fit-content' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default PatientSettingsPage;
