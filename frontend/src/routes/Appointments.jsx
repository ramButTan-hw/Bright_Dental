import { useEffect, useState } from 'react';

const STATUS_FILTERS = ['All', 'Scheduled', 'Completed', 'Cancelled'];

const MOCK = [
  { appointment_id: 5, p_first_name: 'John',   p_last_name: 'Doe',      doctor_first_name: 'Robert', doctor_last_name: 'Chen',  appointment_date: '2026-03-20', appointment_time: '15:30', location_city: 'Dallas',  location_state: 'TX', appt_status: 'Scheduled', appt_notes: 'Follow-up retainer check' },
  { appointment_id: 3, p_first_name: 'Carlos',  p_last_name: 'Martinez', doctor_first_name: 'Robert', doctor_last_name: 'Chen',  appointment_date: '2026-03-19', appointment_time: '14:00', location_city: 'Dallas',  location_state: 'TX', appt_status: 'Scheduled', appt_notes: 'Orthodontic consultation' },
  { appointment_id: 2, p_first_name: 'Alice',   p_last_name: 'Johnson',  doctor_first_name: 'James',  doctor_last_name: 'Smith', appointment_date: '2026-03-18', appointment_time: '10:30', location_city: 'Austin',  location_state: 'TX', appt_status: 'Completed', appt_notes: 'Cavity filling on tooth #14' },
  { appointment_id: 1, p_first_name: 'John',    p_last_name: 'Doe',      doctor_first_name: 'James',  doctor_last_name: 'Smith', appointment_date: '2026-03-18', appointment_time: '09:00', location_city: 'Austin',  location_state: 'TX', appt_status: 'Scheduled', appt_notes: 'Regular cleaning and checkup' },
  { appointment_id: 4, p_first_name: 'Diana',   p_last_name: 'Lee',      doctor_first_name: 'James',  doctor_last_name: 'Smith', appointment_date: '2026-03-17', appointment_time: '11:00', location_city: 'Austin',  location_state: 'TX', appt_status: 'Cancelled', appt_notes: 'BP monitoring before extraction' },
];

const statusBadge = (status) => {
  const map = { Scheduled: { bg: '#dbeafe', color: '#2563eb' }, Completed: { bg: '#dcfce7', color: '#16a34a' }, Cancelled: { bg: '#fee2e2', color: '#dc2626' }, 'No Show': { bg: '#fef9c3', color: '#d97706' } };
  const c = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>{status}</span>;
};

function Appointments() {
  const [appointments, setAppointments] = useState(MOCK);
  const [search, setSearch]             = useState('');
  const [filter, setFilter]             = useState('All');

  useEffect(() => {
    fetch('/api/appointments')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setAppointments(data); })
      .catch(() => {});
  }, []);

  const filtered = appointments.filter(a => {
    const q      = search.toLowerCase();
    const match  = `${a.p_first_name} ${a.p_last_name} ${a.doctor_last_name} ${a.appt_status}`.toLowerCase().includes(q);
    const matchF = filter === 'All' || a.appt_status === filter;
    return match && matchF;
  });

  return (
    <div style={{ padding: '32px 36px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332', marginBottom: '24px' }}>Appointments</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search appointments..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: '2px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '3px' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: filter === f ? '#1a2332' : 'transparent', color: filter === f ? '#fff' : '#6b7280', transition: 'all 0.15s' }}>
              {f}
            </button>
          ))}
        </div>

        <button style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Appointment
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['ID','PATIENT ↑↓','DOCTOR ↑↓','DATE ↑↓','TIME','LOCATION','STATUS ↑↓','NOTES'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No appointments found</td></tr>
            ) : filtered.map(a => (
              <tr key={a.appointment_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '0.875rem' }}>{a.appointment_id}</td>
                <td style={{ padding: '14px 16px', fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{a.p_first_name} {a.p_last_name}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>Dr. {a.doctor_last_name}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{a.appointment_date?.split('T')[0]}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{a.appointment_time?.slice(0,5)}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{a.location_city}, {a.location_state}</td>
                <td style={{ padding: '14px 16px' }}>{statusBadge(a.appt_status)}</td>
                <td style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '0.875rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.appt_notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Appointments;
