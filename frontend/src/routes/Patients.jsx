import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MOCK = [
  { patient_id: 2, p_first_name: 'Alice',   p_last_name: 'Johnson',  p_dob: '1988-02-20', p_phone: '555-1003', p_email: 'alice@email.com',  p_city: 'Austin',  p_state: 'TX' },
  { patient_id: 3, p_first_name: 'Carlos',  p_last_name: 'Martinez', p_dob: '2001-11-30', p_phone: '555-1005', p_email: 'carlos@email.com', p_city: 'Dallas',  p_state: 'TX' },
  { patient_id: 4, p_first_name: 'Diana',   p_last_name: 'Lee',      p_dob: '1972-08-10', p_phone: '555-1007', p_email: 'diana@email.com',  p_city: 'Houston', p_state: 'TX' },
  { patient_id: 1, p_first_name: 'John',    p_last_name: 'Doe',      p_dob: '1995-06-15', p_phone: '555-1001', p_email: 'john@email.com',   p_city: 'Austin',  p_state: 'TX' },
];

function Patients() {
  const [patients, setPatients] = useState(MOCK);
  const [search, setSearch]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/patients')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setPatients(data); })
      .catch(() => {});
  }, []);

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return p.p_first_name?.toLowerCase().includes(q) || p.p_last_name?.toLowerCase().includes(q) || p.p_email?.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: '32px 36px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332', marginBottom: '24px' }}>Patients</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', width: '360px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search patients..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem', outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
        </div>
        <button onClick={() => navigate('/portal/patients/new')}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Patient
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['ID','NAME ↑↓','DATE OF BIRTH ↑↓','PHONE','EMAIL','CITY ↑↓'].map(h => (
                <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No patients found</td></tr>
            ) : filtered.map(p => (
              <tr key={p.patient_id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => navigate(`/portal/patients/${p.patient_id}`)}>
                <td style={{ padding: '14px 18px', color: '#9ca3af', fontSize: '0.875rem' }}>{p.patient_id}</td>
                <td style={{ padding: '14px 18px', color: '#2d7a6e', fontWeight: 500, fontSize: '0.875rem' }}>{p.p_first_name} {p.p_last_name}</td>
                <td style={{ padding: '14px 18px', color: '#374151', fontSize: '0.875rem' }}>{p.p_dob?.split('T')[0] || '—'}</td>
                <td style={{ padding: '14px 18px', color: '#374151', fontSize: '0.875rem' }}>{p.p_phone || '—'}</td>
                <td style={{ padding: '14px 18px', color: '#6b7280', fontSize: '0.875rem' }}>{p.p_email || '—'}</td>
                <td style={{ padding: '14px 18px', color: '#374151', fontSize: '0.875rem' }}>{p.p_city ? `${p.p_city}, ${p.p_state}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Patients;
