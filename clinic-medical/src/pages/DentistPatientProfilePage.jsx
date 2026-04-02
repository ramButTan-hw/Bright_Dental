import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatTime, getDentistPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/DentistDashboardPage.css';

const SURFACE_OPTIONS = [
  { value: 'O', label: 'O - Occlusal (biting surface)' },
  { value: 'M', label: 'M - Mesial (toward the midline)' },
  { value: 'D', label: 'D - Distal (away from the midline)' },
  { value: 'B', label: 'B - Buccal (cheek side)' },
  { value: 'L', label: 'L - Lingual (tongue side)' },
  { value: 'I', label: 'I - Incisal (cutting edge of anterior tooth)' },
  { value: 'F', label: 'F - Facial (front/lip side)' }
];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];
const FINDING_CONDITION_OPTIONS = [
  'Decay',
  'Missing',
  'Impacted',
  'Existing Amalgam',
  'Fracture',
  'Crown',
  'Root Canal',
  'Abscess',
  'Periodontal',
  'Existing Composite'
];
const FALLBACK_ADA_CODES = [
  { procedure_code: 'D0120', description: 'Periodic oral evaluation', default_fees: 85 },
  { procedure_code: 'D1110', description: 'Adult prophylaxis (cleaning)', default_fees: 140 },
  { procedure_code: 'D2140', description: 'Amalgam one surface', default_fees: 180 },
  { procedure_code: 'D2330', description: 'Resin-based composite one surface anterior', default_fees: 210 },
  { procedure_code: 'D2740', description: 'Crown porcelain/ceramic', default_fees: 1250 },
  { procedure_code: 'D8070', description: 'Comprehensive orthodontic treatment (adolescent braces)', default_fees: 5200 },
  { procedure_code: 'D8080', description: 'Comprehensive orthodontic treatment (adult braces)', default_fees: 6200 },
  { procedure_code: 'D9972', description: 'External bleaching - per arch', default_fees: 480 },
  { procedure_code: 'D2962', description: 'Labial veneer (porcelain laminate)', default_fees: 1450 }
];

function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return `$${numeric.toFixed(2)}`;
}

function normalizeFeeValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return numeric.toFixed(2);
}

