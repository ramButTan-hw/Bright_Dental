import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatTime, getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';

function AssignAppointmentPage() {
  const navigate = useNavigate();
  const { requestId } = useParams();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = getReceptionPortalSession();

  const [request, setRequest] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [message, setMessage] = useState('');
  const [assignmentDraft, setAssignmentDraft] = useState({
    assignedDoctorId: '',
    assignedDate: '',
    assignedTime: '',
    receptionistNotes: ''
  });

  useEffect(() => {
    if (!session?.staffId) {
      navigate('/staff-login');
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        const [reqRes, docRes, availRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/appointments/preference-requests/${requestId}`),
          fetch(`${API_BASE_URL}/api/reception/doctors`),
          fetch(`${API_BASE_URL}/api/appointments/preferred-availability`)
        ]);

        if (cancelled) return;

        if (!reqRes.ok) {
          const errBody = await reqRes.json().catch(() => ({}));
          throw new Error(errBody.error || `Server returned ${reqRes.status}`);
        }

        const requestData = await reqRes.json();
        const doctorsData = await docRes.json().catch(() => []);
        const availData = await availRes.json().catch(() => ({}));

        if (cancelled) return;

        setRequest(Array.isArray(requestData) ? requestData[0] : requestData);
        setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
        setAvailability(Array.isArray(availData?.availability) ? availData.availability : []);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load assign-appointment data:', error);
          setLoadError(error.message || 'Failed to load appointment request');
        }
      }
    };

    const timeoutId = window.setTimeout(loadData, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [API_BASE_URL, navigate, session?.staffId, requestId]);

  const setAssignField = (field, value) => {
    setAssignmentDraft((prev) => {
      if (field === 'assignedDate') {
        return { ...prev, assignedDate: value, assignedTime: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const DEFAULT_TIME_SLOTS = [
    { time: '09:00', label: '9:00 AM' },
    { time: '10:00', label: '10:00 AM' },
    { time: '11:00', label: '11:00 AM' },
    { time: '12:00', label: '12:00 PM' },
    { time: '13:00', label: '1:00 PM' },
    { time: '14:00', label: '2:00 PM' },
    { time: '15:00', label: '3:00 PM' },
    { time: '16:00', label: '4:00 PM' },
    { time: '17:00', label: '5:00 PM' },
    { time: '18:00', label: '6:00 PM' },
    { time: '19:00', label: '7:00 PM' }
  ];

  const selectedDaySlots = useMemo(() => {
    if (!assignmentDraft.assignedDate) return [];
    const dayData = availability.find((d) => d.date === assignmentDraft.assignedDate);
    if (dayData?.timeOptions) return dayData.timeOptions;
    return DEFAULT_TIME_SLOTS.map((s) => ({ time: s.time, booked: 0, remaining: 5, isFull: false }));
  }, [assignmentDraft.assignedDate, availability]);

  const assignRequest = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments/preference-requests/${requestId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedDoctorId: Number(assignmentDraft.assignedDoctorId),
          assignedDate: assignmentDraft.assignedDate,
          assignedTime: assignmentDraft.assignedTime,
          receptionistNotes: assignmentDraft.receptionistNotes || '',
          receptionistUsername: session?.username || '',
          receptionistStaffId: session?.staffId || null
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to assign appointment');
      }

      setMessage('Appointment request assigned successfully.');
      navigate('/receptionist');
    } catch (error) {
      setMessage(error.message || 'Failed to assign appointment');
    }
  };

  if (loadError) {
    return (
      <main className="reception-page">
        <section className="reception-header">
          <h1>Assign Appointment</h1>
        </section>
        <p className="reception-message" style={{ color: '#b53030' }}>{loadError}</p>
        <button className="reception-action-btn reception-action-btn--secondary" onClick={() => navigate('/receptionist')}>&larr; Back to Dashboard</button>
      </main>
    );
  }

  if (!request) {
    return (
      <main className="reception-page">
        <section className="reception-header">
          <h1>Assign Appointment</h1>
        </section>
        <p>Loading appointment request...</p>
      </main>
    );
  }

  return (
    <main className="reception-page">
      <section className="reception-header">
        <h1>Assign Appointment</h1>
        <p>Assign a dentist, date, and time for the patient's appointment request.</p>
      </section>

      {message && <p className="reception-message">{message}</p>}

      <section className="reception-panel">
        <h2>Appointment Request Details</h2>
        <p><strong>Patient:</strong> {request.p_first_name || ''} {request.p_last_name || ''}</p>
        <p><strong>Email:</strong> {request.p_email || 'N/A'}</p>
        <p><strong>Phone:</strong> {request.p_phone || 'N/A'}</p>
        <p><strong>Preferred Date:</strong> {formatDate(request.preferred_date)}</p>
        <p><strong>Preferred Time:</strong> {formatTime(request.preferred_time)}</p>
        <p><strong>Preferred Location:</strong> {request.preferred_location || 'N/A'}</p>
        <p><strong>Available Days:</strong> {request.available_days || 'N/A'}</p>
        <p><strong>Available Times:</strong> {request.available_times || 'N/A'}</p>
        <p><strong>Reason:</strong> {request.appointment_reason || 'N/A'}</p>
        <p><strong>Status:</strong> {request.request_status || 'N/A'}</p>
      </section>

      <section className="reception-panel">
        <h2>Assign Appointment</h2>
        <form className="reception-form" onSubmit={assignRequest}>
          <select value={assignmentDraft.assignedDoctorId} onChange={(e) => setAssignField('assignedDoctorId', e.target.value)} required>
            <option value="">Select dentist</option>
            {doctors.map((doctor) => <option key={doctor.doctor_id} value={doctor.doctor_id}>{doctor.doctor_name}</option>)}
          </select>
          <input type="date" value={assignmentDraft.assignedDate} onChange={(e) => setAssignField('assignedDate', e.target.value)} required />
          <select value={assignmentDraft.assignedTime} onChange={(e) => setAssignField('assignedTime', e.target.value)} required disabled={!assignmentDraft.assignedDate}>
            <option value="">{assignmentDraft.assignedDate ? 'Select a time' : 'Select a date first'}</option>
            {selectedDaySlots.map((slot) => (
              <option key={slot.time} value={slot.time} disabled={slot.isFull}>
                {formatTime(slot.time)}{slot.isFull ? ' (Full)' : ` (${slot.remaining} open)`}
              </option>
            ))}
          </select>
          <textarea rows="2" placeholder="Receptionist Notes" value={assignmentDraft.receptionistNotes} onChange={(e) => setAssignField('receptionistNotes', e.target.value)} />
          <button type="submit">Assign Appointment</button>
        </form>
      </section>
    </main>
  );
}

export default AssignAppointmentPage;
