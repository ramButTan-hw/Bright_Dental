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

  // Insurance change requests
  const [insuranceCompanies, setInsuranceCompanies] = useState([]);
  const [insuranceChangeForm, setInsuranceChangeForm] = useState({ open: false, type: '', insuranceId: null, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' });
  const [isSubmittingInsurance, setIsSubmittingInsurance] = useState(false);
  const [insuranceMsg, setInsuranceMsg] = useState('');

  // Pharmacy change requests
  const [allPharmacies, setAllPharmacies] = useState([]);
  const [pharmacyChangeForm, setPharmacyChangeForm] = useState({ open: false, type: '', patientPharmacyId: null, pharmId: '', isPrimary: false, patientNote: '' });
  const [isSubmittingPharmacy, setIsSubmittingPharmacy] = useState(false);
  const [pharmacyMsg, setPharmacyMsg] = useState('');
  
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
    try {
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
    } catch (err) {
      alert('Failed to download invoices. Please try again.');
    }
  }

  useEffect(() => {
    if (!insuranceChangeForm.open || insuranceChangeForm.type === 'REMOVE') return;
    fetch(`${API_BASE_URL}/api/insurance-companies`).then(safeJson).then(setInsuranceCompanies).catch(() => {});
  }, [API_BASE_URL, insuranceChangeForm.open, insuranceChangeForm.type]);

  useEffect(() => {
    if (!pharmacyChangeForm.open || pharmacyChangeForm.type === 'REMOVE') return;
    fetch(`${API_BASE_URL}/api/pharmacies`).then(safeJson).then((data) => setAllPharmacies(Array.isArray(data) ? data : [])).catch(() => {});
  }, [API_BASE_URL, pharmacyChangeForm.open, pharmacyChangeForm.type]);

  const submitInsuranceChange = async (e) => {
    e.preventDefault();
    setIsSubmittingInsurance(true);
    setInsuranceMsg('');
    try {
      await fetch(`${API_BASE_URL}/api/patients/${patientId}/insurance-change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeType: insuranceChangeForm.type,
          insuranceId: insuranceChangeForm.insuranceId,
          companyId: Number(insuranceChangeForm.companyId) || null,
          memberId: insuranceChangeForm.memberId,
          groupNumber: insuranceChangeForm.groupNumber,
          isPrimary: insuranceChangeForm.isPrimary,
          patientNote: insuranceChangeForm.patientNote
        })
      }).then(safeJson);
      setInsuranceMsg('Request submitted. A receptionist will review it shortly.');
      setInsuranceChangeForm({ open: false, type: '', insuranceId: null, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' });
    } catch (err) {
      setInsuranceMsg(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmittingInsurance(false);
    }
  };

  const submitPharmacyChange = async (e) => {
    e.preventDefault();
    setIsSubmittingPharmacy(true);
    setPharmacyMsg('');
    try {
      await fetch(`${API_BASE_URL}/api/patients/${patientId}/pharmacy-change-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changeType: pharmacyChangeForm.type,
          patientPharmacyId: pharmacyChangeForm.patientPharmacyId,
          pharmId: Number(pharmacyChangeForm.pharmId) || null,
          isPrimary: pharmacyChangeForm.isPrimary,
          patientNote: pharmacyChangeForm.patientNote
        })
      }).then(safeJson);
      setPharmacyMsg('Request submitted. A receptionist will review it shortly.');
      setPharmacyChangeForm({ open: false, type: '', patientPharmacyId: null, pharmId: '', isPrimary: false, patientNote: '' });
    } catch (err) {
      setPharmacyMsg(err.message || 'Failed to submit request.');
    } finally {
      setIsSubmittingPharmacy(false);
    }
  };

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Insurance</h2>
            {!session?.staffId && <button type="button" style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', background: 'none', border: '1px solid #2d7a6e', color: '#2d7a6e', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setInsuranceChangeForm({ open: true, type: 'ADD', insuranceId: null, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' })}>+ Request Add</button>}
          </div>
          {insuranceMsg && <p style={{ fontSize: '0.85rem', color: insuranceMsg.startsWith('Request submitted') ? '#1a7a6e' : '#c0392b', marginBottom: '0.5rem' }}>{insuranceMsg}</p>}
          {(insurance || []).map((ins) => (
            <div key={ins.insurance_id} style={{ border: '1px solid #d6e7e4', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.5rem', background: '#fbfefd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 0.15rem', fontWeight: 700 }}>{ins.company_name}{ins.is_primary ? ' (Primary)' : ''}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#444' }}>Member #{ins.member_id}{ins.group_number ? ` | Group: ${ins.group_number}` : ''}</p>
                </div>
                {!session?.staffId && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button type="button" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'none', border: '1px solid #2d7a6e', color: '#2d7a6e', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setInsuranceChangeForm({ open: true, type: 'UPDATE', insuranceId: ins.insurance_id, companyId: String(ins.company_id || ''), memberId: ins.member_id || '', groupNumber: ins.group_number || '', isPrimary: !!ins.is_primary, patientNote: '' })}>Request Update</button>
                    <button type="button" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'none', border: '1px solid #c0392b', color: '#c0392b', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setInsuranceChangeForm({ open: true, type: 'REMOVE', insuranceId: ins.insurance_id, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' })}>Request Remove</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!insurance?.length && <p style={{ color: '#4b6966' }}><em>No insurance on file</em></p>}
          {insuranceChangeForm.open && (
            <form onSubmit={submitInsuranceChange} style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', border: '1px solid #d6e7e4', borderRadius: '10px', background: '#f8fffe' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{insuranceChangeForm.type === 'ADD' ? 'Request New Insurance' : insuranceChangeForm.type === 'UPDATE' ? 'Request Insurance Update' : 'Request Insurance Removal'}</p>
              {insuranceChangeForm.type === 'REMOVE' ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}>A receptionist will review and remove this insurance record.</p>
              ) : (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>Insurance Company *</span>
                    <select value={insuranceChangeForm.companyId} onChange={(e) => setInsuranceChangeForm((p) => ({ ...p, companyId: e.target.value }))} required>
                      <option value="">Select company</option>
                      {insuranceCompanies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>Member ID *</span>
                    <input type="text" value={insuranceChangeForm.memberId} onChange={(e) => setInsuranceChangeForm((p) => ({ ...p, memberId: e.target.value }))} required />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>Group Number</span>
                    <input type="text" value={insuranceChangeForm.groupNumber} onChange={(e) => setInsuranceChangeForm((p) => ({ ...p, groupNumber: e.target.value }))} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={insuranceChangeForm.isPrimary} onChange={(e) => setInsuranceChangeForm((p) => ({ ...p, isPrimary: e.target.checked }))} />
                    Set as primary insurance
                  </label>
                </>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Note to receptionist (optional)</span>
                <textarea value={insuranceChangeForm.patientNote} onChange={(e) => setInsuranceChangeForm((p) => ({ ...p, patientNote: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={isSubmittingInsurance} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>{isSubmittingInsurance ? 'Submitting...' : 'Submit Request'}</button>
                <button type="button" style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', background: 'none', border: '1px solid #999', color: '#555', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setInsuranceChangeForm({ open: false, type: '', insuranceId: null, companyId: '', memberId: '', groupNumber: '', isPrimary: false, patientNote: '' })}>Cancel</button>
              </div>
            </form>
          )}
        </article>

        <article className="reception-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Pharmacies</h2>
            {!session?.staffId && <button type="button" style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', background: 'none', border: '1px solid #2d7a6e', color: '#2d7a6e', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setPharmacyChangeForm({ open: true, type: 'ADD', patientPharmacyId: null, pharmId: '', isPrimary: false, patientNote: '' })}>+ Request Add</button>}
          </div>
          {pharmacyMsg && <p style={{ fontSize: '0.85rem', color: pharmacyMsg.startsWith('Request submitted') ? '#1a7a6e' : '#c0392b', marginBottom: '0.5rem' }}>{pharmacyMsg}</p>}
          {(pharmacies || []).map((pharm) => (
            <div key={pharm.patient_pharmacy_id} style={{ border: '1px solid #d6e7e4', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '0.5rem', background: '#fbfefd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 0.1rem', fontWeight: 700 }}>{pharm.pharm_name}{pharm.is_primary ? ' (Primary)' : ''}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}>{[pharm.ph_city, pharm.ph_state].filter(Boolean).join(', ')}</p>
                </div>
                {!session?.staffId && (
                  <button type="button" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'none', border: '1px solid #c0392b', color: '#c0392b', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }} onClick={() => setPharmacyChangeForm({ open: true, type: 'REMOVE', patientPharmacyId: pharm.patient_pharmacy_id, pharmId: '', isPrimary: false, patientNote: '' })}>Request Remove</button>
                )}
              </div>
            </div>
          ))}
          {!pharmacies?.length && <p style={{ color: '#4b6966' }}><em>No pharmacies on file</em></p>}
          {pharmacyChangeForm.open && (
            <form onSubmit={submitPharmacyChange} style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', border: '1px solid #d6e7e4', borderRadius: '10px', background: '#f8fffe' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{pharmacyChangeForm.type === 'ADD' ? 'Request New Pharmacy' : 'Request Pharmacy Removal'}</p>
              {pharmacyChangeForm.type === 'REMOVE' ? (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}>A receptionist will review and remove this pharmacy.</p>
              ) : (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600 }}>Pharmacy *</span>
                    <select value={pharmacyChangeForm.pharmId} onChange={(e) => setPharmacyChangeForm((p) => ({ ...p, pharmId: e.target.value }))} required>
                      <option value="">Select pharmacy</option>
                      {allPharmacies.map((ph) => <option key={ph.pharm_id} value={ph.pharm_id}>{ph.pharm_name} — {ph.ph_city}, {ph.ph_state}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <input type="checkbox" checked={pharmacyChangeForm.isPrimary} onChange={(e) => setPharmacyChangeForm((p) => ({ ...p, isPrimary: e.target.checked }))} />
                    Set as primary pharmacy
                  </label>
                </>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Note to receptionist (optional)</span>
                <textarea value={pharmacyChangeForm.patientNote} onChange={(e) => setPharmacyChangeForm((p) => ({ ...p, patientNote: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" disabled={isSubmittingPharmacy} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>{isSubmittingPharmacy ? 'Submitting...' : 'Submit Request'}</button>
                <button type="button" style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem', background: 'none', border: '1px solid #999', color: '#555', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setPharmacyChangeForm({ open: false, type: '', patientPharmacyId: null, pharmId: '', isPrimary: false, patientNote: '' })}>Cancel</button>
              </div>
            </form>
          )}
        </article>
      </section>
    </main>
  );
}

export default PatientDashboardPage;
