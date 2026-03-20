import { useEffect, useState } from 'react';

const MOCK = [
  { appointment_id: 5, doctor_first_name: 'Robert', doctor_last_name: 'Chen',  doctor_specialties: 'Orthodontics, Pediatric', appointment_date: '2026-03-20', appointment_time: '15:30', location_city: 'Dallas', appt_status: 'Scheduled', appt_notes: 'Follow-up retainer check' },
  { appointment_id: 3, doctor_first_name: 'Robert', doctor_last_name: 'Chen',  doctor_specialties: 'Orthodontics, Pediatric', appointment_date: '2026-03-19', appointment_time: '14:00', location_city: 'Dallas', appt_status: 'Scheduled', appt_notes: 'Orthodontic consultation for braces' },
  { appointment_id: 2, doctor_first_name: 'James',  doctor_last_name: 'Smith', doctor_specialties: 'General Dentistry, Cosmetic', appointment_date: '2026-03-18', appointment_time: '10:30', location_city: 'Austin', appt_status: 'Completed', appt_notes: 'Cavity filling on tooth #14' },
  { appointment_id: 1, doctor_first_name: 'James',  doctor_last_name: 'Smith', doctor_specialties: 'General Dentistry, Cosmetic', appointment_date: '2026-03-18', appointment_time: '09:00', location_city: 'Austin', appt_status: 'Scheduled', appt_notes: 'Regular cleaning and checkup' },
];

const statusBadge = (status) => {
  const map = {
    Scheduled: { bg: '#dbeafe', color: '#2563eb' },
    Completed: { bg: '#dcfce7', color: '#16a34a' },
    Cancelled: { bg: '#fee2e2', color: '#dc2626' },
  };
  const c = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>
      {status}
    </span>
  );
};

const CalIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#9ca3af' }}>
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#9ca3af' }}>
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const PinIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#9ca3af' }}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

function PatientAppointments() {
  const [appointments, setAppointments] = useState(MOCK);

  useEffect(() => {
    fetch('/api/appointments')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setAppointments(data); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '32px 36px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332', marginBottom: '24px' }}>Appointments</h2>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827' }}>Your Appointments</span>
        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Appointment
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {appointments.map(a => (
          <div key={a.appointment_id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                Dr. {a.doctor_first_name} {a.doctor_last_name}
              </div>
              {statusBadge(a.appt_status)}
            </div>

            <div style={{ fontSize: '0.8rem', color: '#2d7a6e', fontWeight: 500, marginBottom: '10px' }}>
              {a.doctor_specialties}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.825rem', color: '#6b7280', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CalIcon />{a.appointment_date?.split('T')[0]}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><ClockIcon />{a.appointment_time?.slice(0, 5)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><PinIcon />{a.location_city}</span>
            </div>

            {a.appt_notes && (
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{a.appt_notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PatientAppointments;
