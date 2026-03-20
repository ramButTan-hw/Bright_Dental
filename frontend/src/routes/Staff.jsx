import { useEffect, useState } from 'react';

const MOCK = [
  { staff_id: 3, staff_first_name: 'Emily',  staff_last_name: 'Jones',    staff_role: 'Dental Hygienist', date_hired: '2024-02-01', phone_number: '555-0103', locations: 'Austin Clinic, Dallas Clinic', salary: 65000 },
  { staff_id: 1, staff_first_name: 'James',  staff_last_name: 'Smith',    staff_role: 'Dentist',          date_hired: '2024-01-01', phone_number: '555-0101', locations: 'Austin Clinic',               salary: 180000 },
  { staff_id: 2, staff_first_name: 'Maria',  staff_last_name: 'Garcia',   staff_role: 'Receptionist',     date_hired: '2024-01-15', phone_number: '555-0102', locations: 'Austin Clinic',               salary: 45000 },
  { staff_id: 4, staff_first_name: 'Robert', staff_last_name: 'Chen',     staff_role: 'Orthodontist',     date_hired: '2024-01-15', phone_number: '555-0104', locations: 'Dallas Clinic',               salary: 200000 },
  { staff_id: 5, staff_first_name: 'Sarah',  staff_last_name: 'Williams', staff_role: 'Dental Assistant', date_hired: '2024-02-15', phone_number: '555-0105', locations: 'Dallas Clinic',               salary: 55000 },
];

function Staff() {
  const [staff, setStaff] = useState(MOCK);

  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setStaff(data); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332' }}>Staff</h2>
        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Staff
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['ID','NAME ↑↓','ROLE ↑↓','DATE HIRED ↑↓','PHONE','LOCATIONS','SALARY ↑↓'].map(h => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.staff_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '14px 18px', color: '#9ca3af', fontSize: '0.875rem' }}>{s.staff_id}</td>
                <td style={{ padding: '14px 18px', fontWeight: 500, color: '#111827', fontSize: '0.875rem' }}>{s.staff_first_name} {s.staff_last_name}</td>
                <td style={{ padding: '14px 18px', color: '#374151', fontSize: '0.875rem' }}>{s.staff_role}</td>
                <td style={{ padding: '14px 18px', color: '#374151', fontSize: '0.875rem' }}>{s.date_hired?.split('T')[0]}</td>
                <td style={{ padding: '14px 18px', color: '#374151', fontSize: '0.875rem' }}>{s.phone_number}</td>
                <td style={{ padding: '14px 18px', color: '#374151', fontSize: '0.875rem' }}>{s.locations}</td>
                <td style={{ padding: '14px 18px', color: '#374151', fontSize: '0.875rem' }}>${Number(s.salary).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Staff;
