import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/DentistProfilePage.css';

const CLINIC_OPEN_TIME = '08:00';
const CLINIC_CLOSE_TIME = '19:00';

const buildClinicTimeOptions = (openTime, closeTime) => {
  const [openHour, openMinute] = openTime.split(':').map(Number);
  const [closeHour, closeMinute] = closeTime.split(':').map(Number);

  const cursor = new Date(2000, 0, 1, openHour, openMinute, 0, 0);
  const close = new Date(2000, 0, 1, closeHour, closeMinute, 0, 0);
  const options = [];

  while (cursor.getTime() <= close.getTime()) {
    const hours = String(cursor.getHours()).padStart(2, '0');
    const minutes = String(cursor.getMinutes()).padStart(2, '0');
    const value = `${hours}:${minutes}`;
    options.push({
      value,
      label: new Date(`2000-01-01T${value}:00`).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    });
    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  return options;
};

const CLINIC_TIME_SELECT_OPTIONS = buildClinicTimeOptions(CLINIC_OPEN_TIME, CLINIC_CLOSE_TIME);

const formatDateTimeWithMeridiem = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A';
  }
  return parsed.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

function ReceptionistProfilePage() {
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const navigate = useNavigate();
  const session = getReceptionPortalSession();
  const fileInputRef = useRef(null);

  const formatPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const formatZip = (value) => String(value || '').replace(/\D/g, '').slice(0, 5);

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolvedStaffId, setResolvedStaffId] = useState(() => session?.staffId || null);
  const [timeOffForm, setTimeOffForm] = useState({
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    locationId: '',
    reason: ''
  });
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [timeOffLocations, setTimeOffLocations] = useState([]);
  const [timeOffStatus, setTimeOffStatus] = useState('');
  const [isSubmittingTimeOff, setIsSubmittingTimeOff] = useState(false);

  const [allLocations, setAllLocations] = useState([]);
  const [staffLocations, setStaffLocations] = useState([]);
  const [locationStatus, setLocationStatus] = useState('');
  const [isSavingLocations, setIsSavingLocations] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMessage, setPwMessage] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const DAYS_OF_WEEK = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const SCHEDULE_TIME_OPTIONS = CLINIC_TIME_SELECT_OPTIONS;
  const [scheduleEntries, setScheduleEntries] = useState(
    DAYS_OF_WEEK.map((d) => ({ day: d, startTime: '08:00', endTime: '19:00', isOff: false }))
  );
  const [approvedSchedule, setApprovedSchedule] = useState([]);
  const [scheduleRequests, setScheduleRequests] = useState([]);
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  useEffect(() => {
    if (!session?.userId) {
      navigate('/staff-login');
      return;
    }

    fetchWithTimeout(`${API_BASE_URL}/api/reception/profile?userId=${session.userId}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || 'Failed to load profile');
        }
        return payload;
      })
      .then((profile) => {
        const sid = profile.staff_id || session?.staffId || null;
        setResolvedStaffId(sid);
        setForm({
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          email: profile.user_email || '',
          phone: formatPhone(profile.phone_number || ''),
          dateOfBirth: String(profile.date_of_birth || '').slice(0, 10),
          address: profile.s_address || '',
          city: profile.s_city || '',
          state: profile.s_state || '',
          zipcode: formatZip(profile.s_zipcode || ''),
          country: profile.s_country || '',
          emergencyContactName: profile.emergency_contact_name || '',
          emergencyContactPhone: formatPhone(profile.emergency_contact_phone)
        });
        if (sid) {
          fetchWithTimeout(`${API_BASE_URL}/api/staff/profile-image?staffId=${sid}`)
            .then((r) => r.json())
            .then((imgData) => {
              if (imgData.profile_image_base64) {
                setAvatarPreview(`data:image/jpeg;base64,${imgData.profile_image_base64}`);
              }
            })
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          setStatus('Loading profile timed out. Please try again.');
          return;
        }
        setStatus(err.message || 'Unable to load profile');
      })
      .finally(() => setLoading(false));
  }, [API_BASE_URL, navigate, session?.userId, session?.staffId]);

  useEffect(() => {
    if (!resolvedStaffId) {
      setTimeOffRequests([]);
      return;
    }

    const loadTimeOffData = async () => {
      const [requestRows, locationRows] = await Promise.all([
        fetchWithTimeout(`${API_BASE_URL}/api/staff/time-off-requests?staffId=${encodeURIComponent(resolvedStaffId)}`).then((response) => response.json().catch(() => [])),
        fetchWithTimeout(`${API_BASE_URL}/api/admin/locations`).then((response) => response.json().catch(() => []))
      ]);
      setTimeOffRequests(Array.isArray(requestRows) ? requestRows : []);
      setTimeOffLocations(Array.isArray(locationRows) ? locationRows : []);
    };

    loadTimeOffData().catch(() => {
      setTimeOffRequests([]);
    });
  }, [API_BASE_URL, resolvedStaffId]);

  useEffect(() => {
    if (!resolvedStaffId) return;
    const loadLocations = async () => {
      const [allLocs, myLocs] = await Promise.all([
        fetchWithTimeout(`${API_BASE_URL}/api/admin/locations`).then((r) => r.json().catch(() => [])),
        fetchWithTimeout(`${API_BASE_URL}/api/staff/locations?staffId=${resolvedStaffId}`).then((r) => r.json().catch(() => []))
      ]);
      setAllLocations(Array.isArray(allLocs) ? allLocs : []);
      setStaffLocations(Array.isArray(myLocs) ? myLocs.map((l) => ({ locationId: l.location_id, fullAddress: l.full_address, isPrimary: !!l.is_primary })) : []);
    };
    loadLocations().catch(() => {});
  }, [API_BASE_URL, resolvedStaffId]);

  useEffect(() => {
    if (!resolvedStaffId) return;
    const loadScheduleData = async () => {
      const [approved, requests] = await Promise.all([
        fetchWithTimeout(`${API_BASE_URL}/api/staff/schedules?staffId=${resolvedStaffId}`).then((r) => r.json().catch(() => [])),
        fetchWithTimeout(`${API_BASE_URL}/api/staff/schedule-requests?staffId=${resolvedStaffId}`).then((r) => r.json().catch(() => []))
      ]);
      setApprovedSchedule(Array.isArray(approved) ? approved : []);
      setScheduleRequests(Array.isArray(requests) ? requests : []);
      const approvedMap = {};
      (Array.isArray(approved) ? approved : []).forEach((s) => { approvedMap[s.day_of_week] = s; });
      setScheduleEntries(DAYS_OF_WEEK.map((d) => {
        const s = approvedMap[d];
        if (s) {
          const isOff = Number(s.is_off) === 1 || s.is_off === true || String(s.is_off).toLowerCase() === 'true';
          const startTime = String(s.start_time || '').slice(0, 5);
          const endTime = String(s.end_time || '').slice(0, 5);
          return {
            day: d,
            startTime: isOff ? '' : (startTime || CLINIC_OPEN_TIME),
            endTime: isOff ? '' : (endTime || CLINIC_CLOSE_TIME),
            isOff
          };
        }
        return { day: d, startTime: '08:00', endTime: '19:00', isOff: false };
      }));
    };
    loadScheduleData().catch(() => {});
  }, [API_BASE_URL, resolvedStaffId]);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!resolvedStaffId) return;
    setIsSubmittingSchedule(true);
    setScheduleStatus('');
    try {
      const entriesPayload = scheduleEntries.map((entry) => {
        const isOff = !!entry.isOff;
        return {
          day: String(entry.day || '').toUpperCase(),
          startTime: isOff ? null : (String(entry.startTime || CLINIC_OPEN_TIME)),
          endTime: isOff ? null : (String(entry.endTime || CLINIC_CLOSE_TIME)),
          isOff
        };
      });

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/staff/schedule-requests?staffId=${encodeURIComponent(Number(resolvedStaffId))}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: Number(resolvedStaffId), entries: entriesPayload })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detailText = payload.detail
          ? (typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail))
          : '';
        throw new Error(detailText ? `${payload.error || 'Failed to submit schedule'}: ${detailText}` : (payload.error || 'Failed to submit schedule'));
      }
      setScheduleStatus('Schedule preference submitted for admin approval.');
      const fresh = await fetchWithTimeout(`${API_BASE_URL}/api/staff/schedule-requests?staffId=${resolvedStaffId}`).then((r) => r.json().catch(() => []));
      setScheduleRequests(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      setScheduleStatus(err.message || 'Failed to submit schedule.');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const updateScheduleEntry = (idx, field, value) => {
    setScheduleEntries((prev) => prev.map((entry, i) => {
      if (i !== idx) return entry;
      if (field === 'isOff') {
        const isOff = !!value;
        return {
          ...entry,
          isOff,
          startTime: isOff ? '' : (entry.startTime || CLINIC_OPEN_TIME),
          endTime: isOff ? '' : (entry.endTime || CLINIC_CLOSE_TIME)
        };
      }
      return { ...entry, [field]: value };
    }));
  };

  const updateField = (field, value) => {
    if (field === 'phone') {
      setForm((prev) => ({ ...prev, [field]: formatPhone(value) }));
      return;
    }

    if (field === 'zipcode') {
      setForm((prev) => ({ ...prev, [field]: formatZip(value) }));
      return;
    }

    if (field === 'emergencyContactPhone') {
      const formatted = formatPhone(value);
      setForm((prev) => ({ ...prev, [field]: formatted }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setAvatarPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('Saving profile changes...');

    const phoneDigits = String(form.phone || '').replace(/\D/g, '');
    const emergencyDigits = String(form.emergencyContactPhone || '').replace(/\D/g, '');
    const zipDigits = String(form.zipcode || '').replace(/\D/g, '');

    if (phoneDigits.length && phoneDigits.length !== 10) {
      setStatus('Phone number must contain exactly 10 digits.');
      return;
    }
    if (emergencyDigits.length && emergencyDigits.length !== 10) {
      setStatus('Emergency contact phone must contain exactly 10 digits.');
      return;
    }
    if (zipDigits.length && zipDigits.length !== 5) {
      setStatus('ZIP code must contain exactly 5 digits.');
      return;
    }

    // Save profile image to DB
    if (resolvedStaffId) {
      try {
        await fetchWithTimeout(`${API_BASE_URL}/api/staff/profile-image`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffId: resolvedStaffId, imageBase64: avatarPreview || null })
        });
      } catch {
        // Image save failure is non-blocking
      }
    }

    const response = await fetchWithTimeout(`${API_BASE_URL}/api/reception/profile?userId=${session.userId}`, {
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

  const addStaffLocation = (locationId) => {
    const loc = allLocations.find((l) => l.location_id === Number(locationId));
    if (!loc || staffLocations.some((sl) => sl.locationId === Number(locationId))) return;
    setStaffLocations((prev) => [
      ...prev,
      { locationId: loc.location_id, fullAddress: loc.full_address, isPrimary: prev.length === 0 }
    ]);
  };

  const removeStaffLocation = (locationId) => {
    setStaffLocations((prev) => {
      const updated = prev.filter((l) => l.locationId !== locationId);
      if (updated.length && !updated.some((l) => l.isPrimary)) {
        updated[0].isPrimary = true;
      }
      return updated;
    });
  };

  const setPrimaryLocation = (locationId) => {
    setStaffLocations((prev) => prev.map((l) => ({ ...l, isPrimary: l.locationId === locationId })));
  };

  const saveStaffLocations = async () => {
    if (!resolvedStaffId) return;
    if (!staffLocations.length) {
      setLocationStatus('Please add at least one location.');
      return;
    }
    setIsSavingLocations(true);
    setLocationStatus('');
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/staff/locations?staffId=${resolvedStaffId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: staffLocations })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to save locations.');
      setLocationStatus('Locations updated successfully.');
    } catch (err) {
      setLocationStatus(err.message || 'Failed to save locations.');
    } finally {
      setIsSavingLocations(false);
    }
  };

  const submitTimeOffRequest = async (event) => {
    event.preventDefault();
    setTimeOffStatus('');

    if (!resolvedStaffId) {
      setTimeOffStatus('Staff session missing. Please sign in again.');
      return;
    }

    if (!timeOffForm.startDate || !timeOffForm.startTime || !timeOffForm.endDate || !timeOffForm.endTime) {
      setTimeOffStatus('Please provide start/end date and start/end time for time off.');
      return;
    }

    const clinicTimes = new Set(CLINIC_TIME_SELECT_OPTIONS.map((option) => option.value));
    if (!clinicTimes.has(timeOffForm.startTime) || !clinicTimes.has(timeOffForm.endTime)) {
      setTimeOffStatus('Please select times within clinic hours.');
      return;
    }

    const startDateTime = `${timeOffForm.startDate}T${timeOffForm.startTime}:00`;
    const endDateTime = `${timeOffForm.endDate}T${timeOffForm.endTime}:00`;

    setIsSubmittingTimeOff(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/staff/time-off-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: Number(resolvedStaffId),
          startDateTime,
          endDateTime,
          locationId: timeOffForm.locationId ? Number(timeOffForm.locationId) : null,
          reason: timeOffForm.reason
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to submit time-off request.');
      }

      setTimeOffForm({ startDate: '', startTime: '', endDate: '', endTime: '', locationId: '', reason: '' });
      setTimeOffStatus('Time-off request submitted. Admin will review it shortly.');

      const refreshed = await fetchWithTimeout(`${API_BASE_URL}/api/staff/time-off-requests?staffId=${encodeURIComponent(resolvedStaffId)}`);
      const refreshedRows = await refreshed.json().catch(() => []);
      setTimeOffRequests(Array.isArray(refreshedRows) ? refreshedRows : []);
    } catch (err) {
      setTimeOffStatus(err.message || 'Failed to submit time-off request.');
    } finally {
      setIsSubmittingTimeOff(false);
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
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/users/${session.userId}/password`, {
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
        <p className="dentist-profile-subtle">Use this page to keep your contact and profile data current.</p>

        <div className="dentist-profile-content">
          <div className="dentist-profile-form-container">
            <form className="dentist-profile-form" onSubmit={handleSubmit}>
              <label>
                First Name
                <input value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} required />
              </label>

              <label>
                Last Name
                <input value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} required />
              </label>

              <label>
                Email
                <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
              </label>

              <label>
                Phone
                <input type="tel" inputMode="numeric" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}|[0-9]{10}" maxLength={12} value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
              </label>

              <label>
                Date of Birth
                <input type="date" value={form.dateOfBirth} onChange={(event) => updateField('dateOfBirth', event.target.value)} />
              </label>

              <label>
                Address
                <input value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Street address" />
              </label>

              <label>
                City
                <input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
              </label>

              <label>
                State
                <input value={form.state} onChange={(event) => updateField('state', event.target.value)} maxLength={2} placeholder="TX" />
              </label>

              <label>
                Zip Code
                <input inputMode="numeric" pattern="\d{5}" maxLength={5} value={form.zipcode} onChange={(event) => updateField('zipcode', event.target.value)} />
              </label>

              <label>
                Country
                <input value={form.country} onChange={(event) => updateField('country', event.target.value)} placeholder="USA" />
              </label>

              <label>
                Emergency Contact Name
                <input value={form.emergencyContactName} onChange={(event) => updateField('emergencyContactName', event.target.value)} placeholder="Contact full name" />
              </label>

              <label>
                Emergency Contact Phone
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}|[0-9]{3}-[0-9]{3}-[0-9]{4}"
                  maxLength={12}
                  value={form.emergencyContactPhone}
                  onChange={(event) => updateField('emergencyContactPhone', event.target.value)}
                  placeholder="123-456-7890"
                  title="Enter 10 digits (1234567890) or XXX-XXX-XXXX"
                />
              </label>

              <label>
                Staff ID
                <input value={session?.staffId || ''} readOnly disabled />
              </label>

              <div className="dentist-profile-actions">
                <button type="button" className="dentist-profile-secondary" onClick={() => navigate('/receptionist')}>Back to Dashboard</button>
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
                onError={(event) => {
                  event.target.onerror = null;
                  event.target.src = 'https://i.imgur.com/832p1z4.png';
                }}
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
                id="receptionist-photo-upload"
              />
              <label htmlFor="receptionist-photo-upload" className="dentist-profile-secondary">
                {avatarPreview ? 'Change Photo' : 'Upload Photo'}
              </label>
            </div>
          </div>
        </div>

        <section className="dentist-profile-timeoff">
          <h2>My Locations</h2>
          <p className="dentist-profile-subtle">Assign yourself to one or more clinic locations. One must be your primary.</p>

          <div className="dentist-profile-form" style={{ gridTemplateColumns: '1fr', gap: '0.6rem' }}>
            <label>
              Add Location
              <select onChange={(e) => { addStaffLocation(e.target.value); e.target.value = ''; }} defaultValue="">
                <option value="" disabled>Select a location to add</option>
                {allLocations
                  .filter((loc) => !staffLocations.some((sl) => sl.locationId === loc.location_id))
                  .map((loc) => (
                    <option key={loc.location_id} value={loc.location_id}>{loc.full_address}</option>
                  ))}
              </select>
            </label>

            {staffLocations.length > 0 && (
              <div className="dentist-profile-timeoff-history" style={{ marginTop: 0 }}>
                <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {staffLocations.map((sl) => (
                    <li key={sl.locationId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <input
                        type="radio"
                        name="primaryLocationReceptionist"
                        checked={sl.isPrimary}
                        onChange={() => setPrimaryLocation(sl.locationId)}
                        title="Set as primary"
                      />
                      <span style={{ flex: 1 }}>
                        {sl.fullAddress}
                        {sl.isPrimary && <strong style={{ color: '#0b6d68', marginLeft: '0.4rem' }}>(Primary)</strong>}
                      </span>
                      <button
                        type="button"
                        className="dentist-profile-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => removeStaffLocation(sl.locationId)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="dentist-profile-actions" style={{ marginTop: '0.2rem' }}>
              <button type="button" className="dentist-profile-primary" onClick={saveStaffLocations} disabled={isSavingLocations}>
                {isSavingLocations ? 'Saving...' : 'Save Locations'}
              </button>
            </div>
            {locationStatus && <p className="dentist-profile-status">{locationStatus}</p>}
          </div>
        </section>

        <section className="dentist-profile-timeoff">
          <h2>Request Time Off</h2>
          <p className="dentist-profile-subtle">Clinic hours are 08:00 AM to 07:00 PM in 30-minute intervals.</p>
          <form className="dentist-profile-form dentist-profile-timeoff-form" onSubmit={submitTimeOffRequest}>
            <label>
              Start Date
              <input
                type="date"
                value={timeOffForm.startDate}
                onChange={(event) => setTimeOffForm((prev) => ({ ...prev, startDate: event.target.value }))}
                required
              />
            </label>

            <label>
              Start Time
              <select
                value={timeOffForm.startTime}
                onChange={(event) => setTimeOffForm((prev) => ({ ...prev, startTime: event.target.value }))}
                required
              >
                <option value="">Select time (e.g., 08:00 AM)</option>
                {CLINIC_TIME_SELECT_OPTIONS.map((timeOption) => (
                  <option key={`receptionist-profile-start-${timeOption.value}`} value={timeOption.value}>
                    {timeOption.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              End Date
              <input
                type="date"
                value={timeOffForm.endDate}
                onChange={(event) => setTimeOffForm((prev) => ({ ...prev, endDate: event.target.value }))}
                required
              />
            </label>

            <label>
              End Time
              <select
                value={timeOffForm.endTime}
                onChange={(event) => setTimeOffForm((prev) => ({ ...prev, endTime: event.target.value }))}
                required
              >
                <option value="">Select time (e.g., 05:00 PM)</option>
                {CLINIC_TIME_SELECT_OPTIONS.map((timeOption) => (
                  <option key={`receptionist-profile-end-${timeOption.value}`} value={timeOption.value}>
                    {timeOption.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Location (optional)
              <select
                value={timeOffForm.locationId}
                onChange={(event) => setTimeOffForm((prev) => ({ ...prev, locationId: event.target.value }))}
              >
                <option value="">Any location</option>
                {timeOffLocations.map((location) => (
                  <option key={location.location_id} value={location.location_id}>{location.full_address}</option>
                ))}
              </select>
            </label>

            <label>
              Reason (optional)
              <input
                type="text"
                value={timeOffForm.reason}
                onChange={(event) => setTimeOffForm((prev) => ({ ...prev, reason: event.target.value }))}
                placeholder="Brief reason"
              />
            </label>

            <div className="dentist-profile-actions">
              <button type="submit" className="dentist-profile-primary" disabled={isSubmittingTimeOff}>
                {isSubmittingTimeOff ? 'Submitting...' : 'Submit Time-Off Request'}
              </button>
            </div>
          </form>

          <div className="dentist-profile-timeoff-history">
            <h3>Time-Off History</h3>
            <ul>
              {timeOffRequests.length ? timeOffRequests.map((item) => (
                <li key={item.request_id}>
                  {formatDateTimeWithMeridiem(item.start_datetime)} to {formatDateTimeWithMeridiem(item.end_datetime)} | {item.location_address || 'Any location'} | {item.is_approved ? 'Approved' : 'Pending'}
                </li>
              )) : <li>No time-off requests submitted yet.</li>}
            </ul>
          </div>

          {timeOffStatus && <p className="dentist-profile-status">{timeOffStatus}</p>}
        </section>

        <section className="dentist-profile-timeoff">
          <h2>Preferred Work Schedule</h2>
          <p className="dentist-profile-subtitle">Set your preferred hours for each day. Submit for admin approval.</p>

          {approvedSchedule.length > 0 && (
            <div className="dentist-profile-timeoff-history">
              <h3>Current Approved Schedule</h3>
              <ul>
                {approvedSchedule.map((s) => (
                  <li key={s.schedule_id}>
                    <strong>{s.day_of_week}</strong>: {s.is_off ? <em style={{ color: '#999' }}>OFF</em> : <>{String(s.start_time || '').slice(0, 5)} — {String(s.end_time || '').slice(0, 5)}</>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {scheduleRequests.some((r) => r.request_status === 'PENDING') && (
            <div className="dentist-profile-timeoff-history">
              <h3>Pending Request</h3>
              <ul>
                {scheduleRequests.filter((r) => r.request_status === 'PENDING').map((r) => (
                  <li key={r.request_id}>
                    <strong>{r.day_of_week}</strong>: {r.is_off ? <em style={{ color: '#999' }}>OFF</em> : <>{String(r.start_time || '').slice(0, 5)} — {String(r.end_time || '').slice(0, 5)}</>} <em>(Pending)</em>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form className="dentist-profile-form" onSubmit={handleScheduleSubmit}>
            {scheduleEntries.map((entry, idx) => (
              <div key={entry.day} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span style={{ flex: '0 0 100px', fontWeight: 600 }}>{entry.day.charAt(0) + entry.day.slice(1).toLowerCase()}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!entry.isOff} onChange={(e) => updateScheduleEntry(idx, 'isOff', e.target.checked)} />
                  OFF
                </label>
                {!entry.isOff && (
                  <>
                    <label style={{ flex: '1 1 100px' }}>
                      Start
                      <select value={entry.startTime} onChange={(e) => updateScheduleEntry(idx, 'startTime', e.target.value)}>
                        {SCHEDULE_TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                    <label style={{ flex: '1 1 100px' }}>
                      End
                      <select value={entry.endTime} onChange={(e) => updateScheduleEntry(idx, 'endTime', e.target.value)}>
                        {SCHEDULE_TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
            ))}
            <div className="dentist-profile-actions">
              <button type="submit" className="dentist-profile-primary" disabled={isSubmittingSchedule}>
                {isSubmittingSchedule ? 'Submitting...' : 'Submit Schedule Preference'}
              </button>
            </div>
          </form>
          {scheduleStatus && <p className="dentist-profile-status">{scheduleStatus}</p>}
        </section>

        <section className="dentist-profile-timeoff">
          <h2>Change Password</h2>
          {pwMessage && <p className="dentist-profile-status">{pwMessage}</p>}
          <form className="dentist-profile-form" onSubmit={handlePasswordChange}>
            <label>
              Current Password
              <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))} required />
            </label>
            <label>
              New Password
              <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))} minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}" title="At least 8 characters, 1 uppercase, 1 lowercase, and 1 number" required />
            </label>
            <label>
              Confirm New Password
              <input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))} minLength={8} required />
            </label>
            <div className="dentist-profile-actions">
              <button type="submit" className="dentist-profile-primary" disabled={pwSaving}>
                {pwSaving ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}

export default ReceptionistProfilePage;
