import { useEffect, useState } from 'react';

const MOCK = [
  { invoice_id: 3, p_first_name: 'Carlos', p_last_name: 'Martinez', doctor_last_name: 'Chen',  amount: 1500, insurance_covered_amount: 1000, patient_amount: 500,  invoice_status: 'Pending', invoice_date: '2026-03-19' },
  { invoice_id: 1, p_first_name: 'Alice',  p_last_name: 'Johnson',  doctor_last_name: 'Smith', amount: 350,  insurance_covered_amount: 250,  patient_amount: 100,  invoice_status: 'Paid',    invoice_date: '2026-03-18' },
  { invoice_id: 2, p_first_name: 'John',   p_last_name: 'Doe',      doctor_last_name: 'Smith', amount: 200,  insurance_covered_amount: 0,    patient_amount: 200,  invoice_status: 'Pending', invoice_date: '2026-03-18' },
];

const statusBadge = (status) => {
  const map = { Pending: { bg: '#fef9c3', color: '#d97706' }, Paid: { bg: '#dcfce7', color: '#16a34a' }, Overdue: { bg: '#fee2e2', color: '#dc2626' } };
  const c = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>{status}</span>;
};

const fmt = n => n != null ? `$${Number(n).toFixed(2)}` : '—';

function Invoices() {
  const [invoices, setInvoices] = useState(MOCK);

  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setInvoices(data); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '32px 36px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332', marginBottom: '24px' }}>Invoices</h2>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['INVOICE # ↑↓','PATIENT ↑↓','DOCTOR','TOTAL ↑↓','INSURANCE COVERED','PATIENT OWES','STATUS ↑↓','DATE ↑↓'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map(i => (
              <tr key={i.invoice_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '14px 16px', color: '#374151', fontWeight: 500, fontSize: '0.875rem' }}>{i.invoice_id}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{i.p_first_name} {i.p_last_name}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>Dr. {i.doctor_last_name}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{fmt(i.amount)}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{fmt(i.insurance_covered_amount)}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{fmt(i.patient_amount)}</td>
                <td style={{ padding: '14px 16px' }}>{statusBadge(i.invoice_status)}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{i.invoice_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Invoices;
