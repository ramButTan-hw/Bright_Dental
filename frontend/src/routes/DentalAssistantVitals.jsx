import { useEffect, useState } from 'react';

const MOCK_PATIENTS = [
  { appointment_id: 1, p_first_name: 'John',   p_last_name: 'Doe',      appointment_time: '09:00', appt_status: 'Scheduled', appt_notes: 'Regular cleaning and checkup',   vitals_recorded: false },
  { appointment_id: 2, p_first_name: 'Alice',  p_last_name: 'Johnson',  appointment_time: '10:30', appt_status: 'Completed', appt_notes: 'Cavity filling on tooth #14',     vitals_recorded: true  },
  { appointment_id: 5, p_first_name: 'John',   p_last_name: 'Doe',      appointment_time: '15:30', appt_status: 'Scheduled', appt_notes: 'Follow-up retainer check',         vitals_recorded: false },
];

const statusBadge = (status) => {
  const map = { Scheduled: { bg: '#dbeafe', color: '#2563eb' }, Completed: { bg: '#dcfce7', color: '#16a34a' }, Cancelled: { bg: '#fee2e2', color: '#dc2626' } };
  const c = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>{status}</span>;
};

const EMPTY_VITALS = { bp_systolic: '', bp_diastolic: '', pulse: '', weight: '', height: '', notes: '' };

function DentalAssistantVitals() {
  const [patients, setPatients]       = useState(MOCK_PATIENTS);
  const [selected, setSelected]       = useState(null);
  const [vitals, setVitals]           = useState(EMPTY_VITALS);
  const [savedMap, setSavedMap]       = useState({});

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    fetch('/api/appointments')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const todays = data.filter(a => a.appointment_date?.startsWith(today));
          if (todays.length > 0) setPatients(todays.map(a => ({ ...a, vitals_recorded: false })));
        }
      })
      .catch(() => {});
  }, []);

  const openModal = (p) => {
    setSelected(p);
    setVitals(savedMap[p.appointment_id] || EMPTY_VITALS);
  };

  const saveVitals = () => {
    setSavedMap(prev => ({ ...prev, [selected.appointment_id]: vitals }));
    setPatients(prev => prev.map(p => p.appointment_id === selected.appointment_id ? { ...p, vitals_recorded: true } : p));
    setSelected(null);
  };

  const th = { padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' };
  const td = { padding: '14px 16px', color: '#374151', fontSize: '0.875rem', borderBottom: '1px solid #f3f4f6' };
  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '32px 36px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332', marginBottom: '4px' }}>Patient Vitals</h2>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '24px' }}>Record vitals for today&apos;s patients before their appointment.</p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: "Today's Patients",  value: patients.length,                                  color: '#3b82f6' },
          { label: 'Vitals Recorded',   value: patients.filter(p => p.vitals_recorded).length,   color: '#10b981' },
          { label: 'Vitals Pending',    value: patients.filter(p => !p.vitals_recorded).length,  color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#111827' }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Patient table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['Patient', 'Time', 'Notes', 'Appt Status', 'Vitals', 'Action'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No patients today</td></tr>
            ) : patients.map(p => (
              <tr key={p.appointment_id}>
                <td style={{ ...td, fontWeight: 600, color: '#111827' }}>{p.p_first_name} {p.p_last_name}</td>
                <td style={td}>{p.appointment_time?.slice(0, 5)}</td>
                <td style={{ ...td, color: '#9ca3af', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.appt_notes}</td>
                <td style={td}>{statusBadge(p.appt_status)}</td>
                <td style={td}>
                  {p.vitals_recorded ? (
                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>Recorded</span>
                  ) : (
                    <span style={{ background: '#fef9c3', color: '#d97706', padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>Pending</span>
                  )}
                </td>
                <td style={td}>
                  <button
                    onClick={() => openModal(p)}
                    style={{ padding: '6px 14px', background: p.vitals_recorded ? '#f3f4f6' : '#2d7a6e', color: p.vitals_recorded ? '#374151' : '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {p.vitals_recorded ? 'Edit Vitals' : 'Record Vitals'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0 }}>Record Vitals</h3>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '4px 0 0' }}>{selected.p_first_name} {selected.p_last_name}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>BP Systolic (mmHg)</label>
                <input style={inp} type="number" placeholder="120" value={vitals.bp_systolic} onChange={e => setVitals(v => ({ ...v, bp_systolic: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>BP Diastolic (mmHg)</label>
                <input style={inp} type="number" placeholder="80" value={vitals.bp_diastolic} onChange={e => setVitals(v => ({ ...v, bp_diastolic: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Pulse (bpm)</label>
                <input style={inp} type="number" placeholder="72" value={vitals.pulse} onChange={e => setVitals(v => ({ ...v, pulse: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Weight (lbs)</label>
                <input style={inp} type="number" placeholder="150" value={vitals.weight} onChange={e => setVitals(v => ({ ...v, weight: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Height (in)</label>
                <input style={inp} type="number" placeholder="68" value={vitals.height} onChange={e => setVitals(v => ({ ...v, height: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Notes</label>
              <textarea style={{ ...inp, resize: 'vertical', minHeight: '70px' }} placeholder="Any additional observations..." value={vitals.notes} onChange={e => setVitals(v => ({ ...v, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelected(null)} style={{ padding: '9px 20px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button onClick={saveVitals} style={{ padding: '9px 20px', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                Save Vitals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DentalAssistantVitals;
