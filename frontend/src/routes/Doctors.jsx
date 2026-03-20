import { useEffect, useState } from 'react';

const MOCK = [
  { doctor_id: 1, doctor_first_name: 'James',  doctor_last_name: 'Smith', npi: '1234567890', doctor_role: 'Dentist',       doctor_gender: 'Male', phone_number: '555-0101', date_hired: '2024-01-01', locations: 'Austin Clinic',  specialties: 'General Dentistry,Cosmetic' },
  { doctor_id: 2, doctor_first_name: 'Robert', doctor_last_name: 'Chen',  npi: '0987654321', doctor_role: 'Orthodontist',  doctor_gender: 'Male', phone_number: '555-0104', date_hired: '2024-01-15', locations: 'Dallas Clinic',  specialties: 'Orthodontics,Pediatric' },
];

const COLORS = ['#c7ddd9','#d5cce8','#ccdde8','#e8d5cc','#cce8d5'];

function initials(f, l) { return `${(f||'')[0]||''}${(l||'')[0]||''}`.toUpperCase(); }

function DoctorCard({ d, idx }) {
  const specs = d.specialties ? d.specialties.split(',').map(s => s.trim()) : [];
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: COLORS[idx % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', color: '#374151', flexShrink: 0 }}>
          {initials(d.doctor_first_name, d.doctor_last_name)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>Dr. {d.doctor_first_name} {d.doctor_last_name}</div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>NPI: {d.npi || '—'}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: specs.length ? '16px' : 0 }}>
        {[['Role', d.doctor_role],['Gender', d.doctor_gender],['Phone', d.phone_number],['Date Hired', d.date_hired?.split('T')[0]],['Locations', d.locations]].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{label}</span>
            <span style={{ fontSize: '0.85rem', color: '#111827', fontWeight: 500 }}>{val || '—'}</span>
          </div>
        ))}
      </div>

      {specs.length > 0 && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {specs.map(s => <span key={s} style={{ padding: '4px 12px', background: '#f3f4f6', borderRadius: '99px', fontSize: '0.78rem', color: '#374151', fontWeight: 500 }}>{s}</span>)}
        </div>
      )}
    </div>
  );
}

function Doctors() {
  const [doctors, setDoctors] = useState(MOCK);

  useEffect(() => {
    fetch('/api/doctors')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setDoctors(data); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '32px 36px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332', marginBottom: '24px' }}>Doctors</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {doctors.map((d, i) => <DoctorCard key={d.doctor_id} d={d} idx={i} />)}
      </div>
    </div>
  );
}

export default Doctors;
