import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
      label: new Date(`2000-01-01T${value}:00`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    });
    cursor.setMinutes(cursor.getMinutes() + 30);
  }
  return options;
};

const CLINIC_TIME_OPTIONS = buildClinicTimeOptions(CLINIC_OPEN_TIME, CLINIC_CLOSE_TIME);

function labelFromKey(key) {
  return String(key || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function collectChecked(mapObject, excludedKeys = []) {
  if (!mapObject || typeof mapObject !== 'object') return [];
  const excluded = new Set(excludedKeys);
  return Object.entries(mapObject)
    .filter(([key, value]) => !excluded.has(key) && Boolean(value))
    .map(([key]) => labelFromKey(key));
}

function ReceptionistPatientProfilePage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = useMemo(() => getReceptionPortalSession(), []);

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generatingInvoiceForAppointmentId, setGeneratingInvoiceForAppointmentId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    locationId: '',
    doctorId: '',
    appointmentDate: '',
    appointmentTime: '',
    notes: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  // Confirm appointment request state
  const [confirmForms, setConfirmForms] = useState({});
  const [confirmingId, setConfirmingId] = useState(null);

  // Prescription state
  const [rxFormOpen, setRxFormOpen] = useState(false);
  const [allPharmacies, setAllPharmacies] = useState([]);
  const [rxForm, setRxForm] = useState({
    medicationName: '', strength: '', dosage: '', frequency: '', instructions: '',
    startDate: '', endDate: '', quantity: '', refills: '0', pharmId: '', doctorId: ''
  });
  const [isCreatingRx, setIsCreatingRx] = useState(false);

  // Checkout state
  const [checkoutInvoice, setCheckoutInvoice] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({ amount: '', methodId: '', referenceNumber: '', notes: '' });
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const safeJson = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  };

  const loadPatientData = async () => {
    setLoading(true);
    setError('');
    try {
      const [detailData, appointmentData, locationData, invoiceData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reception/patients/${patientId}/details`).then(safeJson),
        fetch(`${API_BASE_URL}/api/reception/patients/${patientId}/appointments`).then(safeJson),
        fetch(`${API_BASE_URL}/api/admin/locations`).then(safeJson),
        fetch(`${API_BASE_URL}/api/patients/${patientId}/invoices`).then(safeJson)
      ]);
      setPatient(detailData?.patient || null);
      setPatientData(detailData);
      setAppointments(Array.isArray(appointmentData) ? appointmentData : []);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);

      // Initialize confirm forms for pending requests
      const pending = Array.isArray(detailData?.pendingRequests) ? detailData.pendingRequests : [];
      const forms = {};
      pending.forEach((req) => {
        forms[req.preference_request_id] = {
          doctorId: req.assigned_doctor_id ? String(req.assigned_doctor_id) : '',
          locationId: '',
          assignedDate: req.preferred_date ? String(req.preferred_date).slice(0, 10) : '',
          assignedTime: req.preferred_time ? req.preferred_time.slice(0, 5) : '',
          notes: req.receptionist_notes || ''
        };
      });
      setConfirmForms(forms);
    } catch (err) {
      setError(err.message || 'Failed to load patient data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.staffId) {
      navigate('/staff-login');
      return;
    }
    loadPatientData();
  }, [API_BASE_URL, patientId]);

  // Load doctors when location changes (for create appointment form)
  useEffect(() => {
    const loadDoctors = async () => {
      const locationParam = appointmentForm.locationId ? `?locationId=${appointmentForm.locationId}` : '';
      try {
        const data = await fetch(`${API_BASE_URL}/api/reception/doctors${locationParam}`).then(safeJson);
        setDoctors(Array.isArray(data) ? data : []);
      } catch {
        setDoctors([]);
      }
    };
    loadDoctors();
  }, [API_BASE_URL, appointmentForm.locationId]);

  // Load pharmacies when rx form opens
  useEffect(() => {
    if (!rxFormOpen) return;
    const loadPharmacies = async () => {
      try {
        const data = await fetch(`${API_BASE_URL}/api/pharmacies`).then(safeJson);
        setAllPharmacies(Array.isArray(data) ? data : []);
      } catch {
        setAllPharmacies([]);
      }
    };
    loadPharmacies();
  }, [API_BASE_URL, rxFormOpen]);

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    setIsCreatingRx(true);
    setMessage('');
    setError('');
    try {
      await fetch(`${API_BASE_URL}/api/reception/patients/${patientId}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationName: rxForm.medicationName,
          strength: rxForm.strength,
          dosage: rxForm.dosage,
          frequency: rxForm.frequency,
          instructions: rxForm.instructions,
          startDate: rxForm.startDate || null,
          endDate: rxForm.endDate || null,
          quantity: Number(rxForm.quantity) || 0,
          refills: Number(rxForm.refills) || 0,
          pharmId: Number(rxForm.pharmId),
          doctorId: Number(rxForm.doctorId)
        })
      }).then(safeJson);
      setMessage('Prescription created successfully.');
      setRxFormOpen(false);
      setRxForm({ medicationName: '', strength: '', dosage: '', frequency: '', instructions: '', startDate: '', endDate: '', quantity: '', refills: '0', pharmId: '', doctorId: '' });
      loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to create prescription.');
    } finally {
      setIsCreatingRx(false);
    }
  };

  const handleLocationChange = (locationId) => {
    setAppointmentForm((prev) => ({ ...prev, locationId, doctorId: '' }));
  };

  const pendingRequests = Array.isArray(patientData?.pendingRequests) ? patientData.pendingRequests : [];
  const hasPendingRequest = pendingRequests.length > 0;

  const createAppointment = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!appointmentForm.doctorId || !appointmentForm.appointmentDate || !appointmentForm.appointmentTime) {
      setError('Please select a doctor, date, and time.');
      return;
    }

    setIsCreating(true);
    try {
      await fetch(`${API_BASE_URL}/api/reception/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: Number(patientId),
          doctorId: Number(appointmentForm.doctorId),
          appointmentDate: appointmentForm.appointmentDate,
          appointmentTime: appointmentForm.appointmentTime,
          locationId: appointmentForm.locationId ? Number(appointmentForm.locationId) : null,
          notes: appointmentForm.notes
        })
      }).then(safeJson);

      setMessage('Appointment created successfully.');
      setAppointmentForm({ locationId: appointmentForm.locationId, doctorId: '', appointmentDate: '', appointmentTime: '', notes: '' });
      setCreateOpen(false);
      await loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to create appointment.');
    } finally {
      setIsCreating(false);
    }
  };

  const confirmAppointmentRequest = async (preferenceRequestId) => {
    const form = confirmForms[preferenceRequestId];
    if (!form) return;

    if (!form.doctorId || !form.assignedDate || !form.assignedTime) {
      setError('Please select a doctor, date, and time to confirm the appointment.');
      return;
    }

    setMessage('');
    setError('');
    setConfirmingId(preferenceRequestId);
    try {
      await fetch(`${API_BASE_URL}/api/appointments/preference-requests/${preferenceRequestId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedDoctorId: Number(form.doctorId),
          assignedDate: form.assignedDate,
          assignedTime: form.assignedTime,
          receptionistNotes: form.notes,
          receptionistStaffId: session?.staffId
        })
      }).then(safeJson);

      setMessage('Appointment confirmed and scheduled successfully.');
      await loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to confirm appointment.');
    } finally {
      setConfirmingId(null);
    }
  };

  const updateConfirmForm = (requestId, field, value) => {
    setConfirmForms((prev) => ({
      ...prev,
      [requestId]: { ...prev[requestId], [field]: value }
    }));
  };

  const invoiceByAppointmentId = useMemo(() => {
    const mapped = new Map();
    (Array.isArray(invoices) ? invoices : []).forEach((invoice) => {
      const appointmentId = Number(invoice?.appointment_id || 0);
      if (appointmentId > 0) {
        mapped.set(appointmentId, invoice);
      }
    });
    return mapped;
  }, [invoices]);

  const formatMoney = (amount) => {
    const value = Number(amount || 0);
    return Number.isFinite(value)
      ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '$0.00';
  };

  const downloadVisitInvoicePdf = ({ invoice, payments, treatments, appointment }) => {
    const doc = new jsPDF();
    const invoiceId = Number(invoice?.invoice_id || 0);
    const appointmentId = Number(appointment?.appointment_id || invoice?.appointment_id || 0);
    const patientName = `${patient?.p_first_name || ''} ${patient?.p_last_name || ''}`.trim() || `Patient ${patientId}`;

    doc.setFontSize(16);
    doc.text('Visit Invoice', 14, 18);

    doc.setFontSize(10);
    doc.text(`Invoice #: ${invoiceId || 'N/A'}`, 14, 25);
    doc.text(`Patient: ${patientName}`, 14, 31);
    doc.text(`Patient ID: ${patientId}`, 14, 37);
    doc.text(`Appointment ID: ${appointmentId || 'N/A'}`, 14, 43);
    doc.text(`Date: ${formatDate(appointment?.appointment_date || invoice?.appointment_date)}`, 14, 49);
    doc.text(`Time: ${formatTime(appointment?.appointment_time || invoice?.appointment_time)}`, 14, 55);
    doc.text(`Doctor: ${appointment?.doctor_name || 'N/A'}`, 14, 61);
    doc.text(`Location: ${appointment?.location_address || 'N/A'}`, 14, 67);
    doc.text(`Status: ${appointment?.appointment_status || appointment?.status_name || 'N/A'}`, 14, 73);

    // Treatment Details table
    const treatmentList = Array.isArray(treatments) ? treatments : [];
    let nextY = 80;

    if (treatmentList.length) {
      doc.setFontSize(11);
      doc.text('Treatment Details', 14, nextY);
      nextY += 3;

      autoTable(doc, {
        startY: nextY,
        styles: { fontSize: 8 },
        head: [['ADA Code', 'Description', 'Tooth', 'Surface', 'Fee', 'Coverage %', 'Ins. Covered', 'Copay', 'Patient Owes']],
        body: treatmentList.map((t) => [
          t.procedure_code || 'N/A',
          t.procedure_description || 'N/A',
          t.tooth_number || '—',
          t.surface || '—',
          formatMoney(t.estimated_cost),
          `${Number(t.coverage_percent || 0).toFixed(0)}%`,
          formatMoney(t.insurance_covered),
          formatMoney(t.copay_amount),
          formatMoney(t.patient_owes)
        ]),
        foot: [[
          { content: 'Totals', colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: formatMoney(invoice?.amount), styles: { fontStyle: 'bold' } },
          '',
          { content: formatMoney(invoice?.insurance_covered_amount), styles: { fontStyle: 'bold' } },
          '',
          { content: formatMoney(invoice?.patient_amount), styles: { fontStyle: 'bold' } }
        ]]
      });

      nextY = (doc.lastAutoTable?.finalY || nextY) + 6;
    }

    // Invoice Summary table
    doc.setFontSize(11);
    doc.text('Invoice Summary', 14, nextY);
    nextY += 3;

    autoTable(doc, {
      startY: nextY,
      head: [['Invoice Total', 'Insurance Covered', 'Patient Responsibility', 'Amount Paid', 'Amount Due', 'Payment Status']],
      body: [[
        formatMoney(invoice?.amount),
        formatMoney(invoice?.insurance_covered_amount),
        formatMoney(invoice?.patient_amount),
        formatMoney(invoice?.amount_paid),
        formatMoney(invoice?.amount_due),
        String(invoice?.payment_status || 'N/A')
      ]],
      styles: { fontSize: 9 }
    });

    // Payment History table
    const paymentRows = (Array.isArray(payments) ? payments : []).map((payment) => [
      payment?.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A',
      formatMoney(payment?.payment_amount),
      payment?.method_name || payment?.method_type || 'N/A',
      payment?.reference_number || 'N/A',
      payment?.notes || ''
    ]);

    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || nextY) + 6,
      head: [['Payment Date', 'Amount', 'Method', 'Reference', 'Notes']],
      body: paymentRows.length ? paymentRows : [['N/A', formatMoney(0), 'N/A', 'N/A', 'No payments recorded']],
      styles: { fontSize: 9 }
    });

    doc.save(`patient-${patientId}-appointment-${appointmentId || 'visit'}-invoice.pdf`);
  };

  const handleViewInvoicePdf = async (appointment) => {
    const appointmentId = Number(appointment?.appointment_id || 0);
    if (!appointmentId) {
      setError('Unable to find this appointment.');
      return;
    }

    const invoiceSummary = invoiceByAppointmentId.get(appointmentId);
    if (!invoiceSummary?.invoice_id) {
      setError('No invoice is available yet for this completed visit.');
      return;
    }

    setError('');
    setMessage('');
    setGeneratingInvoiceForAppointmentId(appointmentId);
    try {
      const payload = await fetch(`${API_BASE_URL}/api/patients/${patientId}/invoices/${invoiceSummary.invoice_id}`).then(safeJson);
      downloadVisitInvoicePdf({
        invoice: payload?.invoice || invoiceSummary,
        payments: Array.isArray(payload?.payments) ? payload.payments : [],
        treatments: Array.isArray(payload?.treatments) ? payload.treatments : [],
        appointment
      });
      setMessage('Invoice PDF downloaded successfully.');
    } catch (err) {
      setError(err.message || 'Unable to generate invoice PDF for this visit.');
    } finally {
      setGeneratingInvoiceForAppointmentId(null);
    }
  };

  const openCheckout = async (invoice) => {
    setCheckoutInvoice(invoice);
    const amountDue = Number(invoice?.amount_due ?? (Number(invoice?.patient_amount || 0) - Number(invoice?.amount_paid || 0)));
    setCheckoutForm({ amount: amountDue > 0 ? amountDue.toFixed(2) : '', methodId: '', referenceNumber: '', notes: '' });
    if (!paymentMethods.length) {
      try {
        const methods = await fetch(`${API_BASE_URL}/api/payment-methods`).then(safeJson);
        setPaymentMethods(Array.isArray(methods) ? methods : []);
      } catch { /* ignore */ }
    }
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (!checkoutInvoice?.invoice_id) return;

    const paymentAmount = Number(checkoutForm.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    setIsProcessingPayment(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${patientId}/invoices/${checkoutInvoice.invoice_id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentAmount: paymentAmount,
          methodId: Number(checkoutForm.methodId),
          referenceNumber: checkoutForm.referenceNumber || null,
          notes: checkoutForm.notes || null,
          paymentDate: new Date().toISOString()
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Payment failed.');
      }

      setMessage(`Payment of ${formatMoney(paymentAmount)} recorded successfully.`);
      setCheckoutInvoice(null);

      // Refresh invoices
      const updatedInvoices = await fetch(`${API_BASE_URL}/api/patients/${patientId}/invoices`).then(safeJson);
      setInvoices(Array.isArray(updatedInvoices) ? updatedInvoices : []);
    } catch (err) {
      setError(err.message || 'Payment processing failed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return <main className="reception-page"><p>Loading patient profile...</p></main>;
  }

  if (!patient) {
    return (
      <main className="reception-page">
        <p>{error || 'Patient not found.'}</p>
        <Link to="/receptionist" className="reception-action-btn reception-action-btn--primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '0.5rem' }}>Back to Dashboard</Link>
      </main>
    );
  }

  const emergencyContact = (() => {
    const name = String(patient.p_emergency_contact_name || '').trim();
    const phone = String(patient.p_emergency_contact_phone || '').trim();
    if (name && phone) return `${name} (${phone})`;
    if (name) return name;
    if (phone) return phone;
    return 'N/A';
  })();

  // Medical info from intake snapshot
  const snapshot = patientData?.intakeSnapshot || {};
  const medicalConditions = collectChecked(snapshot.medicalHistory || {});
  const adverseReactions = collectChecked(snapshot.adverseReactions || {}, ['hasAllergies']);
  const dentalSymptoms = collectChecked(snapshot.dentalFindings || {});
  const sleepHabits = collectChecked(snapshot.sleepSocial || {});
  const caffeineHabits = collectChecked(snapshot.caffeine || {});

  const tobaccoSummary = [];
  if (snapshot?.tobacco?.never) tobaccoSummary.push('Never used tobacco');
  if (snapshot?.tobacco?.quit) tobaccoSummary.push('Patient reports quitting tobacco');
  (snapshot?.tobacco?.currentUses || []).forEach((entry) => {
    tobaccoSummary.push(`${entry.type || 'Tobacco'} - ${entry.amount || 'N/A'} (${entry.frequency || 'N/A'})`);
  });
  (snapshot?.tobacco?.quitHistory || []).forEach((entry) => {
    tobaccoSummary.push(`${entry.type || 'Tobacco'} quit on ${entry.quitDate || 'unknown date'}`);
  });

  const dentalFindings = Array.isArray(patientData?.dentalFindings) ? patientData.dentalFindings : [];
  const treatments = Array.isArray(patientData?.treatments) ? patientData.treatments : [];
  const insurance = Array.isArray(patientData?.insurance) ? patientData.insurance : [];
  const patientPharmacies = Array.isArray(patientData?.pharmacies) ? patientData.pharmacies : [];
  const prescriptions = Array.isArray(patientData?.prescriptions) ? patientData.prescriptions : [];

  return (
    <main className="reception-page">
      <section className="reception-header">
        <div>
          <p className="reception-header-subtle">Patient Profile</p>
          <h1>{patient.p_first_name} {patient.p_last_name}</h1>
          <p className="reception-header-subtle">Patient ID: {patient.patient_id}</p>
        </div>
        <Link to="/receptionist" className="reception-action-btn reception-action-btn--secondary" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>Back to Dashboard</Link>
      </section>

      {error && <p className="reception-message" style={{ color: '#9d2e2e' }}>{error}</p>}
      {message && <p className="reception-message">{message}</p>}

      {/* Contact + Medical Info */}
      <section className="reception-profile-grid-two">
        <article className="reception-panel">
          <h2>Contact Information</h2>
          <p><strong>Phone:</strong> {patient.p_phone || 'N/A'}</p>
          <p><strong>Email:</strong> {patient.p_email || 'N/A'}</p>
          <p><strong>Date of Birth:</strong> {patient.p_dob ? formatDate(patient.p_dob) : 'N/A'}</p>
          <p><strong>Address:</strong> {[patient.p_address, patient.p_city, patient.p_state, patient.p_zipcode].filter(Boolean).join(', ') || 'N/A'}</p>
          <p><strong>Emergency Contact:</strong> {emergencyContact}</p>
          {insurance.length > 0 ? (
            <>
              <h3 style={{ marginTop: '0.8rem', marginBottom: '0.3rem' }}>Insurance</h3>
              {insurance.map((ins) => (
                <div key={ins.insurance_id} style={{ border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd', padding: '0.6rem 0.75rem', marginBottom: '0.5rem' }}>
                  <p style={{ margin: '0 0 0.3rem', fontWeight: 700 }}>{ins.company_name || 'Unknown'}{ins.is_primary ? ' (Primary)' : ''}</p>
                  <p style={{ margin: '0.15rem 0' }}><strong>Member ID:</strong> {ins.member_id || 'N/A'}{ins.group_number ? ` | Group: ${ins.group_number}` : ''}</p>
                  {ins.company_phone && <p style={{ margin: '0.15rem 0' }}><strong>Phone:</strong> {ins.company_phone}</p>}
                  {ins.company_fax && <p style={{ margin: '0.15rem 0' }}><strong>Fax:</strong> {ins.company_fax}</p>}
                  {(ins.company_address || ins.company_city) && (
                    <p style={{ margin: '0.15rem 0' }}><strong>Mailing:</strong> {[ins.company_address, ins.company_city, ins.company_state, ins.company_zipcode].filter(Boolean).join(', ')}</p>
                  )}
                  {ins.company_website && <p style={{ margin: '0.15rem 0' }}><strong>Website:</strong> {ins.company_website}</p>}
                  {ins.company_contact && <p style={{ margin: '0.15rem 0' }}><strong>Contact:</strong> {ins.company_contact}</p>}
                </div>
              ))}
            </>
          ) : (
            <p style={{ marginTop: '0.8rem', color: '#4b6966' }}><em>No insurance on file</em></p>
          )}
        </article>

        <article className="reception-panel">
          <h2>Medical Information</h2>
          <p><strong>Medical Conditions:</strong> {medicalConditions.join(', ') || 'None reported'}</p>
          <p><strong>Adverse Reactions:</strong> {adverseReactions.join(', ') || 'None reported'}</p>
          <p><strong>Dental Symptoms:</strong> {dentalSymptoms.join(', ') || 'None reported'}</p>
          <p><strong>Sleep Habits:</strong> {sleepHabits.join(', ') || 'None reported'}</p>
          <p><strong>Caffeine Habits:</strong> {caffeineHabits.join(', ') || 'None reported'}</p>
          <p><strong>Tobacco History:</strong> {tobaccoSummary.join('; ') || 'None reported'}</p>
        </article>
      </section>

      {/* Confirm Pending Appointment Requests */}
      {pendingRequests.length > 0 && (
        <section className="reception-panel">
          <h2>Pending Appointment Requests</h2>
          {pendingRequests.map((req) => {
            const form = confirmForms[req.preference_request_id] || {};
            const isConfirming = confirmingId === req.preference_request_id;
            return (
              <div key={req.preference_request_id} className="reception-confirm-request">
                <div className="reception-confirm-header">
                  <p><strong>Requested:</strong> {formatDate(req.preferred_date)} at {formatTime(req.preferred_time)}</p>
                  <p><strong>Reason:</strong> {req.appointment_reason || 'N/A'}</p>
                  {req.preferred_location && <p><strong>Preferred Location:</strong> {req.preferred_location}</p>}
                </div>
                <div className="reception-form" style={{ marginTop: '0.5rem' }}>
                  <label>
                    Location
                    <select
                      value={form.locationId || ''}
                      onChange={(e) => {
                        updateConfirmForm(req.preference_request_id, 'locationId', e.target.value);
                        updateConfirmForm(req.preference_request_id, 'doctorId', '');
                      }}
                    >
                      <option value="">All Locations</option>
                      {locations.map((loc) => (
                        <option key={loc.location_id} value={loc.location_id}>{loc.full_address}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Doctor
                    <ConfirmDoctorSelect
                      apiBaseUrl={API_BASE_URL}
                      locationId={form.locationId}
                      value={form.doctorId || ''}
                      onChange={(val) => updateConfirmForm(req.preference_request_id, 'doctorId', val)}
                      safeJson={safeJson}
                    />
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={form.assignedDate || ''}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => updateConfirmForm(req.preference_request_id, 'assignedDate', e.target.value)}
                    />
                  </label>
                  <label>
                    Time
                    <select value={form.assignedTime || ''} onChange={(e) => updateConfirmForm(req.preference_request_id, 'assignedTime', e.target.value)}>
                      <option value="">Select time</option>
                      {CLINIC_TIME_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Notes (optional)
                    <input
                      type="text"
                      value={form.notes || ''}
                      onChange={(e) => updateConfirmForm(req.preference_request_id, 'notes', e.target.value)}
                      placeholder="Receptionist notes"
                    />
                  </label>
                  <button
                    type="button"
                    className="reception-action-btn reception-action-btn--primary"
                    disabled={isConfirming}
                    onClick={() => confirmAppointmentRequest(req.preference_request_id)}
                  >
                    {isConfirming ? 'Confirming...' : 'Confirm Appointment'}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Create Appointment — expandable, disabled if pending request exists */}
      <section className="reception-panel">
        <button
          type="button"
          className="reception-expand-btn"
          onClick={() => {
            if (!hasPendingRequest) setCreateOpen((prev) => !prev);
          }}
          disabled={hasPendingRequest}
          title={hasPendingRequest ? 'This patient already has a pending appointment request. Confirm it above instead.' : ''}
        >
          <span>{createOpen ? '▾' : '▸'} Create Appointment</span>
          {hasPendingRequest && <span className="reception-expand-hint">Pending request exists</span>}
        </button>
        {createOpen && !hasPendingRequest && (
          <form className="reception-form" style={{ marginTop: '0.75rem' }} onSubmit={createAppointment}>
            <label>
              Location
              <select value={appointmentForm.locationId} onChange={(e) => handleLocationChange(e.target.value)}>
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.location_id} value={loc.location_id}>{loc.full_address}</option>
                ))}
              </select>
            </label>
            <label>
              Doctor
              <select value={appointmentForm.doctorId} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, doctorId: e.target.value }))} required>
                <option value="">Select a doctor</option>
                {doctors.map((doc) => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    Dr. {doc.doctor_name} — {doc.specialties}{doc.location_names ? ` (${doc.location_names})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                value={appointmentForm.appointmentDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setAppointmentForm((prev) => ({ ...prev, appointmentDate: e.target.value }))}
                required
              />
            </label>
            <label>
              Time
              <select value={appointmentForm.appointmentTime} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, appointmentTime: e.target.value }))} required>
                <option value="">Select time</option>
                {CLINIC_TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label>
              Notes (optional)
              <input
                type="text"
                value={appointmentForm.notes}
                onChange={(e) => setAppointmentForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Reason or notes"
              />
            </label>
            <button type="submit" className="reception-action-btn reception-action-btn--primary" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Appointment'}
            </button>
          </form>
        )}
      </section>

      {/* Dental Findings */}
      {dentalFindings.length > 0 && (
        <section className="reception-panel">
          <h2>Dental Findings</h2>
          <div className="reception-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tooth</th>
                  <th>Surface</th>
                  <th>Condition</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {dentalFindings.map((f) => (
                  <tr key={f.finding_id}>
                    <td>{formatDate(f.appointment_date || f.date_logged)}</td>
                    <td>{f.tooth_number || 'N/A'}</td>
                    <td>{f.surface || 'N/A'}</td>
                    <td>{f.condition_type || 'N/A'}</td>
                    <td>{f.notes || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Treatments */}
      {treatments.length > 0 && (
        <section className="reception-panel">
          <h2>Treatment History</h2>
          <div className="reception-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Procedure</th>
                  <th>Tooth</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {treatments.map((t) => (
                  <tr key={t.plan_id}>
                    <td>{formatDate(t.created_at)}</td>
                    <td>{t.procedure_code || 'N/A'}</td>
                    <td>{t.tooth_number || 'N/A'}</td>
                    <td>{t.treatment_status || 'N/A'}</td>
                    <td>{t.notes || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pharmacy & Prescriptions */}
      <section className="reception-profile-grid-two">
        <article className="reception-panel">
          <h2>Assigned Pharmacy</h2>
          {patientPharmacies.length > 0 ? patientPharmacies.map((ph) => (
            <div key={ph.pharm_id} style={{ border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd', padding: '0.6rem 0.75rem', marginBottom: '0.5rem' }}>
              <p style={{ margin: '0 0 0.15rem', fontWeight: 700 }}>{ph.pharm_name}{ph.is_primary ? ' (Primary)' : ''}</p>
              <p style={{ margin: '0.1rem 0' }}><strong>Phone:</strong> {ph.pharm_phone || 'N/A'}</p>
              <p style={{ margin: '0.1rem 0' }}><strong>Address:</strong> {[ph.ph_address_1, ph.ph_city, ph.ph_state, ph.ph_zipcode].filter(Boolean).join(', ')}</p>
            </div>
          )) : (
            <p style={{ color: '#4b6966' }}><em>No pharmacy assigned</em></p>
          )}
        </article>

        <article className="reception-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Prescriptions</h2>
            <button type="button" className="reception-action-btn reception-action-btn--primary" onClick={() => setRxFormOpen(!rxFormOpen)}>
              {rxFormOpen ? 'Cancel' : 'New Prescription'}
            </button>
          </div>

          {rxFormOpen && (
            <form onSubmit={handleCreatePrescription} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 0.75rem', marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd' }}>
              <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Medication Name *</span>
                <input value={rxForm.medicationName} onChange={(e) => setRxForm((p) => ({ ...p, medicationName: e.target.value }))} required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Strength</span>
                <input value={rxForm.strength} onChange={(e) => setRxForm((p) => ({ ...p, strength: e.target.value }))} placeholder="e.g. 500mg" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Dosage</span>
                <input value={rxForm.dosage} onChange={(e) => setRxForm((p) => ({ ...p, dosage: e.target.value }))} placeholder="e.g. 1 tablet" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Frequency</span>
                <input value={rxForm.frequency} onChange={(e) => setRxForm((p) => ({ ...p, frequency: e.target.value }))} placeholder="e.g. Twice daily" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Quantity</span>
                <input type="number" min="0" value={rxForm.quantity} onChange={(e) => setRxForm((p) => ({ ...p, quantity: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Start Date</span>
                <input type="date" value={rxForm.startDate} onChange={(e) => setRxForm((p) => ({ ...p, startDate: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>End Date</span>
                <input type="date" value={rxForm.endDate} onChange={(e) => setRxForm((p) => ({ ...p, endDate: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Refills</span>
                <input type="number" min="0" value={rxForm.refills} onChange={(e) => setRxForm((p) => ({ ...p, refills: e.target.value }))} />
              </label>
              <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Instructions</span>
                <textarea rows="2" value={rxForm.instructions} onChange={(e) => setRxForm((p) => ({ ...p, instructions: e.target.value }))} placeholder="Patient instructions..." />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Pharmacy *</span>
                <select value={rxForm.pharmId} onChange={(e) => setRxForm((p) => ({ ...p, pharmId: e.target.value }))} required>
                  <option value="">Select pharmacy</option>
                  {allPharmacies.map((ph) => (
                    <option key={ph.pharm_id} value={ph.pharm_id}>{ph.pharm_name} — {ph.ph_city}, {ph.ph_state}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Prescribing Doctor *</span>
                <select value={rxForm.doctorId} onChange={(e) => setRxForm((p) => ({ ...p, doctorId: e.target.value }))} required>
                  <option value="">Select doctor</option>
                  {doctors.map((doc) => (
                    <option key={doc.doctor_id} value={doc.doctor_id}>Dr. {doc.doctor_name}</option>
                  ))}
                </select>
              </label>
              <div style={{ gridColumn: '1 / -1', marginTop: '0.3rem' }}>
                <button type="submit" className="reception-action-btn reception-action-btn--primary" disabled={isCreatingRx}>
                  {isCreatingRx ? 'Creating...' : 'Create Prescription'}
                </button>
              </div>
            </form>
          )}

          {prescriptions.length > 0 ? (
            <div className="reception-table-wrap" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Qty</th>
                    <th>Refills</th>
                    <th>Doctor</th>
                    <th>Pharmacy</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx) => (
                    <tr key={rx.prescription_id}>
                      <td>{rx.medication_name}{rx.strength ? ` (${rx.strength})` : ''}</td>
                      <td>{rx.dosage || '—'}</td>
                      <td>{rx.frequency || '—'}</td>
                      <td>{rx.start_date ? formatDate(rx.start_date) : '—'}</td>
                      <td>{rx.end_date ? formatDate(rx.end_date) : '—'}</td>
                      <td>{rx.quantity || '—'}</td>
                      <td>{rx.refills ?? '—'}</td>
                      <td>{rx.prescribing_doctor || 'N/A'}</td>
                      <td>{rx.pharmacy_name || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ marginTop: '0.5rem', color: '#4b6966' }}><em>No prescriptions on file</em></p>
          )}
        </article>
      </section>

      {/* Appointment History */}
      <section className="reception-panel">
        <h2>Appointment History</h2>
        <div className="reception-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Doctor</th>
                <th>Location</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => {
                const status = String(appt.appointment_status || appt.status_name || '').toUpperCase();
                const isCompleted = status === 'COMPLETED';
                const invoice = invoiceByAppointmentId.get(Number(appt.appointment_id || 0));
                const hasInvoice = Boolean(invoice?.invoice_id);
                const isGenerating = generatingInvoiceForAppointmentId === Number(appt.appointment_id || 0);
                const paymentStatus = invoice?.payment_status || '';
                const amountDue = Number(invoice?.amount_due ?? invoice?.patient_amount ?? 0);

                return (
                  <tr key={appt.appointment_id}>
                    <td>{formatDate(appt.appointment_date)}</td>
                    <td>{formatTime(appt.appointment_time)}</td>
                    <td>{appt.doctor_name}</td>
                    <td>{appt.location_address || 'N/A'}</td>
                    <td>{appt.appointment_status || appt.status_name}</td>
                    <td>
                      {isCompleted && hasInvoice ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: paymentStatus === 'Paid' ? '#d4edda' : paymentStatus === 'Partial' ? '#fff3cd' : '#f8d7da',
                          color: paymentStatus === 'Paid' ? '#155724' : paymentStatus === 'Partial' ? '#856404' : '#721c24'
                        }}>
                          {paymentStatus}{amountDue > 0 ? ` — ${formatMoney(amountDue)} due` : ''}
                        </span>
                      ) : isCompleted ? 'Pending' : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {isCompleted && hasInvoice && (
                          <button
                            type="button"
                            className="reception-action-btn reception-action-btn--secondary"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                            onClick={() => handleViewInvoicePdf(appt)}
                            disabled={isGenerating}
                          >
                            {isGenerating ? 'Preparing...' : 'Invoice PDF'}
                          </button>
                        )}
                        {isCompleted && hasInvoice && amountDue > 0 && (
                          <button
                            type="button"
                            className="reception-action-btn reception-action-btn--primary"
                            style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                            onClick={() => openCheckout(invoice)}
                          >
                            Checkout
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!appointments.length && (
                <tr>
                  <td colSpan="7">No appointment history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Checkout Modal */}
      {checkoutInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '1.5rem', maxWidth: '480px', width: '90%', boxShadow: '0 12px 36px rgba(6,55,53,0.18)' }}>
            <h2 style={{ margin: '0 0 0.3rem', color: '#132524' }}>Checkout</h2>
            <p style={{ margin: '0 0 1rem', color: '#4b6966' }}>
              Invoice #{checkoutInvoice.invoice_id} — {patient?.p_first_name} {patient?.p_last_name}
            </p>

            <div style={{ border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd', padding: '0.65rem 0.75rem', marginBottom: '1rem' }}>
              <p style={{ margin: '0.1rem 0' }}><strong>Total:</strong> {formatMoney(checkoutInvoice.amount)}</p>
              <p style={{ margin: '0.1rem 0' }}><strong>Insurance Covered:</strong> {formatMoney(checkoutInvoice.insurance_covered_amount)}</p>
              <p style={{ margin: '0.1rem 0' }}><strong>Patient Responsibility:</strong> {formatMoney(checkoutInvoice.patient_amount)}</p>
              <p style={{ margin: '0.1rem 0' }}><strong>Already Paid:</strong> {formatMoney(checkoutInvoice.amount_paid || 0)}</p>
              <p style={{ margin: '0.1rem 0', fontWeight: 700, color: '#9d2e2e' }}>
                <strong>Amount Due:</strong> {formatMoney(Number(checkoutInvoice.amount_due ?? (Number(checkoutInvoice.patient_amount || 0) - Number(checkoutInvoice.amount_paid || 0))))}
              </p>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="reception-form">
              <label>
                <span>Payment Amount</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(checkoutInvoice.amount_due ?? (Number(checkoutInvoice.patient_amount || 0) - Number(checkoutInvoice.amount_paid || 0)))}
                  value={checkoutForm.amount}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </label>
              <label>
                <span>Payment Method</span>
                <select
                  value={checkoutForm.methodId}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, methodId: e.target.value }))}
                  required
                >
                  <option value="">Select method</option>
                  {paymentMethods.map((m) => (
                    <option key={m.method_id} value={m.method_id}>{m.display_name || m.method_name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Reference Number (optional)</span>
                <input
                  type="text"
                  value={checkoutForm.referenceNumber}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                  placeholder="Check #, card last 4, etc."
                />
              </label>
              <label>
                <span>Notes (optional)</span>
                <input
                  type="text"
                  value={checkoutForm.notes}
                  onChange={(e) => setCheckoutForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="In-person payment, etc."
                />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="reception-action-btn reception-action-btn--secondary" onClick={() => setCheckoutInvoice(null)} disabled={isProcessingPayment}>
                  Cancel
                </button>
                <button type="submit" className="reception-action-btn reception-action-btn--primary" disabled={isProcessingPayment}>
                  {isProcessingPayment ? 'Processing...' : 'Process Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// Sub-component: Doctor select that loads doctors filtered by location for each confirm form
function ConfirmDoctorSelect({ apiBaseUrl, locationId, value, onChange, safeJson }) {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const loadDocs = async () => {
      const param = locationId ? `?locationId=${locationId}` : '';
      try {
        const data = await fetch(`${apiBaseUrl}/api/reception/doctors${param}`).then(safeJson);
        setDocs(Array.isArray(data) ? data : []);
      } catch {
        setDocs([]);
      }
    };
    loadDocs();
  }, [apiBaseUrl, locationId]);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a doctor</option>
      {docs.map((doc) => (
        <option key={doc.doctor_id} value={doc.doctor_id}>
          Dr. {doc.doctor_name} — {doc.specialties}{doc.location_names ? ` (${doc.location_names})` : ''}
        </option>
      ))}
    </select>
  );
}

export default ReceptionistPatientProfilePage;
