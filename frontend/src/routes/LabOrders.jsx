import { useEffect, useState } from 'react';

const MOCK = [
  { lab_order_id: 1, p_first_name: 'John', p_last_name: 'Doe', doctor_last_name: 'Smith', lab_name: 'Precision Dental Lab', tooth_number: 14, procedure_code: 'D2392', order_date: '2026-03-18', due_date: '2026-03-25', order_status: 'Sent', cost: 120 },
];

const statusBadge = (status) => {
  const map = { Sent: { bg: '#dbeafe', color: '#2563eb' }, Received: { bg: '#dcfce7', color: '#16a34a' }, Pending: { bg: '#fef9c3', color: '#d97706' }, Completed: { bg: '#dcfce7', color: '#16a34a' }, Cancelled: { bg: '#fee2e2', color: '#dc2626' } };
  const c = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>{status}</span>;
};

function LabOrders() {
  const [orders, setOrders] = useState(MOCK);

  useEffect(() => {
    fetch('/api/lab-orders')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setOrders(data); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '32px 36px' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332', marginBottom: '24px' }}>Lab Orders</h2>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['ORDER #','PATIENT','DOCTOR','LAB','TOOTH #','PROCEDURE','ORDER DATE','DUE DATE','STATUS','COST'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.lab_order_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '14px 16px', color: '#374151', fontWeight: 500, fontSize: '0.875rem' }}>{o.lab_order_id}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{o.p_first_name} {o.p_last_name}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>Dr. {o.doctor_last_name}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{o.lab_name}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{o.tooth_number}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{o.procedure_code}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{o.order_date?.split('T')[0]}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>{o.due_date?.split('T')[0]}</td>
                <td style={{ padding: '14px 16px' }}>{statusBadge(o.order_status)}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '0.875rem' }}>${Number(o.cost).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LabOrders;
