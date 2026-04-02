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

function useSortState() {
  const [col, setCol] = useState(null);
  const [dir, setDir] = useState('asc');
  const toggle = (column) => {
    if (col === column) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setCol(column);
      setDir('asc');
    }
  };
  const sorted = (rows, accessor) => {
    if (!col || !rows?.length) return rows;
    const get = accessor || ((row) => {
      const v = row[col];
      return v == null ? '' : v;
    });
    return [...rows].sort((a, b) => {
      let va = get(a, col);
      let vb = get(b, col);
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb) && va !== '' && vb !== '') {
        return dir === 'asc' ? na - nb : nb - na;
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  };
  return { col, dir, toggle, sorted };
}

function SortTh({ sort, column, children, style }) {
  const arrow = sort.col === column ? (sort.dir === 'asc' ? ' \u25B2' : ' \u25BC') : '';
  return (
    <th
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      onClick={() => sort.toggle(column)}
    >
      {children}{arrow}
    </th>
  );
}

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

function AdminDashboardPage() {
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeSection, setActiveSection] = useState('overview');
  const [reportStatus, setReportStatus] = useState('ALL');
  const [reportType, setReportType] = useState('patients');
  const [staffReport, setStaffReport] = useState({ workload: [], schedule: [] });
  const [reportDateFrom, setReportDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [reportDateTo, setReportDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [clinicReportDateFrom, setClinicReportDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
  });
  const [clinicReportDateTo, setClinicReportDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [clinicPerformanceReport, setClinicPerformanceReport] = useState({
    summary: null,
    monthlyTrends: [],
    providerPerformance: [],
    newPatientsTrend: [],
    outstandingPatients: [],
    generatedAt: null
  });
  const [clinicPerformanceLoading, setClinicPerformanceLoading] = useState(false);
  const [clinicPerformanceError, setClinicPerformanceError] = useState('');

  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState({ scheduledAppointments: [], pendingRequests: [], notificationCount: 0 });
  const [followUpQueue, setFollowUpQueue] = useState({ summary: { overdue: 0, dueToday: 0, upcoming: 0, scheduled: 0, unscheduled: 0 }, items: [] });
  const [includeScheduledFollowUps, setIncludeScheduledFollowUps] = useState(false);

  const [patientReport, setPatientReport] = useState({ summary: null, rows: [] });
  const [doctors, setDoctors] = useState([]);

  const [receptionists, setReceptionists] = useState([]);
  const [locations, setLocations] = useState([]);
  const [staffTimeOffRequests, setStaffTimeOffRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const [scheduleRequests, setScheduleRequests] = useState([]);
  const [allStaffSchedules, setAllStaffSchedules] = useState([]);
  const [scheduleGaps, setScheduleGaps] = useState([]);
  const [expandedStaff, setExpandedStaff] = useState({});
  const [editingSchedules, setEditingSchedules] = useState({});

  const ADMIN_DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  const ADMIN_TIME_OPTIONS = useMemo(() => {
    const opts = [];
    for (let h = 8; h <= 19; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === 19 && m > 0) break;
        const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        opts.push({ value: val, label: new Date(`2000-01-01T${val}:00`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) });
      }
    }
    return opts;
  }, []);

  const reportStatusOptions = ['ALL', 'SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELED', 'NO_SHOW'];

  const [doctorForm, setDoctorForm] = useState({ ...EMPTY_STAFF_FORM });

  const [receptionistForm, setReceptionistForm] = useState({ ...EMPTY_STAFF_FORM });
  const [expandedCards, setExpandedCards] = useState({
    dentist: false,
    location: false,
    receptionist: false,
    offDayRequests: false,
    manageStaff: false
  });

  const [allStaff, setAllStaff] = useState([]);
  const [resetPasswordStaffId, setResetPasswordStaffId] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [cancelledRequests, setCancelledRequests] = useState([]);
  const [cancelledAppointments, setCancelledAppointments] = useState([]);
  const [refundHistory, setRefundHistory] = useState([]);
  const [refundForm, setRefundForm] = useState({ invoiceId: '', amount: '', reason: '' });
  const [invoiceLookup, setInvoiceLookup] = useState(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [docSchedPage, setDocSchedPage] = useState(0);
  const docSchedPageSize = 20;
  const [docSchedSearch, setDocSchedSearch] = useState('');
  const filteredDocSchedule = useMemo(() => {
    const q = docSchedSearch.trim().toLowerCase();
    if (!q) return staffReport.schedule;
    return staffReport.schedule.filter((row) => (row.doctor_name || '').toLowerCase().includes(q));
  }, [staffReport.schedule, docSchedSearch]);

  const sortFinancial = useSortState();
  const sortWorkload = useSortState();
  const sortDoctorSchedule = useSortState();
  const sortRefund = useSortState();

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
      const [summaryData, queueData, followUpData, reportData, doctorData, receptionistData, locationData, timeOffData, cancelledData, schedReqData, staffSchedData, gapsData, refundData, cancelledApptData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/dashboard/summary?date=${selectedDate}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/appointments/queue?date=${selectedDate}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/follow-ups/queue?windowDays=365&includeScheduled=${includeScheduledFollowUps}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/reports/patients?date=${selectedDate}${reportStatus === 'ALL' ? '' : `&status=${reportStatus}`}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/doctors`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff/receptionists`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/locations`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff/time-off-requests`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/appointment-requests/cancelled`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/schedule-requests`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff-schedules`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff-schedules/gaps`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/refunds`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/cancelled-appointments`).then(safeJson)
      ]);

      setSummary(summaryData);
      setQueue(queueData);
      setFollowUpQueue({
        summary: followUpData?.summary || { overdue: 0, dueToday: 0, upcoming: 0, scheduled: 0, unscheduled: 0 },
        items: Array.isArray(followUpData?.items) ? followUpData.items : []
      });
      setPatientReport(reportData);
      setDoctors(Array.isArray(doctorData) ? doctorData : []);
      setReceptionists(Array.isArray(receptionistData) ? receptionistData : []);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setStaffTimeOffRequests(Array.isArray(timeOffData) ? timeOffData : []);
      setCancelledRequests(Array.isArray(cancelledData) ? cancelledData : []);
      setScheduleRequests(Array.isArray(schedReqData) ? schedReqData : []);
      setAllStaffSchedules(Array.isArray(staffSchedData) ? staffSchedData : []);
      setScheduleGaps(Array.isArray(gapsData) ? gapsData : []);
      setRefundHistory(Array.isArray(refundData) ? refundData : []);
      setCancelledAppointments(Array.isArray(cancelledApptData) ? cancelledApptData : []);
    } catch (err) {
      setError(err.message || 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  const lookupInvoice = async (id) => {
    const invoiceId = Number(id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) { setInvoiceLookup(null); return; }
    setInvoiceLookupLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setInvoiceLookup(null); return; }
      setInvoiceLookup(data);
    } catch { setInvoiceLookup(null); }
    finally { setInvoiceLookupLoading(false); }
  };

  const processRefund = async () => {
    const invoiceId = Number(refundForm.invoiceId);
    const amount = Number(refundForm.amount);
    if (!invoiceId || !amount || amount <= 0) {
      setError('Valid invoice ID and refund amount are required.');
      return;
    }
    setError('');
    setActionMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, refundAmount: amount, reason: refundForm.reason || 'Treatment cost adjusted' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to process refund');
      setActionMessage(`Refund of $${amount.toFixed(2)} processed successfully.`);
      setRefundForm({ invoiceId: '', amount: '', reason: '' });
      setInvoiceLookup(null);
      // Reload refund history and financial data
      const [refundData, reportData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/refunds`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/reports/patients?date=${selectedDate}${reportStatus === 'ALL' ? '' : `&status=${reportStatus}`}`).then(safeJson)
      ]);
      setRefundHistory(Array.isArray(refundData) ? refundData : []);
      setPatientReport(reportData);
    } catch (err) {
      setError(err.message || 'Failed to process refund.');
    }
  };

  const loadStaffReport = async () => {
    try {
      const data = await fetch(
        `${API_BASE_URL}/api/admin/reports/staff?dateFrom=${reportDateFrom}&dateTo=${reportDateTo}`
      ).then(safeJson);
      setStaffReport({
        workload: Array.isArray(data.workload) ? data.workload : [],
        schedule: Array.isArray(data.schedule) ? data.schedule : []
      });
    } catch (err) {
      setError(err.message || 'Unable to load staff report.');
    }
  };

  const loadClinicPerformanceReport = async () => {
    setClinicPerformanceLoading(true);
    setClinicPerformanceError('');

    try {
      const data = await fetch(
        `${API_BASE_URL}/api/admin/reports/performance?dateFrom=${clinicReportDateFrom}&dateTo=${clinicReportDateTo}`
      ).then(safeJson);

      setClinicPerformanceReport({
        summary: data.summary || null,
        monthlyTrends: Array.isArray(data.monthlyTrends) ? data.monthlyTrends : [],
        providerPerformance: Array.isArray(data.providerPerformance) ? data.providerPerformance : [],
        newPatientsTrend: Array.isArray(data.newPatientsTrend) ? data.newPatientsTrend : [],
        outstandingPatients: Array.isArray(data.outstandingPatients) ? data.outstandingPatients : [],
        generatedAt: data.generatedAt || null
      });
    } catch (err) {
      setClinicPerformanceError(err.message || 'Unable to load clinic performance report.');
    } finally {
      setClinicPerformanceLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [selectedDate, reportStatus, includeScheduledFollowUps]);

  useEffect(() => {
    if (reportType === 'staff') {
      loadStaffReport();
    }
  }, [reportType, reportDateFrom, reportDateTo]);

  useEffect(() => {
    if (activeSection === 'reports') {
      loadClinicPerformanceReport();
    }
  }, [activeSection, clinicReportDateFrom, clinicReportDateTo]);

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

  const loadAllStaff = async () => {
    try {
      const data = await fetch(`${API_BASE_URL}/api/admin/staff/all`).then(safeJson);
      setAllStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      setActionMessage(err.message || 'Failed to load staff list.');
      setAllStaff([]);
    }
  };

  useEffect(() => {
    if (expandedCards.manageStaff) {
      loadAllStaff();
    }
  }, [expandedCards.manageStaff]);

  const handleResetPassword = async (staffId) => {
    if (!resetPasswordValue || resetPasswordValue.length < 8 || !/[A-Z]/.test(resetPasswordValue) || !/[a-z]/.test(resetPasswordValue) || !/[0-9]/.test(resetPasswordValue)) {
      setActionMessage('Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/staff/${staffId}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPasswordValue })
      });
      await safeJson(response);
      setActionMessage('Password reset successfully.');
      setResetPasswordStaffId(null);
      setResetPasswordValue('');
    } catch (err) {
      setActionMessage(err.message || 'Failed to reset password.');
    }
  };

  const handleToggleVisibility = async (staffId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/staff/${staffId}/toggle-visibility`, {
        method: 'PUT'
      });
      const result = await safeJson(response);
      setActionMessage(result.message || 'Visibility toggled.');
      loadAllStaff();
      loadAdminData();
    } catch (err) {
      setActionMessage(err.message || 'Failed to toggle visibility.');
    }
  };

  const reportRows = Array.isArray(patientReport.rows) ? patientReport.rows : [];
  const financialFollowUpRows = Array.isArray(patientReport.financialFollowUp) ? patientReport.financialFollowUp : [];
  const [financialSearch, setFinancialSearch] = useState('');
  const filteredFinancialRows = useMemo(() => {
    const query = financialSearch.trim().toLowerCase();
    const hasSearch = query.length > 0;
    return financialFollowUpRows.filter((row) => {
      const queryDigits = query.replace(/\D/g, '');
      const matchesSearch = !hasSearch ||
        (row.patient_name || '').toLowerCase().includes(query) ||
        (queryDigits.length > 0 && (row.p_phone || '').replace(/\D/g, '').includes(queryDigits)) ||
        (row.p_phone || '').toLowerCase().includes(query);
      if (hasSearch) return matchesSearch;
      return Number(row.total_outstanding || 0) > 0;
    });
  }, [financialFollowUpRows, financialSearch]);
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

  const combinedNotifications = pendingStaffOffDayNotifications;


  return (
    <main className="admin-page">
      <section className="admin-header">
        <div>
          <p className="admin-label">Clinic Admin</p>
          <h1>Operations Dashboard</h1>
        </div>
        <div className="admin-header-actions">
        </div>
      </section>

      <nav className="admin-section-nav" aria-label="Admin sections">
        <button type="button" className={activeSection === 'overview' ? 'is-active' : ''} onClick={() => setActiveSection('overview')}>Overview</button>
        <button type="button" className={activeSection === 'scheduling' ? 'is-active' : ''} onClick={() => setActiveSection('scheduling')}>Scheduling</button>
        <button type="button" className={activeSection === 'reports' ? 'is-active' : ''} onClick={() => setActiveSection('reports')}>Reports</button>
        <button type="button" className={activeSection === 'staff-scheduling' ? 'is-active' : ''} onClick={() => setActiveSection('staff-scheduling')}>Staff Scheduling</button>
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
                  <h2>Collected</h2>
                  <p>{formatMoney(summary.metrics?.collectedAllTime)}</p>
                </article>
                <article className="metric-card">
                  <h2>Outstanding Balance</h2>
                  <p style={{ color: summary.metrics?.totalOutstanding > 0 ? '#9d2e2e' : 'inherit' }}>
                    {formatMoney(summary.metrics?.totalOutstanding)}
                  </p>
                </article>
                <article className="metric-card">
                  <h2>Waiting Requests</h2>
                  <p>{summary.metrics?.waitingToSchedule || 0}</p>
                </article>
                <article className="metric-card">
                  <h2>Dentists on Team</h2>
                  <p>{summary.metrics?.doctorCount || 0}</p>
                  {(summary.metrics?.doctorCount || 0) > 5 && <small>Above your baseline of 5 dentists</small>}
                </article>
                <article className="metric-card">
                  <h2>New Patients This Month</h2>
                  <p>{summary.metrics?.newPatientsThisMonth || 0}</p>
                </article>
                <article className="metric-card">
                  <h2>Pending Time-Off Requests</h2>
                  <p style={{ color: summary.metrics?.pendingTimeOffCount > 0 ? '#9d2e2e' : 'inherit' }}>
                    {summary.metrics?.pendingTimeOffCount || 0}
                  </p>
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
                <div className="admin-panel-header">
                  <h2>Appointments Scheduled</h2>
                  <label className="admin-date-filter">
                    Date
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                  </label>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Patient</th>
                        <th>Dentist</th>
                        <th>Status</th>
                        <th>Confirmed By</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.scheduledAppointments?.length ? queue.scheduledAppointments.map((appt) => {
                        return (
                          <tr key={appt.appointment_id}>
                            <td>{formatTime(appt.appointment_time)}</td>
                            <td>{appt.patient_name}</td>
                            <td>{appt.doctor_name || 'TBD'}</td>
                            <td>{appt.status_name}</td>
                            <td>{appt.receptionist_name || 'Unassigned'}</td>
                            <td>{appt.location_address || 'TBD'}</td>
                          </tr>
                        );
                      }) : <tr><td colSpan="6">No scheduled appointments for this date.</td></tr>}
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

              <article className="admin-panel" style={{ gridColumn: '1 / -1' }}>
                <h2>Cancelled Appointment Requests</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Preferred Date</th>
                        <th>Preferred Time</th>
                        <th>Location</th>
                        <th>Appointment Reason</th>
                        <th style={{ width: '80px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledRequests.length ? cancelledRequests.map((req) => (
                        <tr key={req.preference_request_id}>
                          <td>{req.patient_name}</td>
                          <td>{formatDate(req.preferred_date)}</td>
                          <td>{formatTime(req.preferred_time)}</td>
                          <td>{req.preferred_location || 'N/A'}</td>
                          <td>{req.appointment_reason || 'N/A'}</td>
                          <td>
                            <button
                              type="button"
                              style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                              onClick={async () => {
                                try {
                                  await safeJson(await fetch(`${API_BASE_URL}/api/admin/appointment-requests/${req.preference_request_id}/restore`, { method: 'PUT' }));
                                  setActionMessage('Request restored successfully.');
                                  loadAdminData();
                                } catch (err) {
                                  setActionMessage(err.message || 'Failed to restore request.');
                                }
                              }}
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      )) : <tr><td colSpan="6">No cancelled requests.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="admin-panel">
                <h2>Cancelled Appointments</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Patient</th>
                        <th>Dentist</th>
                        <th>Location</th>
                        <th>Cancel Reason</th>
                        <th>Cancelled By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledAppointments.length ? cancelledAppointments.map((appt) => (
                        <tr key={appt.appointment_id}>
                          <td>{formatDate(appt.appointment_date)}</td>
                          <td>{formatTime(appt.appointment_time)}</td>
                          <td>{appt.patient_name}</td>
                          <td>{appt.doctor_name}</td>
                          <td>{appt.location || 'N/A'}</td>
                          <td>{appt.cancel_reason || '—'}</td>
                          <td>{appt.cancelled_by || '—'}</td>
                        </tr>
                      )) : <tr><td colSpan="7">No cancelled appointments.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="admin-panel" style={{ gridColumn: '1 / -1' }}>
                <h2>Follow-Up Recall Queue</h2>
                <p className="muted">
                  Overdue: {followUpQueue.summary?.overdue || 0} | Due Today: {followUpQueue.summary?.dueToday || 0} | Upcoming: {followUpQueue.summary?.upcoming || 0} | Unscheduled: {followUpQueue.summary?.unscheduled || 0}
                </p>
                <label className="admin-inline-filter" style={{ marginBottom: '0.6rem', display: 'inline-flex' }}>
                  <input
                    type="checkbox"
                    checked={includeScheduledFollowUps}
                    onChange={(e) => setIncludeScheduledFollowUps(e.target.checked)}
                    style={{ marginRight: '0.45rem' }}
                  />
                  Include already scheduled patients
                </label>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Phone</th>
                        <th>Follow-Up Date</th>
                        <th>Status</th>
                        <th>Procedures</th>
                        <th>Suggested Dentist</th>
                        <th>Next Appointment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {followUpQueue.items?.length ? followUpQueue.items.map((item) => (
                        <tr key={`${item.patientId}-${item.followUpDate}`}>
                          <td>{item.patientName}</td>
                          <td>{item.phone || 'N/A'}</td>
                          <td>{formatDate(item.followUpDate)}</td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: item.dueState === 'OVERDUE' ? '#f8d7da' : item.dueState === 'DUE_TODAY' ? '#fff3cd' : '#e7f1ff',
                                color: item.dueState === 'OVERDUE' ? '#721c24' : item.dueState === 'DUE_TODAY' ? '#856404' : '#1f4d7a'
                              }}
                            >
                              {item.dueState === 'OVERDUE' ? `Overdue (${Math.abs(Number(item.daysUntilDue || 0))}d)` : item.dueState === 'DUE_TODAY' ? 'Due Today' : `Upcoming (${Number(item.daysUntilDue || 0)}d)`}
                            </span>
                            {item.isAlreadyScheduled && (
                              <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#155724', fontWeight: 700 }}>
                                Scheduled
                              </span>
                            )}
                          </td>
                          <td>{Array.isArray(item.procedureCodes) && item.procedureCodes.length ? item.procedureCodes.join(', ') : 'N/A'}</td>
                          <td>{item.suggestedDoctorName || 'Any available dentist'}</td>
                          <td>{item.nextAppointmentDate ? formatDate(item.nextAppointmentDate) : 'Not booked'}</td>
                        </tr>
                      )) : <tr><td colSpan="7">No follow-ups due in the selected recall window.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}

          {activeSection === 'reports' && (
            <>
              <section className="admin-panel">
                <div className="admin-panel-header-row">
                  <div>
                    <p className="admin-label" style={{ marginBottom: '0.25rem' }}>Clinic Performance</p>
                    <h2 style={{ margin: 0 }}>How the practice is doing</h2>
                    <p className="muted">Production, collections, provider output, patient growth, and outstanding balances for the selected range.</p>
                  </div>
                  <div className="report-date-range">
                    <label className="admin-inline-filter">
                      From
                      <input type="date" value={clinicReportDateFrom} onChange={(e) => setClinicReportDateFrom(e.target.value)} />
                    </label>
                    <label className="admin-inline-filter">
                      To
                      <input type="date" value={clinicReportDateTo} onChange={(e) => setClinicReportDateTo(e.target.value)} />
                    </label>
                    <button type="button" className="admin-btn" onClick={loadClinicPerformanceReport} disabled={clinicPerformanceLoading}>
                      {clinicPerformanceLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {clinicPerformanceError && <p className="admin-error">{clinicPerformanceError}</p>}
                {clinicPerformanceReport.generatedAt && (
                  <p className="muted">Generated {new Date(clinicPerformanceReport.generatedAt).toLocaleString()}</p>
                )}
              </section>

              {clinicPerformanceLoading && <p className="admin-loading">Loading clinic performance report...</p>}

              {!clinicPerformanceLoading && clinicPerformanceReport.summary && (
                <>
                  <section className="admin-metrics-grid">
                    <article className="metric-card">
                      <h2>Production</h2>
                      <p>{formatMoney(clinicPerformanceReport.summary.totalProduction)}</p>
                      <small>Gross charges in range</small>
                    </article>
                    <article className="metric-card">
                      <h2>Collected</h2>
                      <p>{formatMoney(clinicPerformanceReport.summary.netCollected)}</p>
                      <small>After refunds</small>
                    </article>
                    <article className="metric-card">
                      <h2>Collection Rate</h2>
                      <p>{formatPercent(clinicPerformanceReport.summary.collectionRate)}</p>
                      <small>Collected vs patient responsibility</small>
                    </article>
                    <article className="metric-card">
                      <h2>Outstanding A/R</h2>
                      <p style={{ color: clinicPerformanceReport.summary.totalOutstanding > 0 ? '#9d2e2e' : 'inherit' }}>
                        {formatMoney(clinicPerformanceReport.summary.totalOutstanding)}
                      </p>
                    </article>
                    <article className="metric-card">
                      <h2>Completed Visits</h2>
                      <p>{clinicPerformanceReport.summary.completedAppointments}</p>
                      <small>{formatPercent(clinicPerformanceReport.summary.completionRate)} completion rate</small>
                    </article>
                    <article className="metric-card">
                      <h2>No-Shows</h2>
                      <p>{clinicPerformanceReport.summary.noShowAppointments}</p>
                      <small>{formatPercent(clinicPerformanceReport.summary.noShowRate)} no-show rate</small>
                    </article>
                    <article className="metric-card">
                      <h2>New Patients</h2>
                      <p>{clinicPerformanceReport.summary.newPatients}</p>
                      <small>Registered in range</small>
                    </article>
                    <article className="metric-card">
                      <h2>Active Patients</h2>
                      <p>{clinicPerformanceReport.summary.activePatients}</p>
                      <small>Seen in range</small>
                    </article>
                  </section>

                  <section className="admin-grid-two">
                    <article className="admin-panel" style={{ gridColumn: '1 / -1' }}>
                      <h2>Production & Collections by Month</h2>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>Appointments</th>
                              <th>Completed</th>
                              <th>Cancelled</th>
                              <th>No-Show</th>
                              <th>Production</th>
                              <th>Collected</th>
                              <th>Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinicPerformanceReport.monthlyTrends.length ? clinicPerformanceReport.monthlyTrends.map((row) => (
                              <tr key={row.period_key}>
                                <td>{row.period_label}</td>
                                <td>{row.total_appointments}</td>
                                <td>{row.completed_appointments}</td>
                                <td>{row.cancelled_appointments}</td>
                                <td>{row.no_show_appointments}</td>
                                <td>{formatMoney(row.total_production)}</td>
                                <td>{formatMoney(row.total_collected)}</td>
                                <td>{formatMoney(row.total_outstanding)}</td>
                              </tr>
                            )) : <tr><td colSpan="8">No monthly trend data for this range.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>

                    <article className="admin-panel" style={{ gridColumn: '1 / -1' }}>
                      <h2>Provider Productivity</h2>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Provider</th>
                              <th>Appointments</th>
                              <th>Completed</th>
                              <th>Cancelled</th>
                              <th>No-Show</th>
                              <th>Production</th>
                              <th>Collected</th>
                              <th>Collection Rate</th>
                              <th>Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinicPerformanceReport.providerPerformance.length ? clinicPerformanceReport.providerPerformance.map((row) => {
                              const collectionRate = Number(row.total_production || 0) > 0
                                ? (Number(row.total_collected || 0) / Number(row.total_production || 0)) * 100
                                : 0;
                              return (
                                <tr key={row.doctor_id}>
                                  <td>Dr. {row.doctor_name}</td>
                                  <td>{row.total_appointments}</td>
                                  <td>{row.completed_appointments}</td>
                                  <td>{row.cancelled_appointments}</td>
                                  <td>{row.no_show_appointments}</td>
                                  <td>{formatMoney(row.total_production)}</td>
                                  <td>{formatMoney(row.total_collected)}</td>
                                  <td>{formatPercent(collectionRate)}</td>
                                  <td>{formatMoney(row.total_outstanding)}</td>
                                </tr>
                              );
                            }) : <tr><td colSpan="9">No provider productivity data for this range.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>

                    <article className="admin-panel">
                      <h2>Patient Growth</h2>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>New Patients</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinicPerformanceReport.newPatientsTrend.length ? clinicPerformanceReport.newPatientsTrend.map((row) => (
                              <tr key={row.period_key}>
                                <td>{row.period_label}</td>
                                <td>{row.new_patients}</td>
                              </tr>
                            )) : <tr><td colSpan="2">No patient growth data for this range.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>

                    <article className="admin-panel">
                      <h2>Outstanding Accounts</h2>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Patient</th>
                              <th>Phone</th>
                              <th>Invoices</th>
                              <th>Charged</th>
                              <th>Insurance</th>
                              <th>Patient Owes</th>
                              <th>Paid</th>
                              <th>Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinicPerformanceReport.outstandingPatients.length ? clinicPerformanceReport.outstandingPatients.map((row) => (
                              <tr key={row.patient_id}>
                                <td>{row.patient_name}</td>
                                <td>{row.p_phone || 'N/A'}</td>
                                <td>{row.total_invoices}</td>
                                <td>{formatMoney(row.total_charged)}</td>
                                <td>{formatMoney(row.insurance_covered)}</td>
                                <td>{formatMoney(row.patient_responsibility)}</td>
                                <td>{formatMoney(row.patient_paid)}</td>
                                <td style={{ color: '#9d2e2e', fontWeight: 700 }}>{formatMoney(row.patient_due)}</td>
                              </tr>
                            )) : <tr><td colSpan="8">No outstanding balances to show.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  </section>
                </>
              )}
            </>
          )}

          {activeSection === 'staff-scheduling' && (
            <>
              {/* Pending Schedule Requests — collapsible per staff */}
              <section className="admin-panel">
                <h2>Pending Schedule Requests</h2>
                <p className="muted">Staff members requesting preferred work hours. Approve or deny all days at once.</p>
                {(() => {
                  if (!scheduleRequests.length) return <p>No pending schedule requests.</p>;
                  // Group by staff_id
                  const grouped = {};
                  scheduleRequests.forEach((r) => {
                    if (!grouped[r.staff_id]) grouped[r.staff_id] = { staff_name: r.staff_name, role: r.role, staff_id: r.staff_id, submitted_at: r.submitted_at, entries: [] };
                    grouped[r.staff_id].entries.push(r);
                  });
                  const staffList = Object.values(grouped);

                  return staffList.map((staff) => {
                    const isOpen = !!expandedStaff[`req_${staff.staff_id}`];

                    const approveAll = async () => {
                      try {
                        for (const entry of staff.entries) {
                          await safeJson(await fetch(`${API_BASE_URL}/api/admin/schedule-requests/${entry.request_id}/approve`, { method: 'PUT' }));
                        }
                        setActionMessage(`All schedule requests approved for ${staff.staff_name}.`);
                        loadAdminData();
                      } catch (err) {
                        setActionMessage(err.message || 'Failed to approve.');
                      }
                    };

                    const denyAll = async () => {
                      try {
                        for (const entry of staff.entries) {
                          await safeJson(await fetch(`${API_BASE_URL}/api/admin/schedule-requests/${entry.request_id}/deny`, { method: 'PUT' }));
                        }
                        setActionMessage(`All schedule requests denied for ${staff.staff_name}.`);
                        loadAdminData();
                      } catch (err) {
                        setActionMessage(err.message || 'Failed to deny.');
                      }
                    };

                    return (
                      <div key={staff.staff_id} style={{ border: '1px solid #ddd', borderRadius: '6px', marginBottom: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedStaff((prev) => ({ ...prev, [`req_${staff.staff_id}`]: !prev[`req_${staff.staff_id}`] }))}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', background: '#fff8e1', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, borderRadius: isOpen ? '6px 6px 0 0' : '6px' }}
                        >
                          <span>{staff.staff_name} <span style={{ fontWeight: 400, color: '#666', fontSize: '0.85rem' }}>({String(staff.role || '').replace('_', ' ')}) — {staff.entries.length} day(s) — {new Date(staff.submitted_at).toLocaleDateString()}</span></span>
                          <span>{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0.7rem 1rem' }}>
                            <table style={{ width: '100%', fontSize: '0.9rem' }}>
                              <thead><tr><th style={{ textAlign: 'left' }}>Day</th><th style={{ textAlign: 'left' }}>Start</th><th style={{ textAlign: 'left' }}>End</th></tr></thead>
                              <tbody>
                                {staff.entries.map((r) => (
                                  <tr key={r.request_id}>
                                    <td>{r.day_of_week.charAt(0) + r.day_of_week.slice(1).toLowerCase()}</td>
                                    <td>{r.is_off ? <em style={{ color: '#999' }}>OFF</em> : String(r.start_time || '').slice(0, 5)}</td>
                                    <td>{r.is_off ? '' : String(r.end_time || '').slice(0, 5)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button type="button" onClick={approveAll} style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Approve All</button>
                              <button type="button" onClick={denyAll} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Deny All</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </section>

              {/* Current Staff Schedules — collapsible per staff */}
              <section className="admin-panel">
                <h2>Current Staff Schedules</h2>
                <p className="muted">Approved work schedules for all active staff. Click a name to expand and edit.</p>
                {(() => {
                  // Group schedules by staff_id
                  const grouped = {};
                  allStaffSchedules.forEach((s) => {
                    if (!grouped[s.staff_id]) grouped[s.staff_id] = { staff_name: s.staff_name, role: s.role, staff_id: s.staff_id, days: [] };
                    grouped[s.staff_id].days.push(s);
                  });
                  const staffList = Object.values(grouped);
                  if (!staffList.length) return <p>No staff schedules configured yet.</p>;

                  return staffList.map((staff) => {
                    const isOpen = !!expandedStaff[staff.staff_id];
                    const editing = editingSchedules[staff.staff_id];

                    const startEditing = () => {
                      const entries = ADMIN_DAYS.map((day) => {
                        const existing = staff.days.find((d) => d.day_of_week === day);
                        if (existing && existing.is_off) return { day, startTime: '09:00', endTime: '17:00', isOff: true };
                        if (existing) return { day, startTime: String(existing.start_time || '').slice(0, 5), endTime: String(existing.end_time || '').slice(0, 5), isOff: false };
                        return { day, startTime: '09:00', endTime: '17:00', isOff: true };
                      });
                      setEditingSchedules((prev) => ({ ...prev, [staff.staff_id]: entries }));
                    };

                    const updateEntry = (dayIdx, field, value) => {
                      setEditingSchedules((prev) => ({
                        ...prev,
                        [staff.staff_id]: prev[staff.staff_id].map((e, i) => i === dayIdx ? { ...e, [field]: value } : e)
                      }));
                    };

                    const saveSchedule = async () => {
                      try {
                        const resp = await fetch(`${API_BASE_URL}/api/admin/staff-schedules/update`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ staffId: staff.staff_id, entries: editing })
                        });
                        const result = await safeJson(resp);
                        setActionMessage(result.message || 'Schedule updated.');
                        setEditingSchedules((prev) => { const copy = { ...prev }; delete copy[staff.staff_id]; return copy; });
                        loadAdminData();
                      } catch (err) {
                        setActionMessage(err.message || 'Failed to update schedule.');
                      }
                    };

                    return (
                      <div key={staff.staff_id} style={{ border: '1px solid #ddd', borderRadius: '6px', marginBottom: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setExpandedStaff((prev) => ({ ...prev, [staff.staff_id]: !prev[staff.staff_id] }))}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', background: '#f8f9fa', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, borderRadius: isOpen ? '6px 6px 0 0' : '6px' }}
                        >
                          <span>{staff.staff_name} <span style={{ fontWeight: 400, color: '#666', fontSize: '0.85rem' }}>({String(staff.role || '').replace('_', ' ')})</span></span>
                          <span>{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                          <div style={{ padding: '0.7rem 1rem' }}>
                            {!editing ? (
                              <>
                                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                  <thead><tr><th style={{ textAlign: 'left' }}>Day</th><th style={{ textAlign: 'left' }}>Start</th><th style={{ textAlign: 'left' }}>End</th></tr></thead>
                                  <tbody>
                                    {staff.days.map((d, i) => (
                                      <tr key={i}>
                                        <td>{d.day_of_week.charAt(0) + d.day_of_week.slice(1).toLowerCase()}</td>
                                        <td>{d.is_off ? <em style={{ color: '#999' }}>OFF</em> : String(d.start_time || '').slice(0, 5)}</td>
                                        <td>{d.is_off ? '' : String(d.end_time || '').slice(0, 5)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <button type="button" onClick={startEditing} style={{ marginTop: '0.5rem', background: '#2980b9', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Edit Schedule</button>
                              </>
                            ) : (
                              <>
                                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                                  <thead><tr><th style={{ textAlign: 'left' }}>Day</th><th style={{ textAlign: 'left' }}>OFF</th><th style={{ textAlign: 'left' }}>Start</th><th style={{ textAlign: 'left' }}>End</th></tr></thead>
                                  <tbody>
                                    {editing.map((entry, dayIdx) => (
                                      <tr key={entry.day}>
                                        <td>{entry.day.charAt(0) + entry.day.slice(1).toLowerCase()}</td>
                                        <td>
                                          <input type="checkbox" checked={!!entry.isOff} onChange={(e) => updateEntry(dayIdx, 'isOff', e.target.checked)} />
                                        </td>
                                        <td>
                                          {entry.isOff ? <span style={{ color: '#999' }}>—</span> : (
                                            <select value={entry.startTime} onChange={(e) => updateEntry(dayIdx, 'startTime', e.target.value)} style={{ fontSize: '0.85rem' }}>
                                              {ADMIN_TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                          )}
                                        </td>
                                        <td>
                                          {entry.isOff ? <span style={{ color: '#999' }}>—</span> : (
                                            <select value={entry.endTime} onChange={(e) => updateEntry(dayIdx, 'endTime', e.target.value)} style={{ fontSize: '0.85rem' }}>
                                              {ADMIN_TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                  <button type="button" onClick={saveSchedule} style={{ background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Save</button>
                                  <button type="button" onClick={() => setEditingSchedules((prev) => { const copy = { ...prev }; delete copy[staff.staff_id]; return copy; })} style={{ background: '#95a5a6', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Cancel</button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </section>

              {/* Coverage Gaps */}
              <section className="admin-panel">
                <h2>Coverage Gaps</h2>
                <p className="muted">Hours during clinic operating times (Mon–Sat, 9 AM – 7 PM) with missing staff coverage.</p>
                {scheduleGaps.length > 0 ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Gap Start</th>
                          <th>Gap End</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleGaps.map((g, idx) => (
                          <tr key={idx} style={{ background: g.type === 'NO_COVERAGE' ? '#f8d7da' : g.type === 'NO_DOCTOR' ? '#fff3cd' : '#e8f0fe' }}>
                            <td>{g.day_of_week.charAt(0) + g.day_of_week.slice(1).toLowerCase()}</td>
                            <td>{String(g.gap_start || '').slice(0, 5)}</td>
                            <td>{String(g.gap_end || '').slice(0, 5)}</td>
                            <td>{g.type === 'NO_COVERAGE' ? 'No staff at all' : g.type === 'NO_DOCTOR' ? 'No doctor' : 'No receptionist'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>Full coverage across all clinic hours.</p>
                )}
              </section>
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
                        <input type="password" placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" value={doctorForm.password} onChange={(e) => setDoctorForm((prev) => ({ ...prev, password: e.target.value }))} minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}" title="At least 8 characters, 1 uppercase, 1 lowercase, and 1 number" required />
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
                        <input type="password" placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" value={receptionistForm.password} onChange={(e) => setReceptionistForm((prev) => ({ ...prev, password: e.target.value }))} minLength={8} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}" title="At least 8 characters, 1 uppercase, 1 lowercase, and 1 number" required />
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

                <article className="admin-panel admin-panel-wide collapsible-panel">
                  <button
                    type="button"
                    className="collapse-toggle"
                    onClick={() => setExpandedCards((prev) => ({ ...prev, manageStaff: !prev.manageStaff }))}
                    aria-expanded={expandedCards.manageStaff}
                  >
                    <span>Manage Staff (Passwords &amp; Visibility)</span>
                    <span>{expandedCards.manageStaff ? 'Hide' : 'Show'}</span>
                  </button>
                  {expandedCards.manageStaff && (
                    <div className="collapse-content">
                      <p className="muted">Reset staff passwords or hide/restore staff members. Hidden staff cannot log in and are excluded from public views.</p>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Username</th>
                              <th>Role</th>
                              <th>Email</th>
                              <th>Location</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allStaff.length ? allStaff.map((member) => (
                              <tr key={member.staff_id} style={member.is_deleted ? { opacity: 0.5 } : {}}>
                                <td>{member.first_name} {member.last_name}</td>
                                <td>{member.user_username}</td>
                                <td>{member.user_role}</td>
                                <td>{member.user_email}</td>
                                <td>{member.location_address || 'Unassigned'}</td>
                                <td>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: member.is_deleted ? '#f8d7da' : '#d4edda',
                                    color: member.is_deleted ? '#721c24' : '#155724'
                                  }}>
                                    {member.is_deleted ? 'Hidden' : 'Active'}
                                  </span>
                                </td>
                                <td>
                                  <div className="admin-row-actions" style={{ flexDirection: 'column', gap: '0.3rem' }}>
                                    <button
                                      type="button"
                                      className="admin-action-btn approve"
                                      onClick={() => handleToggleVisibility(member.staff_id)}
                                    >
                                      {member.is_deleted ? 'Restore' : 'Hide'}
                                    </button>
                                    {resetPasswordStaffId === member.staff_id ? (
                                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                        <input
                                          type="password"
                                          placeholder="New password"
                                          value={resetPasswordValue}
                                          onChange={(e) => setResetPasswordValue(e.target.value)}
                                          style={{ width: '160px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                          minLength={8}
                                          title="At least 8 characters, 1 uppercase, 1 lowercase, and 1 number"
                                        />
                                        <button type="button" className="admin-action-btn approve" onClick={() => handleResetPassword(member.staff_id)}>Set</button>
                                        <button type="button" className="admin-action-btn deny" onClick={() => { setResetPasswordStaffId(null); setResetPasswordValue(''); }}>X</button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        className="admin-action-btn deny"
                                        onClick={() => { setResetPasswordStaffId(member.staff_id); setResetPasswordValue(''); }}
                                      >
                                        Reset Password
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )) : <tr><td colSpan="7">No staff members found.</td></tr>}
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
