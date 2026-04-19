import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  formatDate,
  formatMoney,
  formatTime,
  getPatientPortalSession,
  resolveApiBaseUrl
} from '../utils/patientPortal';
import '../styles/PatientPortalPage.css';

const ACTIVE_UPCOMING_STATUSES = new Set(['SCHEDULED', 'CONFIRMED', 'RESCHEDULED']);

const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const readJsonSafely = async (response, fallback) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return fallback;
  }

  try {
    return await response.json();
  } catch {
    return fallback;
  }
};

const toAppointmentTimestamp = (item) => {
  const datePart = String(item?.appointment_date || '').slice(0, 10);
  const timePart = String(item?.appointment_time || '').slice(0, 8) || '00:00:00';
  const value = new Date(`${datePart}T${timePart}`);
  return Number.isNaN(value.getTime()) ? -Infinity : value.getTime();
};

function PatientPortalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [appointmentRequests, setAppointmentRequests] = useState([]);
  const [primaryDentist, setPrimaryDentist] = useState(null);
  const [cancelState, setCancelState] = useState({ open: false, cancelNote: '', submitting: false });
  const [prescriptions, setPrescriptions] = useState([]);
  const [patientPharmacy, setPatientPharmacy] = useState([]);
  const [patientInsurance, setPatientInsurance] = useState([]);
  const [insuranceRequests, setInsuranceRequests] = useState([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState([]);
  const [allPharmacies, setAllPharmacies] = useState([]);
  const [insuranceChangeForm, setInsuranceChangeForm] = useState({ open: false, type: '', insuranceId: null, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' });
  const [isSubmittingInsurance, setIsSubmittingInsurance] = useState(false);
  const [insuranceMsg, setInsuranceMsg] = useState('');
  const [pharmacyChangeForm, setPharmacyChangeForm] = useState({ open: false, type: '', patientPharmacyId: null, pharmId: '', isPrimary: false, patientNote: '' });
  const [isSubmittingPharmacy, setIsSubmittingPharmacy] = useState(false);
  const [pharmacyMsg, setPharmacyMsg] = useState('');
  const [invoicePopupDismissed, setInvoicePopupDismissed] = useState(false);
  const [cancelledAppts, setCancelledAppts] = useState([]);
  const [dismissedCancelledIds, setDismissedCancelledIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('dismissedCancelledAppts') || '[]'));
    } catch { return new Set(); }
  });

  const scrollToSection = (sectionId) => {
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const session = useMemo(() => getPatientPortalSession(), []);
  const API_BASE_URL = resolveApiBaseUrl();

  useEffect(() => {
    if (!session?.patientId) {
      navigate('/patient-login');
      return;
    }

    const loadPortalData = async () => {
      setLoading(true);
      setError('');

      try {
        const [patientRes, appointmentsRes, invoicesRes, requestsRes, primaryDentistRes, rxRes, pharmRes, cancelledBySystemRes, insuranceRes, insuranceRequestsRes] = await Promise.all([
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/appointments`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/invoices`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/appointment-requests`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/primary-dentist`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/prescriptions`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/pharmacy`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/appointments/cancelled-by-system`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/insurance`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/insurance-change-requests`)
        ]);

        if (!patientRes.ok) {
          throw new Error('Unable to load patient profile.');
        }

        const [patientPayload, appointmentsPayload, invoicesPayload, requestsPayload, primaryDentistPayload, rxPayload, pharmPayload, cancelledBySystemPayload, insurancePayload, insuranceRequestsPayload] = await Promise.all([
          readJsonSafely(patientRes, null),
          appointmentsRes.ok ? readJsonSafely(appointmentsRes, []) : Promise.resolve([]),
          invoicesRes.ok ? readJsonSafely(invoicesRes, []) : Promise.resolve([]),
          requestsRes.ok ? readJsonSafely(requestsRes, []) : Promise.resolve([]),
          primaryDentistRes.ok ? readJsonSafely(primaryDentistRes, { assigned: false, dentist: null }) : Promise.resolve({ assigned: false, dentist: null }),
          rxRes.ok ? readJsonSafely(rxRes, []) : Promise.resolve([]),
          pharmRes.ok ? readJsonSafely(pharmRes, []) : Promise.resolve([]),
          cancelledBySystemRes.ok ? readJsonSafely(cancelledBySystemRes, []) : Promise.resolve([]),
          insuranceRes.ok ? readJsonSafely(insuranceRes, []) : Promise.resolve([]),
          insuranceRequestsRes.ok ? readJsonSafely(insuranceRequestsRes, []) : Promise.resolve([])
        ]);

        if (!patientPayload) {
          throw new Error('Unable to load patient profile.');
        }

        setPatient(patientPayload);
        setAppointments(Array.isArray(appointmentsPayload) ? appointmentsPayload : []);
        setInvoices(Array.isArray(invoicesPayload) ? invoicesPayload : []);
        setAppointmentRequests(Array.isArray(requestsPayload) ? requestsPayload : []);
        setPrimaryDentist(primaryDentistPayload?.dentist || null);
        setPrescriptions(Array.isArray(rxPayload) ? rxPayload : []);
        setPatientPharmacy(Array.isArray(pharmPayload) ? pharmPayload : []);
        setCancelledAppts(Array.isArray(cancelledBySystemPayload) ? cancelledBySystemPayload : []);
        setPatientInsurance(Array.isArray(insurancePayload) ? insurancePayload : []);
        setInsuranceRequests(Array.isArray(insuranceRequestsPayload) ? insuranceRequestsPayload : []);
      } catch (fetchError) {
        const isTimeout = fetchError?.name === 'AbortError';
        setError(isTimeout ? 'Portal request timed out. Please refresh and try again.' : (fetchError.message || 'Unable to load portal right now.'));
      } finally {
        setLoading(false);
      }
    };

    loadPortalData();
  }, [API_BASE_URL, navigate, session?.patientId]);

  const now = new Date();
  const upcomingAppointments = appointments.filter((item) => {
    if (!item?.appointment_date || !ACTIVE_UPCOMING_STATUSES.has(String(item.status_name || '').toUpperCase())) {
      return false;
    }
    const date = new Date(`${String(item.appointment_date).slice(0, 10)}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }).sort((a, b) => toAppointmentTimestamp(a) - toAppointmentTimestamp(b));

  const nextAppointment = upcomingAppointments[upcomingAppointments.length - 1] || null;

  const hasActiveRequest = appointmentRequests.some((request) => {
    const status = String(request?.request_status || '').toUpperCase();
    return status === 'PREFERRED_PENDING' || status === 'ASSIGNED';
  });

  const canCreateNewAppointment = !nextAppointment && !hasActiveRequest;

  const visibleRequests = appointmentRequests.filter((r) => {
    const status = String(r?.request_status || '').toUpperCase();
    return status === 'PREFERRED_PENDING';
  });

  const invoiceByAppointmentId = useMemo(() => {
    const mapped = new Map();
    (Array.isArray(invoices) ? invoices : []).forEach((inv) => {
      const apptId = Number(inv?.appointment_id || 0);
      if (apptId > 0) mapped.set(apptId, inv);
    });
    return mapped;
  }, [invoices]);

  const formattedAddress = [patient?.p_address, patient?.p_city, patient?.p_state, patient?.p_zipcode]
    .filter((part) => String(part || '').trim())
    .join(', ');

  useEffect(() => {
    if (!insuranceChangeForm.open || insuranceChangeForm.type === 'REMOVE') return;
    fetch(`${API_BASE_URL}/api/insurance-companies`)
      .then((res) => readJsonSafely(res, []))
      .then((data) => setInsuranceCompanies(Array.isArray(data) ? data : []))
      .catch(() => setInsuranceCompanies([]));
  }, [API_BASE_URL, insuranceChangeForm.open, insuranceChangeForm.type]);

  useEffect(() => {
    if (!pharmacyChangeForm.open || pharmacyChangeForm.type === 'REMOVE') return;
    fetch(`${API_BASE_URL}/api/pharmacies`)
      .then((res) => readJsonSafely(res, []))
      .then((data) => setAllPharmacies(Array.isArray(data) ? data : []))
      .catch(() => setAllPharmacies([]));
  }, [API_BASE_URL, pharmacyChangeForm.open, pharmacyChangeForm.type]);

  const submitInsuranceChange = async (event) => {
    event.preventDefault();
    setIsSubmittingInsurance(true);
    setInsuranceMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/insurance-change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeType: insuranceChangeForm.type,
          insuranceId: insuranceChangeForm.insuranceId,
          companyId: Number(insuranceChangeForm.companyId) || null,
          memberId: insuranceChangeForm.memberId,
          groupNumber: insuranceChangeForm.groupNumber,
          isPrimary: insuranceChangeForm.isPrimary,
          patientNote: insuranceChangeForm.patientNote
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to submit request');
      setInsuranceMsg('Request submitted. A receptionist will review it shortly.');
      setInsuranceChangeForm({ open: false, type: '', insuranceId: null, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' });
      const refreshedRequests = await fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/insurance-change-requests`);
      if (refreshedRequests.ok) {
        const refreshedPayload = await readJsonSafely(refreshedRequests, []);
        setInsuranceRequests(Array.isArray(refreshedPayload) ? refreshedPayload : []);
      }
    } catch (err) {
      setInsuranceMsg(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmittingInsurance(false);
    }
  };

  const submitPharmacyChange = async (event) => {
    event.preventDefault();
    setIsSubmittingPharmacy(true);
    setPharmacyMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/pharmacy-change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeType: pharmacyChangeForm.type,
          patientPharmacyId: pharmacyChangeForm.patientPharmacyId,
          pharmId: Number(pharmacyChangeForm.pharmId) || null,
          isPrimary: pharmacyChangeForm.isPrimary,
          patientNote: pharmacyChangeForm.patientNote
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to submit request');
      setPharmacyMsg('Request submitted. A receptionist will review it shortly.');
      setPharmacyChangeForm({ open: false, type: '', patientPharmacyId: null, pharmId: '', isPrimary: false, patientNote: '' });
    } catch (err) {
      setPharmacyMsg(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmittingPharmacy(false);
    }
  };

  const pastAppointments = appointments.filter((item) => {
    if (!item?.appointment_date) {
      return false;
    }
    return String(item.status_name || '').toUpperCase() === 'COMPLETED';
  }).sort((a, b) => toAppointmentTimestamp(b) - toAppointmentTimestamp(a));

  const handleCancelAppointment = async () => {
    if (!cancelState.cancelNote.trim() || !nextAppointment) return;
    setCancelState((prev) => ({ ...prev, submitting: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/appointments/${nextAppointment.appointment_id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelNote: cancelState.cancelNote.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to cancel appointment');
      setCancelState({ open: false, cancelNote: '', submitting: false });
      setError('');
      const [refreshRes, refreshReqRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/patients/${session.patientId}/appointments`),
        fetch(`${API_BASE_URL}/api/patients/${session.patientId}/appointment-requests`)
      ]);
      const refreshData = await refreshRes.json().catch(() => []);
      const refreshReqData = await refreshReqRes.json().catch(() => []);
      setAppointments(Array.isArray(refreshData) ? refreshData : []);
      setAppointmentRequests(Array.isArray(refreshReqData) ? refreshReqData : []);
    } catch (cancelError) {
      setError(cancelError.message || 'Failed to cancel appointment');
      setCancelState((prev) => ({ ...prev, submitting: false }));
    }
  };

  if (loading) {
    return <main className="patient-portal-page"><p className="portal-loading">Loading patient portal...</p></main>;
  }

  return (
    <main className="patient-portal-page">
      <section className="portal-header-card">
        <div>
          <p className="portal-label">Patient Portal</p>
          {patient && (
            <h2 style={{ margin: 0, fontWeight: 500, fontSize: '1.35rem', color: '#2a7b2a' }}>
              Welcome, {patient.p_first_name}!
            </h2>
          )}
          <h1>{patient ? `${patient.p_first_name} ${patient.p_last_name}` : 'Patient'}</h1>
          <p>{patient?.p_email || ''}</p>
        </div>
        <div className="portal-link-row">
          <Link to="/patient-portal/settings" className="portal-secondary-btn">My Profile &amp; Settings</Link>
          {canCreateNewAppointment ? (
            <Link to="/patient-portal/new-appointment" className="portal-primary-btn">New Appointment</Link>
          ) : (
            <span className="portal-primary-btn" style={{ opacity: 0.6, pointerEvents: 'none' }}>
              New Appointment Unavailable
            </span>
          )}
        </div>
      </section>

      {error && <p className="portal-error">{error}</p>}

      {cancelledAppts.filter(a => !dismissedCancelledIds.has(a.appointment_id)).length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: cancelledAppts.filter(a => !dismissedCancelledIds.has(a.appointment_id)).length > 0 && !invoicePopupDismissed && invoices.filter(inv => (inv.payment_status === 'Unpaid' || inv.payment_status === 'Partial') && Number(inv.amount_due) > 0).length > 0 ? '9rem' : '1.5rem',
          right: '1.5rem',
          zIndex: 999,
          width: '320px',
          background: '#2a1c1c',
          color: '#fff',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          padding: '1.1rem 1.2rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
        }}>
          {(() => {
              const visible = cancelledAppts.filter(a => !dismissedCancelledIds.has(a.appointment_id));
              const dismissAll = () => {
                const newIds = new Set([...dismissedCancelledIds, ...visible.map(a => a.appointment_id)]);
                setDismissedCancelledIds(newIds);
                try { localStorage.setItem('dismissedCancelledAppts', JSON.stringify([...newIds])); } catch {}
              };
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#ff8080', letterSpacing: '0.01em' }}>
                      {visible.length === 1 ? 'Appointment Cancelled' : `${visible.length} Appointments Cancelled`}
                    </p>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.1rem', lineHeight: 1, padding: 0, marginLeft: '0.5rem' }}
                      onClick={dismissAll}
                    >
                      &times;
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#f5c0c0', lineHeight: 1.4 }}>
                    {visible.length === 1
                      ? `Your appointment on ${new Date(visible[0].appointment_date).toLocaleDateString()} with ${visible[0].doctor_name} was cancelled due to doctor unavailability. Please reschedule.`
                      : `${visible.length} of your appointments were cancelled due to doctor unavailability. Please reschedule.`}
                  </p>
                  <Link
                    to="/patient-portal/new-appointment"
                    style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: '#ff9999', fontWeight: 600, textDecoration: 'none' }}
                    onClick={dismissAll}
                  >
                    Reschedule Now &rarr;
                  </Link>
                </>
              );
            })()}
        </div>
      )}

      {(() => {
        const unpaidInvoices = invoices.filter(
          (inv) => (inv.payment_status === 'Unpaid' || inv.payment_status === 'Partial') && Number(inv.amount_due) > 0
        );
        if (!unpaidInvoices.length || invoicePopupDismissed) return null;
        const multiple = unpaidInvoices.length > 1;
        return (
          <div
            style={{
              position: 'fixed',
              bottom: '1.5rem',
              right: '1.5rem',
              zIndex: 1000,
              width: '320px',
              background: '#1c2a28',
              color: '#fff',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
              padding: '1.1rem 1.2rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#f0c040', letterSpacing: '0.01em' }}>
                {multiple ? `${unpaidInvoices.length} Outstanding Invoices` : 'Outstanding Invoice'}
              </p>
              <button
                type="button"
                aria-label="Dismiss"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.1rem', lineHeight: 1, padding: 0, marginLeft: '0.5rem' }}
                onClick={() => setInvoicePopupDismissed(true)}
              >
                &times;
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#d4e8e4', lineHeight: 1.4 }}>
              {multiple
                ? `You have ${unpaidInvoices.length} outstanding invoices. Please review and pay your balance.`
                : 'You have an outstanding invoice. Please review and pay your balance.'}
            </p>
            <Link
              to={multiple ? '/patient-portal/invoices' : `/patient-portal/invoices/${unpaidInvoices[0].invoice_id}/checkout`}
              style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: '#5dd6b3', fontWeight: 600, textDecoration: 'none' }}
              onClick={() => setInvoicePopupDismissed(true)}
            >
              {multiple ? 'View All Invoices \u2192' : 'View Invoice \u2192'}
            </Link>
          </div>
        );
      })()}

      <section className="portal-grid">
        <article className="portal-card" id="next-appointment-section">
          <h2>Next Scheduled Appointment</h2>
          {nextAppointment ? (
            <>
              <p><strong>Date:</strong> {formatDate(nextAppointment.appointment_date)}</p>
              <p><strong>Time:</strong> {formatTime(nextAppointment.appointment_time)}</p>
              <p><strong>Status:</strong> {nextAppointment.appointment_status || 'Pending'}</p>
              <p><strong>Location:</strong> {nextAppointment.location_address || 'To be confirmed'}</p>
              {nextAppointment.status_name !== 'CANCELLED' && (
                <div style={{ marginTop: '0.75rem' }}>
                  {!cancelState.open ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                        type="button"
                        className="portal-link-btn"
                        onClick={() => navigate('/patient-portal/new-appointment', { state: { isReschedule: true, appointmentId: nextAppointment.appointment_id } })}
                        >
                        Reschedule
                        </button>
                        <button
                        type="button"
                        className="portal-link-btn"
                        style={{ color: '#a53030', borderColor: '#e8b4b4' }}
                        onClick={() => setCancelState({ open: true, reasonId: '', submitting: false })}
                        >
                        Cancel Appointment
                        </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea
                        value={cancelState.cancelNote}
                        onChange={(e) => setCancelState((prev) => ({ ...prev, cancelNote: e.target.value }))}
                        placeholder="Please tell us why you need to cancel..."
                        rows={3}
                        style={{ border: '1px solid #c7dcda', borderRadius: '0.5rem', padding: '0.5rem 0.6rem', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.95rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="portal-link-btn"
                          style={{ color: '#a53030', borderColor: '#e8b4b4' }}
                          disabled={!cancelState.cancelNote.trim() || cancelState.submitting}
                          onClick={handleCancelAppointment}
                        >
                          {cancelState.submitting ? 'Cancelling...' : 'Confirm Cancel'}
                        </button>
                        <button
                          type="button"
                          className="portal-link-btn"
                          onClick={() => setCancelState({ open: false, reasonId: '', submitting: false })}
                        >
                          Go Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p>No scheduled appointment yet.</p>
          )}
        </article>

        <article className="portal-card" id="primary-dentist-section">
          <h2>Primary Dentist</h2>
          {primaryDentist ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: '#e0eeec', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #c7dcda'
              }}>
                {primaryDentist.profile_image_base64 ? (
                  <img
                    src={`data:image/jpeg;base64,${primaryDentist.profile_image_base64}`}
                    alt={primaryDentist.doctor_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '1.6rem', color: '#6a8a87' }}>
                    {(primaryDentist.doctor_name || '').split(' ').map((n) => n[0]).join('')}
                  </span>
                )}
              </div>
              <div>
                <p style={{ margin: '0 0 0.15rem', fontWeight: 700, fontSize: '1.05rem' }}>{primaryDentist.doctor_name}</p>
                <p style={{ margin: '0.15rem 0', color: '#4b6966', fontSize: '0.88rem' }}>{primaryDentist.specialties}</p>
                {primaryDentist.doctor_phone && <p><strong>Phone:</strong> {primaryDentist.doctor_phone}</p>}
                {primaryDentist.doctor_city && <p><strong>Location:</strong> {primaryDentist.doctor_city}{primaryDentist.doctor_state ? `, ${primaryDentist.doctor_state}` : ''}</p>}
                <p><strong>Visits:</strong> {primaryDentist.visit_count}</p>
                <p><strong>Last Visit:</strong> {formatDate(primaryDentist.last_visit_date)}</p>
              </div>
            </div>
          ) : (
            <p>No primary dentist assigned yet.</p>
          )}
        </article>

        <article className="portal-card" id="billing-summary-section">
          <h2>Invoices Snapshot</h2>
          <p><strong>Total Invoices:</strong> {invoices.length}</p>
          <p><strong>Total Balance:</strong> {formatMoney(invoices.reduce((sum, item) => sum + Number(item.patient_amount || 0), 0))}</p>
          <div className="portal-link-row">
            <Link to="/patient-portal/invoices" className="portal-link-btn">Billing &amp; Invoices</Link>
          </div>
        </article>

        <article className="portal-card" id="contact-details-section">
          <h2>Contact Details</h2>
          <p><strong>Address:</strong> {formattedAddress || 'Not provided'}</p>
          <p><strong>Emergency Contact Number:</strong> {patient?.p_emergency_contact_phone || 'Not provided'}</p>
        </article>

      </section>

      {/* Pharmacy & Prescriptions */}
      <section className="portal-grid" style={{ gridTemplateColumns: '1fr' }}>
        <article className="portal-card" id="pharmacy-section">
          <h2>My Pharmacy</h2>
          {patientPharmacy.length > 0 ? patientPharmacy.map((ph) => (
            <div key={ph.pharm_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid #e4eeee' }}>
              <div>
                <p style={{ fontWeight: 700, margin: '0 0 0.2rem' }}>{ph.pharm_name}{ph.is_primary ? ' (Primary)' : ''}</p>
                <p style={{ margin: '0.1rem 0', color: '#4b6966' }}>{[ph.ph_address_1, ph.ph_city, ph.ph_state, ph.ph_zipcode].filter(Boolean).join(', ')}</p>
                {ph.pharm_phone && <p style={{ margin: '0.1rem 0' }}><strong>Phone:</strong> {ph.pharm_phone}</p>}
              </div>
              <button
                type="button"
                className="portal-link-btn"
                style={{ color: '#a53030', borderColor: '#e8b4b4', whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() => setPharmacyChangeForm({ open: true, type: 'REMOVE', patientPharmacyId: ph.patient_pharmacy_id, pharmId: '', isPrimary: false, patientNote: '' })}
              >
                Request Remove{ph.is_primary ? ' Primary' : ''} Pharmacy
              </button>
            </div>
          )) : (
            <p style={{ color: '#4b6966' }}>No pharmacy assigned. Contact the front desk to set one up.</p>
          )}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="portal-link-btn" onClick={() => setPharmacyChangeForm({ open: true, type: 'ADD', patientPharmacyId: null, pharmId: '', isPrimary: false, patientNote: '' })}>Request Pharmacy Add</button>
          </div>
          {pharmacyMsg && <p className="portal-note" style={{ color: pharmacyMsg.startsWith('Request submitted') ? '#1a7a6e' : '#a53030', marginTop: '0.75rem' }}>{pharmacyMsg}</p>}
          {pharmacyChangeForm.open && (
            <form onSubmit={submitPharmacyChange} style={{ marginTop: '1rem', border: '1px solid #d6e7e4', borderRadius: '12px', padding: '1rem', background: '#fbfefd', display: 'grid', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>{pharmacyChangeForm.type === 'ADD' ? 'Request New Pharmacy' : 'Request Pharmacy Removal'}</h3>
              {pharmacyChangeForm.type === 'ADD' ? (
                <>
                  <label className="portal-field">
                    <span>Pharmacy *</span>
                    <select value={pharmacyChangeForm.pharmId} onChange={(e) => setPharmacyChangeForm((prev) => ({ ...prev, pharmId: e.target.value }))} required>
                      <option value="">Select pharmacy</option>
                      {allPharmacies.map((ph) => (
                        <option key={ph.pharm_id} value={ph.pharm_id}>{ph.pharm_name} — {ph.ph_city}, {ph.ph_state}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={pharmacyChangeForm.isPrimary} onChange={(e) => setPharmacyChangeForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} />
                    Set as primary pharmacy
                  </label>
                </>
              ) : (
                <p style={{ margin: 0 }}>A receptionist will review and remove this pharmacy.</p>
              )}
              <label className="portal-field">
                <span>Note to receptionist</span>
                <textarea value={pharmacyChangeForm.patientNote} onChange={(e) => setPharmacyChangeForm((prev) => ({ ...prev, patientNote: e.target.value }))} rows={3} />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="portal-primary-btn" disabled={isSubmittingPharmacy}>{isSubmittingPharmacy ? 'Submitting...' : 'Submit Request'}</button>
                <button type="button" className="portal-secondary-btn" onClick={() => setPharmacyChangeForm({ open: false, type: '', patientPharmacyId: null, pharmId: '', isPrimary: false, patientNote: '' })}>Cancel</button>
              </div>
            </form>
          )}
        </article>

        <article className="portal-card" id="insurance-section">
          <h2>My Insurance</h2>
          {patientInsurance.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              {patientInsurance.map((insurance) => (
                <div key={insurance.insurance_id} style={{ border: '1px solid #d6e7e4', borderRadius: '10px', padding: '0.85rem 1rem', background: '#fbfefd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{insurance.company_name}{insurance.is_primary ? ' (Primary)' : ''}</p>
                      <p style={{ margin: '0.15rem 0', color: '#4b6966' }}>Member #{insurance.member_id}{insurance.group_number ? ` | Group: ${insurance.group_number}` : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="portal-link-btn"
                        onClick={() => setInsuranceChangeForm({ open: true, type: 'UPDATE', insuranceId: insurance.insurance_id, companyId: String(insurance.company_id || ''), memberId: insurance.member_id || '', groupNumber: insurance.group_number || '', isPrimary: !!insurance.is_primary, patientNote: '' })}
                      >
                        Request Update{insurance.is_primary ? ' Primary' : ''} Insurance
                      </button>
                      <button
                        type="button"
                        className="portal-link-btn"
                        style={{ color: '#a53030', borderColor: '#e8b4b4' }}
                        onClick={() => setInsuranceChangeForm({ open: true, type: 'REMOVE', insuranceId: insurance.insurance_id, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' })}
                      >
                        Request Remove Insurance
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#4b6966' }}>No insurance on file.</p>
          )}
          {insuranceRequests.length > 0 && (
            <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.7rem' }}>
              <h3 style={{ margin: '0.2rem 0 0' }}>Pending Insurance Requests</h3>
              {insuranceRequests.map((request) => (
                <div key={request.request_id} style={{ border: '1px solid #d6e7e4', borderRadius: '10px', padding: '0.85rem 1rem', background: '#fbfefd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{request.change_type} Insurance</p>
                      <p style={{ margin: '0.15rem 0', color: '#4b6966' }}>Company: {request.new_company_name || request.current_company_name || 'N/A'}</p>
                      <p style={{ margin: '0.15rem 0', color: '#4b6966' }}>Member #{request.member_id || request.current_member_id || 'N/A'}{request.group_number || request.current_group_number ? ` | Group: ${request.group_number || request.current_group_number}` : ''}</p>
                      {request.patient_note && <p style={{ margin: '0.15rem 0', color: '#4b6966' }}>Note: {request.patient_note}</p>}
                    </div>
                    <span style={{ alignSelf: 'flex-start', padding: '0.2rem 0.5rem', borderRadius: '999px', border: '1px solid #d0d8d8', color: '#4b6966', fontSize: '0.78rem', fontWeight: 700 }}>
                      {String(request.request_status || '').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="portal-link-btn" onClick={() => setInsuranceChangeForm({ open: true, type: 'ADD', insuranceId: null, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' })}>Request Insurance Add</button>
          </div>
          {insuranceMsg && <p className="portal-note" style={{ color: insuranceMsg.startsWith('Request submitted') ? '#1a7a6e' : '#a53030', marginTop: '0.75rem' }}>{insuranceMsg}</p>}
          {insuranceChangeForm.open && (
            <form onSubmit={submitInsuranceChange} style={{ marginTop: '1rem', border: '1px solid #d6e7e4', borderRadius: '12px', padding: '1rem', background: '#fbfefd', display: 'grid', gap: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>{insuranceChangeForm.type === 'ADD' ? 'Request New Insurance' : insuranceChangeForm.type === 'UPDATE' ? 'Request Insurance Update' : 'Request Insurance Removal'}</h3>
              {insuranceChangeForm.type === 'REMOVE' ? (
                <p style={{ margin: 0 }}>A receptionist will review and remove this insurance record.</p>
              ) : (
                <>
                  <label className="portal-field">
                    <span>Insurance Company *</span>
                    <select value={insuranceChangeForm.companyId} onChange={(e) => setInsuranceChangeForm((prev) => ({ ...prev, companyId: e.target.value }))} required>
                      <option value="">Select company</option>
                      {insuranceCompanies.map((company) => (
                        <option key={company.company_id} value={company.company_id}>{company.company_name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="portal-field">
                    <span>Member ID *</span>
                    <input type="text" value={insuranceChangeForm.memberId} onChange={(e) => setInsuranceChangeForm((prev) => ({ ...prev, memberId: e.target.value }))} required />
                  </label>
                  <label className="portal-field">
                    <span>Group Number</span>
                    <input type="text" value={insuranceChangeForm.groupNumber} onChange={(e) => setInsuranceChangeForm((prev) => ({ ...prev, groupNumber: e.target.value }))} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={insuranceChangeForm.isPrimary} onChange={(e) => setInsuranceChangeForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} />
                    Set as primary insurance
                  </label>
                </>
              )}
              <label className="portal-field">
                <span>Note to receptionist</span>
                <textarea value={insuranceChangeForm.patientNote} onChange={(e) => setInsuranceChangeForm((prev) => ({ ...prev, patientNote: e.target.value }))} rows={3} />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" className="portal-primary-btn" disabled={isSubmittingInsurance}>{isSubmittingInsurance ? 'Submitting...' : 'Submit Request'}</button>
                <button type="button" className="portal-secondary-btn" onClick={() => setInsuranceChangeForm({ open: false, type: '', insuranceId: null, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' })}>Cancel</button>
              </div>
            </form>
          )}
        </article>
      </section>

      <section className="portal-card">
        <h2>My Prescriptions</h2>
        {prescriptions.length === 0 ? (
          <p>No prescriptions on file.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {prescriptions.map((rx) => {
              const isExpired = rx.end_date && new Date(rx.end_date) < new Date();
              return (
                <div key={rx.prescription_id} style={{
                  border: '1px solid #d6e7e4',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  background: isExpired ? '#f9fafa' : '#fbfefd',
                  opacity: isExpired ? 0.6 : 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>
                        {rx.medication_name}
                        {rx.strength ? <span style={{ fontWeight: 400, color: '#4b6966' }}> ({rx.strength})</span> : ''}
                      </p>
                      <p style={{ margin: '0.2rem 0 0', color: '#4b6966', fontSize: '0.9rem' }}>
                        {rx.dosage ? `${rx.dosage} — ` : ''}{rx.frequency || 'As directed'}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#4b6966' }}>
                      <p style={{ margin: 0 }}>Prescribed by <strong>{rx.prescribing_doctor || 'N/A'}</strong></p>
                      <p style={{ margin: '0.1rem 0 0' }}>Pharmacy: {rx.pharmacy_name || 'N/A'}</p>
                    </div>
                  </div>

                  {rx.instructions && (
                    <p style={{ margin: '0.6rem 0 0', padding: '0.5rem 0.65rem', background: '#eef5f3', borderRadius: '6px', fontSize: '0.88rem', lineHeight: '1.45', color: '#1c2a28' }}>
                      {rx.instructions}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.85rem', color: '#4b6966' }}>
                    <span><strong>Start:</strong> {rx.start_date ? formatDate(rx.start_date) : '—'}</span>
                    <span>
                      <strong>Stop:</strong>{' '}
                      {rx.end_date ? (
                        <span style={isExpired ? { color: '#9d2e2e', fontWeight: 600 } : {}}>
                          {formatDate(rx.end_date)}{isExpired ? ' (ended)' : ''}
                        </span>
                      ) : 'Ongoing'}
                    </span>
                    <span><strong>Qty:</strong> {rx.quantity || '—'}</span>
                    <span><strong>Refills:</strong> {rx.refills ?? '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="portal-card">
        <div className="portal-row-between">
          <h2>Past Appointments and Visit Notes</h2>
        </div>

        {pastAppointments.length === 0 ? (
          <p>No past appointments yet.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Doctor</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Visit Notes</th>
                </tr>
              </thead>
              <tbody>
                {pastAppointments.map((item) => {
                  const inv = invoiceByAppointmentId.get(Number(item.appointment_id || 0));
                  const payStatus = inv?.payment_status || '';
                  const amtDue = Number(inv?.amount_due ?? (Number(inv?.patient_amount || 0) - Number(inv?.amount_paid || 0)));
                  const badgeBg = payStatus === 'Paid' ? '#d4edda' : payStatus === 'Partial' ? '#fff3cd' : payStatus === 'Refunded' ? '#fde8d8' : '#f8d7da';
                  const badgeColor = payStatus === 'Paid' ? '#155724' : payStatus === 'Partial' ? '#856404' : payStatus === 'Refunded' ? '#7a3b00' : '#721c24';
                  return (
                    <tr key={item.appointment_id}>
                      <td>{formatDate(item.appointment_date)}</td>
                      <td>{formatTime(item.appointment_time)}</td>
                      <td>{item.doctor_name || 'Pending assignment'}</td>
                      <td>{item.appointment_status || item.status_name || 'N/A'}</td>
                      <td>
                        {inv ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '999px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: badgeBg,
                            color: badgeColor
                          }}>
                            {payStatus}{payStatus !== 'Refunded' && amtDue > 0 ? ` — ${formatMoney(amtDue)}` : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{item.notes || 'No notes on file.'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-card">
        <div className="portal-row-between">
          <h2>My Appointment Requests</h2>
        </div>

        {visibleRequests.length === 0 ? (
          <p>No appointment requests submitted yet.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Preferred Date</th>
                  <th>Preferred Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRequests.map((request) => {
                  const canCancel = request.request_status === 'PREFERRED_PENDING';
                  return (
                    <tr key={request.preference_request_id}>
                      <td>{formatDate(request.created_at)}</td>
                      <td>{formatDate(request.preferred_date)}</td>
                      <td>{formatTime(request.preferred_time)}</td>
                      <td>{request.appointment_reason || 'N/A'}</td>
                      <td>{request.request_status || 'PREFERRED_PENDING'}</td>
                      <td>
                        {canCancel ? (
                          <button
                            type="button"
                            className="portal-secondary-btn"
                            style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                            onClick={async () => {
                              try {
                                const res = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/appointment-requests/${request.preference_request_id}/cancel`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({})
                                });
                                const payload = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(payload.error || 'Failed to cancel request');
                                const refreshRes = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/appointment-requests`);
                                const refreshData = await refreshRes.json().catch(() => []);
                                setAppointmentRequests(Array.isArray(refreshData) ? refreshData : []);
                              } catch (cancelErr) {
                                setError(cancelErr.message || 'Failed to cancel request');
                              }
                            }}
                          >
                            Cancel Request
                          </button>
                        ) : (
                          <span style={{ color: '#888' }}>N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default PatientPortalPage;
