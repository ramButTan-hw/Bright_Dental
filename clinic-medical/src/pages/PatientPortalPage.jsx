import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  formatDate,
  formatMoney,
  formatTime,
  getPatientPortalSession,
  resolveApiBaseUrl
} from '../utils/patientPortal';
import '../styles/PatientPortalPage.css';

function PatientPortalPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [primaryDentist, setPrimaryDentist] = useState(null);

  const session = useMemo(() => getPatientPortalSession(), []);
  const API_BASE_URL = resolveApiBaseUrl();

  useEffect(() => {
    if (!session?.patientId) {
      navigate('/patient-login');
      return;
    }

    const loadPortalData = async () => {
      setLoading(true);
      setError('');

      try {
        const [patientRes, appointmentsRes, invoicesRes, primaryDentistRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/patients/${session.patientId}`),
          fetch(`${API_BASE_URL}/api/patients/${session.patientId}/appointments`),
          fetch(`${API_BASE_URL}/api/patients/${session.patientId}/invoices`),
          fetch(`${API_BASE_URL}/api/patients/${session.patientId}/primary-dentist`)
        ]);

        if (!patientRes.ok) {
          throw new Error('Unable to load patient profile.');
        }

        const [patientPayload, appointmentsPayload, invoicesPayload, primaryDentistPayload] = await Promise.all([
          patientRes.json(),
          appointmentsRes.ok ? appointmentsRes.json() : Promise.resolve([]),
          invoicesRes.ok ? invoicesRes.json() : Promise.resolve([]),
          primaryDentistRes.ok ? primaryDentistRes.json() : Promise.resolve({ assigned: false, dentist: null })
        ]);

        setPatient(patientPayload);
        setAppointments(Array.isArray(appointmentsPayload) ? appointmentsPayload : []);
        setInvoices(Array.isArray(invoicesPayload) ? invoicesPayload : []);
        setPrimaryDentist(primaryDentistPayload?.dentist || null);
      } catch (fetchError) {
        setError(fetchError.message || 'Unable to load portal right now.');
      } finally {
        setLoading(false);
      }
    };

    loadPortalData();
  }, [API_BASE_URL, navigate, session?.patientId]);

  const now = new Date();
  const upcomingAppointments = appointments.filter((item) => {
    if (!item?.appointment_date) {
      return false;
    }
    const date = new Date(`${String(item.appointment_date).slice(0, 10)}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const nextAppointment = upcomingAppointments[upcomingAppointments.length - 1] || null;

  const pastAppointments = appointments.filter((item) => {
    if (!item?.appointment_date) {
      return false;
    }
    const date = new Date(`${String(item.appointment_date).slice(0, 10)}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const handleDownloadPastAppointmentReport = async (appointmentId) => {
    if (!session?.patientId || !appointmentId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/appointments/${appointmentId}/report`);
      if (!response.ok) {
        throw new Error('Unable to generate report for this visit right now.');
      }

      const reportPayload = await response.json();
      const jsonBlob = new Blob([JSON.stringify(reportPayload, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(jsonBlob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `patient-${session.patientId}-appointment-${appointmentId}-report.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
    } catch (reportError) {
      setError(reportError.message || 'Unable to generate report for this visit right now.');
    }
  };

  if (loading) {
    return <main className="patient-portal-page"><p className="portal-loading">Loading patient portal...</p></main>;
  }

  return (
    <main className="patient-portal-page">
      <section className="portal-header-card">
        <div>
          <p className="portal-label">Patient Portal</p>
          <h1>{patient ? `${patient.p_first_name} ${patient.p_last_name}` : 'Patient'}</h1>
          <p>{patient?.p_email || ''}</p>
        </div>
      </section>

      {error && <p className="portal-error">{error}</p>}

      <section className="portal-grid">
        <article className="portal-card">
          <h2>Next Scheduled Appointment</h2>
          {nextAppointment ? (
            <>
              <p><strong>Date:</strong> {formatDate(nextAppointment.appointment_date)}</p>
              <p><strong>Time:</strong> {formatTime(nextAppointment.appointment_time)}</p>
              <p><strong>Status:</strong> {nextAppointment.appointment_status || 'Pending'}</p>
              <p><strong>Location:</strong> {nextAppointment.location_address || 'To be confirmed'}</p>
            </>
          ) : (
            <p>No scheduled appointment yet.</p>
          )}
        </article>

        <article className="portal-card">
          <h2>Primary Dentist</h2>
          {primaryDentist ? (
            <>
              <p><strong>Name:</strong> {primaryDentist.doctor_name}</p>
              <p><strong>Visits:</strong> {primaryDentist.visit_count}</p>
              <p><strong>Last Visit:</strong> {formatDate(primaryDentist.last_visit_date)}</p>
            </>
          ) : (
            <p>No primary dentist assigned yet.</p>
          )}
        </article>

        <article className="portal-card">
          <h2>Invoices Snapshot</h2>
          <p><strong>Total Invoices:</strong> {invoices.length}</p>
          <p><strong>Total Balance:</strong> {formatMoney(invoices.reduce((sum, item) => sum + Number(item.patient_amount || 0), 0))}</p>
          <div className="portal-link-row">
            <Link to="/patient-portal/invoices" className="portal-link-btn">Billing &amp; Invoices</Link>
          </div>
        </article>

        <article className="portal-card">
          <h2>Appointment Report</h2>
          <p>Click any previous appointment row below to generate a visit report with notes for that specific appointment.</p>
        </article>
      </section>

      <section className="portal-card">
        <div className="portal-row-between">
          <h2>Past Appointments and Visit Notes</h2>
          <Link to="/patient-portal/new-appointment" className="portal-secondary-btn">
            New Appointment
          </Link>
        </div>

        {pastAppointments.length === 0 ? (
          <p>No past appointments yet.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Doctor</th>
                  <th>Status</th>
                  <th>Visit Notes</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {pastAppointments.map((item) => (
                  <tr key={item.appointment_id}>
                    <td>
                      <button
                        type="button"
                        className="portal-table-action"
                        onClick={() => handleDownloadPastAppointmentReport(item.appointment_id)}
                      >
                        {formatDate(item.appointment_date)}
                      </button>
                    </td>
                    <td>{formatTime(item.appointment_time)}</td>
                    <td>{item.doctor_name || 'Pending assignment'}</td>
                    <td>{item.appointment_status || item.status_name || 'N/A'}</td>
                    <td>{item.notes || 'No notes on file.'}</td>
                    <td>
                      <button
                        type="button"
                        className="portal-link-btn"
                        onClick={() => handleDownloadPastAppointmentReport(item.appointment_id)}
                      >
                        Generate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default PatientPortalPage;
