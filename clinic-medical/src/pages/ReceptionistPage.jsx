import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatTime, getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/ReceptionistPage.css';


function PatientSearch() {
  const navigate = useNavigate();
  const [patientQuery, setPatientQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const debounceRef = useRef(null);

  useEffect(() => {
    const query = String(patientQuery || '').trim();
    if (!query) {
      setPatientSearchResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/reception/patients/search?query=${encodeURIComponent(query)}`);
        const data = await response.json().catch(() => []);
        setPatientSearchResults(Array.isArray(data) ? data : []);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [patientQuery, API_BASE_URL]);

  const goToPatientProfile = (patientId) => {
    navigate(`/receptionist/patient-profile/${patientId}`);
  };

  return (
    <article className="reception-panel">
      <h2>Search Patient</h2>
      <input
        value={patientQuery}
        onChange={(e) => setPatientQuery(e.target.value)}
        placeholder="Search name, email, phone"
        className="reception-search-input"
      />
      {patientSearchResults.length > 0 && (
        <div className="reception-table-wrap" style={{ marginTop: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Date of Birth</th>
              </tr>
            </thead>
            <tbody>
              {patientSearchResults.map((patient) => (
                <tr key={patient.patient_id} className="reception-clickable-row" onClick={() => goToPatientProfile(patient.patient_id)}>
                  <td>{patient.patient_id}</td>
                  <td>{patient.p_first_name} {patient.p_last_name}</td>
                  <td>{patient.p_phone || 'N/A'}</td>
                  <td>{patient.p_email || 'N/A'}</td>
                  <td>{patient.p_dob ? formatDate(patient.p_dob) : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!isSearching && patientQuery.trim() && !patientSearchResults.length && (
        <p style={{ marginTop: '0.5rem', color: '#4b6966' }}>No patients found for this search.</p>
      )}
      {isSearching && <p style={{ marginTop: '0.5rem', color: '#4b6966' }}>Searching...</p>}
    </article>
  );
}

function ReceptionistPage() {
  const navigate = useNavigate();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = getReceptionPortalSession();

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const [requests, setRequests] = useState([]);
  const [allAppointmentsForDate, setAllAppointmentsForDate] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilters, setStatusFilters] = useState(new Set(['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN']));
  const [message, setMessage] = useState('');
const [mySchedule, setMySchedule] = useState([]);
  const [systemCancelledAppts, setSystemCancelledAppts] = useState([]);
  const [systemCancelledUnresolvedCount, setSystemCancelledUnresolvedCount] = useState(0);
  const [dismissFallbackDoctorToast, setDismissFallbackDoctorToast] = useState(false);
  const [dismissFallbackDoctorHiddenToast, setDismissFallbackDoctorHiddenToast] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('dismissedReceptionNotifications') || '[]'));
    } catch {
      return new Set();
    }
  });
  const [insuranceChangeRequests, setInsuranceChangeRequests] = useState([]);
  const [pharmacyChangeRequests, setPharmacyChangeRequests] = useState([]);
  const [dismissedRequestAlertIds, setDismissedRequestAlertIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('dismissedReceptionRequestAlerts') || '[]'));
    } catch {
      return new Set();
    }
  });

  const safeJson = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  };

  const loadAppointmentsForDate = async (date) => {
    const appointmentsData = await fetchWithTimeout(`${API_BASE_URL}/api/reception/appointments?date=${date}`).then(safeJson);
    setAllAppointmentsForDate(Array.isArray(appointmentsData) ? appointmentsData : []);
  };

  const loadCore = async () => {
    const [requestsData, scheduleData, notificationsData, insuranceChangeData, pharmacyChangeData, systemCancelledData] = await Promise.all([
      fetchWithTimeout(`${API_BASE_URL}/api/appointments/preference-requests`).then(safeJson),
      session?.staffId
        ? fetchWithTimeout(`${API_BASE_URL}/api/staff/schedules?staffId=${encodeURIComponent(session.staffId)}`).then(safeJson)
        : Promise.resolve([]),
      fetchWithTimeout(`${API_BASE_URL}/api/reception/notifications`).then(safeJson),
      fetchWithTimeout(`${API_BASE_URL}/api/reception/insurance-change-requests`).then(safeJson),
      fetchWithTimeout(`${API_BASE_URL}/api/reception/pharmacy-change-requests`).then(safeJson),
      fetchWithTimeout(`${API_BASE_URL}/api/admin/system-cancelled-appointments`).then(safeJson)
    ]);

    setRequests(Array.isArray(requestsData) ? requestsData : []);
    setMySchedule(Array.isArray(scheduleData) ? scheduleData : []);
    setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
    setInsuranceChangeRequests(Array.isArray(insuranceChangeData) ? insuranceChangeData : []);
    setPharmacyChangeRequests(Array.isArray(pharmacyChangeData) ? pharmacyChangeData : []);
    setSystemCancelledAppts(Array.isArray(systemCancelledData?.items) ? systemCancelledData.items : (Array.isArray(systemCancelledData) ? systemCancelledData : []));
    setSystemCancelledUnresolvedCount(Number(systemCancelledData?.unresolvedCount ?? (Array.isArray(systemCancelledData) ? systemCancelledData.length : 0)));
    await loadAppointmentsForDate(selectedDate);
  };

  const visibleNotifications = notifications.filter((notification) => !dismissedNotificationIds.has(notification.notification_id));
const doctorTimeOffNotification = visibleNotifications.find((notification) => notification.notification_type === 'DOCTOR_TIME_OFF') || null;
  const doctorTimeOffCancelledCount = systemCancelledAppts.filter((r) => r.cancelled_by === 'SYSTEM_TIME_OFF').length;
  const shouldShowFallbackDoctorToast = !doctorTimeOffNotification && !dismissFallbackDoctorToast && doctorTimeOffCancelledCount > 0;
  const fallbackDoctorTimeOffToast = shouldShowFallbackDoctorToast
    ? {
      notification_id: null,
      message: `${doctorTimeOffCancelledCount} appointment${doctorTimeOffCancelledCount === 1 ? '' : 's'} still need rescheduling after doctor time off cancellations.`
    }
    : null;
  const activeDoctorTimeOffToast = doctorTimeOffNotification || fallbackDoctorTimeOffToast;

  const doctorHiddenNotification = visibleNotifications.find((n) => n.notification_type === 'DOCTOR_HIDDEN') || null;
  const doctorHiddenCancelledCount = systemCancelledAppts.filter((r) => r.cancelled_by === 'SYSTEM_DOCTOR_HIDDEN').length;
  const shouldShowFallbackDoctorHiddenToast = !doctorHiddenNotification && !dismissFallbackDoctorHiddenToast && doctorHiddenCancelledCount > 0;
  const fallbackDoctorHiddenToast = shouldShowFallbackDoctorHiddenToast
    ? {
      notification_id: null,
      message: `${doctorHiddenCancelledCount} appointment${doctorHiddenCancelledCount === 1 ? '' : 's'} were cancelled due to doctor deletion and need rescheduling.`
    }
    : null;
  const activeDoctorHiddenToast = doctorHiddenNotification || fallbackDoctorHiddenToast;

  const requestAlerts = [
    ...(insuranceChangeRequests.length > 0 ? [{
      alertKey: `insurance:${insuranceChangeRequests[0].request_id}`,
      alertType: 'insurance',
      title: `${insuranceChangeRequests.length} Insurance Change Request${insuranceChangeRequests.length === 1 ? '' : 's'}`,
      request: insuranceChangeRequests[0],
      count: insuranceChangeRequests.length,
      sectionId: 'insurance-section'
    }] : []),
    ...(pharmacyChangeRequests.length > 0 ? [{
      alertKey: `pharmacy:${pharmacyChangeRequests[0].request_id}`,
      alertType: 'pharmacy',
      title: `${pharmacyChangeRequests.length} Pharmacy Change Request${pharmacyChangeRequests.length === 1 ? '' : 's'}`,
      request: pharmacyChangeRequests[0],
      count: pharmacyChangeRequests.length,
      sectionId: 'pharmacy-section'
    }] : [])
  ].filter((alert) => !dismissedRequestAlertIds.has(alert.alertKey));

  const dismissRequestAlert = (alertKey) => {
    setDismissedRequestAlertIds((prev) => {
      const next = new Set(prev);
      next.add(alertKey);
      try {
        localStorage.setItem('dismissedReceptionRequestAlerts', JSON.stringify([...next]));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  const openPatientProfileSection = (patientId, sectionId) => {
    navigate(`/receptionist/patient-profile/${patientId}#${sectionId}`);
  };

  const dismissNotification = (notificationId) => {
    setDismissedNotificationIds((prev) => {
      const next = new Set(prev);
      next.add(notificationId);
      try {
        localStorage.setItem('dismissedReceptionNotifications', JSON.stringify([...next]));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  };

  const shiftDate = (offset) => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const selectedDateLabel = (() => {
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate === today) return 'Today';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (selectedDate === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
    return formatDate(selectedDate);
  })();

  const ALL_STATUS_OPTIONS = ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED'];

  const toggleStatusFilter = (status) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const filteredAppointments = allAppointmentsForDate.filter((appt) => {
    const status = String(appt?.status_name || appt?.appointment_status || '').toUpperCase();
    return statusFilters.has(status);
  });

  const markNoShow = async (appointmentId) => {
    await fetchWithTimeout(`${API_BASE_URL}/api/reception/appointments/${appointmentId}/no-show`, {
      method: 'PUT',
    }).then(safeJson);

    setMessage('Appointment marked as no-show.');
    await loadAppointmentsForDate(selectedDate);
  };

  useEffect(() => {
    if (!session?.staffId) return;
    loadAppointmentsForDate(selectedDate).catch(() => {});
  }, [selectedDate]);

  useEffect(() => {
    if (!session?.staffId) {
      navigate('/staff-login');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadCore().catch((error) => {
        setMessage(error.message || 'Failed to load receptionist data');
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [API_BASE_URL, navigate, session?.staffId]);

  useEffect(() => {
    if (!session?.staffId) return undefined;

    const intervalId = window.setInterval(() => {
      loadCore().catch(() => {});
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [API_BASE_URL, session?.staffId]);

  useEffect(() => {
    setDismissFallbackDoctorToast(false);
  }, [systemCancelledUnresolvedCount]);

  const checkInPatient = async (appointmentId) => {
    await fetchWithTimeout(`${API_BASE_URL}/api/reception/appointments/${appointmentId}/check-in`, {
      method: 'PUT',
    }).then(safeJson);

    setMessage('Patient checked in.');
    await loadAppointmentsForDate(selectedDate);
  };

  const navigateToPatientProfile = (patientId) => {
    navigate(`/receptionist/patient-profile/${patientId}`);
  };


  return (
    <main className="reception-page">
      <section className="reception-header">
        <div>
          <h1>Receptionist Page</h1>
          <p>Manage appointment requests, check-in patients, and search for patients.</p>
        </div>
        <div className="reception-actions">
          <button className="reception-action-btn reception-action-btn--primary" onClick={() => navigate('/receptionist/register-patient')}>
            <span className="btn-icon">+</span> Register New Patient
          </button>
          <button
            className="reception-action-btn reception-action-btn--secondary"
            onClick={() => navigate('/receptionist/recall')}
          >
            Open Recall / Recare
          </button>
        </div>
      </section>

      {message && <p className="reception-message">{message}</p>}


      {mySchedule.length > 0 && (
        <section className="reception-panel" style={{ marginBottom: '1rem' }}>
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

      {(activeDoctorTimeOffToast || activeDoctorHiddenToast || requestAlerts.length > 0) && (
        <aside className="reception-request-alert-stack" aria-live="polite" aria-label="Notifications">
          {activeDoctorTimeOffToast && (
            <article className="reception-request-alert-card reception-request-alert-card--doctor-time-off">
              <div className="reception-request-alert-card__top">
                <div>
                  <p className="reception-request-alert-card__eyebrow">Doctor Time Off</p>
                  <h3>Doctor time off affected patient schedules</h3>
                </div>
                <button
                  type="button"
                  className="reception-request-alert-card__close"
                  aria-label="Dismiss doctor time off notification"
                  onClick={() => {
                    if (activeDoctorTimeOffToast.notification_id) {
                      dismissNotification(activeDoctorTimeOffToast.notification_id);
                      return;
                    }
                    setDismissFallbackDoctorToast(true);
                  }}
                >
                  &times;
                </button>
              </div>
              <p className="reception-request-alert-card__message">
                {activeDoctorTimeOffToast.message}
              </p>
              <button
                type="button"
                className="reception-request-alert-card__action"
                onClick={() => {
                  const target = document.getElementById('system-cancelled-appointments');
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                Review Cancellations &rarr;
              </button>
            </article>
          )}
          {activeDoctorHiddenToast && (
            <article className="reception-request-alert-card reception-request-alert-card--doctor-time-off">
              <div className="reception-request-alert-card__top">
                <div>
                  <p className="reception-request-alert-card__eyebrow">Doctor Deletion</p>
                  <h3>Doctor deletion affected patient schedules</h3>
                </div>
                <button
                  type="button"
                  className="reception-request-alert-card__close"
                  aria-label="Dismiss doctor deletion notification"
                  onClick={() => {
                    if (activeDoctorHiddenToast.notification_id) {
                      dismissNotification(activeDoctorHiddenToast.notification_id);
                      return;
                    }
                    setDismissFallbackDoctorHiddenToast(true);
                  }}
                >
                  &times;
                </button>
              </div>
              <p className="reception-request-alert-card__message">
                {activeDoctorHiddenToast.message}
              </p>
              <button
                type="button"
                className="reception-request-alert-card__action"
                onClick={() => {
                  const target = document.getElementById('system-cancelled-appointments');
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                Review Cancellations &rarr;
              </button>
            </article>
          )}
          {requestAlerts.map((alert) => (
            <article
              key={alert.alertKey}
              className={`reception-request-alert-card reception-request-alert-card--${alert.alertType}`}
            >
              <div className="reception-request-alert-card__top">
                <div>
                  <p className="reception-request-alert-card__eyebrow">Reception Alert</p>
                  <h3>{alert.title}</h3>
                </div>
                <button
                  type="button"
                  className="reception-request-alert-card__close"
                  aria-label="Dismiss request alert"
                  onClick={() => dismissRequestAlert(alert.alertKey)}
                >
                  &times;
                </button>
              </div>
              <p className="reception-request-alert-card__patient"><strong>{alert.request.patient_name}</strong></p>
              <p className="reception-request-alert-card__message">
                {alert.alertType === 'pharmacy'
                  ? `${alert.request.change_type} pharmacy request ready for review.`
                  : `${alert.request.change_type} insurance request ready for review.`}
              </p>
              <button
                type="button"
                className="reception-request-alert-card__action"
                onClick={() => {
                  openPatientProfileSection(alert.request.patient_id, alert.sectionId);
                }}
              >
                Open Patient Profile
              </button>
            </article>
          ))}
        </aside>
      )}

      <PatientSearch />

      <section className="reception-panel">
        <h2>Appointment Requests</h2>
        <div className="reception-table-wrap reception-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Requested Date/Time</th>
                <th>Preferred Location</th>
                <th>Reason</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.preference_request_id} className="reception-clickable-row">
                  <td onClick={() => navigateToPatientProfile(request.patient_id)}>
                    {request.p_first_name} {request.p_last_name}
                  </td>
                  <td onClick={() => navigateToPatientProfile(request.patient_id)}>
                    {formatDate(request.preferred_date)} {formatTime(request.preferred_time)}
                  </td>
                  <td onClick={() => navigateToPatientProfile(request.patient_id)}>{request.preferred_location || 'N/A'}</td>
                  <td onClick={() => navigateToPatientProfile(request.patient_id)}>{request.appointment_reason || 'N/A'}</td>
                  <td>
                    <button
                      type="button"
                      title="Cancel this request"
                      style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', padding: '0.2rem 0.5rem' }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm(`Cancel appointment request for ${request.p_first_name} ${request.p_last_name}?`)) return;
                        try {
                          const cancelRes = await fetch(`${API_BASE_URL}/api/appointments/preference-requests/${request.preference_request_id}/cancel`, { method: 'PUT' });
                          const payload = await cancelRes.json().catch(() => ({}));
                          if (!cancelRes.ok) throw new Error(payload.error || 'Failed to cancel');
                          setMessage('Appointment request cancelled.');
                          const freshRequests = await fetchWithTimeout(`${API_BASE_URL}/api/appointments/preference-requests`).then(safeJson);
                          setRequests(Array.isArray(freshRequests) ? freshRequests : []);
                        } catch (err) {
                          setMessage(err.message || 'Failed to cancel request.');
                        }
                      }}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan="5">No appointment requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      {insuranceChangeRequests.length > 0 && (
        <section className="reception-panel" id="insurance-change-requests">
          <h2>Insurance Change Requests</h2>
          <div className="reception-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Type</th>
                  <th>Company</th>
                  <th>Member ID</th>
                  <th>Group</th>
                  <th>Primary</th>
                  <th>Note</th>
                  <th>Requested</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {insuranceChangeRequests.map((req) => (
                  <tr key={req.request_id}>
                    <td style={{ cursor: 'pointer', color: '#0f6965', fontWeight: 600 }} onClick={() => navigateToPatientProfile(req.patient_id)}>{req.patient_name}</td>
                    <td>{req.change_type}</td>
                    <td>{req.change_type === 'REMOVE' ? <span style={{ color: '#999' }}>{req.current_company_name || '—'}</span> : (req.new_company_name || '—')}</td>
                    <td>{req.change_type !== 'REMOVE' ? (req.member_id || '—') : <span style={{ color: '#999' }}>{req.current_member_id || '—'}</span>}</td>
                    <td>{req.change_type !== 'REMOVE' ? (req.group_number || '—') : <span style={{ color: '#999' }}>{req.current_group_number || '—'}</span>}</td>
                    <td>{req.change_type !== 'REMOVE' ? (req.is_primary ? 'Yes' : 'No') : '—'}</td>
                    <td style={{ maxWidth: '160px', fontSize: '0.8rem', color: '#555' }}>{req.patient_note || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#777' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={async () => {
                          try {
                            await fetchWithTimeout(`${API_BASE_URL}/api/reception/insurance-change-requests/${req.request_id}/approved`, { method: 'PUT' }).then(safeJson);
                            setMessage('Insurance change approved.');
                            const fresh = await fetchWithTimeout(`${API_BASE_URL}/api/reception/insurance-change-requests`).then(safeJson);
                            setInsuranceChangeRequests(Array.isArray(fresh) ? fresh : []);
                          } catch (err) { setMessage(err.message || 'Failed to approve.'); }
                        }}>Approve</button>
                      <button type="button" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'none', border: '1px solid #c0392b', color: '#c0392b', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={async () => {
                          try {
                            await fetchWithTimeout(`${API_BASE_URL}/api/reception/insurance-change-requests/${req.request_id}/denied`, { method: 'PUT' }).then(safeJson);
                            setMessage('Insurance change denied.');
                            const fresh = await fetchWithTimeout(`${API_BASE_URL}/api/reception/insurance-change-requests`).then(safeJson);
                            setInsuranceChangeRequests(Array.isArray(fresh) ? fresh : []);
                          } catch (err) { setMessage(err.message || 'Failed to deny.'); }
                        }}>Deny</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pharmacyChangeRequests.length > 0 && (
        <section className="reception-panel" id="pharmacy-change-requests">
          <h2>Pharmacy Change Requests</h2>
          <div className="reception-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Type</th>
                  <th>Pharmacy</th>
                  <th>Primary</th>
                  <th>Note</th>
                  <th>Requested</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pharmacyChangeRequests.map((req) => (
                  <tr key={req.request_id}>
                    <td style={{ cursor: 'pointer', color: '#0f6965', fontWeight: 600 }} onClick={() => navigateToPatientProfile(req.patient_id)}>{req.patient_name}</td>
                    <td>{req.change_type}</td>
                    <td>{req.change_type === 'REMOVE' ? <span style={{ color: '#999' }}>{req.current_pharm_name || '—'}</span> : `${req.new_pharm_name || '—'}${req.new_pharm_city ? ` (${req.new_pharm_city}, ${req.new_pharm_state})` : ''}`}</td>
                    <td>{req.change_type === 'ADD' ? (req.is_primary ? 'Yes' : 'No') : '—'}</td>
                    <td style={{ maxWidth: '160px', fontSize: '0.8rem', color: '#555' }}>{req.patient_note || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#777' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                      <button type="button" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={async () => {
                          try {
                            await fetchWithTimeout(`${API_BASE_URL}/api/reception/pharmacy-change-requests/${req.request_id}/approved`, { method: 'PUT' }).then(safeJson);
                            setMessage('Pharmacy change approved.');
                            const fresh = await fetchWithTimeout(`${API_BASE_URL}/api/reception/pharmacy-change-requests`).then(safeJson);
                            setPharmacyChangeRequests(Array.isArray(fresh) ? fresh : []);
                          } catch (err) { setMessage(err.message || 'Failed to approve.'); }
                        }}>Approve</button>
                      <button type="button" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: 'none', border: '1px solid #c0392b', color: '#c0392b', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={async () => {
                          try {
                            await fetchWithTimeout(`${API_BASE_URL}/api/reception/pharmacy-change-requests/${req.request_id}/denied`, { method: 'PUT' }).then(safeJson);
                            setMessage('Pharmacy change denied.');
                            const fresh = await fetchWithTimeout(`${API_BASE_URL}/api/reception/pharmacy-change-requests`).then(safeJson);
                            setPharmacyChangeRequests(Array.isArray(fresh) ? fresh : []);
                          } catch (err) { setMessage(err.message || 'Failed to deny.'); }
                        }}>Deny</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="reception-panel">
        <div className="reception-date-nav">
          <h2>Appointments — {selectedDateLabel}</h2>
          <div className="reception-date-controls">
            <button type="button" className="reception-nav-btn" onClick={() => shiftDate(-1)}> Prev</button>
            <button type="button" className="reception-nav-btn" onClick={() => shiftDate(1)}>Next </button>
            <label className="reception-jump-date">
              <span>Jump to date</span>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="reception-status-filters">
          {ALL_STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={`reception-filter-chip ${statusFilters.has(status) ? 'is-active' : ''}`}
              onClick={() => toggleStatusFilter(status)}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="reception-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Dentist</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appointment) => {
                const status = String(appointment.status_name || appointment.appointment_status || '').toUpperCase();
                const canCheckIn = status === 'SCHEDULED' || status === 'CONFIRMED' || status === 'RESCHEDULED';
                const canMarkNoShow = status !== 'NO_SHOW' && status !== 'CANCELLED' && status !== 'COMPLETED';
                return (
                  <tr key={appointment.appointment_id} className="reception-clickable-row" onClick={() => navigateToPatientProfile(appointment.patient_id)}>
                    <td>{formatTime(appointment.appointment_time)}</td>
                    <td>{appointment.patient_name}</td>
                    <td>{appointment.doctor_name}</td>
                    <td>{appointment.appointment_status || appointment.status_name}</td>
                    <td className="reception-action-cell" onClick={(e) => e.stopPropagation()}>
                      {canCheckIn && (
                        <button type="button" onClick={() => checkInPatient(appointment.appointment_id)}>
                          Check In
                        </button>
                      )}
                      {canMarkNoShow && (
                        <button type="button" className="reception-noshow-btn" onClick={() => markNoShow(appointment.appointment_id)}>
                          No Show
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredAppointments.length && (
                <tr>
                  <td colSpan="5">No appointments match the selected filters for this date.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>


      {systemCancelledAppts.length > 0 && (
        <section className="reception-section" id="system-cancelled-appointments">
          <h2 style={{ color: '#a53030', marginBottom: '0.75rem' }}>Appointments Cancelled by System — Patients Need to Reschedule</h2>
          <p style={{ color: '#666', fontSize: '0.88rem', marginBottom: '1rem' }}>
            The following appointments were automatically cancelled by the system in the last 30 days. Contact these patients to help them reschedule.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="reception-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Patient</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Phone</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Cancelled Appt Date</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Doctor</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Reason</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Cancelled At</th>
                </tr>
              </thead>
              <tbody>
                {systemCancelledAppts.map((row) => (
                  <tr
                    key={row.appointment_id}
                    className="reception-clickable-row"
                    style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                    onClick={() => navigateToPatientProfile(row.patient_id)}
                  >
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#0f6965' }}>{row.patient_name}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{row.p_email}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{row.p_phone}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{formatDate(row.appointment_date)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{formatTime(row.appointment_time)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{row.doctor_name}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {row.cancelled_by === 'SYSTEM_DOCTOR_HIDDEN'
                        ? <span style={{ color: '#a53030', fontWeight: 600, fontSize: '0.82rem' }}>Doctor Deleted</span>
                        : <span style={{ color: '#7a5c00', fontWeight: 600, fontSize: '0.82rem' }}>Doctor Time Off</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: '#888', fontSize: '0.82rem' }}>{formatDate(row.cancelled_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export default ReceptionistPage;
