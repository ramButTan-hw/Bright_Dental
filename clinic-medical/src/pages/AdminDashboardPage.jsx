import { useEffect, useMemo, useState } from 'react';
import {
  formatDate,
  formatMoney,
  formatTime,
  resolveApiBaseUrl
} from '../utils/patientPortal';
import '../styles/AdminDashboardPage.css';

const EMPTY_STAFF_FORM = {
  firstName: '',
  lastName: '',
  dob: '',
  npi: '',
  ssn: '',
  gender: '',
  phone: '',
  username: '',
  password: '',
  email: '',
  locationId: ''
};

const formatSsnInput = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

const formatPhoneInput = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

function AdminDashboardPage() {
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeSection, setActiveSection] = useState('overview');
  const [reportStatus, setReportStatus] = useState('ALL');
  const [reportType, setReportType] = useState('patients');
  const [staffReport, setStaffReport] = useState({ workload: [], schedule: [], timeOff: [] });
  const [reportDateFrom, setReportDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [reportDateTo, setReportDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState({ scheduledAppointments: [], pendingRequests: [], notificationCount: 0 });

  const [patientReport, setPatientReport] = useState({ summary: null, rows: [] });
  const [doctors, setDoctors] = useState([]);

  const [receptionists, setReceptionists] = useState([]);
  const [locations, setLocations] = useState([]);
  const [staffTimeOffRequests, setStaffTimeOffRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const reportStatusOptions = ['ALL', 'SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELED', 'NO_SHOW'];

  const [doctorForm, setDoctorForm] = useState({ ...EMPTY_STAFF_FORM });

  const [receptionistForm, setReceptionistForm] = useState({ ...EMPTY_STAFF_FORM });
  const [expandedCards, setExpandedCards] = useState({
    dentist: false,
    location: false,

    receptionist: false,
    offDayRequests: false
  });

  const [locationForm, setLocationForm] = useState({
    city: '',
    state: '',
    streetNo: '',
    streetName: '',
    zipCode: ''
  });

  const safeJson = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  };

  const loadAdminData = async () => {
    setLoading(true);
    setError('');

    try {
      const [summaryData, queueData, reportData, doctorData, receptionistData, locationData, timeOffData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/dashboard/summary?date=${selectedDate}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/appointments/queue?date=${selectedDate}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/reports/patients?date=${selectedDate}${reportStatus === 'ALL' ? '' : `&status=${reportStatus}`}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/doctors`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff/receptionists`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/locations`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff/time-off-requests`).then(safeJson)
      ]);

      setSummary(summaryData);
      setQueue(queueData);
      setPatientReport(reportData);
      setDoctors(Array.isArray(doctorData) ? doctorData : []);
      setReceptionists(Array.isArray(receptionistData) ? receptionistData : []);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setStaffTimeOffRequests(Array.isArray(timeOffData) ? timeOffData : []);
    } catch (err) {
      setError(err.message || 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffReport = async () => {
    try {
      const data = await fetch(
        `${API_BASE_URL}/api/admin/reports/staff?dateFrom=${reportDateFrom}&dateTo=${reportDateTo}`
      ).then(safeJson);
      setStaffReport({
        workload: Array.isArray(data.workload) ? data.workload : [],
        schedule: Array.isArray(data.schedule) ? data.schedule : [],
        timeOff: Array.isArray(data.timeOff) ? data.timeOff : []
      });
    } catch (err) {
      setError(err.message || 'Unable to load staff report.');
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [selectedDate, reportStatus]);

  useEffect(() => {
    if (reportType === 'staff') {
      loadStaffReport();
    }
  }, [reportType, reportDateFrom, reportDateTo]);

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    setActionMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...doctorForm,
          locationId: doctorForm.locationId ? Number(doctorForm.locationId) : null,
          gender: doctorForm.gender ? Number(doctorForm.gender) : null
        })
      });

      await safeJson(response);
      setDoctorForm({ ...EMPTY_STAFF_FORM });
      setActionMessage('Doctor added successfully.');
      loadAdminData();
    } catch (err) {
      setActionMessage(err.message || 'Failed to add doctor.');
    }
  };

  const handleRoleStaffSubmit = async (e, rolePath, roleLabel, formState, setFormState) => {
    e.preventDefault();
    setActionMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/staff/${rolePath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formState,
          locationId: formState.locationId ? Number(formState.locationId) : null,
          gender: formState.gender ? Number(formState.gender) : null
        })
      });

      await safeJson(response);
      setFormState({ ...EMPTY_STAFF_FORM });
      setActionMessage(`${roleLabel} created successfully.`);
      loadAdminData();
    } catch (err) {
      setActionMessage(err.message || `Failed to create ${roleLabel.toLowerCase()}.`);
    }
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    setActionMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm)
      });

      await safeJson(response);
      setLocationForm({ city: '', state: '', streetNo: '', streetName: '', zipCode: '' });
      setActionMessage('Location added successfully.');
      loadAdminData();
    } catch (err) {
      setActionMessage(err.message || 'Failed to add location.');
    }
  };

  const handleTimeOffDecision = async (timeOffId, requestSource, decision) => {
    setActionMessage('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/staff/time-off/${timeOffId}/${decision}?source=${encodeURIComponent(requestSource)}`,
        {
        method: 'PUT'
        }
      );
      await safeJson(response);
      setActionMessage(decision === 'approve' ? 'Off-day approved.' : 'Off-day denied.');
      loadAdminData();
    } catch (err) {
      setActionMessage(err.message || 'Failed to update off-day request.');
    }
  };

  const reportRows = Array.isArray(patientReport.rows) ? patientReport.rows : [];
  const financialFollowUpRows = Array.isArray(patientReport.financialFollowUp) ? patientReport.financialFollowUp : [];
  const totalOutstandingAmount = financialFollowUpRows.reduce(
    (sum, row) => sum + Number(row.total_outstanding || 0), 0
  );

  const pendingStaffOffDayNotifications = (staffTimeOffRequests || [])
    .filter((item) => !item.is_approved)
    .map((item) => {
      const role = String(item.requester_role || 'staff').replace('_', ' ');
      const dateLabel = item.start_datetime ? new Date(item.start_datetime).toLocaleDateString() : 'an upcoming date';
      return {
        message: `${item.requester_name} (${role}) submitted an off-day request for ${dateLabel}.`
      };
    });

  const combinedNotifications = [
    ...(Array.isArray(summary?.notifications) ? summary.notifications : []),
    ...pendingStaffOffDayNotifications
  ];

  const schedulingActionRows = (queue.pendingRequests || []).map((row) => ({
    ...row,
    needsDateConfirmation: !String(row.preferred_date || '').trim(),
    needsTimeConfirmation: !String(row.preferred_time || '').trim(),
    needsLocationConfirmation: !String(row.preferred_location || '').trim()
  }));

  return (
    <main className="admin-page">
      <section className="admin-header">
        <div>
          <p className="admin-label">Clinic Admin</p>
          <h1>Operations Dashboard</h1>
        </div>
        <div className="admin-header-actions">
          {activeSection !== 'staffing' && (
            <label className="admin-date-filter">
              Dashboard Date
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </label>
          )}
        </div>
      </section>

      <nav className="admin-section-nav" aria-label="Admin sections">
        <button type="button" className={activeSection === 'overview' ? 'is-active' : ''} onClick={() => setActiveSection('overview')}>Overview</button>
        <button type="button" className={activeSection === 'scheduling' ? 'is-active' : ''} onClick={() => setActiveSection('scheduling')}>Scheduling</button>
        <button type="button" className={activeSection === 'reports' ? 'is-active' : ''} onClick={() => setActiveSection('reports')}>Reports</button>
        <button type="button" className={activeSection === 'staffing' ? 'is-active' : ''} onClick={() => setActiveSection('staffing')}>Staffing & Locations</button>
      </nav>

      {error && <p className="admin-error">{error}</p>}
      {actionMessage && <p className="admin-message">{actionMessage}</p>}
      {loading && <p className="admin-loading">Loading dashboard...</p>}

      {!loading && summary && (
        <>
          {activeSection === 'overview' && (
            <>
              <section className="admin-metrics-grid">
                <article className="metric-card">
                  <h2>Revenue Today</h2>
                  <p>{formatMoney(summary.metrics?.clinicRevenueToday)}</p>
                </article>
                <article className="metric-card">
                  <h2>Revenue All-Time</h2>
                  <p>{formatMoney(summary.metrics?.clinicRevenueAllTime)}</p>
                </article>
                <article className="metric-card">
                  <h2>Scheduled Today</h2>
                  <p>{summary.metrics?.scheduledToday || 0}</p>
                </article>
                <article className="metric-card">
                  <h2>Waiting Requests</h2>
                  <p>{summary.metrics?.waitingToSchedule || 0}</p>
                </article>
                <article className="metric-card">
                  <h2>Total Patients Today</h2>
                  <p>{summary.metrics?.patientsScheduledToday || 0}</p>
                </article>
                <article className="metric-card">
                  <h2>Dentists on Team</h2>
                  <p>{summary.metrics?.doctorCount || 0}</p>
                  {(summary.metrics?.doctorCount || 0) > 5 && <small>Above your baseline of 5 dentists</small>}
                </article>
              </section>

              <section className="admin-panel">
                <h2>Notifications</h2>
                {combinedNotifications.length ? (
                  <ul className="notification-list">
                    {combinedNotifications.map((note, idx) => (
                      <li key={`${note.message}-${idx}`}>{note.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No scheduling alerts right now.</p>
                )}
              </section>
            </>
          )}

          {activeSection === 'scheduling' && (
            <section className="admin-grid-two">
              <article className="admin-panel">
                <h2>Appointments Scheduled</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Patient</th>
                        <th>Dentist</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Confirmed By</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.scheduledAppointments?.length ? queue.scheduledAppointments.map((appt) => {
                        const payStatus = appt.payment_status || '';
                        const amtDue = Number(appt.amount_due || 0);
                        return (
                          <tr key={appt.appointment_id}>
                            <td>{formatTime(appt.appointment_time)}</td>
                            <td>{appt.patient_name}</td>
                            <td>{appt.doctor_name || 'TBD'}</td>
                            <td>{appt.status_name}</td>
                            <td>
                              {payStatus ? (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '999px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: payStatus === 'Paid' ? '#d4edda' : payStatus === 'Partial' ? '#fff3cd' : '#f8d7da',
                                  color: payStatus === 'Paid' ? '#155724' : payStatus === 'Partial' ? '#856404' : '#721c24'
                                }}>
                                  {payStatus}{amtDue > 0 ? ` — ${formatMoney(amtDue)}` : ''}
                                </span>
                              ) : '—'}
                            </td>
                            <td>{appt.receptionist_name || 'Unassigned'}</td>
                            <td>{appt.location_address || 'TBD'}</td>
                          </tr>
                        );
                      }) : <tr><td colSpan="7">No scheduled appointments for this date.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="admin-panel">
                <h2>Waiting To Be Scheduled</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Preferred Date</th>
                        <th>Preferred Time</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.pendingRequests?.length ? queue.pendingRequests.map((req) => (
                        <tr key={req.preference_request_id}>
                          <td>{req.patient_name}</td>
                          <td>{formatDate(req.preferred_date)}</td>
                          <td>{formatTime(req.preferred_time)}</td>
                          <td>{req.preferred_location}</td>
                        </tr>
                      )) : <tr><td colSpan="4">No pending preference requests.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {activeSection === 'reports' && (
            <>
              {/* Report Type Selector */}
              <section className="admin-panel">
                <div className="admin-panel-header-row">
                  <div className="report-type-toggle">
                    <button
                      type="button"
                      className={reportType === 'patients' ? 'report-type-btn is-active' : 'report-type-btn'}
                      onClick={() => setReportType('patients')}
                    >
                      Patient Reports
                    </button>
                    <button
                      type="button"
                      className={reportType === 'staff' ? 'report-type-btn is-active' : 'report-type-btn'}
                      onClick={() => setReportType('staff')}
                    >
                      Staff Reports
                    </button>
                  </div>

                  {reportType === 'patients' && (
                    <label className="admin-inline-filter">
                      Status Filter
                      <select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}>
                        {reportStatusOptions.map((status) => (
                          <option key={status} value={status}>{status.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {reportType === 'staff' && (
                    <div className="report-date-range">
                      <label className="admin-inline-filter">
                        From
                        <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} />
                      </label>
                      <label className="admin-inline-filter">
                        To
                        <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} />
                      </label>
                    </div>
                  )}
                </div>
              </section>

              {/* ── PATIENT REPORTS ── */}
              {reportType === 'patients' && (
                <>
                  <section>
                    <article className="admin-panel">
                      <h2>Report 1: Financial Follow-Up</h2>
                      <p className="muted">
                        Per-patient billing summary across all invoices — pulls from patients, appointments, invoices &amp; payments tables.
                        Patients: {financialFollowUpRows.length} | Total Outstanding: {formatMoney(totalOutstandingAmount)}
                      </p>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Patient</th>
                              <th>Phone</th>
                              <th>Invoices</th>
                              <th>Unpaid</th>
                              <th>Total Charged</th>
                              <th>Insurance Covered</th>
                              <th>Patient Owes</th>
                              <th>Paid</th>
                              <th>Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financialFollowUpRows.length ? financialFollowUpRows.map((row) => {
                              const outstanding = Number(row.total_outstanding || 0);
                              return (
                                <tr key={row.patient_id}>
                                  <td>{row.patient_name}</td>
                                  <td>{row.p_phone || 'N/A'}</td>
                                  <td>{row.total_invoices}</td>
                                  <td>
                                    {Number(row.unpaid_invoices || 0) > 0 ? (
                                      <span style={{
                                        display: 'inline-block',
                                        padding: '0.1rem 0.45rem',
                                        borderRadius: '999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        background: '#f8d7da',
                                        color: '#721c24'
                                      }}>
                                        {row.unpaid_invoices}
                                      </span>
                                    ) : (
                                      <span style={{
                                        display: 'inline-block',
                                        padding: '0.1rem 0.45rem',
                                        borderRadius: '999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        background: '#d4edda',
                                        color: '#155724'
                                      }}>
                                        0
                                      </span>
                                    )}
                                  </td>
                                  <td>{formatMoney(row.total_charged)}</td>
                                  <td>{formatMoney(row.total_insurance_covered)}</td>
                                  <td>{formatMoney(row.total_patient_responsibility)}</td>
                                  <td>{formatMoney(row.total_paid)}</td>
                                  <td style={{ fontWeight: outstanding > 0 ? 700 : 400, color: outstanding > 0 ? '#9d2e2e' : '#155724' }}>
                                    {formatMoney(outstanding)}
                                  </td>
                                </tr>
                              );
                            }) : <tr><td colSpan="9">No invoices found.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>

                  </section>

                  <section className="admin-panel">
                    <h2>Report 2: Scheduling Confirmation Needed</h2>
                    <p className="muted">
                      Pending requests where staff must confirm date/time/location — pulls from appointment_preference_requests &amp; patients tables.
                      Count: {schedulingActionRows.length}
                    </p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Patient</th>
                            <th>Preferred Date</th>
                            <th>Preferred Time</th>
                            <th>Preferred Location</th>
                            <th>Action Needed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedulingActionRows.length ? schedulingActionRows.slice(0, 14).map((row) => (
                            <tr key={row.preference_request_id}>
                              <td>{row.patient_name}</td>
                              <td>{row.preferred_date ? formatDate(row.preferred_date) : 'Missing'}</td>
                              <td>{row.preferred_time ? formatTime(row.preferred_time) : 'Missing'}</td>
                              <td>{row.preferred_location || 'Missing'}</td>
                              <td>
                                {[
                                  row.needsDateConfirmation ? 'Confirm date' : null,
                                  row.needsTimeConfirmation ? 'Confirm time' : null,
                                  row.needsLocationConfirmation ? 'Confirm location' : null
                                ].filter(Boolean).join(', ') || 'Confirm final assignment'}
                              </td>
                            </tr>
                          )) : <tr><td colSpan="5">No pending scheduling confirmations.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {/* ── STAFF REPORTS ── */}
              {reportType === 'staff' && (
                <>
                  <section className="admin-panel">
                    <h2>Report 1: Doctor Workload Summary</h2>
                    <p className="muted">
                      Appointment counts per doctor for the selected date range — pulls from doctors, staff, appointments &amp; appointment_statuses tables.
                    </p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Doctor</th>
                            <th>Phone</th>
                            <th>Total Appts</th>
                            <th>Completed</th>
                            <th>Upcoming</th>
                            <th>Canceled</th>
                            <th>No-Show</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffReport.workload.length ? staffReport.workload.map((row) => (
                            <tr key={row.doctor_id}>
                              <td>Dr. {row.doctor_name}</td>
                              <td>{row.phone_number || 'N/A'}</td>
                              <td>{row.total_appointments}</td>
                              <td>{row.completed}</td>
                              <td>{row.upcoming}</td>
                              <td>{row.canceled}</td>
                              <td>{row.no_show}</td>
                            </tr>
                          )) : <tr><td colSpan="7">No doctor workload data for this range.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="admin-panel">
                    <h2>Report 2: Doctor Appointment Schedule</h2>
                    <p className="muted">
                      Full appointment schedule by doctor for the selected range — pulls from doctors, staff, appointments, patients &amp; locations tables.
                      Total: {staffReport.schedule.length} appointment(s)
                    </p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Doctor</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Patient</th>
                            <th>Patient Phone</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Confirmed By</th>
                            <th>Location</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffReport.schedule.length ? staffReport.schedule.slice(0, 50).map((row, idx) => {
                            const payStatus = row.payment_status || '';
                            const amtDue = Number(row.amount_due || 0);
                            return (
                              <tr key={idx}>
                                <td>Dr. {row.doctor_name}</td>
                                <td>{formatDate(row.appointment_date)}</td>
                                <td>{formatTime(row.appointment_time)}</td>
                                <td>{row.patient_name}</td>
                                <td>{row.patient_phone || 'N/A'}</td>
                                <td>{row.status_name}</td>
                                <td>
                                  {payStatus ? (
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '999px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      background: payStatus === 'Paid' ? '#d4edda' : payStatus === 'Partial' ? '#fff3cd' : '#f8d7da',
                                      color: payStatus === 'Paid' ? '#155724' : payStatus === 'Partial' ? '#856404' : '#721c24'
                                    }}>
                                      {payStatus}{amtDue > 0 ? ` — ${formatMoney(amtDue)}` : ''}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td>{row.receptionist_name || 'Unassigned'}</td>
                                <td>{row.location_address || 'TBD'}</td>
                              </tr>
                            );
                          }) : <tr><td colSpan="9">No scheduled appointments for this range.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="admin-panel">
                    <h2>Report 3: All Staff Time-Off Summary</h2>
                    <p className="muted">
                      All recorded doctor and staff time-off entries — pulls from doctor_time_off, staff_time_off_requests, staff, users &amp; locations tables.
                    </p>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Staff Member</th>
                            <th>Role</th>
                            <th>Source</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Location</th>
                            <th>Reason</th>
                            <th>Approved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffReport.timeOff.length ? staffReport.timeOff.map((row) => (
                            <tr key={row.request_key}>
                              <td>{row.requester_name || 'Unknown staff'}</td>
                              <td>{String(row.requester_role || 'STAFF').replaceAll('_', ' ')}</td>
                              <td>{String(row.request_source || '').replaceAll('_', ' ') || 'TIME OFF'}</td>
                              <td>{new Date(row.start_datetime).toLocaleString()}</td>
                              <td>{new Date(row.end_datetime).toLocaleString()}</td>
                              <td>{row.location_address}</td>
                              <td>{row.reason || 'N/A'}</td>
                              <td>{row.is_approved ? 'Yes' : 'Pending'}</td>
                            </tr>
                          )) : <tr><td colSpan="8">No time-off records found.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
            </>
          )}

          {activeSection === 'staffing' && (
            <>
              <section className="staffing-accordion">
                <article className="admin-panel admin-panel-wide collapsible-panel">
                  <button
                    type="button"
                    className="collapse-toggle"
                    onClick={() => setExpandedCards((prev) => ({ ...prev, dentist: !prev.dentist }))}
                    aria-expanded={expandedCards.dentist}
                  >
                    <span>Add New Dentist</span>
                    <span>{expandedCards.dentist ? 'Hide' : 'Show'}</span>
                  </button>
                  {expandedCards.dentist && (
                    <div className="collapse-content">
                      <form className="admin-form" onSubmit={handleDoctorSubmit}>
                        <input placeholder="First name" value={doctorForm.firstName} onChange={(e) => setDoctorForm((prev) => ({ ...prev, firstName: e.target.value }))} required />
                        <input placeholder="Last name" value={doctorForm.lastName} onChange={(e) => setDoctorForm((prev) => ({ ...prev, lastName: e.target.value }))} required />
                        <input type="date" value={doctorForm.dob} onChange={(e) => setDoctorForm((prev) => ({ ...prev, dob: e.target.value }))} required />
                        <input
                          placeholder="NPI (10 digits)"
                          value={doctorForm.npi}
                          onChange={(e) => setDoctorForm((prev) => ({ ...prev, npi: String(e.target.value || '').replace(/\D/g, '').slice(0, 10) }))}
                          inputMode="numeric"
                          maxLength={10}
                          pattern="\d{10}"
                          title="NPI must be a 10-digit number"
                          required
                        />
                        <input
                          placeholder="SSN (XXX-XX-XXXX)"
                          value={doctorForm.ssn}
                          onChange={(e) => setDoctorForm((prev) => ({ ...prev, ssn: formatSsnInput(e.target.value) }))}
                          inputMode="numeric"
                          maxLength={11}
                          title="Use XXX-XX-XXXX"
                        />
                        <input
                          placeholder="Phone (XXX-XXX-XXXX)"
                          value={doctorForm.phone}
                          onChange={(e) => setDoctorForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))}
                          inputMode="numeric"
                          maxLength={12}
                          required
                        />
                        <input placeholder="Username" value={doctorForm.username} onChange={(e) => setDoctorForm((prev) => ({ ...prev, username: e.target.value }))} required />
                        <input type="password" placeholder="Temporary password" value={doctorForm.password} onChange={(e) => setDoctorForm((prev) => ({ ...prev, password: e.target.value }))} required />
                        <input type="email" placeholder="Email (optional)" value={doctorForm.email} onChange={(e) => setDoctorForm((prev) => ({ ...prev, email: e.target.value }))} />
                        <select value={doctorForm.gender} onChange={(e) => setDoctorForm((prev) => ({ ...prev, gender: e.target.value }))}>
                          <option value="">Gender (optional)</option>
                          <option value="1">Male</option>
                          <option value="2">Female</option>
                          <option value="3">Non-binary</option>
                          <option value="4">Prefer not to say</option>
                        </select>
                        <select value={doctorForm.locationId} onChange={(e) => setDoctorForm((prev) => ({ ...prev, locationId: e.target.value }))}>
                          <option value="">Assign location (optional)</option>
                          {locations.map((location) => (
                            <option key={location.location_id} value={location.location_id}>{location.full_address}</option>
                          ))}
                        </select>
                        <button type="submit">Create Dentist</button>
                      </form>
                      <p className="muted">Current dentists: {doctors.length}</p>
                      <ul className="compact-list">
                        {doctors.map((doctor) => (
                          <li key={doctor.doctor_id}>Dr. {doctor.first_name} {doctor.last_name} - {doctor.user_username || 'no-username'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>

                <article className="admin-panel admin-panel-wide collapsible-panel">
                  <button
                    type="button"
                    className="collapse-toggle"
                    onClick={() => setExpandedCards((prev) => ({ ...prev, location: !prev.location }))}
                    aria-expanded={expandedCards.location}
                  >
                    <span>Add New Location</span>
                    <span>{expandedCards.location ? 'Hide' : 'Show'}</span>
                  </button>
                  {expandedCards.location && (
                    <div className="collapse-content">
                      <form className="admin-form" onSubmit={handleLocationSubmit}>
                        <input placeholder="Street number" value={locationForm.streetNo} onChange={(e) => setLocationForm((prev) => ({ ...prev, streetNo: e.target.value }))} required />
                        <input placeholder="Street name" value={locationForm.streetName} onChange={(e) => setLocationForm((prev) => ({ ...prev, streetName: e.target.value }))} required />
                        <input placeholder="City" value={locationForm.city} onChange={(e) => setLocationForm((prev) => ({ ...prev, city: e.target.value }))} required />
                        <input placeholder="State" maxLength="2" value={locationForm.state} onChange={(e) => setLocationForm((prev) => ({ ...prev, state: e.target.value }))} required />
                        <input placeholder="ZIP" value={locationForm.zipCode} onChange={(e) => setLocationForm((prev) => ({ ...prev, zipCode: e.target.value }))} required />
                        <button type="submit">Create Location</button>
                      </form>
                      <ul className="compact-list">
                        {locations.map((location) => (
                          <li key={location.location_id}>{location.full_address}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>

                <article className="admin-panel admin-panel-wide collapsible-panel">
                  <button
                    type="button"
                    className="collapse-toggle"
                    onClick={() => setExpandedCards((prev) => ({ ...prev, receptionist: !prev.receptionist }))}
                    aria-expanded={expandedCards.receptionist}
                  >
                    <span>Add New Receptionist</span>
                    <span>{expandedCards.receptionist ? 'Hide' : 'Show'}</span>
                  </button>
                  {expandedCards.receptionist && (
                    <div className="collapse-content">
                      <form className="admin-form" onSubmit={(e) => handleRoleStaffSubmit(e, 'receptionists', 'Receptionist', receptionistForm, setReceptionistForm)}>
                        <input placeholder="First name" value={receptionistForm.firstName} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, firstName: e.target.value }))} required />
                        <input placeholder="Last name" value={receptionistForm.lastName} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, lastName: e.target.value }))} required />
                        <input type="date" value={receptionistForm.dob} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, dob: e.target.value }))} required />
                        <input
                          placeholder="SSN (XXX-XX-XXXX)"
                          value={receptionistForm.ssn}
                          onChange={(e) => setReceptionistForm((prev) => ({ ...prev, ssn: formatSsnInput(e.target.value) }))}
                          inputMode="numeric"
                          maxLength={11}
                          title="Use XXX-XX-XXXX"
                        />
                        <input
                          placeholder="Phone (XXX-XXX-XXXX)"
                          value={receptionistForm.phone}
                          onChange={(e) => setReceptionistForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))}
                          inputMode="numeric"
                          maxLength={12}
                          required
                        />
                        <input placeholder="Username" value={receptionistForm.username} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, username: e.target.value }))} required />
                        <input type="password" placeholder="Temporary password" value={receptionistForm.password} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, password: e.target.value }))} required />
                        <input type="email" placeholder="Email (optional)" value={receptionistForm.email} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, email: e.target.value }))} />
                        <select value={receptionistForm.gender} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, gender: e.target.value }))}>
                          <option value="">Gender (optional)</option>
                          <option value="1">Male</option>
                          <option value="2">Female</option>
                          <option value="3">Non-binary</option>
                          <option value="4">Prefer not to say</option>
                        </select>
                        <select value={receptionistForm.locationId} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, locationId: e.target.value }))}>
                          <option value="">Assign location (optional)</option>
                          {locations.map((location) => (
                            <option key={location.location_id} value={location.location_id}>{location.full_address}</option>
                          ))}
                        </select>
                        <button type="submit">Create Receptionist</button>
                      </form>
                      <p className="muted">Current receptionists: {receptionists.length}</p>
                      <ul className="compact-list">
                        {receptionists.map((member) => (
                          <li key={member.staff_id}>{member.first_name} {member.last_name} - {member.user_username || 'no-username'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>

                <article className="admin-panel admin-panel-wide collapsible-panel">
                  <button
                    type="button"
                    className="collapse-toggle"
                    onClick={() => setExpandedCards((prev) => ({ ...prev, offDayRequests: !prev.offDayRequests }))}
                    aria-expanded={expandedCards.offDayRequests}
                  >
                    <span>Staff Off Day Requests</span>
                    <span>{expandedCards.offDayRequests ? 'Hide' : 'Show'}</span>
                  </button>
                  {expandedCards.offDayRequests && (
                    <div className="collapse-content">
                      <p className="muted">Review submitted staff off-day requests and approve or deny pending entries.</p>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Staff Member</th>
                              <th>Role</th>
                              <th>Start</th>
                              <th>End</th>
                              <th>Location</th>
                              <th>Reason</th>
                              <th>Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {staffTimeOffRequests.length ? staffTimeOffRequests.map((item) => (
                              <tr key={`${item.request_source}-${item.request_id}`}>
                                <td>{item.requester_name}</td>
                                <td>{String(item.requester_role || '').replace('_', ' ')}</td>
                                <td>{new Date(item.start_datetime).toLocaleString()}</td>
                                <td>{new Date(item.end_datetime).toLocaleString()}</td>
                                <td>{item.location_address || 'Any'}</td>
                                <td>{item.reason || 'N/A'}</td>
                                <td>{item.is_approved ? 'Approved' : 'Pending Approval'}</td>
                                <td>
                                  {item.is_approved ? 'N/A' : (
                                    <div className="admin-row-actions">
                                      <button type="button" className="admin-action-btn approve" onClick={() => handleTimeOffDecision(item.request_id, item.request_source, 'approve')}>Approve</button>
                                      <button type="button" className="admin-action-btn deny" onClick={() => handleTimeOffDecision(item.request_id, item.request_source, 'deny')}>Deny</button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )) : <tr><td colSpan="8">No staff off-day requests recorded.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </article>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default AdminDashboardPage;
