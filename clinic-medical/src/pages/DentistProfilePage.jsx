import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDentistPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/DentistProfilePage.css';

function DentistProfilePage() {
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const navigate = useNavigate();
  const session = getDentistPortalSession();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    npi: ''
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.userId) {
      navigate('/staff-login');
      return;
    }

    if (session?.doctorId) {
      const key = `dentistAvatar:${session.doctorId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        setAvatarPreview(stored);
      }
    }

    fetch(`${API_BASE_URL}/api/dentist/profile?userId=${session.userId}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || 'Failed to load profile');
        }
        return payload;
      })
      .then((profile) => {
        setForm({
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          email: profile.user_email || '',
          phone: profile.phone_number || '',
          dateOfBirth: String(profile.date_of_birth || '').slice(0, 10),
          npi: profile.npi || ''
        });
      })
      .catch((err) => setStatus(err.message || 'Unable to load profile'))
      .finally(() => setLoading(false));
  }, [API_BASE_URL, navigate, session?.userId, session?.doctorId]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setAvatarPreview('');
    if(fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('Saving profile changes...');

    if (session?.doctorId) {
      const key = `dentistAvatar:${session.doctorId}`;
      if (avatarPreview) {
        localStorage.setItem(key, avatarPreview);
      } else {
        localStorage.removeItem(key);
      }
    }

    const response = await fetch(`${API_BASE_URL}/api/dentist/profile?userId=${session.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.error || 'Failed to save profile changes');
      return;
    }

    setStatus('Profile updated successfully.');
  };

  if (loading) {
    return (
      <main className="dentist-profile-page">
        <section className="dentist-profile-panel">
          <h1>Update Personal Information</h1>
          <p className="dentist-profile-subtle">Loading profile...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dentist-profile-page">
      <section className="dentist-profile-panel">
        <h1>Update Personal Information</h1>
        <p className="dentist-profile-subtle">Use this page to keep your contact and professional data current.</p>

        <div className="dentist-profile-content">
          <div className="dentist-profile-form-container">
            <form className="dentist-profile-form" onSubmit={handleSubmit}>
              <label>
                First Name
                <input value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} required />
              </label>

              <label>
                Last Name
                <input value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} required />
              </label>

              <label>
                Email
                <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} required />
              </label>

              <label>
                Phone
                <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
              </label>

              <label>
                Date of Birth
                <input type="date" value={form.dateOfBirth} onChange={(e) => updateField('dateOfBirth', e.targe.value)} />
              </label>

              <label>
                NPI
                <input value={form.npi} onChange={(e) => updateField('npi', e.target.value)} maxLength={10} />
              </label>

              <div className="dentist-profile-actions">
                <button type="button" className="dentist-profile-secondary" onClick={() => navigate('/dentist-login')}>Back to Dashboard</button>
                <button type="submit" className="dentist-profile-primary">Save Changes</button>
              </div>
            </form>
            {status && <p className="dentist-profile-status">{status}</p>}
          </div>

          <div className="dentist-profile-photo-container">
            <div className="dentist-photo-preview-wrapper">
              <img 
                src={avatarPreview || 'https://i.imgur.com/832p1z4.png'}
                alt="Profile Preview" 
                className="dentist-photo-preview" 
                onError={(e) => { e.target.onerror = null; e.target.src='https://i.imgur.com/832p1z4.png'; }}
              />
              {avatarPreview && (
                <button type="button" className="dentist-photo-remove-btn" onClick={handleRemovePhoto}>
                  &times;
                </button>
              )}
            </div>
            <div className="dentist-photo-actions">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }} 
                id="photo-upload"
              />
              <label htmlFor="photo-upload" className="dentist-profile-secondary">
                {avatarPreview ? 'Change Photo' : 'Upload Photo'}
              </label>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default DentistProfilePage;
