import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDentistPortalSession, resolveApiBaseUrl, setDentistPortalSession } from '../utils/patientPortal';
import '../styles/DentistDashboardPage.css';

function DentistLoginPage() {
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getDentistPortalSession());
  const [profile, setProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [appointmentDetail, setAppointmentDetail] = useState(null);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [treatmentSearchTerm, setTreatmentSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [allAppointments, setAllAppointments] = useState([]);
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
      : new Date().toISOString().slice(0, 10);
    const allAppts = await loadAllAppointments(doctorId);
    const filteredByDate = allAppts.filter((appt) => {
      const apptDate = String(appt.appointment_date || '').slice(0, 10);
      return apptDate === safeDate;
    });
    setAppointments(filteredByDate);

    if (!filteredByDate.length) {
      setSelectedAppointmentId(null);
      setAppointmentDetail(null);
      return;
    }

    const hasCurrentSelection = filteredByDate.some((appt) => appt.appointment_id === selectedAppointmentId);
    if (!hasCurrentSelection) {
      setSelectedAppointmentId(filteredByDate[0].appointment_id);
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

  useEffect(() => {
    if (!session?.doctorId || !selectedAppointmentId) {
      return;
    }

    fetch(`${API_BASE_URL}/api/dentist/appointments/${selectedAppointmentId}?doctorId=${session.doctorId}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || 'Failed to load appointment detail');
        }
        return payload;
      })
      .then((payload) => {
        setAppointmentDetail(payload);
        setMessage('');
      })
      .catch((err) => {
        setMessage(err.message || 'Failed to load patient profile.');
      });
  }, [API_BASE_URL, session?.doctorId, selectedAppointmentId]);

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
    const apptDate = new Date(String(appt.appointment_date || ''));
    apptDate.setHours(0, 0, 0, 0);
    return apptDate.getTime() < today.getTime();
  }).sort((a, b) => {
    const dateA = new Date(String(b.appointment_date || ''));
    const dateB = new Date(String(a.appointment_date || ''));
    return dateA.getTime() - dateB.getTime();
  });

  const filteredAppointments = appointments.filter((appt) => {
    if (!patientSearchTerm.trim()) {
      return true;
    }
    return String(appt.patient_name || '').toLowerCase().includes(patientSearchTerm.trim().toLowerCase());
  });

  const searchResultAppointments = allAppointments.filter((appt) => {
    if (!patientSearchTerm.trim()) {
      return false;
    }
    return String(appt.patient_name || '').toLowerCase().includes(patientSearchTerm.trim().toLowerCase());
  });

  const filteredTreatmentPlans = (appointmentDetail?.treatmentPlans || []).filter((item) => {
    if (!treatmentSearchTerm.trim()) {
      return true;
    }
    const haystack = [item.procedure_code, item.tooth_number, item.notes, item.status_name]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');
    return haystack.includes(treatmentSearchTerm.trim().toLowerCase());
  });

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
          {!filteredAppointments.length ? (
            <p className="dentist-empty">No appointments found for the selected date.</p>
          ) : (
            <ul>
              {filteredAppointments.map((appt) => {
                const isActive = selectedAppointmentId === appt.appointment_id;
                const detailProfile = isActive ? appointmentDetail?.patientProfile : null;

                return (
                  <li key={appt.appointment_id}>
                    <button
                      type="button"
                      className={`dentist-appointment-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => setSelectedAppointmentId(appt.appointment_id)}
                    >
                      <div className="dentist-time">{String(appt.appointment_time || '').slice(0, 5)}</div>
                      <div>{appt.patient_name}</div>
                      <small>{appt.appointment_status || appt.status_name || 'Scheduled'}</small>
                      {isActive && detailProfile && (
                        <div className="dentist-inline-profile">
                          <p><strong>DOB:</strong> {String(detailProfile.date_of_birth || '').slice(0, 10) || 'N/A'}</p>
                          <p><strong>Gender:</strong> {detailProfile.gender || 'N/A'}</p>
                          <p><strong>Phone:</strong> {detailProfile.phone || 'N/A'}</p>
                          <p><strong>Email:</strong> {detailProfile.email || 'N/A'}</p>
                          <p><strong>Address:</strong> {[detailProfile.address, detailProfile.city, detailProfile.state, detailProfile.zipcode].filter(Boolean).join(', ') || 'N/A'}</p>
                          <p><strong>Emergency Contact:</strong> {detailProfile.emergency_contact_name || 'N/A'} ({detailProfile.emergency_contact_phone || 'N/A'})</p>
                          <div className="dentist-past-treatment-head">
                            <strong>Past Treatments</strong>
                            <input
                              className="dentist-search-input"
                              placeholder="Search past treatments"
                              value={treatmentSearchTerm}
                              onChange={(event) => setTreatmentSearchTerm(event.target.value)}
                            />
                          </div>
                          <ul className="dentist-list">
                            {filteredTreatmentPlans.map((item) => (
                              <li key={item.plan_id}>
                                {item.procedure_code || 'N/A'} | Tooth {item.tooth_number || 'N/A'} | {item.status_name || 'N/A'}
                              </li>
                            ))}
                            {!filteredTreatmentPlans.length && <li>No matching treatment entries.</li>}
                          </ul>
                        </div>
                      )}
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
            placeholder="Search by patient name"
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
                      setSelectedAppointmentId(appt.appointment_id);
                      const apptDate = String(appt.appointment_date || '').slice(0, 10);
                      setSelectedDate(apptDate);
                    }}
                    className="dentist-search-result-item"
                  >
                    <div className="dentist-result-info">
                      <div className="dentist-result-name">{appt.patient_name}</div>
                      <div className="dentist-result-date">{String(appt.appointment_date || '').slice(0, 10)} at {String(appt.appointment_time || '').slice(0, 5)}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : patientSearchTerm.trim() ? (
            <p className="dentist-empty">No appointments found for this patient.</p>
          ) : null}
        </article>
      </section>

      <section className="dentist-past-section">
        <article className="dentist-panel">
          <h2>Past Appointments</h2>
          {pastAppointments.length > 0 ? (
            <ul className="dentist-past-list">
              {pastAppointments.slice(0, 5).map((appt) => (
                <li key={appt.appointment_id} className="dentist-past-item">
                  <div className="dentist-past-date">{String(appt.appointment_date || '').slice(0, 10)}</div>
                  <div className="dentist-past-patient">{appt.patient_name}</div>
                  <div className="dentist-past-status">{appt.appointment_status || appt.status_name || 'Completed'}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dentist-empty">No past appointments.</p>
          )}
        </article>
      </section>
      {message && <p className="dentist-save-msg">{message}</p>}
    </main>
  );
}

export default DentistLoginPage;
