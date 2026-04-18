import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, formatTime, getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/ReceptionistPage.css';


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
  const [createAvailability, setCreateAvailability] = useState([]);

  // Confirm appointment request state
  const [confirmForms, setConfirmForms] = useState({});
  const [confirmingId, setConfirmingId] = useState(null);
  const [slotAvailability, setSlotAvailability] = useState({});

  // Pharmacy assign state
  const [pharmAssignOpen, setPharmAssignOpen] = useState(false);
  const [pharmAssignId, setPharmAssignId] = useState('');
  const [pharmAssignPrimary, setPharmAssignPrimary] = useState(false);
  const [isAssigningPharm, setIsAssigningPharm] = useState(false);
  const [pendingInsuranceRequests, setPendingInsuranceRequests] = useState([]);
  const [pendingPharmacyRequests, setPendingPharmacyRequests] = useState([]);
  const [resolvingInsuranceRequestId, setResolvingInsuranceRequestId] = useState(null);
  const [resolvingPharmacyRequestId, setResolvingPharmacyRequestId] = useState(null);

  // Insurance state
  const [insuranceFormOpen, setInsuranceFormOpen] = useState(false);
  const [allInsuranceCompanies, setAllInsuranceCompanies] = useState([]);
  const [insuranceForm, setInsuranceForm] = useState({ companyId: '', memberId: '', groupNumber: '', isPrimary: false });
  const [isAddingInsurance, setIsAddingInsurance] = useState(false);
  const [confirmPrimarySwap, setConfirmPrimarySwap] = useState(false);
  const [confirmSetPrimaryId, setConfirmSetPrimaryId] = useState(null);

  const [allPharmacies, setAllPharmacies] = useState([]);

  // Unpaid invoice contact tracking (persisted per patient in localStorage)
  const [invoiceContactLog, setInvoiceContactLog] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`invoiceContactLog_${patientId}`) || '{}');
    } catch { return {}; }
  });

  const updateInvoiceContact = (invoiceId, patch) => {
    setInvoiceContactLog((prev) => {
      const next = { ...prev, [invoiceId]: { ...prev[invoiceId], ...patch } };
      try { localStorage.setItem(`invoiceContactLog_${patientId}`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

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

      const [insuranceRequestsData, pharmacyRequestsData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reception/insurance-change-requests`).then(safeJson).catch(() => []),
        fetch(`${API_BASE_URL}/api/reception/pharmacy-change-requests`).then(safeJson).catch(() => [])
      ]);

      setPendingInsuranceRequests(
        (Array.isArray(insuranceRequestsData) ? insuranceRequestsData : []).filter((req) => Number(req.patient_id) === Number(patientId))
      );
      setPendingPharmacyRequests(
        (Array.isArray(pharmacyRequestsData) ? pharmacyRequestsData : []).filter((req) => Number(req.patient_id) === Number(patientId))
      );

      // Fetch availability for any pre-populated doctors
      for (const req of pending) {
        const docId = req.assigned_doctor_id ? String(req.assigned_doctor_id) : '';
        if (docId) {
          fetch(`${API_BASE_URL}/api/appointments/preferred-availability?doctorId=${docId}`)
            .then((r) => r.json().catch(() => ({})))
            .then((d) => {
              setSlotAvailability((prev) => ({
                ...prev,
                [req.preference_request_id]: Array.isArray(d?.availability) ? d.availability : []
              }));
            })
            .catch(() => {});
        }
      }
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

  useEffect(() => {
    const hash = String(window.location.hash || '').replace('#', '');
    if (!hash) return;

    const tryScroll = () => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    window.requestAnimationFrame(tryScroll);
    const timeoutId = window.setTimeout(tryScroll, 150);
    return () => window.clearTimeout(timeoutId);
  }, [patientId]);

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

  // Load insurance companies when insurance form opens
  useEffect(() => {
    if (!insuranceFormOpen) return;
    fetch(`${API_BASE_URL}/api/insurance-companies`)
      .then(safeJson)
      .then((data) => setAllInsuranceCompanies(Array.isArray(data) ? data : []))
      .catch(() => setAllInsuranceCompanies([]));
  }, [API_BASE_URL, insuranceFormOpen]);

  // Load pharmacies when pharmacy assign form opens
  useEffect(() => {
    if (!pharmAssignOpen) return;
    const loadPharmacies = async () => {
      try {
        const data = await fetch(`${API_BASE_URL}/api/pharmacies`).then(safeJson);
        setAllPharmacies(Array.isArray(data) ? data : []);
      } catch {
        setAllPharmacies([]);
      }
    };
    loadPharmacies();
  }, [API_BASE_URL, pharmAssignOpen]);

  const handleAssignPharmacy = async (e) => {
    e.preventDefault();
    setIsAssigningPharm(true);
    setMessage('');
    setError('');
    try {
      await fetch(`${API_BASE_URL}/api/reception/patients/${patientId}/pharmacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmId: Number(pharmAssignId), isPrimary: pharmAssignPrimary })
      }).then(safeJson);
      setMessage('Pharmacy assigned.');
      setPharmAssignOpen(false);
      setPharmAssignId('');
      setPharmAssignPrimary(false);
      loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to assign pharmacy.');
    } finally {
      setIsAssigningPharm(false);
    }
  };

  const handleRemovePharmacy = async (pharmId) => {
    setMessage('');
    setError('');
    try {
      await fetch(`${API_BASE_URL}/api/reception/patients/${patientId}/pharmacy/${pharmId}`, {
        method: 'DELETE'
      }).then(safeJson);
      setMessage('Pharmacy removed.');
      loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to remove pharmacy.');
    }
  };

  const handleAddInsurance = async (e) => {
    e.preventDefault();
    setIsAddingInsurance(true);
    setMessage('');
    setError('');
    try {
      await fetch(`${API_BASE_URL}/api/patients/${patientId}/insurance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: Number(insuranceForm.companyId),
          memberId: insuranceForm.memberId,
          groupNumber: insuranceForm.groupNumber,
          isPrimary: insuranceForm.isPrimary
        })
      }).then(safeJson);
      setMessage('Insurance added.');
      setInsuranceFormOpen(false);
      setInsuranceForm({ companyId: '', memberId: '', groupNumber: '', isPrimary: false });
      setConfirmPrimarySwap(false);
      loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to add insurance.');
    } finally {
      setIsAddingInsurance(false);
    }
  };

  const handleSetPrimaryInsurance = async (insuranceId) => {
    setMessage('');
    setError('');
    try {
      await fetch(`${API_BASE_URL}/api/patients/${patientId}/insurance/${insuranceId}/set-primary`, {
        method: 'PUT'
      }).then(safeJson);
      setMessage('Primary insurance updated.');
      setConfirmSetPrimaryId(null);
      loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to update primary insurance.');
    }
  };

  const handleRemoveInsurance = async (insuranceId) => {
    setMessage('');
    setError('');
    try {
      await fetch(`${API_BASE_URL}/api/patients/${patientId}/insurance/${insuranceId}`, {
        method: 'DELETE'
      }).then(safeJson);
      setMessage('Insurance removed.');
      loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to remove insurance.');
    }
  };

  const handleLocationChange = (locationId) => {
    setAppointmentForm((prev) => ({ ...prev, locationId, doctorId: '' }));
  };

  const pendingRequests = Array.isArray(patientData?.pendingRequests) ? patientData.pendingRequests : [];
  const hasPendingRequest = pendingRequests.some((r) => r.request_status === 'PREFERRED_PENDING');

  const unpaidInvoices = invoices.filter((inv) => {
    const due = Number(inv.amount_due ?? (Number(inv.patient_amount || 0) - Number(inv.amount_paid || 0)));
    return due > 0;
  });
  const hasActiveAppointment = appointments.some((appt) => {
    const status = String(appt?.appointment_status || appt?.status_name || '').toUpperCase();
    return ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED', 'CHECKED_IN'].includes(status);
  });
  const canCreateAppointment = !hasPendingRequest && !hasActiveAppointment;
  const [revertingId, setRevertingId] = useState(null);

  const revertAppointmentRequest = async (preferenceRequestId) => {
    setMessage('');
    setError('');
    setRevertingId(preferenceRequestId);
    try {
      await fetch(`${API_BASE_URL}/api/appointments/preference-requests/${preferenceRequestId}/revert`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).then(safeJson);
      setMessage('Appointment reverted to pending request.');
      await loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to revert appointment.');
    } finally {
      setRevertingId(null);
    }
  };

  const resolveInsuranceRequest = async (requestId, action) => {
    setResolvingInsuranceRequestId(requestId);
    setMessage('');
    setError('');
    try {
      await fetch(`${API_BASE_URL}/api/reception/insurance-change-requests/${requestId}/${action}`, { method: 'PUT' }).then(safeJson);
      setMessage(`Insurance request ${action.toLowerCase()}.`);
      await loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to update insurance request.');
    } finally {
      setResolvingInsuranceRequestId(null);
    }
  };

  const resolvePharmacyRequest = async (requestId, action) => {
    setResolvingPharmacyRequestId(requestId);
    setMessage('');
    setError('');
    try {
      await fetch(`${API_BASE_URL}/api/reception/pharmacy-change-requests/${requestId}/${action}`, { method: 'PUT' }).then(safeJson);
      setMessage(`Pharmacy request ${action.toLowerCase()}.`);
      await loadPatientData();
    } catch (err) {
      setError(err.message || 'Failed to update pharmacy request.');
    } finally {
      setResolvingPharmacyRequestId(null);
    }
  };

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

  const fetchSlotAvailability = async (requestId, doctorId) => {
    if (!doctorId) {
      setSlotAvailability((prev) => ({ ...prev, [requestId]: [] }));
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/appointments/preferred-availability?doctorId=${doctorId}`);
      const data = await safeJson(res);
      setSlotAvailability((prev) => ({
        ...prev,
        [requestId]: Array.isArray(data?.availability) ? data.availability : []
      }));
    } catch {
      setSlotAvailability((prev) => ({ ...prev, [requestId]: [] }));
    }
  };

  const updateConfirmForm = (requestId, field, value) => {
    setConfirmForms((prev) => ({
      ...prev,
      [requestId]: {
        ...prev[requestId],
        [field]: value,
        ...(field === 'doctorId' ? { assignedDate: '', assignedTime: '' } : {}),
        ...(field === 'assignedDate' ? { assignedTime: '' } : {})
      }
    }));
    if (field === 'doctorId') {
      fetchSlotAvailability(requestId, value);
    }
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
  if (snapshot?.tobacco?.quit) {
    (snapshot?.tobacco?.quitHistory || []).forEach((entry) => {
      const quitType = String(entry?.type || '').trim();
      const quitDate = String(entry?.quitDate || '').trim();
      if (!quitType && !quitDate) return;
      tobaccoSummary.push(`${quitType || 'Tobacco'} quit on ${quitDate || 'unknown date'}`);
    });
  }

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', marginBottom: '0.3rem' }}>
            <h3 style={{ margin: 0 }}>Insurance</h3>
            <button type="button" style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', background: 'none', border: '1px solid #2d7a6e', color: '#2d7a6e', borderRadius: '6px', cursor: 'pointer' }} onClick={() => { setInsuranceFormOpen(!insuranceFormOpen); setConfirmPrimarySwap(false); setInsuranceForm({ companyId: '', memberId: '', groupNumber: '', isPrimary: false }); }}>
              {insuranceFormOpen ? 'Cancel' : '+ Add'}
            </button>
          </div>
          {insuranceFormOpen && (
            <form onSubmit={handleAddInsurance} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem', border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Insurance Company *</span>
                <select value={insuranceForm.companyId} onChange={(e) => setInsuranceForm((p) => ({ ...p, companyId: e.target.value }))} required>
                  <option value="">Select company</option>
                  {allInsuranceCompanies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Member ID *</span>
                <input type="text" value={insuranceForm.memberId} onChange={(e) => setInsuranceForm((p) => ({ ...p, memberId: e.target.value }))} required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Group Number</span>
                <input type="text" value={insuranceForm.groupNumber} onChange={(e) => setInsuranceForm((p) => ({ ...p, groupNumber: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={insuranceForm.isPrimary} onChange={(e) => { setInsuranceForm((p) => ({ ...p, isPrimary: e.target.checked })); setConfirmPrimarySwap(false); }} />
                Set as primary insurance
              </label>
              {insuranceForm.isPrimary && insurance.some((i) => i.is_primary) && (
                <div style={{ background: '#fff8e1', border: '1px solid #f0c040', borderRadius: '8px', padding: '0.6rem 0.75rem', fontSize: '0.83rem', color: '#7a5a00' }}>
                  <strong>⚠ {insurance.find((i) => i.is_primary).company_name}</strong> is currently the primary insurance. Saving will replace it.
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', fontWeight: 600 }}>
                    <input type="checkbox" checked={confirmPrimarySwap} onChange={(e) => setConfirmPrimarySwap(e.target.checked)} />
                    I confirm this change
                  </label>
                </div>
              )}
              <button type="submit" className="reception-action-btn reception-action-btn--primary" disabled={isAddingInsurance || (insuranceForm.isPrimary && insurance.some((i) => i.is_primary) && !confirmPrimarySwap)} style={{ alignSelf: 'flex-start' }}>
                {isAddingInsurance ? 'Saving...' : 'Save'}
              </button>
            </form>
          )}
          {insurance.length > 0 ? insurance.map((ins) => (
            <div key={ins.insurance_id} style={{ border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd', padding: '0.6rem 0.75rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: '0 0 0.3rem', fontWeight: 700 }}>{ins.company_name || 'Unknown'}{ins.is_primary ? ' (Primary)' : ''}</p>
                <p style={{ margin: '0.15rem 0' }}><strong>Member ID:</strong> {ins.member_id || 'N/A'}{ins.group_number ? ` | Group: ${ins.group_number}` : ''}</p>
                {ins.company_phone && <p style={{ margin: '0.15rem 0' }}><strong>Phone:</strong> {ins.company_phone}</p>}
                {ins.company_fax && <p style={{ margin: '0.15rem 0' }}><strong>Fax:</strong> {ins.company_fax}</p>}
                {(ins.company_address || ins.company_city) && <p style={{ margin: '0.15rem 0' }}><strong>Mailing:</strong> {[ins.company_address, ins.company_city, ins.company_state, ins.company_zipcode].filter(Boolean).join(', ')}</p>}
                {ins.company_website && <p style={{ margin: '0.15rem 0' }}><strong>Website:</strong> {ins.company_website}</p>}
                {ins.company_contact && <p style={{ margin: '0.15rem 0' }}><strong>Contact:</strong> {ins.company_contact}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                {!ins.is_primary && (
                  confirmSetPrimaryId === ins.insurance_id ? (
                    <div style={{ background: '#fff8e1', border: '1px solid #f0c040', borderRadius: '8px', padding: '0.5rem 0.65rem', fontSize: '0.78rem', color: '#7a5a00', textAlign: 'right' }}>
                      {insurance.find((i) => i.is_primary) && (
                        <div>Replaces <strong>{insurance.find((i) => i.is_primary).company_name}</strong> as primary.</div>
                      )}
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => handleSetPrimaryInsurance(ins.insurance_id)} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: '#2d7a6e', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Confirm</button>
                        <button type="button" onClick={() => setConfirmSetPrimaryId(null)} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'none', border: '1px solid #999', color: '#555', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmSetPrimaryId(ins.insurance_id)} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'none', border: '1px solid #2d7a6e', color: '#2d7a6e', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Set as primary</button>
                  )
                )}
                <button type="button" onClick={() => handleRemoveInsurance(ins.insurance_id)} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'none', border: '1px solid #c0392b', color: '#c0392b', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Remove</button>
              </div>
            </div>
          )) : (
            <p style={{ color: '#4b6966' }}><em>No insurance on file</em></p>
          )}

          <div id="insurance-section" style={{ scrollMarginTop: '6.5rem', marginTop: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Pending Insurance Change Requests</h3>
            {pendingInsuranceRequests.length > 0 ? pendingInsuranceRequests.map((req) => (
              <div key={req.request_id} style={{ border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd', padding: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div>
                    <p style={{ margin: '0 0 0.25rem', fontWeight: 700 }}>{req.change_type} Insurance</p>
                    <p style={{ margin: 0 }}><strong>Company:</strong> {req.new_company_name || req.current_company_name || 'N/A'}</p>
                    <p style={{ margin: 0 }}><strong>Member ID:</strong> {req.member_id || req.current_member_id || 'N/A'}</p>
                    <p style={{ margin: 0 }}><strong>Group:</strong> {req.group_number || req.current_group_number || 'N/A'}</p>
                    <p style={{ margin: 0 }}><strong>Primary:</strong> {req.is_primary ? 'Yes' : 'No'}</p>
                    {req.patient_note && <p style={{ margin: '0.25rem 0 0' }}><strong>Note:</strong> {req.patient_note}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="reception-action-btn reception-action-btn--primary"
                      disabled={resolvingInsuranceRequestId === req.request_id}
                      onClick={() => resolveInsuranceRequest(req.request_id, 'APPROVED')}
                    >
                      {resolvingInsuranceRequestId === req.request_id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="reception-action-btn reception-action-btn--secondary"
                      disabled={resolvingInsuranceRequestId === req.request_id}
                      onClick={() => resolveInsuranceRequest(req.request_id, 'DENIED')}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            )) : <p style={{ color: '#4b6966' }}><em>No pending insurance requests.</em></p>}
          </div>
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

      {/* Unpaid Invoice Alert */}
      {unpaidInvoices.length > 0 && (
        <section className="invoice-alert-panel">
          <h3 className="invoice-alert-panel__heading">
            Outstanding Balances
            <span className="invoice-alert-panel__count">{unpaidInvoices.length}</span>
          </h3>
          <div className="invoice-alert-panel__list">
            {unpaidInvoices.map((inv) => {
              const due = Number(inv.amount_due ?? (Number(inv.patient_amount || 0) - Number(inv.amount_paid || 0)));
              const log = invoiceContactLog[inv.invoice_id] || {};
              return (
                <div key={inv.invoice_id} className={`invoice-alert-row${log.contacted ? ' invoice-alert-row--contacted' : ''}`}>
                  <div className="invoice-alert-row__meta">
                    <span className="invoice-alert-row__id">Invoice #{inv.invoice_id}</span>
                    <span className="invoice-alert-row__amount">${due.toFixed(2)} due</span>
                    <span className={`invoice-alert-row__status invoice-alert-row__status--${String(inv.payment_status || 'unpaid').toLowerCase()}`}>
                      {inv.payment_status || 'Unpaid'}
                    </span>
                  </div>
                  <label className="invoice-alert-row__contact-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(log.contacted)}
                      onChange={(e) => updateInvoiceContact(inv.invoice_id, { contacted: e.target.checked })}
                    />
                    Patient contacted
                  </label>
                  {log.contacted && (
                    <input
                      type="text"
                      className="invoice-alert-row__note"
                      placeholder="Note patient's decision or response…"
                      value={log.note || ''}
                      onChange={(e) => updateInvoiceContact(inv.invoice_id, { note: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Appointment Requests */}
      {pendingRequests.length > 0 && (
        <section className="reception-panel">
          <h2>Appointment Requests</h2>
          {pendingRequests.map((req) => {
            const form = confirmForms[req.preference_request_id] || {};
            const isConfirming = confirmingId === req.preference_request_id;
            const isAssigned = req.request_status === 'ASSIGNED';
            const isReverting = revertingId === req.preference_request_id;
            return (
              <div key={req.preference_request_id} className="reception-confirm-request">
                <div className="reception-confirm-header">
                  <p><strong>Requested:</strong> {formatDate(req.preferred_date)} at {formatTime(req.preferred_time)}</p>
                  <p><strong>Reason:</strong> {req.appointment_reason || 'N/A'}</p>
                  {req.preferred_location && <p><strong>Preferred Location:</strong> {req.preferred_location}</p>}
                  <p><strong>Status:</strong> {isAssigned ? 'Assigned' : 'Pending'}</p>
                </div>

                {isAssigned ? (
                  <div style={{ marginTop: '0.5rem' }}>
                    <p><strong>Assigned Doctor:</strong> {req.assigned_doctor_name || 'N/A'}</p>
                    <p><strong>Assigned Date:</strong> {formatDate(req.assigned_date)}</p>
                    <p><strong>Assigned Time:</strong> {formatTime(req.assigned_time)}</p>
                    {req.receptionist_notes && <p><strong>Notes:</strong> {req.receptionist_notes}</p>}
                    <button
                      type="button"
                      className="reception-action-btn reception-action-btn--secondary"
                      style={{ marginTop: '0.5rem' }}
                      disabled={isReverting}
                      onClick={() => revertAppointmentRequest(req.preference_request_id)}
                    >
                      {isReverting ? 'Reverting...' : 'Revert to Pending Request'}
                    </button>
                  </div>
                ) : (
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
                      {(() => {
                        const avail = (slotAvailability[req.preference_request_id] || []).find((d) => d.date === form.assignedDate);
                        const allSlots = avail?.timeOptions || [];
                        const openSlots = allSlots.filter((s) => !s.isFull && !s.timeOff);
                        const hasTimeOff = allSlots.some((s) => s.timeOff);
                        const allFull = allSlots.length > 0 && openSlots.length === 0;

                        if (form.doctorId && form.assignedDate && allFull) {
                          return (
                            <p className="reception-message" style={{ color: '#b53030', margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
                              {hasTimeOff
                                ? 'This doctor has approved time off on this date. Please choose a different date.'
                                : 'All time slots are fully booked on this date. Please choose a different date.'}
                            </p>
                          );
                        }

                        return (
                          <select
                            value={form.assignedTime || ''}
                            onChange={(e) => updateConfirmForm(req.preference_request_id, 'assignedTime', e.target.value)}
                            disabled={!form.assignedDate || !form.doctorId}
                          >
                            <option value="">{!form.doctorId ? 'Select a doctor first' : !form.assignedDate ? 'Select a date first' : 'Select time'}</option>
                            {openSlots.map((slot) => (
                              <option key={slot.time} value={slot.time}>
                                {formatTime(slot.time)}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
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
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Create Appointment — expandable unless a pending request or active appointment exists */}
      <section className="reception-panel">
        {hasActiveAppointment ? (
          <div className="reception-readonly-notice">
            <div className="reception-readonly-notice__header">
              <span>Create Appointment</span>
              <span className="reception-readonly-notice__badge">Active appointment exists</span>
            </div>
            <p>
              This patient already has an active appointment. Reschedule or cancel the existing appointment before creating a new one.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="reception-expand-btn"
              onClick={() => {
                if (canCreateAppointment) setCreateOpen((prev) => !prev);
              }}
              disabled={!canCreateAppointment}
              title={hasPendingRequest ? 'This patient already has a pending appointment request. Confirm it above instead.' : ''}
            >
              <span>{createOpen ? '▾' : '▸'} Create Appointment</span>
              {hasPendingRequest && <span className="reception-expand-hint">Pending request exists</span>}
            </button>
            {createOpen && canCreateAppointment && (
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
              <select value={appointmentForm.doctorId} onChange={(e) => {
                const docId = e.target.value;
                setAppointmentForm((prev) => ({ ...prev, doctorId: docId, appointmentDate: '', appointmentTime: '' }));
                if (docId) {
                  fetch(`${API_BASE_URL}/api/appointments/preferred-availability?doctorId=${docId}`)
                    .then((r) => safeJson(r))
                    .then((d) => setCreateAvailability(Array.isArray(d?.availability) ? d.availability : []))
                    .catch(() => setCreateAvailability([]));
                } else {
                  setCreateAvailability([]);
                }
              }} required>
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
                onChange={(e) => setAppointmentForm((prev) => ({ ...prev, appointmentDate: e.target.value, appointmentTime: '' }))}
                required
              />
            </label>
            <label>
              Time
              {(() => {
                const avail = createAvailability.find((d) => d.date === appointmentForm.appointmentDate);
                const allSlots = avail?.timeOptions || [];
                const openSlots = allSlots.filter((s) => !s.isFull && !s.timeOff);
                const hasTimeOff = allSlots.some((s) => s.timeOff);
                const allFull = allSlots.length > 0 && openSlots.length === 0;

                if (appointmentForm.doctorId && appointmentForm.appointmentDate && allFull) {
                  return (
                    <p className="reception-message" style={{ color: '#b53030', margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
                      {hasTimeOff
                        ? 'This doctor has approved time off on this date. Please choose a different date.'
                        : 'All time slots are fully booked on this date. Please choose a different date.'}
                    </p>
                  );
                }

                return (
                  <select
                    value={appointmentForm.appointmentTime}
                    onChange={(e) => setAppointmentForm((prev) => ({ ...prev, appointmentTime: e.target.value }))}
                    required
                    disabled={!appointmentForm.doctorId || !appointmentForm.appointmentDate}
                  >
                    <option value="">{!appointmentForm.doctorId ? 'Select a doctor first' : !appointmentForm.appointmentDate ? 'Select a date first' : 'Select time'}</option>
                    {openSlots.map((slot) => (
                      <option key={slot.time} value={slot.time}>
                        {formatTime(slot.time)}
                      </option>
                    ))}
                  </select>
                );
              })()}
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
          </>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Assigned Pharmacy</h2>
            <button type="button" style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', background: 'none', border: '1px solid #2d7a6e', color: '#2d7a6e', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setPharmAssignOpen(!pharmAssignOpen)}>
              {pharmAssignOpen ? 'Cancel' : '+ Assign'}
            </button>
          </div>

          {pharmAssignOpen && (
            <form onSubmit={handleAssignPharmacy} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Pharmacy *</span>
                <select value={pharmAssignId} onChange={(e) => setPharmAssignId(e.target.value)} required>
                  <option value="">Select pharmacy</option>
                  {allPharmacies.map((ph) => (
                    <option key={ph.pharm_id} value={ph.pharm_id}>{ph.pharm_name} — {ph.ph_city}, {ph.ph_state}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={pharmAssignPrimary} onChange={(e) => setPharmAssignPrimary(e.target.checked)} />
                Set as primary pharmacy
              </label>
              <button type="submit" className="reception-action-btn reception-action-btn--primary" disabled={isAssigningPharm} style={{ alignSelf: 'flex-start' }}>
                {isAssigningPharm ? 'Saving...' : 'Save'}
              </button>
            </form>
          )}

          <div style={{ marginTop: pharmAssignOpen ? '0.75rem' : '0' }}>
            {patientPharmacies.length > 0 ? patientPharmacies.map((ph) => (
              <div key={ph.pharm_id} style={{ border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd', padding: '0.6rem 0.75rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 0.15rem', fontWeight: 700 }}>{ph.pharm_name}{ph.is_primary ? ' (Primary)' : ''}</p>
                  <p style={{ margin: '0.1rem 0' }}><strong>Phone:</strong> {ph.pharm_phone || 'N/A'}</p>
                  <p style={{ margin: '0.1rem 0' }}><strong>Address:</strong> {[ph.ph_address_1, ph.ph_city, ph.ph_state, ph.ph_zipcode].filter(Boolean).join(', ')}</p>
                </div>
                <button type="button" onClick={() => handleRemovePharmacy(ph.pharm_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9d2e2e', fontSize: '0.8rem', whiteSpace: 'nowrap', padding: '0.1rem 0.3rem' }}>
                  Remove
                </button>
              </div>
            )) : (
              <p style={{ color: '#4b6966' }}><em>No pharmacy assigned</em></p>
            )}
          </div>

          <div id="pharmacy-section" style={{ scrollMarginTop: '6.5rem', marginTop: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem' }}>Pending Pharmacy Change Requests</h3>
            {pendingPharmacyRequests.length > 0 ? pendingPharmacyRequests.map((req) => (
              <div key={req.request_id} style={{ border: '1px solid #d6e7e4', borderRadius: '10px', background: '#fbfefd', padding: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div>
                    <p style={{ margin: '0 0 0.25rem', fontWeight: 700 }}>{req.change_type} Pharmacy</p>
                    <p style={{ margin: 0 }}><strong>Pharmacy:</strong> {req.new_pharm_name || req.current_pharm_name || 'N/A'}</p>
                    <p style={{ margin: 0 }}><strong>Location:</strong> {[req.new_pharm_city || req.current_pharm_city, req.new_pharm_state || req.current_pharm_state].filter(Boolean).join(', ') || 'N/A'}</p>
                    <p style={{ margin: 0 }}><strong>Primary:</strong> {req.is_primary ? 'Yes' : 'No'}</p>
                    {req.patient_note && <p style={{ margin: '0.25rem 0 0' }}><strong>Note:</strong> {req.patient_note}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="reception-action-btn reception-action-btn--primary"
                      disabled={resolvingPharmacyRequestId === req.request_id}
                      onClick={() => resolvePharmacyRequest(req.request_id, 'APPROVED')}
                    >
                      {resolvingPharmacyRequestId === req.request_id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="reception-action-btn reception-action-btn--secondary"
                      disabled={resolvingPharmacyRequestId === req.request_id}
                      onClick={() => resolvePharmacyRequest(req.request_id, 'DENIED')}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            )) : <p style={{ color: '#4b6966' }}><em>No pending pharmacy requests.</em></p>}
          </div>
        </article>

        <article className="reception-panel">
          <h2>Prescriptions</h2>

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
