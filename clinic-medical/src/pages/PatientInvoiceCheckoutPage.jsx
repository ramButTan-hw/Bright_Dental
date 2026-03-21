import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatMoney, formatTime, getPatientPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/PatientPortalPage.css';

function PatientInvoiceCheckoutPage() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const session = useMemo(() => getPatientPortalSession(), []);
  const API_BASE_URL = resolveApiBaseUrl();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!session?.patientId) {
      navigate('/patient-login');
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [invoiceRes, methodsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/patients/${session.patientId}/invoices/${invoiceId}`),
          fetch(`${API_BASE_URL}/api/payment-methods`)
        ]);

        if (!invoiceRes.ok) {
          throw new Error('Unable to load invoice checkout details.');
        }

        const [invoicePayload, methodsPayload] = await Promise.all([
          invoiceRes.json(),
          methodsRes.ok ? methodsRes.json() : Promise.resolve([])
        ]);

        const availableMethods = Array.isArray(methodsPayload) ? methodsPayload : [];
        setInvoice(invoicePayload?.invoice || null);
        setPayments(Array.isArray(invoicePayload?.payments) ? invoicePayload.payments : []);
        setPaymentMethods(availableMethods);
        if (availableMethods.length > 0) {
          setMethodId(String(availableMethods[0].method_id));
        }
      } catch (loadError) {
        setError(loadError.message || 'Unable to load invoice checkout details.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [API_BASE_URL, invoiceId, navigate, session?.patientId]);

  const amountDue = Number(invoice?.amount_due || 0);

  const handleSubmitPayment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const normalizedAmount = Number(paymentAmount);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        throw new Error('Enter a valid payment amount greater than 0.');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/patients/${session.patientId}/invoices/${invoiceId}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentAmount: normalizedAmount,
            methodId: Number(methodId),
            referenceNumber,
            notes
          })
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to process payment.');
      }

      setInvoice(payload?.invoice || null);
      setPayments(Array.isArray(payload?.payments) ? payload.payments : []);
      setPaymentAmount('');
      setReferenceNumber('');
      setNotes('');
      setSuccess(payload?.message || 'Payment completed successfully.');
    } catch (paymentError) {
      setError(paymentError.message || 'Unable to process payment.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="patient-portal-page"><p className="portal-loading">Loading invoice checkout...</p></main>;
  }

  if (!invoice) {
    return (
      <main className="patient-portal-page">
        <section className="portal-card">
          <div className="portal-row-between">
            <h1>Invoice Checkout</h1>
            <Link to="/patient-portal/invoices" className="portal-link-btn">Back to Billing &amp; Invoices</Link>
          </div>
          <p>Invoice not found.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="patient-portal-page">
      <section className="portal-card">
        <div className="portal-row-between">
          <h1>Invoice Checkout #{invoice.invoice_id}</h1>
          <Link to="/patient-portal/invoices" className="portal-link-btn">Back to Billing &amp; Invoices</Link>
        </div>

        {error && <p className="portal-error">{error}</p>}
        {success && <p className="portal-success">{success}</p>}

        <div className="portal-grid portal-grid-small">
          <article className="portal-card portal-card-soft">
            <p className="portal-stat-label">Appointment Date</p>
            <p className="portal-stat-value">{formatDate(invoice.appointment_date)}</p>
          </article>
          <article className="portal-card portal-card-soft">
            <p className="portal-stat-label">Appointment Time</p>
            <p className="portal-stat-value">{formatTime(invoice.appointment_time)}</p>
          </article>
          <article className="portal-card portal-card-soft">
            <p className="portal-stat-label">Invoice Total</p>
            <p className="portal-stat-value">{formatMoney(invoice.amount)}</p>
          </article>
          <article className="portal-card portal-card-soft">
            <p className="portal-stat-label">Insurance Covered</p>
            <p className="portal-stat-value">{formatMoney(invoice.insurance_covered_amount)}</p>
          </article>
          <article className="portal-card portal-card-soft">
            <p className="portal-stat-label">Patient Responsibility</p>
            <p className="portal-stat-value">{formatMoney(invoice.patient_amount)}</p>
          </article>
          <article className="portal-card portal-card-soft">
            <p className="portal-stat-label">Paid So Far</p>
            <p className="portal-stat-value">{formatMoney(invoice.amount_paid)}</p>
          </article>
          <article className="portal-card portal-card-soft">
            <p className="portal-stat-label">Remaining Balance</p>
            <p className="portal-stat-value">{formatMoney(invoice.amount_due)}</p>
          </article>
          <article className="portal-card portal-card-soft">
            <p className="portal-stat-label">Status</p>
            <p className="portal-stat-value">{invoice.payment_status}</p>
          </article>
        </div>
      </section>

      <section className="portal-card">
        <h2>Complete Payment</h2>

        {amountDue <= 0 ? (
          <p>This invoice is fully paid. No further payment is required.</p>
        ) : (
          <form className="portal-payment-form" onSubmit={handleSubmitPayment}>
            <label className="portal-field">
              <span>Payment Amount</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={amountDue.toFixed(2)}
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder={`Up to ${amountDue.toFixed(2)}`}
                required
              />
            </label>

            <label className="portal-field">
              <span>Payment Method</span>
              <select
                value={methodId}
                onChange={(event) => setMethodId(event.target.value)}
                required
              >
                {paymentMethods.map((method) => (
                  <option key={method.method_id} value={method.method_id}>
                    {method.display_name || method.method_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="portal-field">
              <span>Reference Number (optional)</span>
              <input
                type="text"
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="Check #, transaction ID, etc."
              />
            </label>

            <label className="portal-field portal-field-full">
              <span>Notes (optional)</span>
              <textarea
                rows="3"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add any payment note"
              />
            </label>

            <button type="submit" className="portal-primary-btn" disabled={saving || !methodId}>
              {saving ? 'Processing...' : 'Submit Payment'}
            </button>
          </form>
        )}
      </section>

      <section className="portal-card">
        <h2>Payment History</h2>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Payment #</th>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="6">No payments recorded yet.</td>
                </tr>
              ) : payments.map((payment) => (
                <tr key={payment.payment_id}>
                  <td>{payment.payment_id}</td>
                  <td>{new Date(payment.payment_date).toLocaleString()}</td>
                  <td>{payment.payment_method || payment.method_name}</td>
                  <td>{formatMoney(payment.payment_amount)}</td>
                  <td>{payment.reference_number || 'N/A'}</td>
                  <td>{payment.notes || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default PatientInvoiceCheckoutPage;
