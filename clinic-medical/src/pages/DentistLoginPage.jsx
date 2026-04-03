import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDentistPortalSession, resolveApiBaseUrl, setDentistPortalSession } from '../utils/patientPortal';
import '../styles/DentistDashboardPage.css';

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ACTIVE_UPCOMING_STATUSES = new Set(['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN']);
const CLOSED_STATUSES = new Set(['COMPLETED']);

const getAppointmentStatus = (appt) => String(appt?.status_name || appt?.appointment_status || '').trim().toUpperCase();

const toAppointmentTimestamp = (appt) => {
  const datePart = String(appt?.appointment_date || '').slice(0, 10);
  const timePart = String(appt?.appointment_time || '').slice(0, 8) || '00:00:00';
  const value = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(value.getTime()) ? -Infinity : value.getTime();
};

function DentistLoginPage() {
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getDentistPortalSession());
  const [profile, setProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [appointments, setAppointments] = useState([]);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [searchResultAppointments, setSearchResultAppointments] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [mySchedule, setMySchedule] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [selectedPastDate, setSelectedPastDate] = useState('');
  const sessionReady = Boolean(session?.userId || session?.username);

  const loadAllAppointments = async (doctorId) => {
    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      setAllAppointments([]);
      return [];
    }
    const response = await fetch(`${API_BASE_URL}/api/dentist/appointments?doctorId=${doctorId}`);
    const payload = await response.json().catch(() => []);
    if (!response.ok) {
      throw new Error(payload.error || 'Failed to load appointments');
    }
    const nextAppointments = Array.isArray(payload) ? payload : [];
    setAllAppointments(nextAppointments);
    return nextAppointments;
  };

  const refreshAppointments = async (doctorId, dateValue) => {
    const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ''))
      ? String(dateValue)
      : getLocalDateString();
    const allAppts = await loadAllAppointments(doctorId);
    const filteredByDate = allAppts.filter((appt) => {
      const apptDate = String(appt.appointment_date || '').slice(0, 10);
      return apptDate === safeDate && ACTIVE_UPCOMING_STATUSES.has(getAppointmentStatus(appt));
    }).sort((a, b) => toAppointmentTimestamp(a) - toAppointmentTimestamp(b));
    setAppointments(filteredByDate);

    if (!filteredByDate.length) {
      return;
    }
  };

  useEffect(() => {
    const activeSession = getDentistPortalSession();
    if (!activeSession?.userId && !activeSession?.username) {
      return;
    }

    const load = async () => {
      const profileUrl = activeSession.userId
        ? `${API_BASE_URL}/api/dentist/profile?userId=${activeSession.userId}`
        : `${API_BASE_URL}/api/dentist/profile-by-username?username=${encodeURIComponent(activeSession.username || '')}`;
      const [profileRes] = await Promise.all([
        fetch(profileUrl)
      ]);
      const profilePayload = await profileRes.json().catch(() => ({}));
      if (!profileRes.ok) {
        throw new Error(profilePayload.error || 'Failed to load dentist profile');
      }
      setProfile(profilePayload);

      const resolvedDoctorId = activeSession.doctorId || profilePayload?.doctor_id;
      if (!resolvedDoctorId) {
        setMessage('Dentist account is missing a doctor profile mapping.');
        return;
      }

      const updatedSession = {
        ...activeSession,
        userId: activeSession.userId || profilePayload?.user_id || null,
        doctorId: resolvedDoctorId,
        staffId: activeSession.staffId || profilePayload?.staff_id || null,
        username: activeSession.username || profilePayload?.user_username || 'dentist',
        fullName: activeSession.fullName || [profilePayload?.first_name, profilePayload?.last_name].filter(Boolean).join(' ').trim() || 'Doctor'
      };
      setDentistPortalSession(updatedSession);
      setSession(updatedSession);
      await refreshAppointments(resolvedDoctorId, selectedDate);

      // Load approved schedule
      const staffId = updatedSession.staffId;
      if (staffId) {
        fetch(`${API_BASE_URL}/api/staff/schedules?staffId=${staffId}`)
          .then((r) => r.json().catch(() => []))
          .then((data) => setMySchedule(Array.isArray(data) ? data : []))
          .catch(() => {});
      }
    };

    load().catch((err) => {
      setMessage(err.message || 'Unable to load dentist page data.');
    });
  }, [API_BASE_URL]);

  useEffect(() => {
    if (!session?.doctorId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      refreshAppointments(session.doctorId, selectedDate)
        .catch((err) => setMessage(err.message || 'Unable to refresh appointments for selected date.'));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [session?.doctorId, selectedDate]);

  const welcomeName = profile?.first_name || session?.fullName || 'Doctor';
  const missingItems = [
    { key: 'email', label: 'Email address', value: profile?.user_email },
    { key: 'npi', label: 'NPI', value: profile?.npi },
    { key: 'phone', label: 'Phone number', value: profile?.phone_number },
    { key: 'date_of_birth', label: 'Date of birth', value: profile?.date_of_birth }
  ].filter((item) => !String(item.value || '').trim());

  const appointmentAttentionItems = appointments
    .filter((appt) => {
      const status = String(appt?.status_name || appt?.appointment_status || '').trim().toUpperCase();
      const isSkipped = status === 'NO_SHOW' || status === 'SKIPPED';
      const isUnconfirmed = status === 'SCHEDULED' || status === 'PENDING' || status === 'REQUESTED';
      return isSkipped || isUnconfirmed;
    })
    .map((appt) => ({
      key: appt.appointment_id,
      label: `${String(appt.appointment_time || '').slice(0, 5)} - ${appt.patient_name} (${appt.appointment_status || appt.status_name || 'Unconfirmed'})`
    }));

  const hasAttention = missingItems.length > 0 || appointmentAttentionItems.length > 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pastAppointments = allAppointments.filter((appt) => {
    return getAppointmentStatus(appt) === 'COMPLETED';
  }).sort((a, b) => {
    return toAppointmentTimestamp(b) - toAppointmentTimestamp(a);
  });

  const pastAppointmentDays = Array.from(new Set(
    pastAppointments
      .map((appt) => String(appt?.appointment_date || '').slice(0, 10))
      .filter((dateValue) => /^\d{4}-\d{2}-\d{2}$/.test(dateValue))
  )).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const activePastDate = selectedPastDate && pastAppointmentDays.includes(selectedPastDate)
    ? selectedPastDate
    : (pastAppointmentDays[0] || '');

  const activePastDateIndex = pastAppointmentDays.findIndex((dateValue) => dateValue === activePastDate);

  useEffect(() => {
    if (!pastAppointmentDays.length) {
      setSelectedPastDate('');
      return;
    }

    if (!selectedPastDate || !pastAppointmentDays.includes(selectedPastDate)) {
      setSelectedPastDate(pastAppointmentDays[0]);
    }
  }, [pastAppointmentDays, selectedPastDate]);

  const pastAppointmentsForActiveDay = activePastDate
    ? pastAppointments.filter((appt) => String(appt?.appointment_date || '').slice(0, 10) === activePastDate)
    : [];

  const canGoToOlderPastDay = activePastDateIndex >= 0 && activePastDateIndex < pastAppointmentDays.length - 1;
  const canGoToNewerPastDay = activePastDateIndex > 0;

  const goToOlderPastDay = () => {
    if (!canGoToOlderPastDay) return;
    setSelectedPastDate(pastAppointmentDays[activePastDateIndex + 1]);
  };

  const goToNewerPastDay = () => {
    if (!canGoToNewerPastDay) return;
    setSelectedPastDate(pastAppointmentDays[activePastDateIndex - 1]);
  };

  const handlePastDateChange = (value) => {
    if (!value) {
      setSelectedPastDate('');
      return;
    }

    if (pastAppointmentDays.includes(value)) {
      setSelectedPastDate(value);
      return;
    }

    const targetTs = new Date(`${value}T00:00:00`).getTime();
    if (!Number.isFinite(targetTs)) {
      return;
    }

    const nextBest = pastAppointmentDays.find((dateValue) => new Date(`${dateValue}T00:00:00`).getTime() <= targetTs)
      || pastAppointmentDays[pastAppointmentDays.length - 1]
      || '';
    setSelectedPastDate(nextBest);
  };

  useEffect(() => {
    const query = String(patientSearchTerm || '').trim();
    if (!query) {
      setSearchResultAppointments([]);
      setIsSearchLoading(false);
      return;
    }
    if (!session?.doctorId) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/dentist/patients/appointments/search?doctorId=${session.doctorId}&query=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to search patient appointments');
        }
        setSearchResultAppointments(Array.isArray(payload) ? payload : []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSearchResultAppointments([]);
          setMessage(err.message || 'Unable to search patient appointments.');
        }
      } finally {
        setIsSearchLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [API_BASE_URL, patientSearchTerm, session?.doctorId]);

  if (!sessionReady) {
    return (
      <main className="dentist-page">
        <section className="dentist-panel">
          <h1>Dentist Page</h1>
          <p className="dentist-subtle">No dentist session was found. Please sign in through Staff Login.</p>
          <button type="button" className="dentist-save-btn" onClick={() => navigate('/staff-login')}>Go to Staff Login</button>
        </section>
      </main>
    );
  }

  return (
    <main className="dentist-page">
      <section className="dentist-hero">
        <div>
          <p className="dentist-subtle">Dentist Workspace</p>
          <h1 className="dentist-welcome-row">
            <span>Welcome, Dr. {welcomeName}</span>
          </h1>
        </div>
        <div className="dentist-alert-wrap">
          <button
            type="button"
            className={`dentist-alert-pill ${hasAttention ? 'is-attention' : 'is-clear'}`}
            aria-label="Attention summary"
          >
            !
          </button>
          <div className="dentist-alert-popover" role="status" aria-live="polite">
            {hasAttention ? (
              <>
                {missingItems.length > 0 && (
                  <>
                    <p><strong>Profile Needs Update</strong></p>
                    <ul className="dentist-list">
                      {missingItems.map((item) => (
                        <li key={item.key}>Missing {item.label}</li>
                      ))}
                    </ul>
                  </>
                )}
                {appointmentAttentionItems.length > 0 && (
                  <>
                    <p><strong>Appointment Follow-up</strong></p>
                    <ul className="dentist-list">
                      {appointmentAttentionItems.map((item) => (
                        <li key={item.key}>{item.label}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : <p className="dentist-empty">No alerts at this time.</p>}
          </div>
        </div>
      </section>

      {mySchedule.length > 0 && (
        <section className="dentist-panel" style={{ marginBottom: '1rem' }}>
          <h2>My Schedule</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {mySchedule.map((s) => (
              <div key={s.schedule_id} style={{ background: s.is_off ? '#f5f5f5' : '#eefbfa', border: `1px solid ${s.is_off ? '#ddd' : '#d6e7e4'}`, borderRadius: '8px', padding: '0.5rem 1rem', minWidth: '120px' }}>
                <strong style={{ color: s.is_off ? '#999' : '#105550' }}>{s.day_of_week.charAt(0) + s.day_of_week.slice(1).toLowerCase()}</strong>
                <div style={{ fontSize: '0.85rem', color: s.is_off ? '#999' : '#444' }}>{s.is_off ? 'OFF' : `${String(s.start_time || '').slice(0, 5)} — ${String(s.end_time || '').slice(0, 5)}`}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="dentist-main-grid">
        <article className="dentist-panel dentist-appointments">
          <div className="dentist-detail-head">
            <h2>Upcoming Appointments</h2>
            <label className="dentist-date-filter">
              <span>Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
          </div>
          {!appointments.length ? (
            <p className="dentist-empty">No appointments found for the selected date.</p>
          ) : (
            <ul>
              {appointments.map((appt) => {
                const status = getAppointmentStatus(appt);
                const isCheckedIn = status === 'CHECKED_IN';
                return (
                  <li key={appt.appointment_id}>
                    <button
                      type="button"
                      className={`dentist-appointment-item${isCheckedIn ? '' : ' is-locked'}`}
                      disabled={!isCheckedIn}
                      title={isCheckedIn ? '' : 'Patient has not checked in yet'}
                      onClick={() => isCheckedIn && navigate(`/dentist/patient/${appt.appointment_id}`)}
                    >
                      <div>
                        <div>{appt.patient_name}</div>
                        <small>Patient ID: {appt.patient_id}</small>
                        {!isCheckedIn && <small className="dentist-lock-label">Not checked in</small>}
                      </div>
                      <div className="dentist-time">{String(appt.appointment_time || '').slice(0, 5)}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="dentist-panel dentist-search-section">
          <h2>Search Patient</h2>
          <input
            className="dentist-search-input"
            placeholder="Search by patient name, email, phone, or patient ID"
            value={patientSearchTerm}
            onChange={(event) => setPatientSearchTerm(event.target.value)}
          />
          {patientSearchTerm.trim() && searchResultAppointments.length > 0 ? (
            <ul className="dentist-search-results">
              {searchResultAppointments.map((appt) => (
                <li key={appt.appointment_id}>
                  <button
                    type="button"
                    onClick={() => {
                      const apptDate = String(appt.appointment_date || '').slice(0, 10);
                      setSelectedDate(apptDate);
                      if (Number(appt.doctor_id) === Number(session?.doctorId)) {
                        navigate(`/dentist/patient/${appt.appointment_id}`);
                      }
                    }}
                    className="dentist-search-result-item"
                  >
                    <div className="dentist-result-info">
                      <div className="dentist-result-name">{appt.patient_name}</div>
                      <div className="dentist-result-date">
                        {String(appt.appointment_date || '').slice(0, 10)} at {String(appt.appointment_time || '').slice(0, 5)}
                        {' '}| Dr. {appt.doctor_name || 'Unassigned'}
                        {' '}| {appt.appointment_status || appt.status_name || 'Unknown'}
                      </div>
                      {Number(appt.doctor_id) !== Number(session?.doctorId) && (
                        <div className="dentist-result-date">Read-only result (assigned to another dentist).</div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : patientSearchTerm.trim() && isSearchLoading ? (
            <p className="dentist-empty">Searching appointment history...</p>
          ) : patientSearchTerm.trim() ? (
            <p className="dentist-empty">No appointments found for this patient.</p>
          ) : null}
        </article>
      </section>

      <section className="dentist-past-section">
        <article className="dentist-panel">
          <div className="dentist-detail-head">
            <h2>Past Appointments</h2>
            <div className="dentist-past-controls">
              <button
                type="button"
                className="dentist-nav-btn"
                onClick={goToOlderPastDay}
                disabled={!canGoToOlderPastDay}
                title="Go to older day"
              >
                Prev
              </button>
              {canGoToNewerPastDay && (
                <button
                  type="button"
                  className="dentist-nav-btn"
                  onClick={goToNewerPastDay}
                  title="Go to newer day"
                >
                  Next
                </button>
              )}
              <label className="dentist-date-filter">
                <span>Jump to date</span>
                <input
                  type="date"
                  value={activePastDate || ''}
                  onChange={(event) => handlePastDateChange(event.target.value)}
                  min={pastAppointmentDays[pastAppointmentDays.length - 1] || undefined}
                  max={pastAppointmentDays[0] || undefined}
                />
              </label>
            </div>
          </div>
          {pastAppointmentsForActiveDay.length > 0 ? (
            <ul className="dentist-past-list">
              {pastAppointmentsForActiveDay.map((appt) => (
                <li key={appt.appointment_id} className="dentist-past-item">
                  <div className="dentist-past-date">{String(appt.appointment_date || '').slice(0, 10)}</div>
                  <div className="dentist-past-time">{String(appt.appointment_time || '').slice(0, 5) || 'N/A'}</div>
                  <div className="dentist-past-patient dentist-past-patient--inline">
                    <button
                      type="button"
                      className="dentist-past-patient-btn"
                      onClick={() => navigate(`/dentist/patient/${appt.appointment_id}`)}
                    >
                      {appt.patient_name}
                    </button>
                  </div>
                  <div className="dentist-past-id">Patient ID: {appt.patient_id}</div>
                  <div className="dentist-past-status">{appt.appointment_status || appt.status_name || 'Completed'}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dentist-empty">No past appointments for this date.</p>
          )}
        </article>
      </section>

      {message && <p className="dentist-save-msg">{message}</p>}
    </main>
  );
}

export default DentistLoginPage;
