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
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelState, setCancelState] = useState({ open: false, reasonId: '', submitting: false });
  const [prescriptions, setPrescriptions] = useState([]);
  const [patientPharmacy, setPatientPharmacy] = useState([]);
  const [invoicePopupDismissed, setInvoicePopupDismissed] = useState(false);
  const [cancelledAppts, setCancelledAppts] = useState([]);
  const [cancelledApptPopupDismissed, setCancelledApptPopupDismissed] = useState(false);

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
        const [patientRes, appointmentsRes, invoicesRes, requestsRes, primaryDentistRes, cancelReasonsRes, rxRes, pharmRes, cancelledBySystemRes] = await Promise.all([
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/appointments`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/invoices`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/appointment-requests`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/primary-dentist`),
          fetchWithTimeout(`${API_BASE_URL}/api/cancel-reasons`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/prescriptions`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/pharmacy`),
          fetchWithTimeout(`${API_BASE_URL}/api/patients/${session.patientId}/appointments/cancelled-by-system`)
        ]);

        if (!patientRes.ok) {
          throw new Error('Unable to load patient profile.');
        }

        const [patientPayload, appointmentsPayload, invoicesPayload, requestsPayload, primaryDentistPayload, cancelReasonsPayload, rxPayload, pharmPayload, cancelledBySystemPayload] = await Promise.all([
          patientRes.json(),
          appointmentsRes.ok ? appointmentsRes.json() : Promise.resolve([]),
          invoicesRes.ok ? invoicesRes.json() : Promise.resolve([]),
          requestsRes.ok ? requestsRes.json() : Promise.resolve([]),
          primaryDentistRes.ok ? primaryDentistRes.json() : Promise.resolve({ assigned: false, dentist: null }),
          cancelReasonsRes.ok ? cancelReasonsRes.json() : Promise.resolve([]),
          rxRes.ok ? rxRes.json() : Promise.resolve([]),
          pharmRes.ok ? pharmRes.json() : Promise.resolve([]),
          cancelledBySystemRes.ok ? cancelledBySystemRes.json() : Promise.resolve([])
        ]);

        setPatient(patientPayload);
        setAppointments(Array.isArray(appointmentsPayload) ? appointmentsPayload : []);
        setInvoices(Array.isArray(invoicesPayload) ? invoicesPayload : []);
        setAppointmentRequests(Array.isArray(requestsPayload) ? requestsPayload : []);
        setPrimaryDentist(primaryDentistPayload?.dentist || null);
        setCancelReasons(Array.isArray(cancelReasonsPayload) ? cancelReasonsPayload : []);
        setPrescriptions(Array.isArray(rxPayload) ? rxPayload : []);
        setPatientPharmacy(Array.isArray(pharmPayload) ? pharmPayload : []);
        setCancelledAppts(Array.isArray(cancelledBySystemPayload) ? cancelledBySystemPayload : []);
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
    return status !== 'COMPLETED' && status !== 'CANCELLED';
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

  const pastAppointments = appointments.filter((item) => {
    if (!item?.appointment_date) {
      return false;
    }
    return String(item.status_name || '').toUpperCase() === 'COMPLETED';
  }).sort((a, b) => toAppointmentTimestamp(b) - toAppointmentTimestamp(a));

  const handleCancelAppointment = async () => {
    if (!cancelState.reasonId || !nextAppointment) return;
    setCancelState((prev) => ({ ...prev, submitting: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/appointments/${nextAppointment.appointment_id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonId: Number(cancelState.reasonId) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to cancel appointment');
      setCancelState({ open: false, reasonId: '', submitting: false });
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

      {cancelledAppts.length > 0 && !cancelledApptPopupDismissed && (
        <div style={{
          position: 'fixed',
          bottom: cancelledAppts.length > 0 && !invoicePopupDismissed && invoices.filter(inv => (inv.payment_status === 'Unpaid' || inv.payment_status === 'Partial') && Number(inv.amount_due) > 0).length > 0 ? '9rem' : '1.5rem',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#ff8080', letterSpacing: '0.01em' }}>
              {cancelledAppts.length === 1 ? 'Appointment Cancelled' : `${cancelledAppts.length} Appointments Cancelled`}
            </p>
            <button
              type="button"
              aria-label="Dismiss"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.1rem', lineHeight: 1, padding: 0, marginLeft: '0.5rem' }}
              onClick={() => setCancelledApptPopupDismissed(true)}
            >
              &times;
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#f5c0c0', lineHeight: 1.4 }}>
            {cancelledAppts.length === 1
              ? `Your appointment on ${new Date(cancelledAppts[0].appointment_date).toLocaleDateString()} with ${cancelledAppts[0].doctor_name} was cancelled due to doctor unavailability. Please reschedule.`
              : `${cancelledAppts.length} of your appointments were cancelled due to doctor unavailability. Please reschedule.`}
          </p>
          <Link
            to="/patient-portal/new-appointment"
            style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: '#ff9999', fontWeight: 600, textDecoration: 'none' }}
            onClick={() => setCancelledApptPopupDismissed(true)}
          >
            Reschedule Now &rarr;
          </Link>
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
        <article className="portal-card">
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
                      <select
                        value={cancelState.reasonId}
                        onChange={(e) => setCancelState((prev) => ({ ...prev, reasonId: e.target.value }))}
                        style={{ border: '1px solid #c7dcda', borderRadius: '0.5rem', padding: '0.5rem 0.6rem' }}
                      >
                        <option value="">Select a reason</option>
                        {cancelReasons.map((r) => (
                          <option key={r.reason_id} value={r.reason_id}>{r.reason_text}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="portal-link-btn"
                          style={{ color: '#a53030', borderColor: '#e8b4b4' }}
                          disabled={!cancelState.reasonId || cancelState.submitting}
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

        <article className="portal-card">
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

        <article className="portal-card">
          <h2>Invoices Snapshot</h2>
          <p><strong>Total Invoices:</strong> {invoices.length}</p>
          <p><strong>Total Balance:</strong> {formatMoney(invoices.reduce((sum, item) => sum + Number(item.patient_amount || 0), 0))}</p>
          <div className="portal-link-row">
            <Link to="/patient-portal/invoices" className="portal-link-btn">Billing &amp; Invoices</Link>
          </div>
        </article>

        <article className="portal-card">
          <h2>Contact Details</h2>
          <p><strong>Address:</strong> {formattedAddress || 'Not provided'}</p>
          <p><strong>Emergency Contact Number:</strong> {patient?.p_emergency_contact_phone || 'Not provided'}</p>
        </article>

      </section>

      {/* Pharmacy & Prescriptions */}
      <section className="portal-grid" style={{ gridTemplateColumns: '1fr' }}>
        <article className="portal-card">
          <h2>My Pharmacy</h2>
          {patientPharmacy.length > 0 ? patientPharmacy.map((ph) => (
            <div key={ph.pharm_id} style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.5rem 0' }}>
              <div>
                <p style={{ fontWeight: 700, margin: '0 0 0.2rem' }}>{ph.pharm_name}{ph.is_primary ? ' (Primary)' : ''}</p>
                <p style={{ margin: '0.1rem 0', color: '#4b6966' }}>{[ph.ph_address_1, ph.ph_city, ph.ph_state, ph.ph_zipcode].filter(Boolean).join(', ')}</p>
                {ph.pharm_phone && <p style={{ margin: '0.1rem 0' }}><strong>Phone:</strong> {ph.pharm_phone}</p>}
              </div>
            </div>
          )) : (
            <p style={{ color: '#4b6966' }}>No pharmacy assigned. Contact the front desk to set one up.</p>
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
                            background: payStatus === 'Paid' ? '#d4edda' : payStatus === 'Partial' ? '#fff3cd' : '#f8d7da',
                            color: payStatus === 'Paid' ? '#155724' : payStatus === 'Partial' ? '#856404' : '#721c24'
                          }}>
                            {payStatus}{amtDue > 0 ? ` — ${formatMoney(amtDue)}` : ''}
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
                  const canCancel = request.request_status === 'PREFERRED_PENDING' || request.request_status === 'ASSIGNED';
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
