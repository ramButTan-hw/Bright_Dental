import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const s = {
  page: { padding: '32px 36px' },
  header: { borderBottom: '1px solid #e5e7eb', paddingBottom: '16px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#374151' },
  welcome: { marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  welcomeText: { fontSize: '1.6rem', fontWeight: 700, color: '#111827' },
  welcomeSub: { fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' },
  exportBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', fontSize: '0.875rem', fontWeight: 500, color: '#374151', cursor: 'pointer' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' },
  statCard: { background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  statTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  statNum: { fontSize: '1.8rem', fontWeight: 700, color: '#111827', display: 'block' },
  statLabel: { fontSize: '0.8rem', color: '#6b7280', marginTop: '2px', display: 'block' },
  trendIcon: { color: '#10b981' },
  bottomGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  card: { background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '22px' },
  cardTitle: { fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '16px' },
  apptItem: { padding: '14px 0', borderBottom: '1px solid #f3f4f6' },
  apptName: { fontWeight: 600, fontSize: '0.9rem', color: '#111827' },
  apptSub: { fontSize: '0.8rem', color: '#6b7280', margin: '2px 0 4px' },
  apptNotes: { fontSize: '0.8rem', color: '#6b7280' },
  apptRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f3f4f6' },
  invoiceName: { fontWeight: 600, fontSize: '0.9rem', color: '#111827' },
  invoiceAmt: { fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' },
};

const statusBadge = (status) => {
  const map = {
    Scheduled: { bg: '#dbeafe', color: '#2563eb' },
    Completed: { bg: '#dcfce7', color: '#16a34a' },
    Cancelled: { bg: '#fee2e2', color: '#dc2626' },
    Pending:   { bg: '#fef9c3', color: '#d97706' },
    Paid:      { bg: '#dcfce7', color: '#16a34a' },
  };
  const c = map[status] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 500 }}>
      {status}
    </span>
  );
};

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const username = user?.user_username || 'Admin';
  const role = user?.user_role || 'admin';

  const [stats, setStats] = useState({ patients: 4, appointments: 2, invoices: 2, revenue: '$350.00' });
  const [todayAppts, setTodayAppts] = useState([
    { appointment_id: 1, p_first_name: 'John',  p_last_name: 'Doe',     doctor_last_name: 'Smith', appointment_time: '09:00', appt_notes: 'Regular cleaning and checkup', appt_status: 'Scheduled' },
    { appointment_id: 2, p_first_name: 'Alice', p_last_name: 'Johnson', doctor_last_name: 'Smith', appointment_time: '10:30', appt_notes: 'Cavity filling on tooth #14',  appt_status: 'Completed' },
  ]);
  const [pendingInvoices, setPendingInvoices] = useState([
    { invoice_id: 2, total_amount: 200, invoice_status: 'Pending' },
    { invoice_id: 3, total_amount: 500, invoice_status: 'Pending' },
  ]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      fetch('/api/patients').then(r => r.json()).catch(() => []),
      fetch('/api/appointments').then(r => r.json()).catch(() => []),
      fetch('/api/invoices').then(r => r.json()).catch(() => []),
    ]).then(([patients, appointments, invoices]) => {
      const apptArr = Array.isArray(appointments) ? appointments : [];
      const invArr  = Array.isArray(invoices) ? invoices : [];
      if (apptArr.length === 0 && invArr.length === 0) return; // keep mock data
      const todayList = apptArr.filter(a => a.appointment_date?.startsWith(today));
      const pending   = invArr.filter(i => i.invoice_status === 'Pending');
      const revenue   = invArr.filter(i => i.invoice_status === 'Paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
      setStats({ patients: Array.isArray(patients) ? patients.length : 4, appointments: todayList.length, invoices: pending.length, revenue: `$${revenue.toFixed(2)}` });
      setTodayAppts(todayList.slice(0, 3));
      setPendingInvoices(pending.slice(0, 3));
    });
  }, []);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.pageTitle}>Dashboard</span>
      </div>

      <div style={s.welcome}>
        <div>
          <div style={s.welcomeText}>Welcome back, {username}</div>
          <div style={s.welcomeSub}>Here&apos;s what&apos;s happening today at the clinic.</div>
        </div>
        <button style={s.exportBtn}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Report
        </button>
      </div>

      {/* Stat cards — admin gets 4, others get 3 */}
      <div style={{ ...s.statsGrid, gridTemplateColumns: role === 'admin' ? 'repeat(4,1fr)' : 'repeat(3,1fr)' }}>
        {[
          { label: "Today's Appointments", value: stats.appointments, color: '#3b82f6', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, nav: '/portal/appointments', roles: 'all' },
          { label: 'Total Patients',        value: stats.patients,     color: '#3b82f6', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, nav: '/portal/patients', roles: 'all' },
          { label: 'Pending Invoices',      value: stats.invoices,     color: '#f59e0b', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, nav: '/portal/invoices', roles: 'all' },
          { label: 'Revenue (Paid)',         value: stats.revenue,      color: '#10b981', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, nav: '/portal/invoices', roles: 'admin' },
        ].filter(c => c.roles === 'all' || c.roles === role).map((c) => (
          <div key={c.label} style={s.statCard} onClick={() => navigate(c.nav)}>
            <div style={s.statTop}>
              <span style={{ color: c.color }}>{c.icon}</span>
              <svg width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <span style={s.statNum}>{c.value}</span>
            <span style={s.statLabel}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom panels — admin gets 2 columns, others get full-width appointments only */}
      <div style={role === 'admin' ? s.bottomGrid : {}}>
        <div style={s.card}>
          <div style={s.cardTitle}>Today&apos;s Appointments</div>
          {todayAppts.length === 0
            ? <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No appointments today</p>
            : todayAppts.map((a) => (
              <div key={a.appointment_id} style={s.apptItem}>
                <div style={s.apptRow}>
                  <div>
                    <div style={s.apptName}>{a.p_first_name} {a.p_last_name}</div>
                    <div style={s.apptSub}>Dr. {a.doctor_last_name} • {a.appointment_time?.slice(0,5)}</div>
                    <div style={s.apptNotes}>{a.appt_notes}</div>
                  </div>
                  {statusBadge(a.appt_status)}
                </div>
              </div>
            ))
          }
        </div>

        {role === 'admin' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Pending Invoices</div>
            {pendingInvoices.length === 0
              ? <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No pending invoices</p>
              : pendingInvoices.map((inv) => (
                <div key={inv.invoice_id} style={s.invoiceItem}>
                  <div>
                    <div style={s.invoiceName}>Invoice #{inv.invoice_id}</div>
                    <div style={s.invoiceAmt}>Patient amount: ${parseFloat(inv.total_amount || 0).toFixed(2)}</div>
                  </div>
                  {statusBadge(inv.invoice_status)}
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
