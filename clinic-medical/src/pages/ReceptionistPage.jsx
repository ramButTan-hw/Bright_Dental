import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatTime, getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/ReceptionistPage.css';

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
  const [singleReportForm, setSingleReportForm] = useState({
    patientId: '',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    procedureCode: '',
    toothNumber: '',
    surface: '',
    status: '',
    reason: ''
  });
  const [singleReportFormat, setSingleReportFormat] = useState('PDF');
  const [isGeneratingSingleReport, setIsGeneratingSingleReport] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    locationId: '',
    reason: ''
  });
  const [timeOffHistory, setTimeOffHistory] = useState([]);
  const [timeOffLocations, setTimeOffLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isSubmittingTimeOff, setIsSubmittingTimeOff] = useState(false);
  const [mySchedule, setMySchedule] = useState([]);
  const [systemCancelledAppts, setSystemCancelledAppts] = useState([]);

  const buildReportQueryString = (formValues) => {
    const params = new URLSearchParams();
    Object.entries(formValues).forEach(([key, value]) => {
      const safeValue = String(value || '').trim();
      if (safeValue) {
        params.set(key, safeValue);
      }
    });
    return params.toString();
  };

  const flattenReportRows = (payload) => {
    const visits = Array.isArray(payload?.visits) ? payload.visits : [];
    const rows = [];

    visits.forEach((visit) => {
      const entries = Array.isArray(visit?.entries) ? visit.entries : [];
      if (!entries.length) {
        rows.push({
          patientId: visit.patientId,
          patientName: visit.patientName,
          visitDate: visit.visitDate,
          visitCost: Number(visit.visitCost || 0),
          procedureCode: '',
          treatmentDescription: '',
          toothNumber: '',
          surface: '',
          treatmentCost: 0,
          finding: '',
          notes: ''
        });
        return;
      }

      entries.forEach((entry) => {
        rows.push({
          patientId: visit.patientId,
          patientName: visit.patientName,
          visitDate: visit.visitDate,
          visitCost: Number(visit.visitCost || 0),
          procedureCode: entry.procedureCode || '',
          treatmentDescription: entry.treatmentDescription || '',
          toothNumber: entry.toothNumber || '',
          surface: entry.surface || '',
          treatmentCost: Number(entry.cost || 0),
          finding: entry.finding || '',
          notes: entry.notes || ''
        });
      });
    });

    return rows;
  };

  const escapeCsvValue = (value) => {
    const raw = String(value ?? '');
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const downloadTextFile = (text, filename, mimeType) => {
    const blob = new Blob([text], { type: mimeType });
    const fileUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = fileUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(fileUrl);
  };

  const downloadReportJson = (payload, filename) => {
    downloadTextFile(JSON.stringify(payload, null, 2), filename, 'application/json');
  };

  const downloadReportCsv = (payload, filename) => {
    const rows = flattenReportRows(payload);
    const header = [
      'Patient ID',
      'Patient Name',
      'Visit Date',
      'Visit Cost',
      'ADA Code',
      'Treatment',
      'Tooth Number',
      'Surface',
      'Treatment Cost',
      'Finding',
      'Notes'
    ];
    const csvLines = [header.join(',')];

    rows.forEach((row) => {
      csvLines.push([
        row.patientId,
        row.patientName,
        row.visitDate,
        row.visitCost.toFixed(2),
        row.procedureCode,
        row.treatmentDescription,
        row.toothNumber,
        row.surface,
        row.treatmentCost.toFixed(2),
        row.finding,
        row.notes
      ].map(escapeCsvValue).join(','));
    });

    downloadTextFile(csvLines.join('\n'), filename, 'text/csv;charset=utf-8');
  };

  const downloadReportPdf = (payload, filename, title) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const rows = flattenReportRows(payload);
    const summary = payload?.summary || {};
    const isMultiPatientReport = String(payload?.reportType || '').includes('MULTI_PATIENT');
    const summaryParts = [];
    if (isMultiPatientReport) {
      summaryParts.push(`Patients: ${summary.totalPatients ?? 0}`);
    }
    summaryParts.push(`Visits: ${summary.totalVisits ?? 0}`);
    summaryParts.push(`Entries: ${summary.totalEntries ?? 0}`);
    summaryParts.push(`Total Cost: $${Number(summary.totalCost || 0).toFixed(2)}`);

    doc.setFontSize(14);
    doc.text(title, 14, 14);
    doc.setFontSize(10);
    doc.text(`Generated: ${String(payload?.generatedAt || '').slice(0, 19).replace('T', ' ')}`, 14, 20);
    doc.text(summaryParts.join('  '), 14, 26);

    autoTable(doc, {
      startY: 30,
      styles: { fontSize: 8 },
      head: [[
        'Patient ID',
        'Patient Name',
        'Visit Date',
        'Visit Cost',
        'ADA',
        'Treatment',
        'Tooth',
        'Surface',
        'Treatment Cost',
        'Finding'
      ]],
      body: rows.map((row) => [
        String(row.patientId || ''),
        row.patientName,
        row.visitDate,
        `$${row.visitCost.toFixed(2)}`,
        row.procedureCode,
        row.treatmentDescription,
        row.toothNumber,
        row.surface,
        `$${row.treatmentCost.toFixed(2)}`,
        row.finding
      ])
    });

    doc.save(filename);
  };

  const exportReportPayload = (payload, format, baseFilename, title) => {
    const safeFormat = String(format || 'JSON').toUpperCase();
    if (safeFormat === 'CSV') {
      downloadReportCsv(payload, `${baseFilename}.csv`);
      return;
    }
    if (safeFormat === 'PDF') {
      downloadReportPdf(payload, `${baseFilename}.pdf`, title);
      return;
    }
    downloadReportJson(payload, `${baseFilename}.json`);
  };

  const generateSinglePatientReport = async (event) => {
    event.preventDefault();
    setMessage('');
    const patientId = Number(singleReportForm.patientId || 0);
    if (!Number.isInteger(patientId) || patientId <= 0) {
      setMessage('Please enter a valid patient ID.');
      return;
    }

    setIsGeneratingSingleReport(true);
    try {
      const queryString = buildReportQueryString(singleReportForm);
      const response = await fetch(`${API_BASE_URL}/api/reception/reports/patient?${queryString}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate treatment/finding report.');
      }

      exportReportPayload(
        payload,
        singleReportFormat,
        `reception-patient-${patientId}-report-${singleReportForm.fromDate}-to-${singleReportForm.toDate}`,
        'Reception Single Patient Treatment and Finding Report'
      );

      await generateSinglePatientApptReport(patientId);

      setMessage(`Both reports generated and downloaded as ${singleReportFormat}.`);
    } catch (err) {
      setMessage(err.message || 'Failed to generate report.');
    } finally {
      setIsGeneratingSingleReport(false);
    }
  };

  const flattenApptReportRows = (payload) => {
    const appointments = Array.isArray(payload?.appointments) ? payload.appointments : [];
    return appointments.map((a) => ({
      appointmentId: a.appointmentId,
      patientId: a.patientId,
      patientName: a.patientName || '',
      appointmentDate: a.appointmentDate || '',
      appointmentTime: a.appointmentTime || '',
      status: a.statusDisplay || a.status || '',
      doctorName: a.doctorName || '',
      location: a.location || '',
      notes: a.notes || '',
      amountBilled: a.amountBilled ?? '',
      amountPaid: a.amountPaid ?? '',
      amountOwed: a.amountOwed ?? '',
      paymentStatus: a.paymentStatus || ''
    }));
  };

  const downloadApptReportCsv = (payload, filename) => {
    const rows = flattenApptReportRows(payload);
    const header = ['Appt ID', 'Patient ID', 'Patient Name', 'Date', 'Time', 'Status', 'Doctor', 'Location', 'Billed', 'Paid', 'Owed', 'Payment Status', 'Notes'];
    const csvLines = [header.join(',')];
    rows.forEach((row) => {
      csvLines.push([
        row.appointmentId,
        row.patientId,
        row.patientName,
        row.appointmentDate,
        row.appointmentTime,
        row.status,
        row.doctorName,
        row.location,
        row.amountBilled,
        row.amountPaid,
        row.amountOwed,
        row.paymentStatus,
        row.notes
      ].map(escapeCsvValue).join(','));
    });
    downloadTextFile(csvLines.join('\n'), filename, 'text/csv;charset=utf-8');
  };

  const downloadApptReportPdf = (payload, filename, title) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const rows = flattenApptReportRows(payload);
    const summary = payload?.summary || {};
    const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

    doc.setFontSize(14);
    doc.text(title, 14, 14);
    doc.setFontSize(10);
    doc.text(`Generated: ${String(payload?.generatedAt || '').slice(0, 19).replace('T', ' ')}`, 14, 21);
    doc.text(`Total Appointments: ${summary.totalAppointments ?? 0}  |  No-Shows: ${summary.noShows ?? 0}  |  Cancellations: ${summary.cancellations ?? 0}`, 14, 27);
    doc.text(`Last Visit: ${summary.lastVisitDate || 'N/A'}  |  Next Upcoming: ${summary.nextUpcomingDate || 'N/A'}`, 14, 33);
    doc.text(`Total Billed: ${fmt(summary.totalBilled)}  |  Collected: ${fmt(summary.totalCollected)}  |  Outstanding: ${fmt(summary.totalOwed)}`, 14, 39);

    autoTable(doc, {
      startY: 44,
      styles: { fontSize: 8 },
      head: [['Appt ID', 'Date', 'Time', 'Status', 'Doctor', 'Location', 'Billed', 'Paid', 'Owed', 'Notes']],
      body: rows.map((row) => [
        String(row.appointmentId || ''),
        row.appointmentDate,
        row.appointmentTime,
        row.status,
        row.doctorName,
        row.location,
        row.amountBilled !== '' ? fmt(row.amountBilled) : '—',
        row.amountPaid !== '' ? fmt(row.amountPaid) : '—',
        row.amountOwed !== '' ? fmt(row.amountOwed) : '—',
        row.notes
      ])
    });

    doc.save(filename);
  };

  const exportApptReportPayload = (payload, format, baseFilename, title) => {
    const safeFormat = String(format || 'JSON').toUpperCase();
    if (safeFormat === 'CSV') {
      downloadApptReportCsv(payload, `${baseFilename}.csv`);
      return;
    }
    if (safeFormat === 'PDF') {
      downloadApptReportPdf(payload, `${baseFilename}.pdf`, title);
      return;
    }
    downloadReportJson(payload, `${baseFilename}.json`);
  };

  const generateSinglePatientApptReport = async (patientId) => {
    try {
      const apptForm = { patientId: singleReportForm.patientId, fromDate: singleReportForm.fromDate, toDate: singleReportForm.toDate, status: singleReportForm.status, reason: singleReportForm.reason };
      const queryString = buildReportQueryString(apptForm);
      const response = await fetch(`${API_BASE_URL}/api/reception/reports/patient-appointments?${queryString}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to generate single-patient appointment report.');
      }

      exportApptReportPayload(
        payload,
        singleReportFormat,
        `reception-patient-${patientId}-appointments-${singleReportForm.fromDate}-to-${singleReportForm.toDate}`,
        'Single Patient Appointment Report'
      );
    } catch (err) {
      throw err;
    }
  };

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
    const [requestsData, timeOffData, locationData, departmentsData, scheduleData] = await Promise.all([
      fetchWithTimeout(`${API_BASE_URL}/api/appointments/preference-requests`).then(safeJson),
      session?.staffId
        ? fetchWithTimeout(`${API_BASE_URL}/api/staff/time-off-requests?staffId=${encodeURIComponent(session.staffId)}`).then(safeJson)
        : Promise.resolve([]),
      fetchWithTimeout(`${API_BASE_URL}/api/admin/locations`).then(safeJson),
      fetchWithTimeout(`${API_BASE_URL}/api/departments`).then(safeJson),
      session?.staffId
        ? fetchWithTimeout(`${API_BASE_URL}/api/staff/schedules?staffId=${encodeURIComponent(session.staffId)}`).then(safeJson)
        : Promise.resolve([])
    ]);

    setRequests(Array.isArray(requestsData) ? requestsData : []);
    setTimeOffHistory(Array.isArray(timeOffData) ? timeOffData : []);
    setTimeOffLocations(Array.isArray(locationData) ? locationData : []);
    setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
    setMySchedule(Array.isArray(scheduleData) ? scheduleData : []);
    await loadAppointmentsForDate(selectedDate);
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

  const submitTimeOffRequest = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!session?.staffId) {
      setMessage('Staff session missing. Please sign in again.');
      return;
    }
    if (!timeOffForm.startDate || !timeOffForm.startTime || !timeOffForm.endDate || !timeOffForm.endTime) {
      setMessage('Please provide start/end date and start/end time for time off.');
      return;
    }

    const clinicTimes = new Set(CLINIC_TIME_SELECT_OPTIONS.map((option) => option.value));
    if (!clinicTimes.has(timeOffForm.startTime) || !clinicTimes.has(timeOffForm.endTime)) {
      setMessage('Please select times within clinic hours.');
      return;
    }

    const startDateTime = `${timeOffForm.startDate}T${timeOffForm.startTime}:00`;
    const endDateTime = `${timeOffForm.endDate}T${timeOffForm.endTime}:00`;

    setIsSubmittingTimeOff(true);
    try {
      await fetchWithTimeout(`${API_BASE_URL}/api/staff/time-off-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: Number(session.staffId),
          startDateTime,
          endDateTime,
          locationId: timeOffForm.locationId ? Number(timeOffForm.locationId) : null,
          reason: timeOffForm.reason
        })
      }).then(safeJson);

      setMessage('Time-off request submitted. Admin will review it shortly.');
      setTimeOffForm({ startDate: '', startTime: '', endDate: '', endTime: '', locationId: '', reason: '' });
      await loadCore();
    } catch (err) {
      setMessage(err.message || 'Failed to submit time-off request.');
    } finally {
      setIsSubmittingTimeOff(false);
    }
  };

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
    fetch(`${API_BASE_URL}/api/admin/system-cancelled-appointments`)
      .then((res) => res.ok ? res.json() : Promise.resolve([]))
      .then((data) => setSystemCancelledAppts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [API_BASE_URL]);

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

      <section className="reception-panel">
        <h2>Reports</h2>
        <div className="reception-report-grid">
          <form className="reception-report-form" onSubmit={generateSinglePatientReport}>
            <h3>Single Patient Report</h3>
            <p>Generates treatment/finding and appointment reports for one patient in the selected date range.</p>
            <label>
              <span>Patient ID</span>
              <input
                type="number"
                min="1"
                value={singleReportForm.patientId}
                onChange={(event) => setSingleReportForm((prev) => ({ ...prev, patientId: event.target.value }))}
                required
              />
            </label>
            <div className="reception-report-row">
              <label>
                <span>From Date</span>
                <input
                  type="date"
                  value={singleReportForm.fromDate}
                  onChange={(event) => setSingleReportForm((prev) => ({ ...prev, fromDate: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>To Date</span>
                <input
                  type="date"
                  value={singleReportForm.toDate}
                  onChange={(event) => setSingleReportForm((prev) => ({ ...prev, toDate: event.target.value }))}
                  required
                />
              </label>
            </div>
            <label>
              <span>ADA Code (optional)</span>
              <input
                type="text"
                value={singleReportForm.procedureCode}
                onChange={(event) => setSingleReportForm((prev) => ({ ...prev, procedureCode: event.target.value.toUpperCase() }))}
                placeholder="D1110"
              />
            </label>
            <div className="reception-report-row">
              <label>
                <span>Tooth Number (optional)</span>
                <input
                  type="text"
                  value={singleReportForm.toothNumber}
                  onChange={(event) => setSingleReportForm((prev) => ({ ...prev, toothNumber: event.target.value }))}
                  placeholder="14"
                />
              </label>
              <label>
                <span>Surface (optional)</span>
                <input
                  type="text"
                  value={singleReportForm.surface}
                  onChange={(event) => setSingleReportForm((prev) => ({ ...prev, surface: event.target.value.toUpperCase() }))}
                  placeholder="O"
                />
              </label>
            </div>
            <label>
              <span>Export Format</span>
              <select
                value={singleReportFormat}
                onChange={(event) => setSingleReportFormat(event.target.value)}
              >
                <option value="PDF">PDF</option>
                <option value="CSV">CSV</option>
                <option value="JSON">JSON</option>
              </select>
            </label>
            <label>
              <span>Appointment Status (optional)</span>
              <select
                value={singleReportForm.status}
                onChange={(event) => setSingleReportForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
                <option value="RESCHEDULED">Rescheduled</option>
                <option value="CHECKED_IN">Checked In</option>
              </select>
            </label>
            <label>
              <span>Reason / Notes (optional)</span>
              <select
                value={singleReportForm.reason}
                onChange={(event) => setSingleReportForm((prev) => ({ ...prev, reason: event.target.value }))}
              >
                <option value="">All Reasons / Notes</option>
                {departments.map((dept) => (
                  <option key={dept.department_id} value={dept.department_name}>{dept.department_name}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="reception-action-btn reception-action-btn--primary" disabled={isGeneratingSingleReport}>
              {isGeneratingSingleReport ? 'Generating...' : 'Generate Single Patient Report'}
            </button>
          </form>

        </div>
      </section>

      {systemCancelledAppts.length > 0 && (
        <section className="reception-section">
          <h2 style={{ color: '#a53030', marginBottom: '0.75rem' }}>Appointments Cancelled by System — Patients Need to Reschedule</h2>
          <p style={{ color: '#666', fontSize: '0.88rem', marginBottom: '1rem' }}>
            The following appointments were automatically cancelled due to doctor time-off approval in the last 30 days. Contact these patients to help them reschedule.
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
                  <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Cancelled At</th>
                </tr>
              </thead>
              <tbody>
                {systemCancelledAppts.map((row) => (
                  <tr key={row.appointment_id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{row.patient_name}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{row.p_email}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{row.p_phone}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{formatDate(row.appointment_date)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{formatTime(row.appointment_time)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{row.doctor_name}</td>
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
