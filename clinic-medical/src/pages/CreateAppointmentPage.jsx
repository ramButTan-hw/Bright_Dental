import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';

function CreateAppointmentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = getReceptionPortalSession();

  const [doctors, setDoctors] = useState([]);
  const [locations, setLocations] = useState([]);
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const [appointmentForm, setAppointmentForm] = useState({
    patientId: '',
    doctorId: '',
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentTime: '08:00',
    locationId: '',
    notes: ''
  });

  useEffect(() => {
    const prefill = location.state || {};
    if (!prefill?.prefillFromRecallQueue) {
      return;
    }

    setAppointmentForm((prev) => ({
      ...prev,
      patientId: prefill.patientId ? String(prefill.patientId) : prev.patientId,
      appointmentDate: prefill.appointmentDate || prev.appointmentDate,
      notes: prefill.notes || prev.notes
    }));
  }, [location.state]);

  const safeJson = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  };

  useEffect(() => {
    if (!session?.staffId) {
      navigate('/staff-login');
      return;
    }

    const loadData = async () => {
      try {
        const [doctorsData, locationsData] = await Promise.all([
          fetch(`${API_BASE_URL}/api/reception/doctors`).then(safeJson),
          fetch(`${API_BASE_URL}/api/admin/locations`).then(safeJson)
        ]);
        setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
        setLocations(Array.isArray(locationsData) ? locationsData : []);
      } catch (error) {
        setMessage(error.message || 'Failed to load data');
      }
    };

    loadData();
  }, [API_BASE_URL, navigate, session?.staffId]);

  const formatTime = (time24) => {
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  };

  const createAppointment = async (event) => {
    event.preventDefault();
    try {
      await fetch(`${API_BASE_URL}/api/reception/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: Number(appointmentForm.patientId),
          doctorId: Number(appointmentForm.doctorId),
          appointmentDate: appointmentForm.appointmentDate,
          appointmentTime: appointmentForm.appointmentTime,
          locationId: appointmentForm.locationId ? Number(appointmentForm.locationId) : null,
          notes: appointmentForm.notes
        })
      }).then(safeJson);

      const selectedDoctor = doctors.find((d) => String(d.doctor_id) === String(appointmentForm.doctorId));
      const selectedLocation = locations.find((l) => String(l.location_id) === String(appointmentForm.locationId));

      setConfirmation({
        date: appointmentForm.appointmentDate,
        time: appointmentForm.appointmentTime,
        doctorName: selectedDoctor?.doctor_name || null,
        locationAddress: selectedLocation?.full_address || null,
        patientId: appointmentForm.patientId
      });
    } catch (error) {
      setMessage(error.message || 'Failed to create appointment');
    }
  };

  const handleConfirmationClose = () => {
    setConfirmation(null);
    navigate('/receptionist');
  };

  return (
    <main className="reception-page">
      <section className="reception-header">
        <h1>Create Appointment</h1>
        <p>Fill out the form below to create a new appointment.</p>
      </section>

      {message && <p className="reception-message">{message}</p>}

      <section className="reception-panel">
        <form className="reception-form" onSubmit={createAppointment}>
          <input placeholder="Patient ID" value={appointmentForm.patientId} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, patientId: e.target.value }))} required />
          <select value={appointmentForm.doctorId} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, doctorId: e.target.value }))} required>
            <option value="">Select dentist</option>
            {doctors.map((doctor) => <option key={doctor.doctor_id} value={doctor.doctor_id}>{doctor.doctor_name}</option>)}
          </select>
          <input type="date" value={appointmentForm.appointmentDate} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, appointmentDate: e.target.value }))} required />
          <input type="time" value={appointmentForm.appointmentTime} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, appointmentTime: e.target.value }))} required />
          <select value={appointmentForm.locationId} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, locationId: e.target.value }))}>
            <option value="">Select location</option>
            {locations.map((location) => <option key={location.location_id} value={location.location_id}>{location.full_address}</option>)}
          </select>
          <textarea rows="2" placeholder="Notes" value={appointmentForm.notes} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, notes: e.target.value }))} />
          <button type="submit">Create Appointment</button>
        </form>
      </section>

      {confirmation && (
        <div className="modal-overlay" onClick={handleConfirmationClose}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Appointment Confirmed</h3>
            <p>The appointment has been successfully scheduled.</p>
            <div style={{ margin: '1rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#334240', fontSize: '0.95rem' }}>
              <span><strong>Patient ID:</strong> {confirmation.patientId}</span>
              <span><strong>Date:</strong> {confirmation.date}</span>
              <span><strong>Time:</strong> {formatTime(confirmation.time)}</span>
              {confirmation.doctorName && <span><strong>Dentist:</strong> {confirmation.doctorName}</span>}
              {confirmation.locationAddress && <span><strong>Location:</strong> {confirmation.locationAddress}</span>}
            </div>
            <div className="modal-actions">
              <button className="modal-login-btn" onClick={handleConfirmationClose}>Done</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CreateAppointmentPage;
