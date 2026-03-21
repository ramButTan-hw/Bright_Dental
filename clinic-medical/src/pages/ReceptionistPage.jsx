import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatTime, getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/ReceptionistPage.css';

function PatientSearch() {
  const navigate = useNavigate();
  const [patientQuery, setPatientQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);

  const searchPatients = async () => {
    const data = await fetch(`${API_BASE_URL}/api/reception/patients/search?query=${encodeURIComponent(patientQuery)}`).then(
      (res) => res.json()
    );
    setPatientSearchResults(Array.isArray(data) ? data : []);
  };

  const goToPatientProfile = (patientId) => {
    navigate(`/receptionist/patient-profile/${patientId}`);
  };

  return (
    <article className="reception-panel">
      <h2>Search Patient</h2>
      <div className="reception-inline-grid">
        <input
          value={patientQuery}
          onChange={(e) => setPatientQuery(e.target.value)}
          placeholder="Search name, email, phone, SSN"
        />
        <button type="button" className="reception-action-btn reception-action-btn--primary" onClick={searchPatients}>
          Search
        </button>
      </div>
      <ul className="reception-list">
        {patientSearchResults.map((patient) => (
          <li key={patient.patient_id}>
            <button type="button" onClick={() => goToPatientProfile(patient.patient_id)}>
              ID: {patient.patient_id} — {patient.p_first_name} {patient.p_last_name} - {patient.p_email}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ReceptionistPage() {
  const navigate = useNavigate();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = getReceptionPortalSession();

  const [requests, setRequests] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [futureAppointments, setFutureAppointments] = useState([]);
  const [pastAppointments, setPastAppointments] = useState([]);
  const [message, setMessage] = useState('');

  const safeJson = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  };

  const loadCore = async () => {
    const [requestsData, appointmentsData, futureData, pastData] = await Promise.all([
      fetch(`${API_BASE_URL}/api/appointments/preference-requests`).then(safeJson),
      fetch(`${API_BASE_URL}/api/reception/appointments?date=${new Date().toISOString().slice(0, 10)}`).then(safeJson),
      fetch(`${API_BASE_URL}/api/reception/appointments/future`).then(safeJson),
      fetch(`${API_BASE_URL}/api/reception/appointments/past`).then(safeJson),
    ]);

    setRequests(Array.isArray(requestsData) ? requestsData : []);
    setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
    setFutureAppointments(Array.isArray(futureData) ? futureData : []);
    setPastAppointments(Array.isArray(pastData) ? pastData : []);
  };

  useEffect(() => {
    if (!session?.staffId) {
      navigate('/staff-login');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadCore().catch((error) => setMessage(error.message || 'Failed to load receptionist data'));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [API_BASE_URL, navigate, session?.staffId]);

  const checkInPatient = async (appointmentId) => {
    await fetch(`${API_BASE_URL}/api/reception/appointments/${appointmentId}/check-in`, {
      method: 'PUT',
    }).then(safeJson);

    setMessage('Patient checked in.');
    await loadCore();
  };

  const navigateToAssignAppointment = (requestId) => {
    navigate(`/receptionist/assign-appointment/${requestId}`);
  };

  return (
    <main className="reception-page">
      <section className="reception-header">
        <h1>Receptionist Page</h1>
        <p>Manage appointment requests, check-in patients, and search for patients.</p>
        <div className="reception-actions">
          <button className="reception-action-btn reception-action-btn--secondary" onClick={() => navigate('/receptionist/create-appointment')}>
            <span className="btn-icon">+</span> Create Appointment
          </button>
          <button className="reception-action-btn reception-action-btn--primary" onClick={() => navigate('/receptionist/register-patient')}>
            <span className="btn-icon">+</span> Register New Patient
          </button>
        </div>
      </section>

      {message && <p className="reception-message">{message}</p>}

      <PatientSearch />

      <section className="reception-panel">
        <h2>Appointment Requests</h2>
        <div className="reception-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Requested Date/Time</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.preference_request_id}>
                  <td>
                    {request.p_first_name} {request.p_last_name}
                  </td>
                  <td>
                    {formatDate(request.preferred_date)} {formatTime(request.preferred_time)}
                  </td>
                  <td>{request.appointment_reason || 'N/A'}</td>
                  <td>
                    <button onClick={() => navigateToAssignAppointment(request.preference_request_id)}>
                      Assign Appointment
                    </button>
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan="4">No appointment requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="reception-panel">
        <h2>Today's Appointments</h2>
        <div className="reception-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Dentist</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.appointment_id}>
                  <td>{formatTime(appointment.appointment_time)}</td>
                  <td>{appointment.patient_name}</td>
                  <td>{appointment.doctor_name}</td>
                  <td>{appointment.appointment_status || appointment.status_name}</td>
                  <td>
                    <button type="button" onClick={() => checkInPatient(appointment.appointment_id)}>
                      Check In
                    </button>
                  </td>
                </tr>
              ))}
              {!appointments.length && (
                <tr>
                  <td colSpan="5">No appointments today.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="reception-panel">
        <h2>Upcoming Appointments</h2>
        <div className="reception-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Patient</th>
                <th>Dentist</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {futureAppointments.map((appointment) => (
                <tr key={appointment.appointment_id}>
                  <td>{formatDate(appointment.appointment_date)}</td>
                  <td>{formatTime(appointment.appointment_time)}</td>
                  <td>{appointment.patient_name}</td>
                  <td>{appointment.doctor_name}</td>
                  <td>{appointment.appointment_status || appointment.status_name}</td>
                </tr>
              ))}
              {!futureAppointments.length && (
                <tr>
                  <td colSpan="5">No upcoming appointments.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="reception-panel">
        <h2>Past Appointments</h2>
        <div className="reception-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Patient</th>
                <th>Dentist</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pastAppointments.map((appointment) => (
                <tr key={appointment.appointment_id}>
                  <td>{formatDate(appointment.appointment_date)}</td>
                  <td>{formatTime(appointment.appointment_time)}</td>
                  <td>{appointment.patient_name}</td>
                  <td>{appointment.doctor_name}</td>
                  <td>{appointment.appointment_status || appointment.status_name}</td>
                </tr>
              ))}
              {!pastAppointments.length && (
                <tr>
                  <td colSpan="5">No past appointments.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default ReceptionistPage;
