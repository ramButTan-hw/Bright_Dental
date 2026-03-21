import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/PatientRegistrationPage.css';
import '../styles/ReceptionistPage.css';

const TOBACCO_ACTIVE_OPTIONS = ['Cigarettes', 'Cigars', 'Smokeless Tobacco'];
const MAX_QUIT_HISTORY_ROWS = 3;

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

function RegisterPatientPage() {
  const navigate = useNavigate();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = getReceptionPortalSession();

  const [step, setStep] = useState(1);
  const [submittingRegistration, setSubmittingRegistration] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [identity, setIdentity] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });

  const [details, setDetails] = useState({
    dob: '',
    gender: '',
    location: '',
    reason: '',
    ssn: '',
    driversLicense: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
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
    preferredTime: ''
  });
  const [availability, setAvailability] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    if (!session?.staffId) {
      navigate('/staff-login');
      return;
    }
  }, [navigate, session?.staffId]);

  useEffect(() => {
    const fetchPainSymptoms = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/intake/pain-symptoms`);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const symptoms = await response.json();
        if (!Array.isArray(symptoms) || symptoms.length === 0) return;
        setPainAssessment(
          symptoms.map((symptom) => ({
            symptomId: symptom.pain_symptom_id,
            complaint: symptom.symptom_label,
            pain: 0
          }))
        );
      } catch (error) {
        console.error('Failed to fetch pain symptoms:', error.message);
      }
    };

    const fetchAvailability = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/appointments/preferred-availability`);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        setAvailability(data.availability || []);
      } catch (error) {
        console.error('Failed to fetch availability:', error.message);
      }
    };

    const fetchDoctors = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/reception/doctors`);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        setDoctors(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch doctors:', error.message);
      }
    };

    const fetchDepartments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/departments`);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch departments:', error.message);
      }
    };

    fetchPainSymptoms();
    fetchAvailability();
    fetchDoctors();
    fetchDepartments();
  }, [API_BASE_URL]);

  const shouldShowOtherMedicalText = useMemo(
    () => Boolean(medicalHistory.other || medicalHistory.preMedOther || (hasAllergies && allergies.allergyOther)),
    [allergies.allergyOther, hasAllergies, medicalHistory.other, medicalHistory.preMedOther]
  );

  const handleDateSelect = (date, time) => {
    setAppointmentSelection({
      preferredDate: date,
      preferredTime: time
    });
  };

  const updateIdentity = (e) => {
    const { name, value } = e.target;
    setIdentity((prev) => ({ ...prev, [name]: value }));
  };

  const updateCredentials = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const updateDetails = (e) => {
    const { name, value } = e.target;
    if (name === 'ssn') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 9);
      let formatted = digitsOnly;
      if (digitsOnly.length > 3 && digitsOnly.length <= 5) {
        formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
      } else if (digitsOnly.length > 5) {
        formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 5)}-${digitsOnly.slice(5)}`;
      }
      setDetails((prev) => ({ ...prev, ssn: formatted }));
      return;
    }
    if (name === 'driversLicense') {
      const normalized = value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
      setDetails((prev) => ({ ...prev, driversLicense: normalized }));
      return;
    }
    setDetails((prev) => ({ ...prev, [name]: value }));
  };

  const updateMedicalHistory = (field) => {
    setMedicalHistory((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleHasAllergies = () => {
    setHasAllergies((prev) => {
      const nextValue = !prev;
      if (!nextValue) setAllergies(ALLERGIES_INITIAL_STATE);
      return nextValue;
    });
  };

  const updateAllergy = (field) => {
    setAllergies((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updateMedicationRow = (index, field, value) => {
    const newMeds = [...medications];
    newMeds[index][field] = value;
    setMedications(newMeds);
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
        return { ...prev, periodontalDiseaseYesNo: value, periodontalDiseaseWhen: value === 'yes' ? prev.periodontalDiseaseWhen : '' };
      }
      if (name === 'bracesOrtho') {
        return { ...prev, bracesOrtho: value, bracesOrthoWhen: value === 'yes' ? prev.bracesOrthoWhen : '' };
      }
      return { ...prev, [name]: value };
    });
  };

  const updateSleepSocial = (field) => {
    setSleepSocial((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleNever = () => {
    setTobacco((prev) => ({
      never: !prev.never,
      quit: false,
      currentUses: !prev.never ? [] : prev.currentUses,
      quitHistory: [{ type: '', quitDate: '' }]
    }));
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
      return { ...prev, never: false, quit: false, currentUses: nextCurrentUses, quitHistory: [{ type: '', quitDate: '' }] };
    });
  };

  const updateCurrentUseField = (type, field, value) => {
    setTobacco((prev) => ({
      ...prev,
      currentUses: prev.currentUses.map((item) => (item.type === type ? { ...item, [field]: value } : item))
    }));
  };

  const updateQuitHistoryRow = (index, field, value) => {
    setTobacco((prev) => ({
      ...prev,
      quitHistory: prev.quitHistory.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
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
    const newPain = [...painAssessment];
    newPain[index].pain = parseInt(value, 10);
    setPainAssessment(newPain);
  };

  const handleSubmit = (e) => {
    if (step < 7) {
      e.preventDefault();
      setStep((prev) => prev + 1);
      return;
    }
    handleFinalSubmit(e);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');
    setSubmittingRegistration(true);

    try {
      const filteredMedications = medications.filter((med) => med.name.trim() !== '');

      const selectedWeekdays = WEEKDAY_OPTIONS;
      const selectedTimes = TIME_PREFERENCE_OPTIONS.map((t) => t.value);

      const response = await fetch(`${API_BASE_URL}/api/patients/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
          phone: identity.phone,
          username: credentials.username,
          password: credentials.password,
          dob: details.dob,
          gender: details.gender,
          location: details.location,
          reason: details.reason,
          ssn: details.ssn,
          driversLicense: details.driversLicense,
          address: details.address,
          emergencyContactName: details.emergencyContactName,
          emergencyContactPhone: details.emergencyContactPhone,
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
          appointmentSelection: {
            preferredDate: appointmentSelection.preferredDate,
            preferredTime: appointmentSelection.preferredTime,
            preferredWeekdays: selectedWeekdays,
            preferredTimes: selectedTimes
          },
          assignedDoctorId: Number(selectedDoctorId)
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Registration failed');
      }

      setSubmitSuccess('Patient registered successfully! Redirecting to receptionist dashboard...');
      setTimeout(() => navigate('/receptionist'), 2000);
    } catch (error) {
      setSubmitError(error.message || 'Unable to submit registration right now.');
    } finally {
      setSubmittingRegistration(false);
    }
  };

  const appointmentStepInvalid = step === 7 && (
    !appointmentSelection.preferredDate ||
    !appointmentSelection.preferredTime ||
    !selectedDoctorId
  );

  return (
    <main className="patient-registration-page">
      <section className="registration-hero">
        <p className="registration-label">Receptionist - Patient Registration</p>
        <h1>Register New Patient</h1>
        <p>
          Complete this registration on behalf of the patient via phone or in-person visit.
          Select an available appointment date and time to schedule their first visit.
        </p>
      </section>

      <section className="registration-form-section">
        <form className="registration-form" onSubmit={handleSubmit}>
          <div className="sequence-pill">Step {step} of 7</div>

          {step === 1 && (
            <div className="form-grid">
              <label>First Name<input type="text" name="firstName" placeholder="Jane" value={identity.firstName} onChange={updateIdentity} required /></label>
              <label>Last Name<input type="text" name="lastName" placeholder="Doe" value={identity.lastName} onChange={updateIdentity} required /></label>
              <label>Email Address<input type="email" name="email" placeholder="jane@email.com" value={identity.email} onChange={updateIdentity} required /></label>
              <label>Phone Number<input type="tel" name="phone" placeholder="(555) 123-4567" value={identity.phone} onChange={updateIdentity} required /></label>
            </div>
          )}

          {step === 2 && (
            <div className="form-grid">
              <label>Date of Birth<input type="date" name="dob" value={details.dob} onChange={updateDetails} required /></label>
              <label>Gender<select name="gender" value={details.gender} onChange={updateDetails} required><option value="" disabled>Select gender</option><option value="1">Male</option><option value="2">Female</option><option value="3">Non-binary</option><option value="4">Prefer not to say</option></select></label>
              <label>Preferred Location<select name="location" value={details.location} onChange={updateDetails} required><option value="" disabled>Select a location</option><option value="4302 University Dr, Houston, TX 77004">4302 University Dr, Houston, TX 77004</option><option value="14000 University Blvd, Sugar Land, TX 77479">14000 University Blvd, Sugar Land, TX 77479</option><option value="1 Main St, Houston, TX 77002">1 Main St, Houston, TX 77002</option></select></label>
              <label>Social Security Number<input type="text" name="ssn" placeholder="XXX-XX-XXXX" value={details.ssn} onChange={updateDetails} pattern="\d{3}-\d{2}-\d{4}" maxLength="11" inputMode="numeric" title="Use SSN format: XXX-XX-XXXX" required /></label>
              <label>Driver's License<input type="text" name="driversLicense" placeholder="Your DL number" value={details.driversLicense} onChange={updateDetails} pattern="[A-Za-z0-9-]{5,20}" minLength="5" maxLength="20" title="Use 5-20 letters, numbers, or hyphens" required /></label>
              <label>Home Address<input type="text" name="address" placeholder="123 Main St, Houston, TX 77002" value={details.address} onChange={updateDetails} required /></label>
              <label>Emergency Contact Name<input type="text" name="emergencyContactName" placeholder="e.g., Sarah Doe" value={details.emergencyContactName} onChange={updateDetails} required /></label>
              <label>Emergency Contact Number<input type="tel" name="emergencyContactPhone" placeholder="(555) 987-6543" value={details.emergencyContactPhone} onChange={updateDetails} required /></label>
              <label>Department
                <select name="reason" value={details.reason} onChange={updateDetails} required>
                  <option value="" disabled>Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.department_id} value={dept.department_name}>{dept.department_name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="form-sections">
              <fieldset className="form-section">
                <legend>Medical History and Allergies</legend>
                <div className="checkbox-grid">
                  {MEDICAL_HISTORY_OPTIONS.map((item) => (
                    <label key={item.key}>
                      <input type="checkbox" checked={medicalHistory[item.key]} onChange={() => updateMedicalHistory(item.key)} /> {item.label}
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
                        <input type="checkbox" checked={allergies[item.key]} onChange={() => updateAllergy(item.key)} /> {item.label}
                      </label>
                    ))}
                  </div>
                )}

                {shouldShowOtherMedicalText && (
                  <label className="full-width" style={{ marginTop: '1rem' }}>
                    Please specify
                    <textarea rows="3" placeholder="Enter details for the selected 'Other' option" value={medicalHistoryOtherText} onChange={(e) => setMedicalHistoryOtherText(e.target.value)} />
                  </label>
                )}
              </fieldset>
            </div>
          )}

          {step === 4 && (
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
          )}

          {step === 5 && (
            <div className="form-sections">
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
            </div>
          )}

          {step === 6 && (
            <div className="form-sections">
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
                      <input type="checkbox" checked={tobacco.currentUses.some((item) => item.type === option)} onChange={() => toggleCurrentType(option)} />{option}
                    </label>
                  ))}
                  <label className="tobacco-option"><input type="checkbox" checked={tobacco.quit} onChange={toggleQuit} />Quit</label>
                </div>

                {tobacco.currentUses.length > 0 && (
                  <div className="tobacco-multi-details">
                    {tobacco.currentUses.map((item) => (
                      <div key={item.type} className="tobacco-details-grid">
                        <label>{item.type} Amount<input type="text" value={item.amount} onChange={(e) => updateCurrentUseField(item.type, 'amount', e.target.value)} placeholder="e.g., 1 pack" /></label>
                        <label>{item.type} Frequency<input type="text" value={item.frequency} onChange={(e) => updateCurrentUseField(item.type, 'frequency', e.target.value)} placeholder="e.g., Daily" /></label>
                      </div>
                    ))}
                  </div>
                )}

                {tobacco.quit && (
                  <div className="tobacco-quit-section">
                    {tobacco.quitHistory.map((historyItem, idx) => (
                      <div key={`${historyItem.type}-${idx}`} className="tobacco-details-grid">
                        <label>Previously used type<select value={historyItem.type} onChange={(e) => updateQuitHistoryRow(idx, 'type', e.target.value)}><option value="">Select one</option>{TOBACCO_ACTIVE_OPTIONS.map((option) => (<option key={option} value={option}>{option}</option>))}</select></label>
                        <label>Quit Date<input type="date" value={historyItem.quitDate} onChange={(e) => updateQuitHistoryRow(idx, 'quitDate', e.target.value)} /></label>
                      </div>
                    ))}
                    <button type="button" onClick={addQuitHistoryRow} className="add-row-btn" disabled={tobacco.quitHistory.length >= MAX_QUIT_HISTORY_ROWS}>+ Add Another Previous Tobacco Type</button>
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
                <legend>Account Credentials</legend>
                <p style={{ color: '#5b6766', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>
                  Create login credentials for the patient so they can access their portal.
                </p>
                <div className="form-grid">
                  <label>Username<input type="text" name="username" placeholder="Choose a username for the patient" value={credentials.username} onChange={updateCredentials} required /></label>
                  <label>Password<input type="password" name="password" placeholder="Create a secure password" value={credentials.password} onChange={updateCredentials} required /></label>
                </div>
              </fieldset>
            </div>
          )}

          {step === 7 && (
            <fieldset className="form-section">
              <legend>Available Appointment Dates</legend>
              <p style={{ color: '#5b6766', fontSize: '0.9rem', margin: '0 0 1rem' }}>
                Select an available date and time to schedule the patient's appointment.
                Grayed-out slots are fully booked.
              </p>
              <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
                <label>Assign Dentist
                  <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)} required>
                    <option value="" disabled>Select a dentist</option>
                    {doctors.map((doc) => (
                      <option key={doc.doctor_id} value={doc.doctor_id}>
                        {doc.doctor_name} — {doc.specialties}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="preferred-appointment-grid">
                <div>
                  <h4 className="preferred-appointment-heading">Select a Date</h4>
                  <div className="preferred-date-list">
                    {availability.slice(0, 30).map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        className={`preferred-date-btn ${appointmentSelection.preferredDate === day.date ? 'active' : ''}`}
                        onClick={() => setAppointmentSelection((prev) => ({ ...prev, preferredDate: day.date, preferredTime: '' }))}
                        disabled={day.isFull}
                      >
                        {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        <small>{day.isFull ? 'Fully Booked' : `${day.remainingCapacity} slots open`}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="preferred-appointment-heading">Select a Time</h4>
                  {appointmentSelection.preferredDate ? (
                    <div className="preferred-time-list">
                      {(availability.find((d) => d.date === appointmentSelection.preferredDate)?.timeOptions || []).map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          className={`preferred-time-btn ${appointmentSelection.preferredTime === slot.time ? 'active' : ''}`}
                          onClick={() => handleDateSelect(appointmentSelection.preferredDate, slot.time)}
                          disabled={slot.isFull}
                        >
                          {slot.time}
                          <small>{slot.isFull ? 'Full' : `${slot.remaining} open`}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="preferred-calendar-note">Please select a date first.</p>
                  )}
                </div>
              </div>
            </fieldset>
          )}

          {submitError && <p className="identity-error">{submitError}</p>}
          {submitSuccess && <p className="submit-success">{submitSuccess}</p>}

          <div className="form-actions">
            {step > 1 && <button type="button" onClick={() => setStep((prev) => prev - 1)} className="back-btn">&larr; Back</button>}
            <button type="submit" className="submit-btn" disabled={submittingRegistration || appointmentStepInvalid}>
              {step === 7
                ? submittingRegistration
                  ? 'Registering Patient...'
                  : 'Complete Registration'
                : 'Next \u2192'}
            </button>
          </div>

          <div className="existing-account-link-wrap">
            <button type="button" onClick={() => navigate('/receptionist')} className="back-btn" style={{ border: 'none', background: 'transparent', color: '#006a6a' }}>
              &larr; Back to Receptionist Dashboard
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default RegisterPatientPage;
