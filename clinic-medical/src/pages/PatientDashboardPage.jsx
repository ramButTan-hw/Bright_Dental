import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function PatientDashboardPage() {
  const { patientId } = useParams();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = getReceptionPortalSession();

  const [patientDetail, setPatientDetail] = useState(null);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    address: '', city: '', state: '', zipcode: '',
    emergencyContactName: '', emergencyContactPhone: ''
  });


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
        setForm({
            firstName: detail.patient.p_first_name || '',
            lastName: detail.patient.p_last_name || '',
            phone: detail.patient.p_phone || '',
            email: detail.patient.p_email || '',
            address: detail.patient.p_address || '',
            city: detail.patient.p_city || '',
            state: detail.patient.p_state || '',
            zipcode: detail.patient.p_zipcode || '',
            emergencyContactName: detail.patient.p_emergency_contact_name || '',
            emergencyContactPhone: detail.patient.p_emergency_contact_phone || ''
          });
      } catch (error) {
        setMessage(error.message || 'Failed to load patient data');
      }
    };

    loadPatientData();
  }, [API_BASE_URL, patientId]);

  const updateField = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/patients/${patientId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update profile');
      setMessage('Profile updated successfully.');
      setIsEditing(false);
      const detail = await fetch(`${API_BASE_URL}/api/reception/patients/${patientId}/details`).then(safeJson);
      setPatientDetail(detail);
    } catch (err) {
        setMessage(err.message);
    }
  };

  const downloadInvoicePdf = async () => {
    const doc = new jsPDF();
    const invoices = await fetch(`${API_BASE_URL}/api/patients/${patientId}/invoices`).then(safeJson);
    doc.text("Patient Invoices", 14, 15);
    autoTable(doc, {
        head: [['Invoice #', 'Appt Date', 'Appt Time', 'Total', 'Patient Amount', 'Amount Paid', 'Amount Due', 'Status']],
        body: invoices.map(i => [
            i.invoice_id,
            i.appointment_date,
            i.appointment_time,
            i.amount,
            i.patient_amount,
            i.amount_paid,
            i.amount_due,
            i.payment_status
        ])
    });
    doc.save(`patient-${patientId}-invoices.pdf`);
  }

  if (!patientDetail) {
    return <div>Loading...</div>;
  }

  const { patient, insurance, pharmacies } = patientDetail;

  return (
    <main className="reception-page">
      <section className="reception-header">
        <h1>Patient Profile</h1>
        <button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Cancel' : 'Edit'}</button>
      </section>

      {message && <p className="reception-message">{message}</p>}

      {isEditing ? (
        <section className="reception-panel">
            <h2>Patient Information</h2>
            <form className="portal-payment-form" onSubmit={saveProfile}>
                <div className="portal-field">
                    <span>First Name</span>
                    <input name="firstName" value={form.firstName} onChange={updateField} required />
                </div>
                <div className="portal-field">
                    <span>Last Name</span>
                    <input name="lastName" value={form.lastName} onChange={updateField} required />
                </div>
                <div className="portal-field">
                    <span>Email</span>
                    <input name="email" type="email" value={form.email} onChange={updateField} required />
                </div>
                <div className="portal-field">
                    <span>Phone</span>
                    <input name="phone" type="tel" value={form.phone} onChange={updateField} />
                </div>
                <div className="portal-field portal-field-full">
                    <span>Address</span>
                    <input name="address" value={form.address} onChange={updateField} />
                </div>
                <div className="portal-field">
                    <span>City</span>
                    <input name="city" value={form.city} onChange={updateField} />
                </div>
                <div className="portal-field">
                    <span>State</span>
                    <input name="state" value={form.state} onChange={updateField} maxLength={2} placeholder="TX" />
                </div>
                <div className="portal-field">
                    <span>Zip Code</span>
                    <input name="zipcode" value={form.zipcode} onChange={updateField} />
                </div>

                <div className="portal-field">
                    <span>Emergency Contact Name</span>
                    <input name="emergencyContactName" value={form.emergencyContactName} onChange={updateField} />
                </div>
                <div className="portal-field">
                    <span>Emergency Contact Phone</span>
                    <input name="emergencyContactPhone" type="tel" value={form.emergencyContactPhone} onChange={updateField} />
                </div>

                <div className="portal-field portal-field-full">
                    <button type="submit" className="portal-primary-btn" style={{ width: 'fit-content' }}>
                        Save Changes
                    </button>
                </div>
            </form>
        </section>
      ) : (
        <section className="reception-panel">
            <h2>Patient Information</h2>
            <p><strong>Name:</strong> {patient.p_first_name} {patient.p_last_name}</p>
            <p><strong>Date of Birth:</strong> {patient.p_dob}</p>
            <p><strong>Phone:</strong> {patient.p_phone}</p>
            <p><strong>Email:</strong> {patient.p_email}</p>
            <p><strong>Address:</strong> {patient.p_address}, {patient.p_city}, {patient.p_state} {patient.p_zipcode}</p>
            <p><strong>Emergency Contact:</strong> {patient.p_emergency_contact_name} ({patient.p_emergency_contact_phone})</p>
        </section>
      )}

      <section className="reception-grid-two">
        <article className="reception-panel">
        {session?.staffId && <button onClick={downloadInvoicePdf}>Download Invoices PDF</button>}
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

export default PatientDashboardPage;
