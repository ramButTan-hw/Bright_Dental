import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate, formatMoney, formatTime, getPatientPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/PatientPortalPage.css';

function PatientInvoicesPage() {
  const navigate = useNavigate();
  const session = useMemo(() => getPatientPortalSession(), []);
  const API_BASE_URL = resolveApiBaseUrl();
  const [billing, setBilling] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.patientId) {
      navigate('/patient-login');
      return;
    }

    const load = async () => {
      try {
        const [billingRes, invoicesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/patients/${session.patientId}/billing`),
          fetch(`${API_BASE_URL}/api/patients/${session.patientId}/invoices`)
        ]);

        const [billingPayload, invoicesPayload] = await Promise.all([
          billingRes.ok ? billingRes.json() : Promise.resolve(null),
          invoicesRes.ok ? invoicesRes.json() : Promise.resolve([])
        ]);

        setBilling(billingPayload);
        setInvoices(Array.isArray(invoicesPayload) ? invoicesPayload : []);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load billing and invoices.');
      }
    };

    load();
  }, [API_BASE_URL, navigate, session?.patientId]);

  return (
    <main className="patient-portal-page">
      <section className="portal-card">
        <div className="portal-row-between">
          <h1>Billing &amp; Invoices</h1>
          <Link to="/patient-portal" className="portal-link-btn">Back to Portal</Link>
        </div>
        {error && <p className="portal-error">{error}</p>}

        {!billing ? (
          <p>No billing summary available.</p>
        ) : (
          <div className="portal-grid portal-grid-small">
            {Object.entries(billing).map(([key, value]) => {
              const label = key
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase());
              const maybeMoney = /amount|balance|total|cost|covered|paid|due/i.test(key);
              return (
                <article key={key} className="portal-card portal-card-soft">
                  <p className="portal-stat-label">{label}</p>
                  <p className="portal-stat-value">{maybeMoney ? formatMoney(value) : String(value ?? 'N/A')}</p>
                </article>
              );
            })}
          </div>
        )}

        <h2 className="portal-section-title">Invoices</h2>

        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Appointment Date</th>
                <th>Appointment Time</th>
                <th>Total</th>
                <th>Insurance</th>
                <th>Patient Amount</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="10">No invoices found.</td>
                </tr>
              ) : invoices.map((invoice) => {
                const amountDue = Number(invoice.amount_due || 0);
                const isPaid = amountDue <= 0;

                return (
                  <tr key={invoice.invoice_id}>
                    <td>
                      {isPaid ? (
                        <span>{invoice.invoice_id}</span>
                      ) : (
                        <Link
                          to={`/patient-portal/invoices/${invoice.invoice_id}/checkout`}
                          className="portal-inline-link"
                        >
                          {invoice.invoice_id}
                        </Link>
                      )}
                    </td>
                    <td>{formatDate(invoice.appointment_date)}</td>
                    <td>{formatTime(invoice.appointment_time)}</td>
                    <td>{formatMoney(invoice.amount)}</td>
                    <td>{formatMoney(invoice.insurance_covered_amount)}</td>
                    <td>{formatMoney(invoice.patient_amount)}</td>
                    <td>{formatMoney(invoice.amount_paid)}</td>
                    <td>{formatMoney(invoice.amount_due)}</td>
                    <td>
                      {isPaid ? (
                        <span className="portal-status-badge portal-status-paid">Paid</span>
                      ) : (
                        <span className="portal-status-badge portal-status-open">{invoice.payment_status}</span>
                      )}
                    </td>
                    <td>
                      {isPaid ? (
                        <span className="portal-link-btn portal-link-btn-disabled" aria-disabled="true">Paid</span>
                      ) : (
                        <Link to={`/patient-portal/invoices/${invoice.invoice_id}/checkout`} className="portal-link-btn">
                          Checkout
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default PatientInvoicesPage;
