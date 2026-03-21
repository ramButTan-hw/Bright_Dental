import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPatientPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/PatientRegistrationPage.css';

const TOBACCO_ACTIVE_OPTIONS = ['Cigarettes', 'Cigars', 'Smokeless Tobacco'];
const MAX_QUIT_HISTORY_ROWS = 3;
const APPOINTMENT_LOOKAHEAD_DAYS = 365;
const WEEKDAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_PREFERENCE_OPTIONS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' }
];

const MEDICAL_HISTORY_OPTIONS = [
  { key: 'preMedAmox', label: 'Pre-Med Amox' },
  { key: 'preMedClind', label: 'Pre-Med Clind' },
  { key: 'preMedIv', label: 'Pre-Med IV' },
  { key: 'preMedOther', label: 'Pre-Med Other' },
  { key: 'arthritis', label: 'Arthritis' },
  { key: 'asthma', label: 'Asthma' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'excessiveBleeding', label: 'Excessive bleeding' },
  { key: 'headInjuries', label: 'Head injuries' },
  { key: 'heartMurmur', label: 'Heart murmur' },
  { key: 'hepatitisC', label: 'Hepatitis C' },
  { key: 'hiv', label: 'HIV' },
  { key: 'mentalDisorders', label: 'Mental disorders' },
  { key: 'pregnancy', label: 'Pregnancy' },
  { key: 'rheumaticFever', label: 'Rheumatic fever' },
  { key: 'surgicalImplant', label: 'Surgical implant' },
  { key: 'tumors', label: 'Tumors' },
  { key: 'anemia', label: 'Anemia' },
  { key: 'artificialJoints', label: 'Artificial joints' },
  { key: 'bloodDisease', label: 'Blood disease' },
  { key: 'dizziness', label: 'Dizziness' },
  { key: 'fainting', label: 'Fainting' },
  { key: 'headaches', label: 'Headaches' },
  { key: 'hepatitisA', label: 'Hepatitis A' },
  { key: 'hepatitis', label: 'Hepatitis' },
  { key: 'kidneyDisease', label: 'Kidney disease' },
  { key: 'mitralValveProlapse', label: 'Mitral valve prolapse' },
  { key: 'radiationTreatment', label: 'Radiation treatment' },
  { key: 'stomachProblems', label: 'Stomach problems' },
  { key: 'thyroidDisease', label: 'Thyroid disease' },
  { key: 'ulcers', label: 'Ulcers' },
  { key: 'artificialHeartValve', label: 'Artificial heart valve' },
  { key: 'artificialValves', label: 'Artificial valves' },
  { key: 'cancer', label: 'Cancer' },
  { key: 'epilepsy', label: 'Epilepsy' },
  { key: 'glaucoma', label: 'Glaucoma' },
  { key: 'heartDisease', label: 'Heart disease' },
  { key: 'hepatitisB', label: 'Hepatitis B' },
  { key: 'highBloodPressure', label: 'High blood pressure' },
  { key: 'liverDisease', label: 'Liver disease' },
  { key: 'pacemaker', label: 'Pacemaker' },
  { key: 'respiratoryProblems', label: 'Respiratory problems' },
  { key: 'stroke', label: 'Stroke' },
  { key: 'tuberculosis', label: 'Tuberculosis' },
  { key: 'venerealDisease', label: 'Venereal disease' },
  { key: 'other', label: 'Other' }
];

const ALLERGY_OPTIONS = [
  { key: 'allergyCodeine', label: 'Allergy - Codeine' },
  { key: 'allergyLatex', label: 'Allergy - Latex' },
  { key: 'allergySulfa', label: 'Allergy - Sulfa' },
  { key: 'allergyErythro', label: 'Allergy - Erythro' },
  { key: 'allergyOther', label: 'Allergy - Other' },
  { key: 'allergyAspirin', label: 'Allergy - Aspirin' },
  { key: 'allergyHayFever', label: 'Allergy - Hay Fever' },
  { key: 'allergyPenicillin', label: 'Allergy - Penicillin' }
];

const MEDICAL_HISTORY_INITIAL_STATE = MEDICAL_HISTORY_OPTIONS.reduce((acc, item) => {
  acc[item.key] = false;
  return acc;
}, {});

