import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

const formatZipInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 5);

const extractDigits = (value) => String(value || '').replace(/\D/g, '');

const getLocationFieldErrors = (form) => {
  const city = String(form?.city || '').trim();
  const state = String(form?.state || '').trim().toUpperCase();
  const streetNo = String(form?.streetNo || '').trim();
  const streetName = String(form?.streetName || '').trim();
  const zipCode = String(form?.zipCode || '').trim();

  const errors = {};

  if (!city || !state || !streetNo || !streetName || !zipCode) {
    if (!streetNo) errors.streetNo = 'Street number is required.';
    if (!streetName) errors.streetName = 'Street name is required.';
    if (!city) errors.city = 'City is required.';
    if (!state) errors.state = 'State is required.';
    if (!zipCode) errors.zipCode = 'ZIP code is required.';
  }

  if (city && city.length > 20 && !errors.city) {
    errors.city = 'City must be 20 characters or fewer.';
  }

  if (state && !/^[A-Z]{2}$/.test(state) && !errors.state) {
    errors.state = 'State must be a 2-letter abbreviation (for example, TX).';
  }

  if (streetNo && streetNo.length > 20 && !errors.streetNo) {
    errors.streetNo = 'Street number must be 20 characters or fewer.';
  }

  if (streetNo && !/^\d+[A-Za-z0-9\-\/]*$/.test(streetNo) && !errors.streetNo) {
    errors.streetNo = 'Street number must start with digits (for example, 11606 or 11606A).';
  }

  if (streetName && streetName.length > 100 && !errors.streetName) {
    errors.streetName = 'Street name must be 100 characters or fewer.';
  }

  if (zipCode && !/^\d{5}$/.test(zipCode) && !errors.zipCode) {
    errors.zipCode = 'ZIP code must contain exactly 5 digits.';
  }

  return errors;
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
  const location = useLocation();
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
    newPatientRows: [],
    outstandingPatients: [],
    appointmentRows: [],
    generatedAt: null
  });
  const [clinicPerformanceLoading, setClinicPerformanceLoading] = useState(false);
  const [clinicPerformanceError, setClinicPerformanceError] = useState('');
  const [clinicProcedureCodes, setClinicProcedureCodes] = useState([]);
  const [clinicFilters, setClinicFilters] = useState({
    locationId: 'ALL',
    doctorId: 'ALL',
    statusGroup: 'ALL',
    paymentStatus: 'ALL',
    patientState: 'ALL',
    procedureCode: 'ALL'
  });
  const [recallReportAsOfDate, setRecallReportAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recallReportWindowDays, setRecallReportWindowDays] = useState(90);
  const [recallReport, setRecallReport] = useState({
    summary: null,
    items: [],
    generatedAt: null,
    asOfDate: null,
    windowDays: 90
  });
  const [recallReportLoading, setRecallReportLoading] = useState(false);
  const [recallReportError, setRecallReportError] = useState('');
  const [recallDueFilter, setRecallDueFilter] = useState('ALL');
  const [recallContactFilter, setRecallContactFilter] = useState('ALL');
  const [recallScheduledFilter, setRecallScheduledFilter] = useState('ALL');
  const [recallSearch, setRecallSearch] = useState('');

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
  const [dismissedAdminAlertIds, setDismissedAdminAlertIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('dismissedAdminAlerts') || '[]'));
    } catch {
      return new Set();
    }
  });

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
  const [resetPasswordMessage, setResetPasswordMessage] = useState('');
  const [cancelledRequests, setCancelledRequests] = useState([]);
  const [cancelledAppointments, setCancelledAppointments] = useState([]);
  const [refundHistory, setRefundHistory] = useState([]);
  const [overpaidInvoices, setOverpaidInvoices] = useState([]);
  const [refundForm, setRefundForm] = useState({ invoiceId: '', amount: '', reason: '' });
  const [invoiceLookup, setInvoiceLookup] = useState(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('monthly');
  const [monthlyTrendsSort, setMonthlyTrendsSort] = useState('date');
  const [financialDetail, setFinancialDetail] = useState({ items: [], totals: null, generatedAt: null });
  const [financialDetailLoading, setFinancialDetailLoading] = useState(false);
  const [financialDetailError, setFinancialDetailError] = useState('');
  const [financialDetailPatient, setFinancialDetailPatient] = useState('');
  const [financialDetailPage, setFinancialDetailPage] = useState(0);
  const [outstandingAccountsPage, setOutstandingAccountsPage] = useState(0);
  const [docSchedPage, setDocSchedPage] = useState(0);
  const docSchedPageSize = 20;
  const reportPageSize = 8;
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

  useEffect(() => {
    const requestedSection = String(location.state?.initialSection || '').toLowerCase();
    if (requestedSection === 'recall' && activeSection !== 'recall') {
      setActiveSection('recall');
    }
  }, [location.state, activeSection]);

  useEffect(() => {
    setOutstandingAccountsPage(0);
  }, [clinicPerformanceReport.generatedAt]);

  const paginateRows = (rows, page) => rows.slice(page * reportPageSize, (page + 1) * reportPageSize);

const pagedOutstandingPatients = useMemo(
    () => paginateRows(clinicPerformanceReport.outstandingPatients, outstandingAccountsPage),
    [clinicPerformanceReport.outstandingPatients, outstandingAccountsPage]
  );

  const renderTablePager = (totalRows, page, setPage) => {
    if (totalRows <= reportPageSize) return null;
    const totalPages = Math.ceil(totalRows / reportPageSize);
    return (
      <div className="report-table-pager" role="navigation" aria-label="Table pagination">
        <button type="button" className="admin-ghost-button" onClick={() => setPage((p) => Math.max(p - 1, 0))} disabled={page <= 0}>
          {'< Prev'}
        </button>
        <span>Page {page + 1} of {totalPages}</span>
        <button
          type="button"
          className="admin-ghost-button"
          onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
          disabled={page >= totalPages - 1}
        >
          {'Next >'}
        </button>
      </div>
    );
  };

  const [locationForm, setLocationForm] = useState({
    city: '',
    state: '',
    streetNo: '',
    streetName: '',
    zipCode: ''
  });
  const [locationFieldErrors, setLocationFieldErrors] = useState({});

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
      const [summaryData, queueData, followUpData, reportData, doctorData, receptionistData, locationData, timeOffData, cancelledData, schedReqData, staffSchedData, gapsData, refundData, cancelledApptData, overpaidData] = await Promise.all([
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
        fetch(`${API_BASE_URL}/api/admin/cancelled-appointments`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/overpaid-invoices`).then(safeJson)
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
      setOverpaidInvoices(Array.isArray(overpaidData) ? overpaidData : []);
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
      const [refundData, reportData, overpaidData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/refunds`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/reports/patients?date=${selectedDate}${reportStatus === 'ALL' ? '' : `&status=${reportStatus}`}`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/overpaid-invoices`).then(safeJson)
      ]);
      setRefundHistory(Array.isArray(refundData) ? refundData : []);
      setPatientReport(reportData);
      setOverpaidInvoices(Array.isArray(overpaidData) ? overpaidData : []);
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
      const params = new URLSearchParams({
        dateFrom: clinicReportDateFrom,
        dateTo: clinicReportDateTo
      });

      if (clinicFilters.locationId !== 'ALL') params.set('locationId', clinicFilters.locationId);
      if (clinicFilters.doctorId !== 'ALL') params.set('doctorId', clinicFilters.doctorId);
      if (clinicFilters.statusGroup !== 'ALL') params.set('statusGroup', clinicFilters.statusGroup);
      if (clinicFilters.paymentStatus !== 'ALL') params.set('paymentStatus', clinicFilters.paymentStatus);
      if (clinicFilters.patientState !== 'ALL') params.set('patientState', clinicFilters.patientState);
      if (clinicFilters.procedureCode !== 'ALL') params.set('procedureCode', clinicFilters.procedureCode);

      const data = await fetch(
        `${API_BASE_URL}/api/admin/reports/performance?${params.toString()}`
      ).then(safeJson);

      setClinicPerformanceReport({
        summary: data.summary || null,
        monthlyTrends: Array.isArray(data.monthlyTrends) ? data.monthlyTrends : [],
        providerPerformance: Array.isArray(data.providerPerformance) ? data.providerPerformance : [],
        newPatientsTrend: Array.isArray(data.newPatientsTrend) ? data.newPatientsTrend : [],
        newPatientRows: Array.isArray(data.newPatientRows) ? data.newPatientRows : [],
        outstandingPatients: Array.isArray(data.outstandingPatients) ? data.outstandingPatients : [],
        appointmentRows: Array.isArray(data.appointmentRows) ? data.appointmentRows : [],
        generatedAt: data.generatedAt || null,
        filters: data.filters || null
      });
    } catch (err) {
      setClinicPerformanceError(err.message || 'Unable to load clinic performance report.');
    } finally {
      setClinicPerformanceLoading(false);
    }
  };

  const loadClinicFilterOptions = async () => {
    try {
      const data = await fetch(`${API_BASE_URL}/api/admin/reports/filter-options`).then(safeJson);
      const codes = (Array.isArray(data.treatments) ? data.treatments : [])
        .map((item) => {
          const code = String(item?.procedure_code || '').trim().toUpperCase();
          const description = String(item?.description || '').trim();
          if (!code) return null;
          return {
            code,
            label: description ? `${code} - ${description}` : code
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.code.localeCompare(b.code));
      setClinicProcedureCodes(codes);
    } catch {
      setClinicProcedureCodes([]);
    }
  };

  const loadFinancialDetail = async () => {
    setFinancialDetailLoading(true);
    setFinancialDetailError('');
    try {
      const params = new URLSearchParams({ dateFrom: clinicReportDateFrom, dateTo: clinicReportDateTo });
      if (financialDetailPatient) params.set('patient', financialDetailPatient);
      if (clinicFilters.doctorId !== 'ALL') params.set('doctorId', clinicFilters.doctorId);
      if (clinicFilters.locationId !== 'ALL') params.set('locationId', clinicFilters.locationId);
      if (clinicFilters.statusGroup !== 'ALL') params.set('statusGroup', clinicFilters.statusGroup);
      if (clinicFilters.paymentStatus !== 'ALL') params.set('paymentStatus', clinicFilters.paymentStatus);
      if (clinicFilters.patientState !== 'ALL') params.set('patientState', clinicFilters.patientState);
      const data = await fetch(`${API_BASE_URL}/api/admin/reports/financial-detail?${params.toString()}`).then(safeJson);
      setFinancialDetail({
        items: Array.isArray(data.items) ? data.items : [],
        totals: data.totals || null,
        generatedAt: data.generatedAt || null
      });
      setFinancialDetailPage(0);
    } catch (err) {
      setFinancialDetailError(err.message || 'Unable to load financial detail report.');
    } finally {
      setFinancialDetailLoading(false);
    }
  };

  const loadRecallReport = async () => {
    setRecallReportLoading(true);
    setRecallReportError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/reports/recall?asOfDate=${recallReportAsOfDate}&windowDays=${recallReportWindowDays}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to load recall report.');
      }

      setRecallReport({
        summary: data.summary || null,
        items: Array.isArray(data.items) ? data.items : [],
        generatedAt: data.generatedAt || null,
        asOfDate: data.asOfDate || recallReportAsOfDate,
        windowDays: Number(data.windowDays || recallReportWindowDays)
      });
    } catch (err) {
      setRecallReportError(err.message || 'Unable to load recall report.');
    } finally {
      setRecallReportLoading(false);
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
      if (!clinicProcedureCodes.length) {
        loadClinicFilterOptions();
      }
    }
  }, [activeSection, clinicReportDateFrom, clinicReportDateTo]);

  useEffect(() => {
    if (activeSection === 'reports') {
      loadFinancialDetail();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, clinicReportDateFrom, clinicReportDateTo, clinicFilters.doctorId, clinicFilters.locationId, clinicFilters.statusGroup, clinicFilters.paymentStatus, clinicFilters.patientState]);

  useEffect(() => {
    if (activeSection === 'reports' || activeSection === 'recall') {
      loadRecallReport();
    }
  }, [activeSection, recallReportAsOfDate, recallReportWindowDays]);

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    setActionMessage('');

    if (extractDigits(doctorForm.phone).length !== 10) {
      setActionMessage('Doctor phone number must contain exactly 10 digits.');
      return;
    }

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

    if (extractDigits(formState.phone).length !== 10) {
      setActionMessage(`${roleLabel} phone number must contain exactly 10 digits.`);
      return;
    }

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

    const locationErrors = getLocationFieldErrors(locationForm);
    setLocationFieldErrors(locationErrors);
    if (Object.keys(locationErrors).length) {
      setActionMessage('Please correct the highlighted location fields.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: String(locationForm.city || '').trim(),
          state: String(locationForm.state || '').trim().toUpperCase(),
          streetNo: String(locationForm.streetNo || '').trim(),
          streetName: String(locationForm.streetName || '').trim(),
          zipCode: String(locationForm.zipCode || '').trim()
        })
      });

      await safeJson(response);
      setLocationForm({ city: '', state: '', streetNo: '', streetName: '', zipCode: '' });
      setLocationFieldErrors({});
      setActionMessage('Location added successfully.');
      loadAdminData();
    } catch (err) {
      setActionMessage(err.message || 'Failed to add location.');
    }
  };

  const updateLocationField = (field, value) => {
    setLocationForm((prev) => {
      const nextForm = { ...prev, [field]: value };
      setLocationFieldErrors(getLocationFieldErrors(nextForm));
      return nextForm;
    });
  };

  const handleLocationDelete = async (location) => {
    const locationId = Number(location?.location_id || 0);
    if (!Number.isInteger(locationId) || locationId <= 0) {
      setActionMessage('Invalid location id.');
      return;
    }

    const confirmed = window.confirm(`Delete this location?\n\n${location.full_address}\n\nThis removes the location from staff assignments and clears it from existing appointment records.`);
    if (!confirmed) return;

    setActionMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/locations/${locationId}`, {
        method: 'DELETE'
      });
      await safeJson(response);
      setActionMessage('Location deleted successfully.');
      loadAdminData();
    } catch (err) {
      setActionMessage(err.message || 'Failed to delete location.');
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
    if (!resetPasswordValue || resetPasswordValue.length < 8) {
      setResetPasswordMessage('Must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(resetPasswordValue)) {
      setResetPasswordMessage('Must include at least 1 uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(resetPasswordValue)) {
      setResetPasswordMessage('Must include at least 1 lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(resetPasswordValue)) {
      setResetPasswordMessage('Must include at least 1 number.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/staff/${staffId}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPasswordValue })
      });
      await safeJson(response);
      setResetPasswordMessage('Password changed successfully.');
      setResetPasswordValue('');
      setTimeout(() => { setResetPasswordStaffId(null); setResetPasswordMessage(''); }, 2000);
    } catch (err) {
      setResetPasswordMessage(err.message || 'Failed to reset password.');
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

  const todaysCancelledCount = useMemo(() => {
    return (Array.isArray(cancelledAppointments) ? cancelledAppointments : []).filter((appt) => {
      return String(appt.appointment_date || '').slice(0, 10) === selectedDate;
    }).length;
  }, [cancelledAppointments, selectedDate]);

  const pendingTimeOffCount = Number(summary?.metrics?.pendingTimeOffCount || 0);
  const waitingRequestsCount = Number(summary?.metrics?.waitingToSchedule || queue?.pendingRequests?.length || 0);
  const overdueRecallCount = Number(followUpQueue?.summary?.overdue || 0);
  const pendingScheduleRequestCount = Array.isArray(scheduleRequests)
    ? scheduleRequests.filter((item) => String(item.request_status || '').toUpperCase() === 'PENDING').length
    : 0;

  const adminToastNotifications = useMemo(() => {
    const alerts = [];

    if (pendingTimeOffCount > 0) {
      alerts.push({
        id: 'pending-timeoff',
        tone: 'warning',
        title: 'Pending Time-Off Approvals',
        message: `${pendingTimeOffCount} staff off-day request${pendingTimeOffCount === 1 ? '' : 's'} need admin review.`,
        section: 'staffing',
        action: 'Review Requests'
      });
    }

    if (overdueRecallCount > 0) {
      alerts.push({
        id: 'overdue-recall',
        tone: 'critical',
        title: 'Overdue Recall Patients',
        message: `${overdueRecallCount} patient${overdueRecallCount === 1 ? '' : 's'} are overdue for recall follow-up.`,
        section: 'recall',
        action: 'Open Recall Queue'
      });
    }


    if (pendingScheduleRequestCount > 0) {
      alerts.push({
        id: 'pending-schedule-requests',
        tone: 'warning',
        title: 'Pending Staff Schedule Requests',
        message: `${pendingScheduleRequestCount} shift update request${pendingScheduleRequestCount === 1 ? '' : 's'} are waiting for approval.`,
        section: 'staff-scheduling',
        action: 'Review Schedule Requests'
      });
    }

    if (todaysCancelledCount >= 3) {
      alerts.push({
        id: 'high-cancellations',
        tone: 'critical',
        title: 'High Same-Day Cancellations',
        message: `${todaysCancelledCount} appointments were cancelled today. Consider opening additional outreach and recall follow-up.`,
        section: 'scheduling',
        action: 'View Cancellations'
      });
    }

    return alerts;
  }, [pendingTimeOffCount, waitingRequestsCount, overdueRecallCount, pendingScheduleRequestCount, todaysCancelledCount]);

  const visibleAdminToastNotifications = adminToastNotifications.filter((item) => !dismissedAdminAlertIds.has(item.id));

  const dismissAdminToast = (alertId) => {
    setDismissedAdminAlertIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      try {
        localStorage.setItem('dismissedAdminAlerts', JSON.stringify([...next]));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  };

  const nextFiveAppointments = useMemo(() => {
    const rows = Array.isArray(queue?.scheduledAppointments) ? queue.scheduledAppointments : [];
    return rows.slice(0, 5);
  }, [queue?.scheduledAppointments]);

  const overviewCards = useMemo(() => {
    const metrics = summary?.metrics || {};
    return [
      {
        label: 'Scheduled Today',
        value: Number(metrics.scheduledToday || queue?.scheduledAppointments?.length || 0),
        hint: 'Appointments on today\'s book'
      },
      {
        label: 'Patients Today',
        value: Number(metrics.patientsScheduledToday || 0),
        hint: 'Unique patients on the schedule'
      },
      {
        label: 'Waiting Requests',
        value: Number(metrics.waitingToSchedule || queue?.pendingRequests?.length || 0),
        hint: 'Preference requests to assign'
      },
      {
        label: 'Recall Overdue',
        value: Number(followUpQueue?.summary?.overdue || 0),
        hint: 'Patients overdue for follow-up'
      },
      {
        label: 'Pending Time-Off',
        value: Number(metrics.pendingTimeOffCount || 0),
        hint: 'Requests awaiting approval'
      },
      {
        label: 'Cancelled Today',
        value: todaysCancelledCount,
        hint: 'Same-day cancellations'
      }
    ];
  }, [summary?.metrics, queue?.scheduledAppointments, queue?.pendingRequests, followUpQueue?.summary, todaysCancelledCount]);

  const filteredRecallItems = useMemo(() => {
    const items = Array.isArray(recallReport.items) ? recallReport.items : [];
    const searchQuery = recallSearch.trim().toLowerCase();
    const searchDigits = recallSearch.replace(/\D/g, '');

    return items.filter((item) => {
      const matchesDue = recallDueFilter === 'ALL' || item.dueState === recallDueFilter;
      const matchesContact = recallContactFilter === 'ALL' || item.contactState === recallContactFilter;
      const matchesScheduled = recallScheduledFilter === 'ALL'
        || (recallScheduledFilter === 'SCHEDULED' && item.isScheduled)
        || (recallScheduledFilter === 'UNSCHEDULED' && !item.isScheduled);

      const matchesSearch = !searchQuery
        || (item.patientName || '').toLowerCase().includes(searchQuery)
        || (item.email || '').toLowerCase().includes(searchQuery)
        || (searchDigits.length > 0 && String(item.phone || '').replace(/\D/g, '').includes(searchDigits));

      return matchesDue && matchesContact && matchesScheduled && matchesSearch;
    });
  }, [recallReport.items, recallDueFilter, recallContactFilter, recallScheduledFilter, recallSearch]);

  const filteredRecallSummary = useMemo(() => {
    return filteredRecallItems.reduce((acc, item) => {
      acc.totalPatientsDue += 1;
      acc.pendingFollowUpItems += Number(item.pendingFollowUpItems || 0);
      if (item.dueState === 'OVERDUE') acc.overdue += 1;
      if (item.dueState === 'DUE_TODAY') acc.dueToday += 1;
      if (item.dueState === 'DUE_30') acc.due30 += 1;
      if (item.dueState === 'DUE_60') acc.due60 += 1;
      if (item.dueState === 'DUE_90_PLUS') acc.due90Plus += 1;
      if (item.isScheduled) acc.scheduled += 1;
      else acc.unscheduled += 1;
      if (item.contactState === 'CONTACTED') acc.contacted += 1;
      else acc.uncontacted += 1;
      return acc;
    }, {
      totalPatientsDue: 0,
      pendingFollowUpItems: 0,
      overdue: 0,
      dueToday: 0,
      due30: 0,
      due60: 0,
      due90Plus: 0,
      scheduled: 0,
      unscheduled: 0,
      contacted: 0,
      uncontacted: 0
    });
  }, [filteredRecallItems]);

  const clinicProviderOptions = useMemo(() => {
    return (Array.isArray(doctors) ? doctors : []).map((doctor) => {
      const fullName = `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim();
      return {
        id: String(doctor.doctor_id),
        name: fullName || doctor.doctor_name || `Doctor #${doctor.doctor_id}`
      };
    });
  }, [doctors]);

  const clinicLocationOptions = useMemo(() => {
    return (Array.isArray(locations) ? locations : []).map((location) => ({
      id: String(location.location_id),
      label: location.full_address || `${location.location_city || ''}, ${location.location_state || ''}`.trim()
    }));
  }, [locations]);

  const clinicActiveFilterChips = useMemo(() => {
    const chips = [];

    if (clinicFilters.locationId !== 'ALL') {
      const location = clinicLocationOptions.find((item) => item.id === clinicFilters.locationId);
      chips.push(`Location: ${location ? location.label : clinicFilters.locationId}`);
    }
    if (clinicFilters.doctorId !== 'ALL') {
      const provider = clinicProviderOptions.find((item) => item.id === clinicFilters.doctorId);
      chips.push(`Provider: ${provider ? provider.name : clinicFilters.doctorId}`);
    }
    if (clinicFilters.statusGroup !== 'ALL') {
      chips.push(`Visit Status: ${clinicFilters.statusGroup}`);
    }
    if (clinicFilters.paymentStatus !== 'ALL') {
      chips.push(`Payment: ${clinicFilters.paymentStatus}`);
    }
    if (clinicFilters.patientState !== 'ALL') {
      chips.push(`State: ${clinicFilters.patientState}`);
    }
    if (clinicFilters.procedureCode !== 'ALL') {
      chips.push(`Procedure: ${clinicFilters.procedureCode}`);
    }

    return chips;
  }, [clinicFilters, clinicLocationOptions, clinicProviderOptions]);


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
        <button type="button" className={activeSection === 'refunds' ? 'is-active' : ''} onClick={() => setActiveSection('refunds')}>Refunds</button>
        <button type="button" className={activeSection === 'staff-scheduling' ? 'is-active' : ''} onClick={() => setActiveSection('staff-scheduling')}>Staff Scheduling</button>
        <button type="button" className={activeSection === 'staffing' ? 'is-active' : ''} onClick={() => setActiveSection('staffing')}>Staffing & Locations</button>
      </nav>

      {error && <p className="admin-error">{error}</p>}
      {actionMessage && <p className="admin-message">{actionMessage}</p>}
      {loading && <p className="admin-loading">Loading dashboard...</p>}

      {!loading && summary && (
        <>
          {visibleAdminToastNotifications.length > 0 && (
            <aside className="admin-toast-stack" aria-live="polite" aria-label="Admin critical notifications">
              {visibleAdminToastNotifications.map((alert) => (
                <article key={alert.id} className={`admin-toast-card admin-toast-card--${alert.tone}`}>
                  <div className="admin-toast-card__top">
                    <div>
                      <p className="admin-toast-card__eyebrow">Admin Alert</p>
                      <h3>{alert.title}</h3>
                    </div>
                    <button
                      type="button"
                      className="admin-toast-card__close"
                      aria-label="Dismiss admin notification"
                      onClick={() => dismissAdminToast(alert.id)}
                    >
                      &times;
                    </button>
                  </div>
                  <p className="admin-toast-card__message">{alert.message}</p>
                  <button
                    type="button"
                    className="admin-toast-card__action"
                    onClick={() => setActiveSection(alert.section)}
                  >
                    {alert.action} &rarr;
                  </button>
                </article>
              ))}
            </aside>
          )}

          {activeSection === 'overview' && (
            <>
              <section className="admin-metrics-grid">
                {overviewCards.map((card) => (
                  <article className="metric-card" key={card.label}>
                    <h2>{card.label}</h2>
                    <p style={{ color: Number(card.value) > 0 ? 'inherit' : '#6d7e7d' }}>{card.value}</p>
                    <small>{card.hint}</small>
                  </article>
                ))}
              </section>

              <section className="admin-grid-two overview-grid">
                <article className="admin-panel">
                  <div className="admin-panel-header-row">
                    <h2>Priority Queue</h2>
                    <span className="clinic-filter-chip">Date: {formatDate(selectedDate)}</span>
                  </div>
                  <div className="overview-queue-list">
                    <div className="overview-queue-item">
                      <div>
                        <strong>Waiting appointment requests</strong>
                        <p className="muted">{summary.metrics?.waitingToSchedule || 0} requests need assignment.</p>
                      </div>
                      <button type="button" className="admin-btn" onClick={() => setActiveSection('scheduling')}>View</button>
                    </div>
                    <div className="overview-queue-item">
                      <div>
                        <strong>Pending time-off approvals</strong>
                        <p className="muted">{summary.metrics?.pendingTimeOffCount || 0} requests need review.</p>
                      </div>
                      <button type="button" className="admin-btn" onClick={() => setActiveSection('staff-scheduling')}>Review</button>
                    </div>
                    <div className="overview-queue-item">
                      <div>
                        <strong>Overdue recall follow-ups</strong>
                        <p className="muted">{followUpQueue.summary?.overdue || 0} patients are overdue.</p>
                      </div>
                      <button type="button" className="admin-btn" onClick={() => setActiveSection('recall')}>Open Queue</button>
                    </div>
                    <div className="overview-queue-item">
                      <div>
                        <strong>Refund operations</strong>
                        <p className="muted">Go to refunds to process or audit adjustments.</p>
                      </div>
                      <button type="button" className="admin-btn" onClick={() => setActiveSection('refunds')}>Process</button>
                    </div>
                  </div>
                </article>

                <article className="admin-panel">
                  <h2>Next 5 Appointments</h2>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Patient</th>
                          <th>Dentist</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nextFiveAppointments.length ? nextFiveAppointments.map((appt) => (
                          <tr key={`overview-next-${appt.appointment_id}`}>
                            <td>{formatTime(appt.appointment_time)}</td>
                            <td>{appt.patient_name}</td>
                            <td>{appt.doctor_name || 'TBD'}</td>
                            <td>{appt.status_name}</td>
                          </tr>
                        )) : <tr><td colSpan="4">No scheduled appointments for this date.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '0.65rem' }}>
                    <button type="button" className="admin-ghost-button" onClick={() => setActiveSection('scheduling')}>Open Full Schedule</button>
                  </div>
                </article>

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

                <div className="clinic-filter-grid">
                  <label className="admin-inline-filter">
                    Location
                    <select
                      value={clinicFilters.locationId}
                      onChange={(e) => setClinicFilters((prev) => ({ ...prev, locationId: e.target.value }))}
                    >
                      <option value="ALL">All locations</option>
                      {clinicLocationOptions.map((location) => (
                        <option key={location.id} value={location.id}>{location.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="admin-inline-filter">
                    Provider
                    <select
                      value={clinicFilters.doctorId}
                      onChange={(e) => setClinicFilters((prev) => ({ ...prev, doctorId: e.target.value }))}
                    >
                      <option value="ALL">All providers</option>
                      {clinicProviderOptions.map((provider) => (
                        <option key={provider.id} value={provider.id}>{provider.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="admin-inline-filter">
                    Visit Status
                    <select
                      value={clinicFilters.statusGroup}
                      onChange={(e) => setClinicFilters((prev) => ({ ...prev, statusGroup: e.target.value }))}
                    >
                      <option value="ALL">All statuses</option>
                      <option value="COMPLETED">Completed only</option>
                      <option value="SCHEDULED">Scheduled pipeline</option>
                      <option value="CANCELLED">Cancelled only</option>
                      <option value="NO_SHOW">No-show only</option>
                      <option value="MISSED">Missed visits (cancelled + no-show)</option>
                    </select>
                  </label>

                  <label className="admin-inline-filter">
                    Payment
                    <select
                      value={clinicFilters.paymentStatus}
                      onChange={(e) => setClinicFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                    >
                      <option value="ALL">All payment states</option>
                      <option value="PAID">Paid</option>
                      <option value="PARTIAL">Partial</option>
                      <option value="UNPAID">Unpaid</option>
                      <option value="REFUNDED">Refunded</option>
                    </select>
                  </label>


                  <label className="admin-inline-filter">
                    Procedure Code
                    <select
                      value={clinicFilters.procedureCode}
                      onChange={(e) => setClinicFilters((prev) => ({ ...prev, procedureCode: e.target.value }))}
                    >
                      <option value="ALL">All procedure codes</option>
                      {clinicProcedureCodes.map((item) => (
                        <option key={item.code} value={item.code}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="clinic-filter-actions">
                  <button
                    type="button"
                    className="admin-ghost-button"
                    onClick={() => setClinicFilters({
                      locationId: 'ALL',
                      doctorId: 'ALL',
                      statusGroup: 'ALL',
                      paymentStatus: 'ALL',
                      patientState: 'ALL',
                      procedureCode: 'ALL'
                    })}
                  >
                    Clear Filters
                  </button>
                  {clinicActiveFilterChips.length > 0 && (
                    <div className="clinic-filter-chips">
                      {clinicActiveFilterChips.map((chip) => (
                        <span key={chip} className="clinic-filter-chip">{chip}</span>
                      ))}
                    </div>
                  )}
                </div>

                {summary && (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1rem 0 0' }}>
                    <article className="metric-card" style={{ flex: '1', minWidth: '160px' }}>
                      <h2>Patient Collections</h2>
                      <p>{formatMoney(summary.metrics?.patientCollected)}</p>
                      <small>All-time from patients</small>
                    </article>
                    <article className="metric-card" style={{ flex: '1', minWidth: '160px' }}>
                      <h2>Insurance Collections</h2>
                      <p>{formatMoney(summary.metrics?.insuranceCollected)}</p>
                      <small>All-time from other sources</small>
                    </article>
                  </div>
                )}

                {clinicPerformanceError && <p className="admin-error">{clinicPerformanceError}</p>}
                {clinicPerformanceReport.generatedAt && (
                  <p className="muted clinic-generated-at">Generated {new Date(clinicPerformanceReport.generatedAt).toLocaleString()}</p>
                )}
              </section>

              {!clinicPerformanceLoading && clinicPerformanceReport.summary && (
                <section className="admin-metrics-grid">
                  {activeReportTab === 'monthly' && (
                    <>
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
                      {financialDetail.totals && (
                        <article className="metric-card">
                          <h2>Patient Responsibility</h2>
                          <p>{formatMoney(financialDetail.totals.patient_responsibility)}</p>
                          <small>What patients owe in range</small>
                        </article>
                      )}
                    </>
                  )}

                  {activeReportTab === 'providers' && (
                    <>
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
                    </>
                  )}

                  {activeReportTab === 'growth' && (
                    <>
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
                    </>
                  )}

                  {activeReportTab === 'outstanding' && (
                    <article className="metric-card">
                      <h2>Outstanding A/R</h2>
                      <p style={{ color: clinicPerformanceReport.summary.totalOutstanding > 0 ? '#9d2e2e' : 'inherit' }}>
                        {formatMoney(clinicPerformanceReport.summary.totalOutstanding)}
                      </p>
                    </article>
                  )}

                  {activeReportTab === 'financial' && (
                    <>
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
                      {financialDetail.totals && (
                        <>
                          <article className="metric-card">
                            <h2>Patient Responsibility</h2>
                            <p>{formatMoney(financialDetail.totals.patient_responsibility)}</p>
                            <small>What patients owe in range</small>
                          </article>
                          <article className="metric-card">
                            <h2>Refunded</h2>
                            <p>{formatMoney(financialDetail.totals.total_refunded)}</p>
                            <small>Total refunds issued in range</small>
                          </article>
                        </>
                      )}
                    </>
                  )}
                </section>
              )}

              <div className="admin-tab-bar">
                <button type="button" className={activeReportTab === 'monthly' ? 'is-active' : ''} onClick={() => setActiveReportTab('monthly')}>Monthly Trends</button>
                <button type="button" className={activeReportTab === 'providers' ? 'is-active' : ''} onClick={() => setActiveReportTab('providers')}>Provider Productivity</button>
                <button type="button" className={activeReportTab === 'growth' ? 'is-active' : ''} onClick={() => setActiveReportTab('growth')}>Patient Growth</button>
                <button type="button" className={activeReportTab === 'outstanding' ? 'is-active' : ''} onClick={() => setActiveReportTab('outstanding')}>Outstanding A/R</button>
                <button type="button" className={activeReportTab === 'financial' ? 'is-active' : ''} onClick={() => setActiveReportTab('financial')}>Financial Detail</button>
              </div>

              {clinicPerformanceLoading && <p className="admin-loading">Loading clinic performance report...</p>}

              {!clinicPerformanceLoading && clinicPerformanceReport.summary && (
                <>
                  {activeReportTab === 'monthly' && (
                    <article className="admin-panel">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h2 style={{ margin: 0 }}>Production & Collections by Month</h2>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className={`admin-btn${monthlyTrendsSort === 'date' ? ' is-active' : ''}`}
                            onClick={() => setMonthlyTrendsSort('date')}
                          >
                            Sort by Date
                          </button>
                          <button
                            type="button"
                            className={`admin-btn${monthlyTrendsSort === 'alpha' ? ' is-active' : ''}`}
                            onClick={() => setMonthlyTrendsSort('alpha')}
                          >
                            Sort A–Z
                          </button>
                        </div>
                      </div>
                      <div className="table-wrap report-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>Appointments</th>
                              <th>Completed</th>
                              <th>Cancelled</th>
                              <th>No-Show</th>
                              <th>Scheduled</th>
                              <th>Production</th>
                              <th>Patient Collected</th>
                              <th>Insurance Collected</th>
                              <th>Collected</th>
                              <th>Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinicPerformanceReport.monthlyTrends.length ? clinicPerformanceReport.monthlyTrends.map((month) => {
                              const monthAppts = clinicPerformanceReport.appointmentRows
                                .filter((a) => a.period_key === month.period_key)
                                .sort((a, b) => {
                                  const dateA = String(a.appointment_date || '').slice(0, 10);
                                  const dateB = String(b.appointment_date || '').slice(0, 10);
                                  const nameA = String(a.patient_name || '').toLowerCase();
                                  const nameB = String(b.patient_name || '').toLowerCase();
                                  if (monthlyTrendsSort === 'alpha') {
                                    return nameA !== nameB ? nameA.localeCompare(nameB) : dateA.localeCompare(dateB);
                                  }
                                  return dateA !== dateB ? dateA.localeCompare(dateB) : nameA.localeCompare(nameB);
                                });
                              return (
                                <>
                                  <tr key={month.period_key} style={{ background: '#e8f2f0', fontWeight: 700 }}>
                                    <td>{month.period_label}</td>
                                    <td>{month.total_appointments}</td>
                                    <td>{month.completed_appointments}</td>
                                    <td>{month.cancelled_appointments}</td>
                                    <td>{month.no_show_appointments}</td>
                                    <td>{month.scheduled_appointments}</td>
                                    <td>{formatMoney(month.total_production)}</td>
                                    <td>{formatMoney(month.patient_collected)}</td>
                                    <td>{formatMoney(month.insurance_collected)}</td>
                                    <td>{formatMoney(month.total_collected)}</td>
                                    <td>{formatMoney(month.total_outstanding)}</td>
                                  </tr>
                                  {monthAppts.length > 0 && (
                                    <tr style={{ background: '#f0f7f5', fontSize: '0.78rem', color: '#6b8a87', fontWeight: 600 }}>
                                      <td style={{ paddingLeft: '1.5rem' }}>Date</td>
                                      <td>Patient</td>
                                      <td colSpan="9" />
                                    </tr>
                                  )}
                                  {monthAppts.map((appt) => (
                                    <tr key={appt.appointment_id} style={{ background: '#f9fdfb', fontSize: '0.87rem', color: '#334240' }}>
                                      <td style={{ paddingLeft: '1.5rem' }}>
                                        {String(appt.appointment_date || '').slice(0, 10)}
                                      </td>
                                      <td>{appt.patient_name}</td>
                                      <td style={{ color: '#1d6b41', fontWeight: 600 }}>
                                        {appt.status_name === 'COMPLETED' ? '✓' : ''}
                                      </td>
                                      <td style={{ color: '#9d2e2e', fontWeight: 600 }}>
                                        {['CANCELED', 'CANCELLED'].includes(appt.status_name) ? '✓' : ''}
                                      </td>
                                      <td style={{ color: '#9d2e2e', fontWeight: 600 }}>
                                        {appt.status_name === 'NO_SHOW' ? '✓' : ''}
                                      </td>
                                      <td style={{ color: '#4b6966', fontWeight: 600 }}>
                                        {['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN'].includes(appt.status_name) ? '✓' : ''}
                                      </td>
                                      <td>{formatMoney(appt.production)}</td>
                                      <td>{formatMoney(appt.patient_collected)}</td>
                                      <td>{formatMoney(appt.insurance_collected)}</td>
                                      <td>{formatMoney(appt.total_collected)}</td>
                                      <td>{formatMoney(appt.outstanding)}</td>
                                    </tr>
                                  ))}
                                </>
                              );
                            }) : <tr><td colSpan="11">No monthly trend data for this range.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )}

                  {activeReportTab === 'providers' && (
                    <article className="admin-panel">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h2 style={{ margin: 0 }}>Provider Productivity</h2>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className={`admin-btn${monthlyTrendsSort === 'date' ? ' is-active' : ''}`}
                            onClick={() => setMonthlyTrendsSort('date')}
                          >
                            Sort by Date
                          </button>
                          <button
                            type="button"
                            className={`admin-btn${monthlyTrendsSort === 'alpha' ? ' is-active' : ''}`}
                            onClick={() => setMonthlyTrendsSort('alpha')}
                          >
                            Sort A–Z
                          </button>
                        </div>
                      </div>
                      <div className="table-wrap report-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Provider / Date</th>
                              <th>Appointments</th>
                              <th>Completed</th>
                              <th>Cancelled</th>
                              <th>No-Show</th>
                              <th>Scheduled</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinicPerformanceReport.providerPerformance.length ? clinicPerformanceReport.providerPerformance.map((row) => {
                              const providerAppts = clinicPerformanceReport.appointmentRows
                                .filter((a) => Number(a.doctor_id) === Number(row.doctor_id))
                                .sort((a, b) => {
                                  const dateA = String(a.appointment_date || '').slice(0, 10);
                                  const dateB = String(b.appointment_date || '').slice(0, 10);
                                  const nameA = String(a.patient_name || '').toLowerCase();
                                  const nameB = String(b.patient_name || '').toLowerCase();
                                  if (monthlyTrendsSort === 'alpha') {
                                    return nameA !== nameB ? nameA.localeCompare(nameB) : dateA.localeCompare(dateB);
                                  }
                                  return dateA !== dateB ? dateA.localeCompare(dateB) : nameA.localeCompare(nameB);
                                });
                              return (
                                <>
                                  <tr key={row.doctor_id} style={{ background: '#e8f2f0', fontWeight: 700 }}>
                                    <td>Dr. {row.doctor_name}</td>
                                    <td>{row.total_appointments}</td>
                                    <td>{row.completed_appointments}</td>
                                    <td>{row.cancelled_appointments}</td>
                                    <td>{row.no_show_appointments}</td>
                                    <td>{row.scheduled_appointments}</td>
                                  </tr>
                                  {providerAppts.length > 0 && (
                                    <tr style={{ background: '#f0f7f5', fontSize: '0.78rem', color: '#6b8a87', fontWeight: 600 }}>
                                      <td style={{ paddingLeft: '1.5rem' }}>Date</td>
                                      <td>Patient</td>
                                      <td colSpan="4" />
                                    </tr>
                                  )}
                                  {providerAppts.map((appt) => (
                                    <tr key={appt.appointment_id} style={{ background: '#f9fdfb', fontSize: '0.87rem', color: '#334240' }}>
                                      <td style={{ paddingLeft: '1.5rem' }}>
                                        {String(appt.appointment_date || '').slice(0, 10)}
                                      </td>
                                      <td>{appt.patient_name}</td>
                                      <td style={{ color: '#1d6b41', fontWeight: 600 }}>
                                        {appt.status_name === 'COMPLETED' ? '✓' : ''}
                                      </td>
                                      <td style={{ color: '#9d2e2e', fontWeight: 600 }}>
                                        {['CANCELED', 'CANCELLED'].includes(appt.status_name) ? '✓' : ''}
                                      </td>
                                      <td style={{ color: '#9d2e2e', fontWeight: 600 }}>
                                        {appt.status_name === 'NO_SHOW' ? '✓' : ''}
                                      </td>
                                      <td style={{ color: '#4b6966', fontWeight: 600 }}>
                                        {['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN'].includes(appt.status_name) ? '✓' : ''}
                                      </td>
                                    </tr>
                                  ))}
                                </>
                              );
                            }) : <tr><td colSpan="6">No provider productivity data for this range.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )}

                  {activeReportTab === 'growth' && (
                    <article className="admin-panel">
                      <h2>Patient Growth</h2>
                      <div className="table-wrap report-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>New Patients</th>
                              <th>Patient Name</th>
                              <th>Date Registered</th>
                              <th>Phone</th>
                              <th>Doctor</th>
                              <th>Total Appts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clinicPerformanceReport.newPatientsTrend.length ? clinicPerformanceReport.newPatientsTrend.map((month) => {
                              const monthPatients = clinicPerformanceReport.newPatientRows.filter(
                                (p) => p.period_key === month.period_key
                              );
                              return (
                                <>
                                  <tr key={month.period_key} style={{ background: '#e8f2f0', fontWeight: 700 }}>
                                    <td>{month.period_label}</td>
                                    <td>{month.new_patients}</td>
                                    <td colSpan="5" />
                                  </tr>
                                  {monthPatients.length > 0 && (
                                    <tr style={{ background: '#f0f7f5', fontSize: '0.78rem', color: '#6b8a87', fontWeight: 600 }}>
                                      <td colSpan="2" />
                                      <td>Patient</td>
                                      <td>Registered</td>
                                      <td>Phone</td>
                                      <td>Doctor</td>
                                      <td>Total Appts</td>
                                    </tr>
                                  )}
                                  {monthPatients.map((p) => (
                                    <tr key={p.patient_id} style={{ background: '#f9fdfb', fontSize: '0.87rem', color: '#334240' }}>
                                      <td colSpan="2" />
                                      <td>{p.patient_name}</td>
                                      <td>{String(p.registered_date || '').slice(0, 10)}</td>
                                      <td>{p.p_phone || '—'}</td>
                                      <td>{p.doctor_name ? `Dr. ${p.doctor_name}` : '—'}</td>
                                      <td>{p.total_appointments}</td>
                                    </tr>
                                  ))}
                                </>
                              );
                            }) : <tr><td colSpan="7">No patient growth data for this range.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  )}

                  {activeReportTab === 'outstanding' && (
                    <article className="admin-panel">
                      <h2>Outstanding Accounts</h2>
                      <div className="table-wrap report-table-wrap">
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
                            {clinicPerformanceReport.outstandingPatients.length ? pagedOutstandingPatients.map((row) => (
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
                      {renderTablePager(clinicPerformanceReport.outstandingPatients.length, outstandingAccountsPage, setOutstandingAccountsPage)}
                    </article>
                  )}

                  {activeReportTab === 'financial' && (
                    <article className="admin-panel">
                      <h2 style={{ margin: '0 0 0.75rem' }}>Financial Detail Ledger</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.75rem', alignItems: 'flex-end' }}>
                        <label className="admin-inline-filter">
                          Patient
                          <input type="text" placeholder="Search name…" value={financialDetailPatient} onChange={(e) => setFinancialDetailPatient(e.target.value)} />
                        </label>
                        <button type="button" className="admin-btn" onClick={loadFinancialDetail} disabled={financialDetailLoading}>
                          {financialDetailLoading ? 'Loading…' : 'Search'}
                        </button>
                      </div>
                      {financialDetailError && <p className="admin-error">{financialDetailError}</p>}
                      {financialDetailLoading && <p className="admin-loading">Loading financial detail…</p>}
                      {!financialDetailLoading && financialDetail.totals && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem', background: '#f0f7f6', border: '1px solid #d7e7e5', borderRadius: '10px', padding: '0.6rem 1rem' }}>
                          <span><strong>Patient Responsibility:</strong> {formatMoney(financialDetail.totals.patient_responsibility)}</span>
                          <span style={{ color: '#555' }}>|</span>
                          <span><strong>Refunded:</strong> {formatMoney(financialDetail.totals.total_refunded)}</span>
                        </div>
                      )}
                      {!financialDetailLoading && financialDetail.items.length > 0 && (
                        <>
                          <div className="table-wrap report-table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>Patient</th>
                                  <th>Appt Date</th>
                                  <th>Provider</th>
                                  <th>Visit Status</th>
                                  <th>Invoice #</th>
                                  <th>Gross Charge</th>
                                  <th>Insurance Paid</th>
                                  <th>Patient Owes</th>
                                  <th>Patient Paid</th>
                                  <th>Refunded</th>
                                  <th>Balance Due</th>
                                  <th>Pay Status</th>
                                  <th>Fee Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {financialDetail.items.slice(financialDetailPage * reportPageSize, (financialDetailPage + 1) * reportPageSize).map((row, i) => (
                                  <tr key={`${row.appointment_id}-${i}`}>
                                    <td>{row.patient_name}</td>
                                    <td>{formatDate(row.appointment_date)}</td>
                                    <td>{row.doctor_name}</td>
                                    <td style={{ fontSize: '0.78rem' }}>{row.visit_status}</td>
                                    <td>{row.invoice_id ? `#${row.invoice_id}` : '—'}</td>
                                    <td>{formatMoney(row.gross_charge)}</td>
                                    <td>{formatMoney(row.insurance_covered)}</td>
                                    <td>{formatMoney(row.patient_responsibility)}</td>
                                    <td>{formatMoney(row.patient_paid)}</td>
                                    <td>{row.total_refunded > 0 ? formatMoney(row.total_refunded) : '—'}</td>
                                    <td style={{ color: row.balance_due > 0 ? '#9d2e2e' : '#2a7a4f', fontWeight: 700 }}>{formatMoney(row.balance_due)}</td>
                                    <td style={{ fontSize: '0.78rem' }}>{row.payment_status}</td>
                                    <td style={{ fontSize: '0.78rem', color: row.fee_note ? '#7a5100' : '#aaa' }}>{row.fee_note || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {renderTablePager(financialDetail.items.length, financialDetailPage, setFinancialDetailPage)}
                        </>
                      )}
                      {!financialDetailLoading && financialDetail.generatedAt && financialDetail.items.length === 0 && (
                        <p className="muted">No appointments found for the selected filters.</p>
                      )}
                    </article>
                  )}
                </>
              )}
            </>
          )}

          {activeSection === 'refunds' && (
            <>
              {overpaidInvoices.length > 0 && (
                <section className="admin-panel">
                  <div className="admin-panel-header">
                    <h2>Overpaid Invoices <span style={{ fontSize: '0.8rem', fontWeight: 600, background: '#fde8a0', color: '#7a5100', borderRadius: '999px', padding: '0.15em 0.6em', marginLeft: '0.4rem' }}>{overpaidInvoices.length}</span></h2>
                    <p className="muted">Patients who have paid more than their current invoice total. Click "Refund" to pre-fill the form below.</p>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Patient</th>
                          <th>Appt Date</th>
                          <th>Doctor</th>
                          <th>Invoice Total</th>
                          <th>Net Paid</th>
                          <th>Overpayment</th>
                          <th>Reason</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {overpaidInvoices.map((inv) => (
                          <tr key={inv.invoice_id}>
                            <td>#{inv.invoice_id}</td>
                            <td>{inv.patient_name}</td>
                            <td>{formatDate(inv.appointment_date)}</td>
                            <td>{inv.doctor_name || '—'}</td>
                            <td>{formatMoney(inv.patient_amount)}</td>
                            <td>{formatMoney(inv.net_paid)}</td>
                            <td style={{ color: '#9d2e2e', fontWeight: 700 }}>{formatMoney(inv.overpayment)}</td>
                            <td style={{ color: '#555', fontSize: '0.82rem' }}>{inv.reason}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-btn"
                                style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}
                                onClick={() => {
                                  setRefundForm({ invoiceId: String(inv.invoice_id), amount: String(inv.overpayment), reason: inv.reason });
                                  lookupInvoice(inv.invoice_id);
                                  document.getElementById('process-refund-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                              >
                                Refund
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section className="admin-panel" id="process-refund-panel">
                <div className="admin-panel-header">
                  <h2>Process Refund</h2>
                  <p className="muted">Enter an invoice ID to look up details and process a refund.</p>
                </div>
                <form
                  className="admin-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const invoiceId = Number(refundForm.invoiceId);
                    if (!invoiceId) {
                      setError('Invoice ID is required');
                      return;
                    }
                    try {
                      const invResponse = await fetch(`${API_BASE_URL}/api/admin/invoices/${invoiceId}`);
                      const invData = await invResponse.json();
                      if (!invResponse.ok) throw new Error(invData.error || 'Invoice not found');
                      setRefundForm((prev) => ({ ...prev, invoiceData: invData }));
                    } catch (err) {
                      setError(err.message || 'Failed to look up invoice');
                    }
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'end' }}>
                    <input
                      type="number"
                      placeholder="Invoice ID"
                      value={refundForm.invoiceId}
                      onChange={(e) => setRefundForm((prev) => ({ ...prev, invoiceId: e.target.value }))}
                      required
                    />
                    <button type="submit">Look Up Invoice</button>
                  </div>
                </form>

                {refundForm.invoiceData && (
                  <div className="refund-invoice-details" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #ddd' }}>
                    <h3>Invoice Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <p className="muted">Patient</p>
                        <p className="bold">{refundForm.invoiceData.patient_name}</p>
                      </div>
                      <div>
                        <p className="muted">Appointment Date</p>
                        <p className="bold">{formatDate(refundForm.invoiceData.appointment_date)}</p>
                      </div>
                      <div>
                        <p className="muted">Invoice Total</p>
                        <p className="bold">{formatMoney(refundForm.invoiceData.invoice_total)}</p>
                      </div>
                      <div>
                        <p className="muted">Patient Share</p>
                        <p className="bold">{formatMoney(refundForm.invoiceData.patient_amount)}</p>
                      </div>
                      <div>
                        <p className="muted">Total Paid</p>
                        <p className="bold">{formatMoney(refundForm.invoiceData.total_paid)}</p>
                      </div>
                      <div>
                        <p className="muted">Total Refunded</p>
                        <p className="bold" style={{ color: '#9d2e2e' }}>-{formatMoney(refundForm.invoiceData.total_refunded)}</p>
                      </div>
                      <div>
                        <p className="muted">Net Paid</p>
                        <p className="bold" style={{ color: refundForm.invoiceData.net_paid > refundForm.invoiceData.patient_amount ? '#27ae60' : 'inherit' }}>
                          {formatMoney(refundForm.invoiceData.net_paid)}
                        </p>
                      </div>
                      <div>
                        <p className="muted">Max Refundable</p>
                        <p className="bold">{formatMoney(refundForm.invoiceData.max_refundable)}</p>
                      </div>
                    </div>

                    <form
                      className="admin-form"
                      onSubmit={processRefund}
                      style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Refund Amount"
                          value={refundForm.amount}
                          onChange={(e) => setRefundForm((prev) => ({ ...prev, amount: e.target.value }))}
                          min="0"
                          max={refundForm.invoiceData.max_refundable}
                          required
                        />
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={refundForm.reason}
                          onChange={(e) => setRefundForm((prev) => ({ ...prev, reason: e.target.value }))}
                        />
                      </div>
                      <button type="submit" style={{ marginTop: '1rem' }}>Process Refund</button>
                      <button
                        type="button"
                        onClick={() => setRefundForm({ invoiceId: '', amount: '', reason: '' })}
                        style={{ marginTop: '1rem', marginLeft: '0.5rem', background: '#95a5a6' }}
                      >
                        Clear
                      </button>
                    </form>
                  </div>
                )}
              </section>

              <section className="admin-panel">
                <div className="admin-panel-header">
                  <h2>Refund History</h2>
                  <p className="muted">All refunds processed by administrators.</p>
                </div>
                {refundHistory.length > 0 ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Patient</th>
                          <th>Invoice ID</th>
                          <th>Refund Amount</th>
                          <th>Invoice Total</th>
                          <th>Reason</th>
                          <th>Processed By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {refundHistory.map((refund) => (
                          <tr key={refund.refund_id}>
                            <td>{formatDate(refund.created_at)}</td>
                            <td>{refund.patient_name}</td>
                            <td>{refund.invoice_id}</td>
                            <td style={{ color: '#9d2e2e' }}>-{formatMoney(refund.refund_amount)}</td>
                            <td>{formatMoney(refund.invoice_total)}</td>
                            <td>{refund.reason || '—'}</td>
                            <td>{refund.refunded_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No refunds have been processed yet.</p>
                )}
              </section>
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
                        if (existing && existing.is_off) return { day, startTime: '08:00', endTime: '17:00', isOff: true };
                        if (existing) return { day, startTime: String(existing.start_time || '').slice(0, 5), endTime: String(existing.end_time || '').slice(0, 5), isOff: false };
                        return { day, startTime: '08:00', endTime: '17:00', isOff: true };
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
                        <input
                          placeholder="Street number"
                          maxLength={20}
                          title="Use street number only, for example 11606 or 11606A"
                          value={locationForm.streetNo}
                          className={locationFieldErrors.streetNo ? 'admin-input-error' : ''}
                          onChange={(e) => updateLocationField('streetNo', e.target.value)}
                          required
                        />
                        {locationFieldErrors.streetNo ? <p className="admin-field-error">{locationFieldErrors.streetNo}</p> : null}
                        <input
                          placeholder="Street name"
                          maxLength={100}
                          value={locationForm.streetName}
                          className={locationFieldErrors.streetName ? 'admin-input-error' : ''}
                          onChange={(e) => updateLocationField('streetName', e.target.value)}
                          required
                        />
                        {locationFieldErrors.streetName ? <p className="admin-field-error">{locationFieldErrors.streetName}</p> : null}
                        <input
                          placeholder="City"
                          maxLength={20}
                          value={locationForm.city}
                          className={locationFieldErrors.city ? 'admin-input-error' : ''}
                          onChange={(e) => updateLocationField('city', e.target.value)}
                          required
                        />
                        {locationFieldErrors.city ? <p className="admin-field-error">{locationFieldErrors.city}</p> : null}
                        <input
                          placeholder="State"
                          maxLength={2}
                          pattern="[A-Za-z]{2}"
                          title="State must be 2 letters"
                          value={locationForm.state}
                          className={locationFieldErrors.state ? 'admin-input-error' : ''}
                          onChange={(e) => updateLocationField('state', String(e.target.value || '').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase())}
                          required
                        />
                        {locationFieldErrors.state ? <p className="admin-field-error">{locationFieldErrors.state}</p> : null}
                        <input
                          placeholder="ZIP"
                          value={locationForm.zipCode}
                          inputMode="numeric"
                          pattern="\d{5}"
                          maxLength={5}
                          className={locationFieldErrors.zipCode ? 'admin-input-error' : ''}
                          onChange={(e) => updateLocationField('zipCode', formatZipInput(e.target.value))}
                          required
                        />
                        {locationFieldErrors.zipCode ? <p className="admin-field-error">{locationFieldErrors.zipCode}</p> : null}
                        <button type="submit">Create Location</button>
                      </form>
                      <ul className="compact-list">
                        {locations.map((location) => (
                          <li key={location.location_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{location.full_address}</span>
                            <button
                              type="button"
                              className="admin-btn"
                              style={{ padding: '0.3rem 0.6rem', backgroundColor: '#8f2d2d' }}
                              onClick={() => handleLocationDelete(location)}
                            >
                              Remove
                            </button>
                          </li>
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
                                    {member.is_deleted ? 'Deactivated' : 'Active'}
                                  </span>
                                </td>
                                <td>
                                  <div className="admin-row-actions" style={{ flexDirection: 'column', gap: '0.3rem' }}>
                                    <button
                                      type="button"
                                      className="admin-action-btn approve"
                                      onClick={() => handleToggleVisibility(member.staff_id)}
                                    >
                                      {member.is_deleted ? 'Restore' : 'Deactivate'}
                                    </button>
                                    {resetPasswordStaffId === member.staff_id ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                          <input
                                            type="password"
                                            placeholder="New password"
                                            value={resetPasswordValue}
                                            onChange={(e) => { setResetPasswordValue(e.target.value); setResetPasswordMessage(''); }}
                                            style={{ width: '160px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                            minLength={8}
                                            title="At least 8 characters, 1 uppercase, 1 lowercase, and 1 number"
                                          />
                                          <button type="button" className="admin-action-btn approve" onClick={() => handleResetPassword(member.staff_id)}>Set</button>
                                          <button type="button" className="admin-action-btn deny" onClick={() => { setResetPasswordStaffId(null); setResetPasswordValue(''); setResetPasswordMessage(''); }}>X</button>
                                        </div>
                                        {resetPasswordMessage && (
                                          <p style={{ margin: 0, fontSize: '0.78rem', color: resetPasswordMessage.includes('successfully') ? '#007a4d' : '#b91c1c' }}>
                                            {resetPasswordMessage}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        className="admin-action-btn deny"
                                        onClick={() => { setResetPasswordStaffId(member.staff_id); setResetPasswordValue(''); setResetPasswordMessage(''); }}
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
