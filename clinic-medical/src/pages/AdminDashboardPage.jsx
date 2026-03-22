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
  const [refundHistory, setRefundHistory] = useState([]);
  const [refundForm, setRefundForm] = useState({ invoiceId: '', amount: '', reason: '' });
  const [invoiceLookup, setInvoiceLookup] = useState(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [schedulingPage, setSchedulingPage] = useState(0);
  const schedulingPageSize = 15;
  const [docSchedPage, setDocSchedPage] = useState(0);
  const docSchedPageSize = 20;
  const [docSchedSearch, setDocSchedSearch] = useState('');
  const filteredDocSchedule = useMemo(() => {
    const q = docSchedSearch.trim().toLowerCase();
    if (!q) return staffReport.schedule;
    return staffReport.schedule.filter((row) => (row.doctor_name || '').toLowerCase().includes(q));
  }, [staffReport.schedule, docSchedSearch]);

  const sortFinancial = useSortState();
  const sortScheduling = useSortState();
  const sortWorkload = useSortState();
  const sortDoctorSchedule = useSortState();
  const sortTimeOff = useSortState();
  const sortGenReport = useSortState();
  const sortRefund = useSortState();

  // Generate Report state
  const [genReportDateFrom, setGenReportDateFrom] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [genReportDateTo, setGenReportDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [genReportFilters, setGenReportFilters] = useState({
    zipCode: '', locationId: '', patientCity: '', patientState: '', treatmentCode: '', departmentId: '', doctorId: ''
  });
  const [genReportData, setGenReportData] = useState(null);
  const [genReportLoading, setGenReportLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ locations: [], departments: [], doctors: [], treatments: [] });

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
      const [summaryData, queueData, reportData, doctorData, receptionistData, locationData, timeOffData, cancelledData, schedReqData, staffSchedData, gapsData, refundData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/dashboard/summary?date=${selectedDate}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/appointments/queue?date=${selectedDate}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/reports/patients?date=${selectedDate}${reportStatus === 'ALL' ? '' : `&status=${reportStatus}`}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/doctors`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff/receptionists`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/locations`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff/time-off-requests`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/appointment-requests/cancelled`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/schedule-requests`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff-schedules`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/staff-schedules/gaps`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/refunds`).then(safeJson)
      ]);

      setSummary(summaryData);
      setQueue(queueData);
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

  const loadFilterOptions = async () => {
    try {
      const data = await fetch(`${API_BASE_URL}/api/admin/reports/filter-options`).then(safeJson);
      setFilterOptions(data);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const handleGenerateReport = async () => {
    setGenReportLoading(true);
    setGenReportData(null);
    setError('');
    try {
      const params = new URLSearchParams({ dateFrom: genReportDateFrom, dateTo: genReportDateTo });
      if (genReportFilters.zipCode) params.set('zipCode', genReportFilters.zipCode);
      if (genReportFilters.locationId) params.set('locationId', genReportFilters.locationId);
      if (genReportFilters.patientCity) params.set('patientCity', genReportFilters.patientCity);
      if (genReportFilters.patientState) params.set('patientState', genReportFilters.patientState);
      if (genReportFilters.treatmentCode) params.set('treatmentCode', genReportFilters.treatmentCode);
      if (genReportFilters.departmentId) params.set('departmentId', genReportFilters.departmentId);
      if (genReportFilters.doctorId) params.set('doctorId', genReportFilters.doctorId);
      const data = await fetch(`${API_BASE_URL}/api/admin/reports/generate?${params.toString()}`).then(safeJson);
      setGenReportData(data);
    } catch (err) {
      setError(err.message || 'Failed to generate report.');
    } finally {
      setGenReportLoading(false);
    }
  };

  const exportReportCSV = () => {
    if (!genReportData?.rows?.length) return;
    const headers = ['Date', 'Time', 'Patient', 'Patient City', 'Patient State', 'Patient Zip', 'Doctor', 'Clinic Location', 'Clinic City', 'Clinic State', 'Clinic Zip', 'Treatment', 'Department', 'Payment Status', 'Invoice Total', 'Patient Amount'];
    const csvRows = [headers.join(',')];
    genReportData.rows.forEach((r) => {
      csvRows.push([
        r.appointment_date, r.appointment_time,
        `"${(r.patient_name || '').replace(/"/g, '""')}"`,
        `"${r.patient_city || ''}"`, r.patient_state || '', r.patient_zip || '',
        `"${(r.doctor_name || '').replace(/"/g, '""')}"`,
        `"${(r.clinic_location || '').replace(/"/g, '""')}"`,
        r.clinic_city || '', r.clinic_state || '', r.clinic_zip || '',
        `"${(r.treatment_name || 'N/A').replace(/"/g, '""')}"`,
        `"${(r.department_name || 'N/A').replace(/"/g, '""')}"`,
        r.payment_status, r.invoice_total, r.patient_amount
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clinic_report_${genReportDateFrom}_to_${genReportDateTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportReportJSON = () => {
    if (!genReportData) return;
    const blob = new Blob([JSON.stringify(genReportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clinic_report_${genReportDateFrom}_to_${genReportDateTo}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportReportPDF = () => {
    if (!genReportData?.rows?.length) return;
    const printWin = window.open('', '_blank');
    const rows = genReportData.rows;
    const tableRows = rows.map((r) => `<tr>
      <td>${r.appointment_date || ''}</td>
      <td>${r.appointment_time || ''}</td>
      <td>${r.patient_name || ''}</td>
      <td>${r.patient_city || ''}${r.patient_state ? ', ' + r.patient_state : ''} ${r.patient_zip || ''}</td>
      <td>${r.doctor_name || ''}</td>
      <td>${r.clinic_location || ''}</td>
      <td>${r.treatment_name || 'N/A'}</td>
      <td>${r.department_name || 'N/A'}</td>
      <td>${r.payment_status || ''}</td>
    </tr>`).join('');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Clinic Report</title>
      <style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f0f0f0}h1{font-size:18px}p{font-size:12px;color:#555}</style>
    </head><body>
      <h1>Patient General Report</h1>
      <p>Date Range: ${genReportDateFrom} to ${genReportDateTo} | Total Records: ${rows.length} | Generated: ${genReportData.generatedAt}</p>
      <table><thead><tr><th>Date</th><th>Time</th><th>Patient</th><th>Patient Location</th><th>Doctor</th><th>Clinic Location</th><th>Treatment</th><th>Department</th><th>Payment</th></tr></thead><tbody>${tableRows}</tbody></table>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
    printWin.document.close();
  };

  useEffect(() => {
    if (reportType === 'generate') {
      loadFilterOptions();
    }
  }, [reportType]);

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
      // Show all when searching, only unpaid when not searching
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
          {activeSection !== 'staffing' && activeSection !== 'staff-scheduling' && (
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
                        <th>Reason</th>
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
                    <button
                      type="button"
                      className={reportType === 'generate' ? 'report-type-btn is-active' : 'report-type-btn'}
                      onClick={() => setReportType('generate')}
                    >
                      Patient General Report
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
                        {!financialSearch.trim() && <> | Showing {filteredFinancialRows.length} unpaid</>}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0' }}>
                        <input
                          type="text"
                          placeholder="Search by patient name or phone..."
                          value={financialSearch}
                          onChange={(e) => setFinancialSearch(e.target.value)}
                          style={{ flex: 1, maxWidth: '360px', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem' }}
                        />
                        {financialSearch.trim() && (
                          <button type="button" onClick={() => setFinancialSearch('')} style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer', fontSize: '0.85rem' }}>
                            Clear
                          </button>
                        )}
                        <span className="muted" style={{ fontSize: '0.8rem' }}>
                          {financialSearch.trim() ? `${filteredFinancialRows.length} result${filteredFinancialRows.length !== 1 ? 's' : ''} (all statuses)` : 'Only unpaid shown — search to see all'}
                        </span>
                      </div>
                      <div className="table-wrap" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                        <table>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr>
                              <SortTh sort={sortFinancial} column="patient_name">Patient</SortTh>
                              <SortTh sort={sortFinancial} column="p_phone">Phone</SortTh>
                              <SortTh sort={sortFinancial} column="total_invoices">Invoices</SortTh>
                              <SortTh sort={sortFinancial} column="unpaid_invoices">Unpaid</SortTh>
                              <SortTh sort={sortFinancial} column="total_charged">Total Charged</SortTh>
                              <SortTh sort={sortFinancial} column="total_insurance_covered">Insurance Covered</SortTh>
                              <SortTh sort={sortFinancial} column="total_patient_responsibility">Patient Owes</SortTh>
                              <SortTh sort={sortFinancial} column="total_paid">Paid</SortTh>
                              <SortTh sort={sortFinancial} column="total_outstanding">Outstanding</SortTh>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredFinancialRows.length ? sortFinancial.sorted(filteredFinancialRows).map((row) => {
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
                            }) : <tr><td colSpan="9">{financialSearch.trim() ? 'No matching patients found.' : 'No unpaid invoices.'}</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>

                  </section>

                  <section className="admin-panel">
                    <h2>Refund Management</h2>
                    <p className="muted">Process refunds for overpaid invoices and view refund history. Total refunds: {refundHistory.length} | Total refunded: {formatMoney(refundHistory.reduce((s, r) => s + Number(r.refund_amount || 0), 0))}</p>

                    <div style={{ margin: '0.75rem 0', padding: '0.75rem', border: '1px solid #d7e7e5', borderRadius: '10px', background: '#f9fcfb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Invoice ID
                          <input type="number" placeholder="e.g. 5" value={refundForm.invoiceId} onChange={(e) => { setRefundForm((p) => ({ ...p, invoiceId: e.target.value })); lookupInvoice(e.target.value); }} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.85rem' }} />
                        </label>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Refund Amount
                          <input type="number" step="0.01" placeholder="0.00" value={refundForm.amount} onChange={(e) => setRefundForm((p) => ({ ...p, amount: e.target.value }))} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.85rem' }} />
                        </label>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Reason
                          <input type="text" placeholder="Treatment cost adjusted" value={refundForm.reason} onChange={(e) => setRefundForm((p) => ({ ...p, reason: e.target.value }))} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.85rem' }} />
                        </label>
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <button type="button" onClick={processRefund} style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', background: '#9d2e2e', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}>
                            Process Refund
                          </button>
                        </div>
                      </div>
                      {invoiceLookupLoading && <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>Looking up invoice...</p>}
                      {invoiceLookup && Number(refundForm.invoiceId) === invoiceLookup.invoice_id && (
                        <div style={{ marginTop: '0.6rem', padding: '0.6rem', background: '#eef5f4', borderRadius: '8px', fontSize: '0.83rem' }}>
                          <p style={{ margin: 0 }}><strong>{invoiceLookup.patient_name}</strong> — Invoice #{invoiceLookup.invoice_id} | Appt: {formatDate(invoiceLookup.appointment_date)}</p>
                          <p style={{ margin: '0.2rem 0' }}>
                            Charged: {formatMoney(invoiceLookup.amount)} | Patient responsibility: {formatMoney(invoiceLookup.patient_amount)} | Paid: {formatMoney(invoiceLookup.net_paid)} | Outstanding: {formatMoney(Math.max(Number(invoiceLookup.patient_amount) - invoiceLookup.net_paid, 0))} | Status: {invoiceLookup.payment_status}
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                            {invoiceLookup.overpayment > 0 && (
                              <button type="button" onClick={() => setRefundForm((p) => ({ ...p, amount: String(invoiceLookup.overpayment), reason: p.reason || 'Overpayment — treatment cost reduced' }))}
                                style={{ padding: '0.3rem 0.7rem', borderRadius: '6px', border: '1px solid #2a7d6e', background: '#d4edda', color: '#155724', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                                Difference: {formatMoney(invoiceLookup.overpayment)}
                              </button>
                            )}
                            {invoiceLookup.max_refundable > 0 && (
                              <button type="button" onClick={() => setRefundForm((p) => ({ ...p, amount: String(invoiceLookup.max_refundable), reason: p.reason || 'Full refund' }))}
                                style={{ padding: '0.3rem 0.7rem', borderRadius: '6px', border: '1px solid #9d2e2e', background: '#f8d7da', color: '#721c24', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                                Full Refund: {formatMoney(invoiceLookup.max_refundable)}
                              </button>
                            )}
                            {invoiceLookup.max_refundable <= 0 && invoiceLookup.overpayment <= 0 && (
                              <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>No payments to refund.</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {refundHistory.length > 0 && (
                      <div className="table-wrap" style={{ maxHeight: '360px', overflowY: 'auto', marginTop: '0.5rem' }}>
                        <table>
                          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr>
                              <SortTh sort={sortRefund} column="refund_id">ID</SortTh>
                              <SortTh sort={sortRefund} column="patient_name">Patient</SortTh>
                              <SortTh sort={sortRefund} column="invoice_id">Invoice</SortTh>
                              <SortTh sort={sortRefund} column="refund_amount">Amount</SortTh>
                              <SortTh sort={sortRefund} column="reason">Reason</SortTh>
                              <SortTh sort={sortRefund} column="appointment_date">Appt Date</SortTh>
                              <SortTh sort={sortRefund} column="created_at">Refunded On</SortTh>
                            </tr>
                          </thead>
                          <tbody>
                            {sortRefund.sorted(refundHistory).map((r) => (
                              <tr key={r.refund_id}>
                                <td>{r.refund_id}</td>
                                <td>{r.patient_name}</td>
                                <td>#{r.invoice_id}</td>
                                <td style={{ fontWeight: 700, color: '#9d2e2e' }}>-{formatMoney(r.refund_amount)}</td>
                                <td>{r.reason || 'N/A'}</td>
                                <td>{formatDate(r.appointment_date)}</td>
                                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section className="admin-panel">
                    <h2>Report 2: Scheduling Confirmation Needed</h2>
                    <p className="muted">
                      Pending requests where staff must confirm date/time/location — pulls from appointment_preference_requests &amp; patients tables.
                      Count: {schedulingActionRows.length}
                      {schedulingActionRows.length > schedulingPageSize && (<> | Page {schedulingPage + 1} of {Math.ceil(schedulingActionRows.length / schedulingPageSize)}</>)}
                    </p>
                    <div className="table-wrap" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      <table>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <SortTh sort={sortScheduling} column="patient_name">Patient</SortTh>
                            <SortTh sort={sortScheduling} column="preferred_date">Preferred Date</SortTh>
                            <SortTh sort={sortScheduling} column="preferred_time">Preferred Time</SortTh>
                            <SortTh sort={sortScheduling} column="preferred_location">Preferred Location</SortTh>
                            <th>Action Needed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedulingActionRows.length ? sortScheduling.sorted(schedulingActionRows).slice(schedulingPage * schedulingPageSize, (schedulingPage + 1) * schedulingPageSize).map((row) => (
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
                    {schedulingActionRows.length > schedulingPageSize && (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                        <button type="button" disabled={schedulingPage === 0} onClick={() => setSchedulingPage((p) => p - 1)}
                          style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #ccc', background: schedulingPage === 0 ? '#eee' : '#fff', cursor: schedulingPage === 0 ? 'default' : 'pointer', fontSize: '0.85rem' }}>
                          Previous
                        </button>
                        <button type="button" disabled={(schedulingPage + 1) * schedulingPageSize >= schedulingActionRows.length} onClick={() => setSchedulingPage((p) => p + 1)}
                          style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #ccc', background: (schedulingPage + 1) * schedulingPageSize >= schedulingActionRows.length ? '#eee' : '#fff', cursor: (schedulingPage + 1) * schedulingPageSize >= schedulingActionRows.length ? 'default' : 'pointer', fontSize: '0.85rem' }}>
                          Next
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* ── GENERATE REPORT ── */}
              {reportType === 'generate' && (
                <>
                  <section className="admin-panel">
                    <h2>Patient General Report</h2>
                    <p className="muted">View completed appointments. Select a date range and optional filters, then export as PDF, CSV, or JSON.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
                      <label className="admin-inline-filter">
                        From
                        <input type="date" value={genReportDateFrom} onChange={(e) => setGenReportDateFrom(e.target.value)} required />
                      </label>
                      <label className="admin-inline-filter">
                        To
                        <input type="date" value={genReportDateTo} onChange={(e) => setGenReportDateTo(e.target.value)} required />
                      </label>
                      <label className="admin-inline-filter">
                        Zip Code
                        <input type="text" placeholder="e.g. 77004" maxLength={5} value={genReportFilters.zipCode} onChange={(e) => setGenReportFilters((prev) => ({ ...prev, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) }))} />
                      </label>
                      <label className="admin-inline-filter">
                        Clinic Location
                        <select value={genReportFilters.locationId} onChange={(e) => setGenReportFilters((prev) => ({ ...prev, locationId: e.target.value }))}>
                          <option value="">All Locations</option>
                          {filterOptions.locations.map((loc) => (
                            <option key={loc.location_id} value={loc.location_id}>{loc.full_address}</option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-inline-filter">
                        Patient City
                        <input type="text" placeholder="e.g. Houston" value={genReportFilters.patientCity} onChange={(e) => setGenReportFilters((prev) => ({ ...prev, patientCity: e.target.value }))} />
                      </label>
                      <label className="admin-inline-filter">
                        Patient State
                        <input type="text" placeholder="e.g. TX" maxLength={2} value={genReportFilters.patientState} onChange={(e) => setGenReportFilters((prev) => ({ ...prev, patientState: e.target.value.toUpperCase().slice(0, 2) }))} />
                      </label>
                      <label className="admin-inline-filter">
                        Treatment
                        <select value={genReportFilters.treatmentCode} onChange={(e) => setGenReportFilters((prev) => ({ ...prev, treatmentCode: e.target.value }))}>
                          <option value="">All Treatments</option>
                          {filterOptions.treatments.map((t) => (
                            <option key={t.procedure_code} value={t.procedure_code}>{t.procedure_code} - {t.description}</option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-inline-filter">
                        Department
                        <select value={genReportFilters.departmentId} onChange={(e) => setGenReportFilters((prev) => ({ ...prev, departmentId: e.target.value }))}>
                          <option value="">All Departments</option>
                          {filterOptions.departments.map((dep) => (
                            <option key={dep.department_id} value={dep.department_id}>{dep.department_name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-inline-filter">
                        Doctor
                        <select value={genReportFilters.doctorId} onChange={(e) => setGenReportFilters((prev) => ({ ...prev, doctorId: e.target.value }))}>
                          <option value="">All Doctors</option>
                          {filterOptions.doctors.map((doc) => (
                            <option key={doc.doctor_id} value={doc.doctor_id}>Dr. {doc.doctor_name}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" className="report-type-btn is-active" onClick={handleGenerateReport} disabled={genReportLoading}>
                        {genReportLoading ? 'Generating...' : 'Generate Report'}
                      </button>
                      {genReportData?.rows?.length > 0 && (
                        <>
                          <button type="button" className="report-type-btn" onClick={exportReportPDF}>Export PDF</button>
                          <button type="button" className="report-type-btn" onClick={exportReportCSV}>Export CSV</button>
                          <button type="button" className="report-type-btn" onClick={exportReportJSON}>Export JSON</button>
                        </>
                      )}
                    </div>
                  </section>

                  {genReportData && (
                    <section className="admin-panel">
                      <h2>Report Results</h2>
                      <p className="muted">
                        Date Range: {genReportData.dateFrom} to {genReportData.dateTo} | Total Records: {genReportData.totalRows} | Generated: {new Date(genReportData.generatedAt).toLocaleString()}
                      </p>
                      {genReportData.rows.length > 0 ? (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <SortTh sort={sortGenReport} column="appointment_date">Date</SortTh>
                                <SortTh sort={sortGenReport} column="appointment_time">Time</SortTh>
                                <SortTh sort={sortGenReport} column="patient_name">Patient</SortTh>
                                <SortTh sort={sortGenReport} column="patient_city">Patient Location</SortTh>
                                <SortTh sort={sortGenReport} column="doctor_name">Doctor</SortTh>
                                <SortTh sort={sortGenReport} column="clinic_location">Clinic Location</SortTh>
                                <SortTh sort={sortGenReport} column="treatment_name">Treatment</SortTh>
                                <SortTh sort={sortGenReport} column="department_name">Department</SortTh>
                                <SortTh sort={sortGenReport} column="payment_status">Payment</SortTh>
                              </tr>
                            </thead>
                            <tbody>
                              {sortGenReport.sorted(genReportData.rows).slice(0, 100).map((row, idx) => (
                                <tr key={idx}>
                                  <td>{formatDate(row.appointment_date)}</td>
                                  <td>{formatTime(row.appointment_time)}</td>
                                  <td>{row.patient_name}</td>
                                  <td>{row.patient_city || ''}{row.patient_state ? ', ' + row.patient_state : ''} {row.patient_zip || ''}</td>
                                  <td>Dr. {row.doctor_name}</td>
                                  <td>{row.clinic_location || 'N/A'}</td>
                                  <td>{row.treatment_name || 'N/A'}</td>
                                  <td>{row.department_name || 'N/A'}</td>
                                  <td>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '999px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      background: row.payment_status === 'Paid' ? '#d4edda' : row.payment_status === 'Partial' ? '#fff3cd' : '#f8d7da',
                                      color: row.payment_status === 'Paid' ? '#155724' : row.payment_status === 'Partial' ? '#856404' : '#721c24'
                                    }}>
                                      {row.payment_status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {genReportData.rows.length > 100 && (
                            <p className="muted" style={{ marginTop: '0.5rem' }}>Showing first 100 of {genReportData.rows.length} rows. Export for full data.</p>
                          )}
                        </div>
                      ) : (
                        <p>No records found matching your criteria.</p>
                      )}
                    </section>
                  )}
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
                            <SortTh sort={sortWorkload} column="doctor_name">Doctor</SortTh>
                            <SortTh sort={sortWorkload} column="phone_number">Phone</SortTh>
                            <SortTh sort={sortWorkload} column="total_appointments">Total Appts</SortTh>
                            <SortTh sort={sortWorkload} column="completed">Completed</SortTh>
                            <SortTh sort={sortWorkload} column="upcoming">Upcoming</SortTh>
                            <SortTh sort={sortWorkload} column="canceled">Canceled</SortTh>
                            <SortTh sort={sortWorkload} column="no_show">No-Show</SortTh>
                          </tr>
                        </thead>
                        <tbody>
                          {staffReport.workload.length ? sortWorkload.sorted(staffReport.workload).map((row) => (
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
                      {filteredDocSchedule.length !== staffReport.schedule.length && (<> | Showing: {filteredDocSchedule.length}</>)}
                      {filteredDocSchedule.length > docSchedPageSize && (<> | Page {docSchedPage + 1} of {Math.ceil(filteredDocSchedule.length / docSchedPageSize)}</>)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0' }}>
                      <input
                        type="text"
                        placeholder="Search by doctor name..."
                        value={docSchedSearch}
                        onChange={(e) => { setDocSchedSearch(e.target.value); setDocSchedPage(0); }}
                        style={{ flex: 1, maxWidth: '320px', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.9rem' }}
                      />
                      {docSchedSearch.trim() && (
                        <button type="button" onClick={() => { setDocSchedSearch(''); setDocSchedPage(0); }} style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #ccc', background: '#f5f5f5', cursor: 'pointer', fontSize: '0.85rem' }}>
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="table-wrap" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                      <table>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <SortTh sort={sortDoctorSchedule} column="doctor_name">Doctor</SortTh>
                            <SortTh sort={sortDoctorSchedule} column="appointment_date">Date</SortTh>
                            <SortTh sort={sortDoctorSchedule} column="appointment_time">Time</SortTh>
                            <SortTh sort={sortDoctorSchedule} column="patient_name">Patient</SortTh>
                            <SortTh sort={sortDoctorSchedule} column="patient_phone">Patient Phone</SortTh>
                            <SortTh sort={sortDoctorSchedule} column="status_name">Status</SortTh>
                            <SortTh sort={sortDoctorSchedule} column="payment_status">Payment</SortTh>
                            <SortTh sort={sortDoctorSchedule} column="receptionist_name">Confirmed By</SortTh>
                            <SortTh sort={sortDoctorSchedule} column="location_address">Location</SortTh>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDocSchedule.length ? sortDoctorSchedule.sorted(filteredDocSchedule).slice(docSchedPage * docSchedPageSize, (docSchedPage + 1) * docSchedPageSize).map((row, idx) => {
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
                    {filteredDocSchedule.length > docSchedPageSize && (
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                        <button type="button" disabled={docSchedPage === 0} onClick={() => setDocSchedPage((p) => p - 1)}
                          style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #ccc', background: docSchedPage === 0 ? '#eee' : '#fff', cursor: docSchedPage === 0 ? 'default' : 'pointer', fontSize: '0.85rem' }}>
                          Previous
                        </button>
                        <button type="button" disabled={(docSchedPage + 1) * docSchedPageSize >= filteredDocSchedule.length} onClick={() => setDocSchedPage((p) => p + 1)}
                          style={{ padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid #ccc', background: (docSchedPage + 1) * docSchedPageSize >= filteredDocSchedule.length ? '#eee' : '#fff', cursor: (docSchedPage + 1) * docSchedPageSize >= filteredDocSchedule.length ? 'default' : 'pointer', fontSize: '0.85rem' }}>
                          Next
                        </button>
                      </div>
                    )}
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
                            <SortTh sort={sortTimeOff} column="requester_name">Staff Member</SortTh>
                            <SortTh sort={sortTimeOff} column="requester_role">Role</SortTh>
                            <SortTh sort={sortTimeOff} column="request_source">Source</SortTh>
                            <SortTh sort={sortTimeOff} column="start_datetime">Start</SortTh>
                            <SortTh sort={sortTimeOff} column="end_datetime">End</SortTh>
                            <SortTh sort={sortTimeOff} column="location_address">Location</SortTh>
                            <SortTh sort={sortTimeOff} column="reason">Reason</SortTh>
                            <SortTh sort={sortTimeOff} column="is_approved">Approved</SortTh>
                          </tr>
                        </thead>
                        <tbody>
                          {staffReport.timeOff.length ? sortTimeOff.sorted(staffReport.timeOff).map((row) => (
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
