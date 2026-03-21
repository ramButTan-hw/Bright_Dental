import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';

function PatientProfilePage() {
  const { patientId } = useParams();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = getReceptionPortalSession();

  const [patientDetail, setPatientDetail] = useState(null);
  const [message, setMessage] = useState('');

  const safeJson = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  };

  useEffect(() => {
    const loadPatientData = async () => {
      try {
        const detail = await fetch(`${API_BASE_URL}/api/reception/patients/${patientId}/details`).then(safeJson);
        setPatientDetail(detail);
      } catch (error) {
        setMessage(error.message || 'Failed to load patient data');
      }
    };

    loadPatientData();
  }, [API_BASE_URL, patientId]);

  if (!patientDetail) {
    return <div>Loading...</div>;
  }

  const { patient, insurance, pharmacies } = patientDetail;

  return (
    <main className="reception-page">
      <section className="reception-header">
        <h1>Patient Profile</h1>
      </section>

      {message && <p className="reception-message">{message}</p>}

      <section className="reception-panel">
        <h2>Patient Information</h2>
        <p><strong>Name:</strong> {patient.p_first_name} {patient.p_last_name}</p>
        <p><strong>Date of Birth:</strong> {patient.p_dob}</p>
        <p><strong>Phone:</strong> {patient.p_phone}</p>
        <p><strong>Email:</strong> {patient.p_email}</p>
        <p><strong>Address:</strong> {patient.p_address}, {patient.p_city}, {patient.p_state} {patient.p_zipcode}</p>
        <p><strong>Emergency Contact:</strong> {patient.p_emergency_contact_name} ({patient.p_emergency_contact_phone})</p>
      </section>

      <section className="reception-grid-two">
        <article className="reception-panel">
          <h2>Insurance Companies</h2>
          <ul className="reception-list">
            {(insurance || []).map((ins) => (
              <li key={ins.insurance_id}>{ins.company_name} - Member #{ins.member_id}</li>
            ))}
            {!insurance?.length && <li>No insurance records for selected patient.</li>}
          </ul>
        </article>

        <article className="reception-panel">
          <h2>Pharmacies</h2>
          <ul className="reception-list">
            {(pharmacies || []).map((pharm) => (
              <li key={pharm.pharm_id}>{pharm.pharm_name} ({pharm.ph_city}, {pharm.ph_state})</li>
            ))}
            {!pharmacies?.length && <li>No pharmacy records for selected patient.</li>}
          </ul>
        </article>
      </section>
    </main>
  );
}

export default PatientProfilePage;