function parseToothNumbersInput(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createEmptyFindingEntry() {
  return { toothNumber: '', conditionType: '' };
}

function normalizeDateKey(value) {
  if (!value) return 'Unknown date';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  const direct = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return 'Unknown date';
}

function toDateInputValue(value) {
  if (!value) {
    return '';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

function addMonthsToDateInputValue(value, months) {
  const baseDate = value ? new Date(`${toDateInputValue(value)}T00:00:00`) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    return '';
  }

  baseDate.setMonth(baseDate.getMonth() + months);
  return baseDate.toISOString().slice(0, 10);
}

function dateSortValue(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function buildHistoryByDate(completedTreatments, dentalFindings) {
  const treatmentEntries = completedTreatments.map((item) => ({
    type: 'TREATMENT',
    uniqueId: `treatment-${item.plan_id}`,
    dateKey: normalizeDateKey(item.start_date || item.created_at),
    sortAt: dateSortValue(item.start_date || item.created_at),
    tooth: item.tooth_number || 'N/A',
    surface: item.surface || 'N/A',
    label: item.procedure_code || 'Procedure',
    description: (() => {
      const baseDescription = item.procedure_description || item.notes || 'Completed treatment';
      if (!item.follow_up_required) {
        return baseDescription;
      }

      const followUpText = item.follow_up_date
        ? ` Follow-up due ${formatDate(item.follow_up_date)}`
        : ' Follow-up required';
      return `${baseDescription}.${followUpText}`;
    })()
  }));

  const findingEntries = dentalFindings.map((item) => ({
    type: 'FINDING',
    uniqueId: `finding-${item.finding_id}`,
    dateKey: normalizeDateKey(item.appointment_date || item.date_logged),
    sortAt: dateSortValue(item.appointment_date || item.date_logged),
    tooth: item.tooth_number || 'N/A',
    surface: item.surface || 'N/A',
    label: item.condition_type || 'Finding',
    description: item.notes || 'Dental finding logged'
  }));

  const merged = [...treatmentEntries, ...findingEntries].sort((a, b) => b.sortAt - a.sortAt);
  const groups = new Map();
  merged.forEach((item) => {
    if (!groups.has(item.dateKey)) {
      groups.set(item.dateKey, []);
    }
    groups.get(item.dateKey).push(item);
  });

  return Array.from(groups.entries()).map(([dateKey, entries]) => ({
    dateKey,
    entries
  }));
}

function labelFromKey(key) {
  return String(key || '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function collectChecked(mapObject, excludedKeys = []) {
  if (!mapObject || typeof mapObject !== 'object') {
    return [];
  }

  const excluded = new Set(excludedKeys);
  return Object.entries(mapObject)
    .filter(([key, value]) => !excluded.has(key) && Boolean(value))
    .map(([key]) => labelFromKey(key));
}

function DentistPatientProfilePage() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = useMemo(() => getDentistPortalSession(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState(null);
  const [procedureCodeOptions, setProcedureCodeOptions] = useState([]);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [editConfirmPending, setEditConfirmPending] = useState(false);

  const [findingForm, setFindingForm] = useState({
    surface: '',
    notes: '',
    findingEntries: [createEmptyFindingEntry()]
  });

  const [treatmentForm, setTreatmentForm] = useState({
    procedureCode: '',
    toothNumber: '',
    surface: '',
    estimatedCost: '',
    priority: '',
    notes: '',
    followUpRequired: false,
    followUpDate: '',
    statusName: 'COMPLETED'
  });

  const doctorId = Number(session?.doctorId || 0);

  const loadDetail = async () => {
    if (!doctorId || !appointmentId) {
      setError('Missing doctor session or appointment id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/dentist/appointments/${appointmentId}?doctorId=${doctorId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load patient profile.');
      }
      setDetail(payload);
    } catch (err) {
      setError(err.message || 'Failed to load patient profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE_URL, appointmentId, doctorId]);

  useEffect(() => {
    const loadProcedureCodes = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dentist/ada-procedure-codes`);
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          setProcedureCodeOptions(FALLBACK_ADA_CODES);
          return;
        }
        const rows = Array.isArray(payload) ? payload : [];
        setProcedureCodeOptions(rows.length ? rows : FALLBACK_ADA_CODES);
      } catch {
        setProcedureCodeOptions(FALLBACK_ADA_CODES);
      }
    };

    loadProcedureCodes();
  }, [API_BASE_URL]);

  const saveVisitEntries = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const rowsWithValues = (Array.isArray(findingForm.findingEntries) ? findingForm.findingEntries : [])
        .map((entry) => ({
          toothNumber: String(entry?.toothNumber || '').trim(),
          conditionType: String(entry?.conditionType || '').trim()
        }))
        .filter((entry) => entry.toothNumber || entry.conditionType);

      const hasFindings = rowsWithValues.length > 0;

      if (hasFindings) {
        const incompleteRow = rowsWithValues.find((entry) => !entry.toothNumber || !entry.conditionType);
        if (incompleteRow) {
          throw new Error('Each finding condition row must include both tooth number and condition.');
        }

        const duplicateTooth = (() => {
          const seen = new Set();
          for (const row of rowsWithValues) {
            if (seen.has(row.toothNumber)) {
              return row.toothNumber;
            }
            seen.add(row.toothNumber);
          }
          return '';
        })();
        if (duplicateTooth) {
          throw new Error(`Tooth ${duplicateTooth} appears more than once. Use one row per tooth.`);
        }
      }

      if (!String(treatmentForm.procedureCode || '').trim()) {
        throw new Error('Please select an ADA procedure code for the treatment entry.');
      }

      if (treatmentForm.followUpRequired && !treatmentForm.followUpDate) {
        throw new Error('Please choose a follow-up date before saving the treatment.');
      }

      let savedCount = 0;

      if (hasFindings) {
        const toothNumbers = rowsWithValues.map((entry) => entry.toothNumber);
        const normalizedConditionMap = rowsWithValues.reduce((acc, row) => {
          acc[row.toothNumber] = row.conditionType;
          return acc;
        }, {});

        const findingRequestBody = {
          ...findingForm,
          toothNumbers,
          conditionTypesByTooth: normalizedConditionMap,
          toothNumber: toothNumbers.join(', '),
          conditionType: ''
        };

        const findingResponse = await fetch(`${API_BASE_URL}/api/dentist/appointments/${appointmentId}/dental-findings?doctorId=${doctorId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(findingRequestBody)
        });

        const findingPayload = await findingResponse.json().catch(() => ({}));
        if (!findingResponse.ok) {
          throw new Error(findingPayload.error || 'Failed to save dental finding.');
        }
        savedCount = Number(findingPayload?.savedCount || toothNumbers.length || 1);
      }

      const treatmentRequestBody = {
        ...treatmentForm,
        estimatedCost: treatmentForm.estimatedCost ? Number(treatmentForm.estimatedCost) : null,
        followUpRequired: Boolean(treatmentForm.followUpRequired),
        followUpDate: treatmentForm.followUpRequired ? treatmentForm.followUpDate : ''
      };

      const treatmentResponse = await fetch(`${API_BASE_URL}/api/dentist/appointments/${appointmentId}/treatments?doctorId=${doctorId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(treatmentRequestBody)
      });

      const treatmentPayload = await treatmentResponse.json().catch(() => ({}));
      if (!treatmentResponse.ok) {
        throw new Error(treatmentPayload.error || 'Failed to save treatment entry.');
      }

      const savedCostLabel = formatCurrency(treatmentPayload?.estimatedCost);
      const pricingSourceLabel = treatmentPayload?.pricingSource === 'ADA_DEFAULT_FEE'
        ? 'using ADA default fee'
        : treatmentPayload?.pricingSource === 'MANUAL'
          ? 'using manual fee'
          : 'without an estimated fee';

      const findingMsg = savedCount > 0 ? `Saved ${savedCount} finding${savedCount > 1 ? 's' : ''} and ` : 'Saved ';
      setMessage(`${findingMsg}1 treatment ${pricingSourceLabel}${savedCostLabel ? ` (${savedCostLabel})` : ''}. Appointment moved to Completed.`);
      setFindingForm({ surface: '', notes: '', findingEntries: [createEmptyFindingEntry()] });
      setTreatmentForm({
        procedureCode: '',
        toothNumber: '',
        surface: '',
        estimatedCost: '',
        priority: '',
        notes: '',
        followUpRequired: false,
        followUpDate: '',
        statusName: 'COMPLETED'
      });
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Failed to save visit entries.');
    }
  };

  if (loading) {
    return <main className="dentist-page"><p className="dentist-empty">Loading patient profile...</p></main>;
  }

  if (!detail?.patientProfile) {
    return (
      <main className="dentist-page">
        <p className="dentist-empty">Patient profile not found.</p>
        <button type="button" className="dentist-save-btn" onClick={() => navigate('/dentist-login')}>Back to Appointments</button>
      </main>
    );
  }

  const patient = detail.patientProfile;
  const emergencyContactDisplay = (() => {
    const name = String(patient.emergency_contact_name || '').trim();
    const phone = String(patient.emergency_contact_phone || '').trim();
    if (name && phone) return `${name} (${phone})`;
    if (name) return name;
    if (phone) return phone;
    return 'N/A';
  })();
  const snapshot = detail.intakeSnapshot || {};
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

  const completedTreatments = Array.isArray(detail.completedTreatments) ? detail.completedTreatments : [];
  const dentalFindings = Array.isArray(detail.dentalFindings) ? detail.dentalFindings : [];
  const historyByDate = buildHistoryByDate(completedTreatments, dentalFindings);

  const handleTreatmentProcedureChange = (value) => {
    const selected = procedureCodeOptions.find((item) => String(item.procedure_code) === String(value));
    setTreatmentForm((prev) => ({
      ...prev,
      procedureCode: value,
      estimatedCost: normalizeFeeValue(selected?.default_fees)
    }));
  };

  const handleTreatmentFollowUpChange = (checked) => {
    setTreatmentForm((prev) => ({
      ...prev,
      followUpRequired: checked,
      followUpDate: checked
        ? (prev.followUpDate || addMonthsToDateInputValue(detail?.appointment?.appointment_date || new Date(), 6))
        : ''
    }));
  };

  const deleteTreatmentEntry = async (planId) => {
    const numericPlanId = Number(planId);
    if (!Number.isFinite(numericPlanId) || numericPlanId <= 0) {
      return;
    }

    const confirmed = window.confirm('Delete this completed treatment entry? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/dentist/treatments/${numericPlanId}?doctorId=${doctorId}`, {
        method: 'DELETE'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Failed to delete treatment entry (status ${response.status}).`);
      }

      setMessage('Treatment entry deleted.');
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Failed to delete treatment entry.');
    }
  };

  const deleteFindingEntry = async (findingId) => {
    const numericFindingId = Number(findingId);
    if (!Number.isFinite(numericFindingId) || numericFindingId <= 0) {
      return;
    }

    const confirmed = window.confirm('Delete this finding entry? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    setError('');
    setMessage('');

    try {
      const primaryResponse = await fetch(`${API_BASE_URL}/api/dentist/findings/${numericFindingId}?doctorId=${doctorId}`, {
        method: 'DELETE'
      });
      let response = primaryResponse;
      let payload = await response.json().catch(() => ({}));

      if (!response.ok && response.status === 404 && appointmentId) {
        const fallbackResponse = await fetch(`${API_BASE_URL}/api/dentist/appointments/${appointmentId}/findings/${numericFindingId}?doctorId=${doctorId}`, {
          method: 'DELETE'
        });
        response = fallbackResponse;
        payload = await response.json().catch(() => ({}));
      }

      if (!response.ok) {
        throw new Error(payload.error || `Failed to delete finding entry (status ${response.status}).`);
      }

      setMessage('Finding entry deleted.');
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Failed to delete finding entry.');
    }
  };

  const openEditTreatment = (entry) => {
    const planId = String(entry.uniqueId).replace('treatment-', '');
    const treatment = completedTreatments.find((t) => String(t.plan_id) === planId);
    if (!treatment) return;
    setEditingTreatment({
      planId: Number(planId),
      procedureCode: treatment.procedure_code || '',
      toothNumber: treatment.tooth_number || '',
      surface: treatment.surface || '',
      estimatedCost: treatment.default_fees != null ? String(treatment.default_fees) : String(treatment.estimated_cost || ''),
      priority: treatment.priority || '',
      notes: treatment.notes || '',
      followUpRequired: Boolean(treatment.follow_up_required),
      followUpDate: toDateInputValue(treatment.follow_up_date)
    });
    setEditConfirmPending(false);
  };

  const saveEditTreatment = async () => {
    if (!editingTreatment) return;
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/dentist/treatments/${editingTreatment.planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId,
          procedureCode: editingTreatment.procedureCode,
          toothNumber: editingTreatment.toothNumber,
          surface: editingTreatment.surface,
          estimatedCost: editingTreatment.estimatedCost,
          priority: editingTreatment.priority,
          notes: editingTreatment.notes,
          followUpRequired: Boolean(editingTreatment.followUpRequired),
          followUpDate: editingTreatment.followUpDate
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to update treatment.');
      let msg = 'Treatment updated successfully.';
      if (payload.costChanged) {
        const diff = Number(payload.costDiff || 0);
        msg += ` Invoice ${diff < 0 ? 'decreased' : 'increased'} by $${Math.abs(diff).toFixed(2)}.`;
        if (payload.refundNeeded) {
          msg += ` Refund of $${Number(payload.refundAmount).toFixed(2)} available — admin can process it from the Refund History panel.`;
        }
      }
      setMessage(msg);
      setEditingTreatment(null);
      setEditConfirmPending(false);
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Failed to update treatment.');
    }
  };

  const hasActiveAppointment = detail?.appointment?.status_name &&
    ['CHECKED_IN', 'CONFIRMED', 'SCHEDULED', 'RESCHEDULED'].includes(detail.appointment.status_name.toUpperCase());

  return (
    <main className="dentist-page">
      <section className="dentist-hero">
        <div>
          <p className="dentist-subtle">Dentist Workspace</p>
          <h1>{patient.first_name} {patient.last_name}</h1>
          <p className="dentist-subtle">Patient ID: {patient.patient_id} | Appointment: {formatDate(detail.appointment?.appointment_date)} at {formatTime(detail.appointment?.appointment_time)}</p>
        </div>
        <Link to="/dentist-login" className="dentist-save-btn" style={{ textDecoration: 'none' }}>Back to Appointments</Link>
      </section>

      {error && <p className="dentist-save-msg" style={{ color: '#9d2e2e' }}>{error}</p>}
      {message && <p className="dentist-save-msg">{message}</p>}

      <section className="dentist-main-grid">
        <article className="dentist-panel">
          <h2>Contact Information</h2>
          <p><strong>Phone:</strong> {patient.phone || 'N/A'}</p>
          <p><strong>Email:</strong> {patient.email || 'N/A'}</p>
          <p><strong>Address:</strong> {[patient.address, patient.city, patient.state, patient.zipcode].filter(Boolean).join(', ') || 'N/A'}</p>
          <p><strong>Emergency Contact:</strong> {emergencyContactDisplay}</p>
        </article>

        <article className="dentist-panel">
          <h2>Medical Conditions and Habits</h2>
          <p><strong>Medical Conditions:</strong> {medicalConditions.join(', ') || 'None reported'}</p>
          <p><strong>Adverse Reactions:</strong> {adverseReactions.join(', ') || 'None reported'}</p>
          <p><strong>Dental Symptoms:</strong> {dentalSymptoms.join(', ') || 'None reported'}</p>
          <p><strong>Sleep Habits:</strong> {sleepHabits.join(', ') || 'None reported'}</p>
          <p><strong>Caffeine Habits:</strong> {caffeineHabits.join(', ') || 'None reported'}</p>
          <p><strong>Tobacco History:</strong> {tobaccoSummary.join('; ') || 'None reported'}</p>
        </article>
      </section>

      <section className="dentist-panel" style={{ marginTop: '1rem' }}>
        <h2>Current Visit: Add Finding and Treatment</h2>
        {!hasActiveAppointment ? (
          <p className="dentist-empty" style={{ color: '#9d2e2e' }}>
            No active appointment — findings and treatments cannot be added. The patient must be checked in first.
          </p>
        ) : (
        <form onSubmit={saveVisitEntries}>
          <h3 className="dentist-subtle" style={{ marginTop: '0.2rem' }}>Dental Finding</h3>
          <div style={{ display: 'grid', gap: '0.55rem', marginBottom: '0.55rem' }}>
            {findingForm.findingEntries.map((entry, index) => (
              <div key={`finding-entry-${index}`} style={{ display: 'grid', gap: '0.4rem', border: '1px solid #d7e7e5', borderRadius: '10px', padding: '0.6rem' }}>
                <input
                  className="dentist-search-input"
                  placeholder="Tooth Number (e.g. 14)"
                  value={entry.toothNumber}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setFindingForm((p) => ({
                      ...p,
                      findingEntries: p.findingEntries.map((row, rowIndex) => (
                        rowIndex === index
                          ? { ...row, toothNumber: nextValue }
                          : row
                      ))
                    }));
                  }}
                />
                <select
                  className="dentist-search-input"
                  value={entry.conditionType}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setFindingForm((p) => ({
                      ...p,
                      findingEntries: p.findingEntries.map((row, rowIndex) => (
                        rowIndex === index
                          ? { ...row, conditionType: nextValue }
                          : row
                      ))
                    }));
                  }}
                >
                  <option value="">Select condition</option>
                  {FINDING_CONDITION_OPTIONS.map((condition) => (
                    <option key={`finding-condition-${index}-${condition}`} value={condition}>{condition}</option>
                  ))}
                </select>
                {findingForm.findingEntries.length > 1 && (
                  <button
                    type="button"
                    className="dentist-history-delete-btn"
                    onClick={() => {
                      setFindingForm((p) => ({
                        ...p,
                        findingEntries: p.findingEntries.filter((_, rowIndex) => rowIndex !== index)
                      }));
                    }}
                  >
                    Remove row
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="dentist-save-btn"
              onClick={() => {
                setFindingForm((p) => ({
                  ...p,
                  findingEntries: [...p.findingEntries, createEmptyFindingEntry()]
                }));
              }}
            >
              Add New Condition
            </button>
          </div>
          <select
            className="dentist-search-input"
            value={findingForm.surface}
            onChange={(e) => setFindingForm((p) => ({ ...p, surface: e.target.value }))}
          >
            <option value="">Select surface (optional)</option>
            {SURFACE_OPTIONS.map((surface) => (
              <option key={surface.value} value={surface.value}>{surface.label}</option>
            ))}
          </select>
          <textarea className="dentist-note-box" placeholder="Finding notes" value={findingForm.notes} onChange={(e) => setFindingForm((p) => ({ ...p, notes: e.target.value }))} />

          <h3 className="dentist-subtle" style={{ marginTop: '0.9rem' }}>Treatment</h3>
          <select
            className="dentist-search-input"
            value={treatmentForm.procedureCode}
            onChange={(e) => handleTreatmentProcedureChange(e.target.value)}
            required
          >
            <option value="">Select ADA procedure code</option>
            {procedureCodeOptions.map((item) => (
              <option key={item.procedure_code} value={item.procedure_code}>
                {item.procedure_code} - {item.description || 'Procedure'}{formatCurrency(item.default_fees) ? ` (${formatCurrency(item.default_fees)})` : ''}
              </option>
            ))}
          </select>
          <input className="dentist-search-input" placeholder="Treatment Tooth Number" value={treatmentForm.toothNumber} onChange={(e) => setTreatmentForm((p) => ({ ...p, toothNumber: e.target.value }))} />
          <select
            className="dentist-search-input"
            value={treatmentForm.surface}
            onChange={(e) => setTreatmentForm((p) => ({ ...p, surface: e.target.value }))}
          >
            <option value="">Select treatment surface</option>
            {SURFACE_OPTIONS.map((surface) => (
              <option key={surface.value} value={surface.value}>{surface.label}</option>
            ))}
          </select>
          <input className="dentist-search-input" placeholder="Estimated Cost" type="number" step="0.01" value={treatmentForm.estimatedCost} onChange={(e) => setTreatmentForm((p) => ({ ...p, estimatedCost: e.target.value }))} />
          <select
            className="dentist-search-input"
            value={treatmentForm.priority}
            onChange={(e) => setTreatmentForm((p) => ({ ...p, priority: e.target.value }))}
          >
            <option value="">Select priority</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
          <textarea className="dentist-note-box" placeholder="Treatment notes" value={treatmentForm.notes} onChange={(e) => setTreatmentForm((p) => ({ ...p, notes: e.target.value }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.92rem' }}>
            <input
              type="checkbox"
              checked={Boolean(treatmentForm.followUpRequired)}
              onChange={(e) => handleTreatmentFollowUpChange(e.target.checked)}
            />
            Follow-up required
          </label>
          {treatmentForm.followUpRequired && (
            <input
              className="dentist-search-input"
              type="date"
              value={treatmentForm.followUpDate}
              onChange={(e) => setTreatmentForm((p) => ({ ...p, followUpDate: e.target.value }))}
              min={toDateInputValue(detail?.appointment?.appointment_date || new Date())}
              required
            />
          )}
          <button type="submit" className="dentist-save-btn">Save Finding + Treatment</button>
        </form>
        )}
      </section>

      <section className="dentist-panel" style={{ marginTop: '1rem' }}>
        <h2>Previous Completed Treatments</h2>
        {historyByDate.length === 0 ? (
          <p className="dentist-empty">No completed treatments or findings found.</p>
        ) : (
          <div className="dentist-history-scroll">
            {historyByDate.map((group) => (
              <section key={group.dateKey} className="dentist-history-group">
                <h3 className="dentist-history-date">{group.dateKey === 'Unknown date' ? 'Unknown date' : formatDate(group.dateKey)}</h3>
                <ul className="dentist-history-items">
                  {group.entries.map((entry) => (
                    <li key={entry.uniqueId} className="dentist-history-item">
                      <span className={`dentist-history-type ${entry.type === 'TREATMENT' ? 'is-treatment' : 'is-finding'}`}>
                        {entry.type === 'TREATMENT' ? 'Treatment' : 'Finding'}
                      </span>
                      <div className="dentist-history-main">
                        <p><strong>{entry.label}</strong></p>
                        <p>Tooth {entry.tooth} | Surface {entry.surface}</p>
                        <p>{entry.description}</p>
                      </div>
                      {entry.type === 'TREATMENT' && entry.uniqueId.startsWith('treatment-') && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                          <button
                            type="button"
                            className="dentist-save-btn"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                            onClick={() => openEditTreatment(entry)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="dentist-history-delete-btn"
                            onClick={() => deleteTreatmentEntry(String(entry.uniqueId).replace('treatment-', ''))}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                      {entry.type === 'FINDING' && entry.uniqueId.startsWith('finding-') && (
                        <button
                          type="button"
                          className="dentist-history-delete-btn"
                          onClick={() => deleteFindingEntry(String(entry.uniqueId).replace('finding-', ''))}
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="dentist-panel" style={{ marginTop: '1rem' }}>
        <h2>Tooth Number Reference</h2>
        <p className="dentist-subtle" style={{ marginTop: 0 }}>Use this chart as a quick guide while entering findings and treatments.</p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img
            src="/toothnumberingLR.jpg"
            alt="Tooth number reference chart"
            style={{ width: '100%', maxWidth: '560px', height: 'auto', border: '1px solid #d7e7e5', borderRadius: '12px', background: '#fff' }}
          />
        </div>
      </section>

      {/* ── Edit Treatment Modal ── */}
      {editingTreatment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '14px', padding: '1.5rem', width: '95%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            {!editConfirmPending ? (
              <>
                <h2 style={{ marginTop: 0, color: '#2a4f4d' }}>Edit Treatment</h2>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Procedure Code
                    <select
                      className="dentist-search-input"
                      value={editingTreatment.procedureCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const selected = procedureCodeOptions.find((item) => String(item.procedure_code) === code);
                        setEditingTreatment((prev) => ({ ...prev, procedureCode: code, estimatedCost: normalizeFeeValue(selected?.default_fees) || prev.estimatedCost }));
                      }}
                    >
                      <option value="">Select ADA procedure code</option>
                      {procedureCodeOptions.map((item) => (
                        <option key={item.procedure_code} value={item.procedure_code}>
                          {item.procedure_code} - {item.description || 'Procedure'}{formatCurrency(item.default_fees) ? ` (${formatCurrency(item.default_fees)})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tooth Number
                    <input className="dentist-search-input" value={editingTreatment.toothNumber} onChange={(e) => setEditingTreatment((prev) => ({ ...prev, toothNumber: e.target.value }))} />
                  </label>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Surface
                    <select className="dentist-search-input" value={editingTreatment.surface} onChange={(e) => setEditingTreatment((prev) => ({ ...prev, surface: e.target.value }))}>
                      <option value="">Select surface</option>
                      {SURFACE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Estimated Cost
                    <input className="dentist-search-input" type="number" step="0.01" value={editingTreatment.estimatedCost} onChange={(e) => setEditingTreatment((prev) => ({ ...prev, estimatedCost: e.target.value }))} />
                  </label>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Priority
                    <select className="dentist-search-input" value={editingTreatment.priority} onChange={(e) => setEditingTreatment((prev) => ({ ...prev, priority: e.target.value }))}>
                      <option value="">Select priority</option>
                      {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Notes
                    <textarea className="dentist-note-box" value={editingTreatment.notes} onChange={(e) => setEditingTreatment((prev) => ({ ...prev, notes: e.target.value }))} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editingTreatment.followUpRequired)}
                      onChange={(e) => setEditingTreatment((prev) => ({
                        ...prev,
                        followUpRequired: e.target.checked,
                        followUpDate: e.target.checked
                          ? (prev.followUpDate || addMonthsToDateInputValue(detail?.appointment?.appointment_date || new Date(), 6))
                          : ''
                      }))}
                    />
                    Follow-up required
                  </label>
                  {editingTreatment.followUpRequired && (
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Follow-up Date
                      <input
                        className="dentist-search-input"
                        type="date"
                        value={editingTreatment.followUpDate}
                        min={toDateInputValue(detail?.appointment?.appointment_date || new Date())}
                        onChange={(e) => setEditingTreatment((prev) => ({ ...prev, followUpDate: e.target.value }))}
                      />
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="dentist-history-delete-btn" onClick={() => { setEditingTreatment(null); setEditConfirmPending(false); }}>Cancel</button>
                  <button type="button" className="dentist-save-btn" onClick={() => setEditConfirmPending(true)}>Save Changes</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ marginTop: 0, color: '#9d2e2e' }}>Confirm Edit</h2>
                <p>Are you sure you want to update this completed treatment? This will modify the existing record.</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="dentist-history-delete-btn" onClick={() => setEditConfirmPending(false)}>Go Back</button>
                  <button type="button" className="dentist-save-btn" style={{ background: '#9d2e2e' }} onClick={saveEditTreatment}>Yes, Update Treatment</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default DentistPatientProfilePage;
