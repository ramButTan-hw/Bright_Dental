import { useEffect, useState } from 'react';

const MOCK = [
  { invoice_id: 1, total_amount: 350.00, insurance_covered: 250.00, patient_owes: 100.00, invoice_status: 'Paid',    invoice_date: '2026-03-18' },
  { invoice_id: 2, total_amount: 200.00, insurance_covered: 0.00,   patient_owes: 200.00, invoice_status: 'Pending', invoice_date: '2026-03-18' },
  { invoice_id: 3, total_amount: 1500.00,insurance_covered: 1000.00,patient_owes: 500.00, invoice_status: 'Pending', invoice_date: '2026-03-19' },
];

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

const statusBadge = (status) => {
  const map = {
    Paid:    { bg: '#dcfce7', color: '#16a34a' },
    Pending: { bg: '#fef9c3', color: '#d97706' },
  };
  const c = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>
      {status}
    </span>
  );
};

function PatientPayments() {
  const [invoices, setInvoices] = useState(MOCK);

  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setInvoices(data); })
      .catch(() => {});
  }, []);

  const th = { padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' };
  const td = { padding: '16px', color: '#374151', fontSize: '0.875rem', borderBottom: '1px solid #f3f4f6' };

  return (
    <div style={{ padding: '32px 36px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332', marginBottom: '24px' }}>Payments</h2>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['Invoice #', 'Total Amount', 'Insurance Covered', 'Patient Owes', 'Payment Status', 'Date', 'Action'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No invoices found</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.invoice_id}>
                <td style={td}>{inv.invoice_id}</td>
                <td style={td}>{fmt(inv.total_amount)}</td>
                <td style={td}>{fmt(inv.insurance_covered)}</td>
                <td style={td}>{fmt(inv.patient_owes ?? inv.total_amount)}</td>
                <td style={td}>{statusBadge(inv.invoice_status)}</td>
                <td style={td}>{inv.invoice_date?.split('T')[0]}</td>
                <td style={td}>
                  {inv.invoice_status === 'Paid' ? (
                    <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Paid</span>
                  ) : (
                    <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Pay Now
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PatientPayments;