const ALLERGIES_INITIAL_STATE = ALLERGY_OPTIONS.reduce((acc, item) => {
  acc[item.key] = false;
  return acc;
}, {});

function formatAsIsoLocalDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeLegacyLocation(locationValue) {
  const raw = String(locationValue || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }

  if (raw === 'houston') {
    return '4302 University Dr, Houston, TX 77004';
  }

  if (raw === 'bellaire' || raw === 'katy' || raw === 'sugar land') {
    return '14000 University Blvd, Sugar Land, TX 77479';
  }

  return String(locationValue || '').trim();
}

function PatientNewAppointmentPage() {
  const navigate = useNavigate();
  const session = useMemo(() => getPatientPortalSession(), []);
  const API_BASE_URL = resolveApiBaseUrl();

  const [loadingPrefill, setLoadingPrefill] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [details, setDetails] = useState({
    location: '',
    reason: ''
  });

  const [medicalHistory, setMedicalHistory] = useState(MEDICAL_HISTORY_INITIAL_STATE);
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergies, setAllergies] = useState(ALLERGIES_INITIAL_STATE);
  const [medicalHistoryOtherText, setMedicalHistoryOtherText] = useState('');

  const [medications, setMedications] = useState([
    { name: '', dosage: '', frequency: '', reason: '' }
  ]);

  const [dentalFindings, setDentalFindings] = useState({
    badBreath: false,
    bleedingGums: false,
    looseTeeth: false,
    sensitiveTeeth: false,
    swollenGums: false,
    toothPain: false,
    jawPain: false,
    cankerSores: false,
    dryMouth: false,
    soreThroat: false,
    whiteSpots: false
  });

  const [dentalHistory, setDentalHistory] = useState({
    periodontalDiseaseYesNo: 'no',
    periodontalDiseaseWhen: '',
    bracesOrtho: 'no',
    bracesOrthoWhen: ''
  });

  const [sleepSocial, setSleepSocial] = useState({
    cpap: false,
    snore: false
  });

  const [tobacco, setTobacco] = useState({
    never: false,
    quit: false,
    currentUses: [],
    quitHistory: [{ type: '', quitDate: '' }]
  });

  const [caffeine, setCaffeine] = useState({
    none: false,
    coffee: false,
    tea: false,
    soda: false
  });

  const [painAssessment, setPainAssessment] = useState([]);
  const [appointmentSelection, setAppointmentSelection] = useState({
    preferredDate: '',
    preferredTime: '',
    preferredWeekdays: [],
    preferredTimes: []
  });

  const minPreferredDate = useMemo(() => formatAsIsoLocalDate(new Date()), []);
  const maxPreferredDate = useMemo(
    () => formatAsIsoLocalDate(addDays(new Date(), APPOINTMENT_LOOKAHEAD_DAYS)),
    []
  );

  useEffect(() => {
    if (!session?.patientId) {
      navigate('/patient-login');
      return;
    }

    const fetchPainSymptoms = async () => {
      const response = await fetch(`${API_BASE_URL}/api/intake/pain-symptoms`);
      if (!response.ok) {
        return [];
      }
      const symptoms = await response.json();
      if (!Array.isArray(symptoms)) {
        return [];
      }
      return symptoms.map((symptom) => ({
        symptomId: symptom.pain_symptom_id,
        complaint: symptom.symptom_label,
        pain: 0
      }));
    };

    const parseCsv = (value) => String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const loadPrefill = async () => {
      setLoadingPrefill(true);
      setError('');
      try {
        const [painRows, prefillRes] = await Promise.all([
          fetchPainSymptoms(),
          fetch(`${API_BASE_URL}/api/patients/${session.patientId}/new-appointment-prefill`)
        ]);

        const prefillPayload = prefillRes.ok ? await prefillRes.json() : {};
        const snapshot = prefillPayload?.snapshot || {};
        const latestPreference = prefillPayload?.latestPreference || {};

        setPainAssessment(Array.isArray(snapshot?.painAssessment) && snapshot.painAssessment.length > 0
          ? snapshot.painAssessment
            .filter((item) => item?.symptomId)
            .map((item) => ({
              symptomId: Number(item.symptomId),
              complaint: item.complaint || '',
              pain: Number(item.pain || 0)
            }))
          : painRows);

        setMedicalHistory({ ...MEDICAL_HISTORY_INITIAL_STATE, ...(snapshot?.medicalHistory || {}) });
        setMedicalHistoryOtherText(snapshot?.medicalHistoryOtherText || '');

        const adverse = snapshot?.adverseReactions || {};
        setHasAllergies(Boolean(adverse?.hasAllergies));
        const nextAllergies = { ...ALLERGIES_INITIAL_STATE };
        Object.keys(nextAllergies).forEach((key) => {
          nextAllergies[key] = Boolean(adverse[key]);
        });
        setAllergies(nextAllergies);

        setMedications(Array.isArray(snapshot?.medications) && snapshot.medications.length > 0
          ? snapshot.medications.map((item) => ({
              name: item?.name || '',
              dosage: item?.dosage || '',
              frequency: item?.frequency || '',
              reason: item?.reason || ''
            }))
          : [{ name: '', dosage: '', frequency: '', reason: '' }]);

        setDentalFindings({
          badBreath: false,
          bleedingGums: false,
          looseTeeth: false,
          sensitiveTeeth: false,
          swollenGums: false,
          toothPain: false,
          jawPain: false,
          cankerSores: false,
          dryMouth: false,
          soreThroat: false,
          whiteSpots: false,
          ...(snapshot?.dentalFindings || {})
        });

        setDentalHistory({
          periodontalDiseaseYesNo: 'no',
          periodontalDiseaseWhen: '',
          bracesOrtho: 'no',
          bracesOrthoWhen: '',
          ...(snapshot?.dentalHistory || {})
        });

        setSleepSocial({ cpap: false, snore: false, ...(snapshot?.sleepSocial || {}) });
        setTobacco({
          never: false,
          quit: false,
          currentUses: [],
          quitHistory: [{ type: '', quitDate: '' }],
          ...(snapshot?.tobacco || {})
        });
        setCaffeine({ none: false, coffee: false, tea: false, soda: false, ...(snapshot?.caffeine || {}) });

        const preferredTime = String(latestPreference?.preferred_time || '').slice(0, 5);
        const preferredTimesFromLatest = parseCsv(latestPreference?.available_times);

        setDetails({
          location: normalizeLegacyLocation(latestPreference?.preferred_location),
          reason: latestPreference?.appointment_reason || ''
        });

        setAppointmentSelection({
          preferredDate: String(latestPreference?.preferred_date || '').slice(0, 10),
          preferredTime,
          preferredWeekdays: parseCsv(latestPreference?.available_days),
          preferredTimes: preferredTimesFromLatest.map((value) => value.slice(0, 5))
        });
      } catch (loadErr) {
        setError(loadErr.message || 'Unable to load your previous intake details.');
      } finally {
        setLoadingPrefill(false);
      }
    };

    loadPrefill();
  }, [API_BASE_URL, navigate, session?.patientId]);

  const shouldShowOtherMedicalText = useMemo(
    () => Boolean(medicalHistory.other || medicalHistory.preMedOther || (hasAllergies && allergies.allergyOther)),
    [allergies.allergyOther, hasAllergies, medicalHistory.other, medicalHistory.preMedOther]
  );

  const updateDetails = (e) => {
    const { name, value } = e.target;
    setDetails((prev) => ({ ...prev, [name]: value }));
  };

  const updateMedicalHistory = (field) => {
    setMedicalHistory((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleHasAllergies = () => {
    setHasAllergies((prev) => {
      const nextValue = !prev;
      if (!nextValue) {
        setAllergies(ALLERGIES_INITIAL_STATE);
      }
      return nextValue;
    });
  };

  const updateAllergy = (field) => {
    setAllergies((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updateMedicationRow = (index, field, value) => {
    const next = [...medications];
    next[index][field] = value;
    setMedications(next);
  };

  const addMedicationRow = () => {
    setMedications((prev) => [...prev, { name: '', dosage: '', frequency: '', reason: '' }]);
  };

  const updateDentalFindings = (field) => {
    setDentalFindings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updateDentalHistory = (e) => {
    const { name, value } = e.target;
    setDentalHistory((prev) => {
      if (name === 'periodontalDiseaseYesNo') {
        return {
          ...prev,
          periodontalDiseaseYesNo: value,
          periodontalDiseaseWhen: value === 'yes' ? prev.periodontalDiseaseWhen : ''
        };
      }

      if (name === 'bracesOrtho') {
        return {
          ...prev,
          bracesOrtho: value,
          bracesOrthoWhen: value === 'yes' ? prev.bracesOrthoWhen : ''
        };
      }

      return { ...prev, [name]: value };
    });
  };

  const updateSleepSocial = (field) => {
    setSleepSocial((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleNever = () => {
    setTobacco((prev) => {
      const nextNever = !prev.never;
      return {
        never: nextNever,
        quit: false,
        currentUses: nextNever ? [] : prev.currentUses,
        quitHistory: [{ type: '', quitDate: '' }]
      };
    });
  };

  const toggleQuit = () => {
    setTobacco((prev) => ({
      ...prev,
      never: false,
      quit: !prev.quit,
      currentUses: [],
      quitHistory: !prev.quit ? prev.quitHistory : [{ type: '', quitDate: '' }]
    }));
  };

  const toggleCurrentType = (type) => {
    setTobacco((prev) => {
      const exists = prev.currentUses.some((item) => item.type === type);
      const nextCurrentUses = exists
        ? prev.currentUses.filter((item) => item.type !== type)
        : [...prev.currentUses, { type, amount: '', frequency: '' }];

      return {
        ...prev,
        never: false,
        quit: false,
        currentUses: nextCurrentUses,
        quitHistory: [{ type: '', quitDate: '' }]
      };
    });
  };

  const updateCurrentUseField = (type, field, value) => {
    setTobacco((prev) => ({
      ...prev,
      currentUses: prev.currentUses.map((item) => (
        item.type === type ? { ...item, [field]: value } : item
      ))
    }));
  };

  const updateQuitHistoryRow = (index, field, value) => {
    setTobacco((prev) => ({
      ...prev,
      quitHistory: prev.quitHistory.map((item, idx) => (
        idx === index ? { ...item, [field]: value } : item
      ))
    }));
  };

  const addQuitHistoryRow = () => {
    setTobacco((prev) => ({
      ...prev,
      quitHistory: prev.quitHistory.length >= MAX_QUIT_HISTORY_ROWS
        ? prev.quitHistory
        : [...prev.quitHistory, { type: '', quitDate: '' }]
    }));
  };

  const updateCaffeine = (field) => {
    setCaffeine((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updatePainRow = (index, value) => {
    const next = [...painAssessment];
    next[index].pain = parseInt(value, 10);
    setPainAssessment(next);
  };

  const toggleAppointmentPreferenceOption = (field, optionValue) => {
    setAppointmentSelection((prev) => {
      const currentOptions = Array.isArray(prev[field]) ? prev[field] : [];
      const alreadySelected = currentOptions.includes(optionValue);
      const nextOptions = alreadySelected
        ? currentOptions.filter((item) => item !== optionValue)
        : [...currentOptions, optionValue];

      return {
        ...prev,
        [field]: nextOptions
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.patientId) {
      navigate('/patient-login');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const filteredMedications = medications.filter((med) => med.name.trim() !== '');
      const response = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/new-appointment-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: details.location,
          reason: details.reason,
          medicalHistory,
          medicalHistoryOtherText,
          adverseReactions: {
            hasAllergies,
            ...allergies
          },
          medications: filteredMedications,
          dentalFindings,
          dentalHistory,
          sleepSocial,
          tobacco,
          caffeine,
          painAssessment,
          appointmentSelection
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to submit your new appointment request.');
      }

      setSuccess(payload?.message || 'New appointment request submitted successfully.');
    } catch (submitErr) {
      setError(submitErr.message || 'Unable to submit your new appointment request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPrefill) {
    return <main className="patient-registration-page"><p className="portal-loading">Loading previous intake details...</p></main>;
  }

  return (
    <main className="patient-registration-page">
      <section className="registration-hero">
        <p className="registration-label">Returning Patient</p>
        <h1>New Appointment Request</h1>
        <p>
          Review your previous intake details, make edits for any new conditions or medications,
          and submit a fresh appointment request.
        </p>
      </section>

      <section className="registration-form-section">
        <form className="registration-form" onSubmit={handleSubmit}>
          <div className="sequence-pill">Review and Update</div>

          <div className="form-grid">
            <label>Preferred Location<select name="location" value={details.location} onChange={updateDetails} required><option value="" disabled>Select a location</option><option value="4302 University Dr, Houston, TX 77004">4302 University Dr, Houston, TX 77004</option><option value="14000 University Blvd, Sugar Land, TX 77479">14000 University Blvd, Sugar Land, TX 77479</option><option value="1 Main St, Houston, TX 77002">1 Main St, Houston, TX 77002</option></select></label>
            <label className="full-width">Reason for Visit<textarea name="reason" rows="3" placeholder="Tell us how we can help you today" value={details.reason} onChange={updateDetails} required /></label>
          </div>

          <div className="form-sections">
            <fieldset className="form-section">
              <legend>Medical History and Allergies</legend>
              <div className="checkbox-grid">
                {MEDICAL_HISTORY_OPTIONS.map((item) => (
                  <label key={item.key}>
                    <input
                      type="checkbox"
                      checked={medicalHistory[item.key]}
                      onChange={() => updateMedicalHistory(item.key)}
                    /> {item.label}
                  </label>
                ))}
                <label>
                  <input type="checkbox" checked={hasAllergies} onChange={toggleHasAllergies} /> Allergies
                </label>
              </div>

              {hasAllergies && (
                <div className="checkbox-grid" style={{ marginTop: '0.75rem' }}>
                  {ALLERGY_OPTIONS.map((item) => (
                    <label key={item.key}>
                      <input
                        type="checkbox"
                        checked={allergies[item.key]}
                        onChange={() => updateAllergy(item.key)}
                      /> {item.label}
                    </label>
                  ))}
                </div>
              )}

              {shouldShowOtherMedicalText && (
                <label className="full-width" style={{ marginTop: '1rem' }}>
                  Please specify
                  <textarea
                    rows="3"
                    placeholder="Enter details for the selected 'Other' option"
                    value={medicalHistoryOtherText}
                    onChange={(e) => setMedicalHistoryOtherText(e.target.value)}
                  />
                </label>
              )}
            </fieldset>

            <fieldset className="form-section">
              <legend>Current Medications</legend>
              <table className="medicines-table">
                <thead><tr><th>Medication Name</th><th>Dosage</th><th>Frequency</th><th>Reason for Use</th></tr></thead>
                <tbody>
                  {medications.map((med, idx) => (
                    <tr key={idx}>
                      <td><input type="text" value={med.name} onChange={(e) => updateMedicationRow(idx, 'name', e.target.value)} placeholder="e.g., Ibuprofen" /></td>
                      <td><input type="text" value={med.dosage} onChange={(e) => updateMedicationRow(idx, 'dosage', e.target.value)} placeholder="e.g., 400mg" /></td>
                      <td><input type="text" value={med.frequency} onChange={(e) => updateMedicationRow(idx, 'frequency', e.target.value)} placeholder="e.g., Twice daily" /></td>
                      <td><input type="text" value={med.reason} onChange={(e) => updateMedicationRow(idx, 'reason', e.target.value)} placeholder="e.g., Pain relief" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={addMedicationRow} className="add-row-btn">+ Add Medication</button>
            </fieldset>

            <fieldset className="form-section">
              <legend>Dental Findings</legend>
              <div className="checkbox-grid">
                <label><input type="checkbox" checked={dentalFindings.badBreath} onChange={() => updateDentalFindings('badBreath')} /> Bad Breath</label>
                <label><input type="checkbox" checked={dentalFindings.bleedingGums} onChange={() => updateDentalFindings('bleedingGums')} /> Bleeding Gums</label>
                <label><input type="checkbox" checked={dentalFindings.looseTeeth} onChange={() => updateDentalFindings('looseTeeth')} /> Loose Teeth</label>
                <label><input type="checkbox" checked={dentalFindings.sensitiveTeeth} onChange={() => updateDentalFindings('sensitiveTeeth')} /> Sensitive Teeth</label>
                <label><input type="checkbox" checked={dentalFindings.swollenGums} onChange={() => updateDentalFindings('swollenGums')} /> Swollen Gums</label>
                <label><input type="checkbox" checked={dentalFindings.toothPain} onChange={() => updateDentalFindings('toothPain')} /> Tooth Pain</label>
                <label><input type="checkbox" checked={dentalFindings.jawPain} onChange={() => updateDentalFindings('jawPain')} /> Jaw Pain</label>
                <label><input type="checkbox" checked={dentalFindings.cankerSores} onChange={() => updateDentalFindings('cankerSores')} /> Canker Sores</label>
                <label><input type="checkbox" checked={dentalFindings.dryMouth} onChange={() => updateDentalFindings('dryMouth')} /> Dry Mouth</label>
                <label><input type="checkbox" checked={dentalFindings.soreThroat} onChange={() => updateDentalFindings('soreThroat')} /> Sore Throat</label>
                <label><input type="checkbox" checked={dentalFindings.whiteSpots} onChange={() => updateDentalFindings('whiteSpots')} /> White Spots</label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Dental History</legend>
              <div className="form-grid">
                <label>Have you had periodontal disease?<select name="periodontalDiseaseYesNo" value={dentalHistory.periodontalDiseaseYesNo} onChange={updateDentalHistory}><option value="no">No</option><option value="yes">Yes</option></select></label>
                {dentalHistory.periodontalDiseaseYesNo === 'yes' && <label>Date<input type="date" name="periodontalDiseaseWhen" value={dentalHistory.periodontalDiseaseWhen} onChange={updateDentalHistory} required /></label>}
                <label>Have you had braces/ortho?<select name="bracesOrtho" value={dentalHistory.bracesOrtho} onChange={updateDentalHistory}><option value="no">No</option><option value="yes">Yes</option></select></label>
                {dentalHistory.bracesOrtho === 'yes' && <label>Date<input type="date" name="bracesOrthoWhen" value={dentalHistory.bracesOrthoWhen} onChange={updateDentalHistory} required /></label>}
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Sleep and Social</legend>
              <div className="checkbox-grid">
                <label><input type="checkbox" checked={sleepSocial.cpap} onChange={() => updateSleepSocial('cpap')} /> Use CPAP</label>
                <label><input type="checkbox" checked={sleepSocial.snore} onChange={() => updateSleepSocial('snore')} /> Snore</label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Tobacco Use</legend>
              <div className="tobacco-options">
                <label className="tobacco-option"><input type="checkbox" checked={tobacco.never} onChange={toggleNever} />Never</label>
                {TOBACCO_ACTIVE_OPTIONS.map((option) => (
                  <label key={option} className="tobacco-option">
                    <input
                      type="checkbox"
                      checked={tobacco.currentUses.some((item) => item.type === option)}
                      onChange={() => toggleCurrentType(option)}
                    />{option}
                  </label>
                ))}
                <label className="tobacco-option"><input type="checkbox" checked={tobacco.quit} onChange={toggleQuit} />Quit</label>
              </div>

              {tobacco.currentUses.length > 0 && (
                <div className="tobacco-multi-details">
                  {tobacco.currentUses.map((item) => (
                    <div key={item.type} className="tobacco-details-grid">
                      <label>
                        {item.type} Amount
                        <input type="text" value={item.amount} onChange={(e) => updateCurrentUseField(item.type, 'amount', e.target.value)} placeholder="e.g., 1 pack" />
                      </label>
                      <label>
                        {item.type} Frequency
                        <input type="text" value={item.frequency} onChange={(e) => updateCurrentUseField(item.type, 'frequency', e.target.value)} placeholder="e.g., Daily" />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {tobacco.quit && (
                <div className="tobacco-quit-section">
                  {tobacco.quitHistory.map((historyItem, idx) => (
                    <div key={`${historyItem.type}-${idx}`} className="tobacco-details-grid">
                      <label>
                        Previously used type
                        <select value={historyItem.type} onChange={(e) => updateQuitHistoryRow(idx, 'type', e.target.value)}>
                          <option value="">Select one</option>
                          {TOBACCO_ACTIVE_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Quit Date
                        <input type="date" value={historyItem.quitDate} onChange={(e) => updateQuitHistoryRow(idx, 'quitDate', e.target.value)} />
                      </label>
                    </div>
                  ))}
                  <button type="button" onClick={addQuitHistoryRow} className="add-row-btn" disabled={tobacco.quitHistory.length >= MAX_QUIT_HISTORY_ROWS}>
                    + Add Another Previous Tobacco Type
                  </button>
                </div>
              )}
            </fieldset>

            <fieldset className="form-section">
              <legend>Caffeine Intake</legend>
              <div className="checkbox-grid">
                <label><input type="checkbox" checked={caffeine.none} onChange={() => updateCaffeine('none')} /> None</label>
                <label><input type="checkbox" checked={caffeine.coffee} onChange={() => updateCaffeine('coffee')} /> Coffee</label>
                <label><input type="checkbox" checked={caffeine.tea} onChange={() => updateCaffeine('tea')} /> Tea</label>
                <label><input type="checkbox" checked={caffeine.soda} onChange={() => updateCaffeine('soda')} /> Soda</label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Pain Assessment (0 = No Pain, 5 = Worst Possible Pain)</legend>
              {painAssessment.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Loading pain symptoms...</p>
              ) : (
                <table className="pain-table">
                  <thead><tr><th>Symptom</th><th>Pain Level</th></tr></thead>
                  <tbody>
                    {painAssessment.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.complaint}</td>
                        <td>
                          <select value={item.pain} onChange={(e) => updatePainRow(idx, e.target.value)}>
                            <option value="0">0 - No Pain</option>
                            <option value="1">1 - Mild</option>
                            <option value="2">2 - Discomforting</option>
                            <option value="3">3 - Moderate</option>
                            <option value="4">4 - Distressing</option>
                            <option value="5">5 - Worst Pain</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </fieldset>

            <fieldset className="form-section">
              <legend>Appointment Preferences</legend>
              <div className="preferred-appointment-grid">
                <div>
                  <p className="preferred-appointment-heading">Preferred appointment date</p>
                  <label className="preferred-calendar-field">
                    <span>Earliest date that works for you</span>
                    <input
                      type="date"
                      value={appointmentSelection.preferredDate}
                      min={minPreferredDate}
                      max={maxPreferredDate}
                      onChange={(e) => setAppointmentSelection((prev) => ({ ...prev, preferredDate: e.target.value }))}
                      required
                    />
                  </label>
                </div>

                <div>
                  <p className="preferred-appointment-heading">Preferred time</p>
                  <label>
                    <span className="preferred-inline-label">Select your top time choice (9:00 AM to 7:00 PM)</span>
                    <select
                      value={appointmentSelection.preferredTime}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setAppointmentSelection((prev) => ({
                          ...prev,
                          preferredTime: nextValue,
                          preferredTimes: prev.preferredTimes.includes(nextValue)
                            ? prev.preferredTimes
                            : [...prev.preferredTimes, nextValue]
                        }));
                      }}
                      required
                    >
                      <option value="" disabled>Select your preferred time</option>
                      {TIME_PREFERENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="form-sections">
                <div>
                  <p className="preferred-appointment-heading">Days of the week you are available</p>
                  <div className="availability-chip-grid">
                    {WEEKDAY_OPTIONS.map((day) => {
                      const isChecked = appointmentSelection.preferredWeekdays.includes(day);
                      return (
                        <label key={day} className={`availability-chip${isChecked ? ' active' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAppointmentPreferenceOption('preferredWeekdays', day)}
                          />
                          <span>{day}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="preferred-appointment-heading">Times that generally work for you</p>
                  <div className="availability-chip-grid">
                    {TIME_PREFERENCE_OPTIONS.map((option) => {
                      const isChecked = appointmentSelection.preferredTimes.includes(option.value);
                      return (
                        <label key={option.value} className={`availability-chip${isChecked ? ' active' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAppointmentPreferenceOption('preferredTimes', option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          {error && <p className="identity-error">{error}</p>}
          {success && <p className="submit-success">{success}</p>}

          <div className="form-actions">
            <Link to="/patient-portal" className="back-btn">Back to Portal</Link>
            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Create New Appointment Request'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default PatientNewAppointmentPage;
