import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, getReceptionPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/ReceptionistPage.css';

const EMPTY_SUMMARY = { overdue: 0, dueToday: 0, upcoming: 0, scheduled: 0, unscheduled: 0 };

const formatDateTimeWithMeridiem = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

function ReceptionistRecallPage() {
  const navigate = useNavigate();
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const session = useMemo(() => getReceptionPortalSession(), []);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [includeScheduled, setIncludeScheduled] = useState(false);
  const [followUpQueue, setFollowUpQueue] = useState({ summary: EMPTY_SUMMARY, items: [] });
  const [contactModal, setContactModal] = useState({ isOpen: false, item: null, note: '' });

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const safeJson = async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }
    return payload;
  };

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const queueData = await fetchWithTimeout(
        `${API_BASE_URL}/api/reception/follow-ups/queue?windowDays=365&includeScheduled=${includeScheduled}`
      ).then(safeJson);

      setFollowUpQueue({
        summary: queueData?.summary || EMPTY_SUMMARY,
        items: Array.isArray(queueData?.items) ? queueData.items : []
      });
    } catch (err) {
      setError(err.message || 'Unable to load recall queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { document.title = 'Recall List | Bright Dental'; }, []);

  useEffect(() => {
    if (!session?.staffId) {
      navigate('/staff-login');
      return;
    }
    loadQueue();
  }, [API_BASE_URL, includeScheduled, navigate, session?.staffId]);

  const closeContactModal = () => {
    setContactModal({ isOpen: false, item: null, note: '' });
  };

  const openContactModal = (item) => {
    setContactModal({
      isOpen: true,
      item,
      note: item.lastContactNote || ''
    });
  };

  const submitContact = async (event) => {
    event.preventDefault();
    if (!contactModal.item) return;

    try {
      await fetchWithTimeout(`${API_BASE_URL}/api/reception/follow-ups/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: contactModal.item.patientId,
          followUpDate: contactModal.item.followUpDate,
          contactedBy: session?.username || session?.staffId || 'RECEPTION_PORTAL',
          contactNote: String(contactModal.note || '').trim()
        })
      }).then(safeJson);

      setMessage(`Follow-up for ${contactModal.item.patientName} marked as contacted.`);
      closeContactModal();
      await loadQueue();
    } catch (err) {
      setMessage(err.message || 'Failed to mark follow-up as contacted.');
    }
  };

  return (
    <main className="reception-page">
      <section className="reception-header">
        <div>
          <h1>Recall / Recare Queue</h1>
          <p>Track due recall patients and manage outreach from one place.</p>
        </div>
        <div className="reception-actions">
          <button className="reception-action-btn reception-action-btn--secondary" onClick={() => navigate('/receptionist')}>
            Back to Receptionist Page
          </button>
        </div>
      </section>

      {message && <p className="reception-message">{message}</p>}
      {error && <p className="reception-message" style={{ color: '#9d2e2e' }}>{error}</p>}
      {loading && <p className="reception-message">Loading recall queue...</p>}

      {!loading && (
        <section className="reception-panel">
          <h2>Follow-Up Recall Queue</h2>
          <p style={{ color: '#4b6966', marginBottom: '0.65rem' }}>
            Overdue: {followUpQueue.summary?.overdue || 0} | Due Today: {followUpQueue.summary?.dueToday || 0} | Upcoming: {followUpQueue.summary?.upcoming || 0} | Unscheduled: {followUpQueue.summary?.unscheduled || 0}
          </p>
          <label style={{ display: 'inline-flex', alignItems: 'center', marginBottom: '0.7rem', fontSize: '0.9rem', color: '#335553' }}>
            <input
              type="checkbox"
              checked={includeScheduled}
              onChange={(e) => setIncludeScheduled(e.target.checked)}
              style={{ marginRight: '0.45rem' }}
            />
            Include already scheduled patients
          </label>

          <div className="reception-table-wrap reception-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Follow-Up Date</th>
                  <th>Status</th>
                  <th>Procedures</th>
                  <th>Suggested Dentist</th>
                  <th>Contact</th>
                  <th>Note</th>
                  <th>Next Appointment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {followUpQueue.items?.length ? followUpQueue.items.map((item) => (
                  <tr key={`${item.patientId}-${item.followUpDate}`}>
                    <td>{item.patientName}</td>
                    <td>{item.phone || 'N/A'}</td>
                    <td>{formatDate(item.followUpDate)}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: item.dueState === 'OVERDUE' ? '#f8d7da' : item.dueState === 'DUE_TODAY' ? '#fff3cd' : '#e7f1ff',
                          color: item.dueState === 'OVERDUE' ? '#721c24' : item.dueState === 'DUE_TODAY' ? '#856404' : '#1f4d7a'
                        }}
                      >
                        {item.dueState === 'OVERDUE' ? `Overdue (${Math.abs(Number(item.daysUntilDue || 0))}d)` : item.dueState === 'DUE_TODAY' ? 'Due Today' : `Upcoming (${Number(item.daysUntilDue || 0)}d)`}
                      </span>
                      {item.isAlreadyScheduled && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#155724', fontWeight: 700 }}>
                          Scheduled
                        </span>
                      )}
                    </td>
                    <td>{Array.isArray(item.procedureCodes) && item.procedureCodes.length ? item.procedureCodes.join(', ') : 'N/A'}</td>
                    <td>{item.suggestedDoctorName || 'Any available dentist'}</td>
                    <td>
                      {item.lastContactedAt ? (
                        <div style={{ display: 'grid', gap: '0.2rem' }}>
                          <span style={{ color: '#155724', fontWeight: 700, fontSize: '0.8rem' }}>
                            Contacted{item.lastContactedBy ? ` by ${item.lastContactedBy}` : ''}
                          </span>
                          <span style={{ color: '#4b6966', fontSize: '0.75rem' }}>{formatDateTimeWithMeridiem(item.lastContactedAt)}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#856404', fontSize: '0.8rem' }}>Not contacted</span>
                      )}
                    </td>
                    <td>{item.lastContactNote || 'No note'}</td>
                    <td>{item.nextAppointmentDate ? formatDate(item.nextAppointmentDate) : 'Not booked'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => navigate(`/receptionist/patient-profile/${item.patientId}`)}>
                          Open Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => openContactModal(item)}
                          disabled={Boolean(item.lastContactedAt)}
                        >
                          {item.lastContactedAt ? 'Contacted' : 'Mark Contacted'}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/receptionist/create-appointment', {
                            state: {
                              prefillFromRecallQueue: true,
                              patientId: item.patientId,
                              appointmentDate: item.followUpDate,
                              notes: `Follow-up recall${item.procedureCodes?.length ? ` (${item.procedureCodes.join(', ')})` : ''}`
                            }
                          })}
                        >
                          Create Appointment
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="10">No follow-ups due in the selected recall window.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {contactModal.isOpen && contactModal.item && (
        <div
          role="presentation"
          onClick={closeContactModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 24, 22, 0.55)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="follow-up-contact-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(560px, 100%)',
              background: '#fff',
              borderRadius: '18px',
              border: '1px solid #d6e7e4',
              boxShadow: '0 24px 60px rgba(7, 33, 30, 0.22)',
              padding: '1.25rem'
            }}
          >
            <form onSubmit={submitContact} style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <h2 id="follow-up-contact-title" style={{ margin: 0 }}>Mark Follow-Up Contacted</h2>
                <p style={{ margin: '0.35rem 0 0', color: '#4b6966' }}>
                  {contactModal.item.patientName} - {formatDate(contactModal.item.followUpDate)}
                </p>
              </div>

              <label style={{ display: 'grid', gap: '0.4rem', color: '#123f3c', fontWeight: 600 }}>
                Contact Note
                <textarea
                  value={contactModal.note}
                  onChange={(event) => setContactModal((current) => ({ ...current, note: event.target.value }))}
                  rows={4}
                  placeholder="Add a short note about the call, voicemail, or next step."
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    borderRadius: '12px',
                    border: '1px solid #c8dad7',
                    padding: '0.85rem 1rem',
                    font: 'inherit'
                  }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={closeContactModal}>
                  Cancel
                </button>
                <button type="submit">Save Contact Note</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default ReceptionistRecallPage;
