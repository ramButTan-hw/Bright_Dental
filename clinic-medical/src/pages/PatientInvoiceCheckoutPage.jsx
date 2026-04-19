import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatMoney, formatTime, getPatientPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/PatientPortalPage.css';

function PatientInvoiceCheckoutPage() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const session = useMemo(() => getPatientPortalSession(), []);
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [treatments, setTreatments] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingZip, setBillingZip] = useState('');

  useEffect(() => { document.title = 'Invoice Checkout | Bright Dental'; }, []);

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

        const allMethods = Array.isArray(methodsPayload) ? methodsPayload : [];
        const cardMethods = allMethods.filter((m) => m.method_name === 'CREDIT_CARD' || m.method_name === 'DEBIT_CARD');
        setInvoice(invoicePayload?.invoice || null);
        setTreatments(Array.isArray(invoicePayload?.treatments) ? invoicePayload.treatments : []);
        setPaymentMethods(cardMethods);
        if (cardMethods.length > 0) {
          setMethodId(String(cardMethods[0].method_id));
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

      const rawCard = cardNumber.replace(/\s/g, '');
      if (!/^\d{13,19}$/.test(rawCard)) {
        throw new Error('Enter a valid card number (13-19 digits).');
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
        throw new Error('Enter a valid expiration date (MM/YY).');
      }
      const [expMonth, expYear] = cardExpiry.split('/').map(Number);
      const now = new Date();
      const expDate = new Date(2000 + expYear, expMonth);
      if (expDate <= now) {
        throw new Error('Card is expired.');
      }
      if (!/^\d{3,4}$/.test(cardCvv)) {
        throw new Error('Enter a valid CVV (3 or 4 digits).');
      }
      if (!cardholderName.trim()) {
        throw new Error('Cardholder name is required.');
      }
      if (!billingAddress.trim()) {
        throw new Error('Billing address is required.');
      }
      if (!billingCity.trim()) {
        throw new Error('Billing city is required.');
      }
      if (!billingState.trim()) {
        throw new Error('Billing state is required.');
      }
      if (!/^\d{5}(-\d{4})?$/.test(billingZip.trim())) {
        throw new Error('Enter a valid ZIP code (e.g. 77001 or 77001-1234).');
      }

      const maskedRef = `****${rawCard.slice(-4)}`;

      const response = await fetch(
        `${API_BASE_URL}/api/patients/${session.patientId}/invoices/${invoiceId}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentAmount: normalizedAmount,
            methodId: Number(methodId),
            referenceNumber: maskedRef,
            notes: null
          })
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to process payment.');
      }

      setInvoice(payload?.invoice || null);
      setPaymentAmount('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setCardholderName('');
      setBillingAddress('');
      setBillingCity('');
      setBillingState('');
      setBillingZip('');
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
      {/* Header */}
      <section className="portal-card">
        <div className="portal-row-between">
          <h1>Invoice #{invoice.invoice_id}</h1>
          <Link to="/patient-portal/invoices" className="portal-link-btn">Back to Billing &amp; Invoices</Link>
        </div>

        {error && <p className="portal-error">{error}</p>}
        {success && <p className="portal-success">{success}</p>}

        {/* Invoice summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <p className="portal-stat-label">Date</p>
            <p className="portal-stat-value">{formatDate(invoice.appointment_date)}</p>
          </div>
          <div>
            <p className="portal-stat-label">Time</p>
            <p className="portal-stat-value">{formatTime(invoice.appointment_time)}</p>
          </div>
          <div>
            <p className="portal-stat-label">Total</p>
            <p className="portal-stat-value">{formatMoney(invoice.amount)}</p>
          </div>
          <div>
            <p className="portal-stat-label">Insurance</p>
            <p className="portal-stat-value">{formatMoney(invoice.insurance_covered_amount)}</p>
          </div>
          <div>
            <p className="portal-stat-label">Your Responsibility</p>
            <p className="portal-stat-value">{formatMoney(invoice.patient_amount)}</p>
          </div>
          <div>
            <p className="portal-stat-label">Paid</p>
            <p className="portal-stat-value">{formatMoney(invoice.amount_paid)}</p>
          </div>
          <div>
            <p className="portal-stat-label">Balance Due</p>
            <p className="portal-stat-value" style={{ color: amountDue > 0 ? '#9d2e2e' : '#155724', fontWeight: 700 }}>
              {formatMoney(amountDue)}
            </p>
          </div>
        </div>
      </section>

      {/* Procedures performed */}
      {treatments.length > 0 && (
        <section className="portal-card">
          <h2>Procedures</h2>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Description</th>
                  <th>Tooth</th>
                  <th>Surface</th>
                  <th>Fee</th>
                  <th>Coverage</th>
                  <th>Ins. Paid</th>
                  <th>You Owe</th>
                </tr>
              </thead>
              <tbody>
                {treatments.map((t) => (
                  <tr key={t.plan_id}>
                    <td>{t.procedure_code}</td>
                    <td>{t.procedure_description}</td>
                    <td>{t.tooth_number || '—'}</td>
                    <td>{t.surface || '—'}</td>
                    <td>{formatMoney(t.estimated_cost)}</td>
                    <td>{Number(t.coverage_percent || 0)}%</td>
                    <td>{formatMoney(t.insurance_covered)}</td>
                    <td>{formatMoney(t.patient_owes)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan="4" style={{ textAlign: 'right' }}>Totals</td>
                  <td>{formatMoney(treatments.reduce((s, t) => s + Number(t.estimated_cost || 0), 0))}</td>
                  <td></td>
                  <td>{formatMoney(treatments.reduce((s, t) => s + Number(t.insurance_covered || 0), 0))}</td>
                  <td>{formatMoney(treatments.reduce((s, t) => s + Number(t.patient_owes || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Payment form */}
      <section className="portal-card">
        <h2>Complete Payment</h2>

        {amountDue <= 0 ? (
          <p>This invoice is fully paid. No further payment is required.</p>
        ) : (
          <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Payment amount & card type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem' }}>
              <label className="portal-field">
                <span>Payment Amount</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={amountDue.toFixed(2)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Up to ${amountDue.toFixed(2)}`}
                  required
                />
              </label>
              <label className="portal-field">
                <span>Card Type</span>
                <select value={methodId} onChange={(e) => setMethodId(e.target.value)} required>
                  {paymentMethods.map((method) => (
                    <option key={method.method_id} value={method.method_id}>
                      {method.display_name || method.method_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Card details */}
            <fieldset style={{ border: '1px solid #c7dcda', borderRadius: '0.6rem', padding: '1rem 1.25rem', margin: 0 }}>
              <legend style={{ fontWeight: 700, padding: '0 0.4rem', color: '#1f2d2b' }}>Card Details</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem' }}>
                <label className="portal-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Card Number</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                      setCardNumber(digits.replace(/(\d{4})(?=\d)/g, '$1 '));
                    }}
                    placeholder="1234 5678 9012 3456"
                    required
                  />
                </label>
                <label className="portal-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Cardholder Name</span>
                  <input
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder="Name on card"
                    required
                  />
                </label>
                <label className="portal-field">
                  <span>Expiration Date</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^\d/]/g, '');
                      const raw = val.replace(/\//g, '');
                      if (raw.length >= 3) {
                        val = raw.slice(0, 2) + '/' + raw.slice(2, 4);
                      } else if (raw.length === 2 && !val.includes('/')) {
                        val = raw + '/';
                      }
                      setCardExpiry(val.slice(0, 5));
                    }}
                    placeholder="MM/YY"
                    required
                  />
                </label>
                <label className="portal-field">
                  <span>CVV</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    required
                  />
                </label>
              </div>
            </fieldset>

            {/* Billing address */}
            <fieldset style={{ border: '1px solid #c7dcda', borderRadius: '0.6rem', padding: '1rem 1.25rem', margin: 0 }}>
              <legend style={{ fontWeight: 700, padding: '0 0.4rem', color: '#1f2d2b' }}>Billing Address</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1rem' }}>
                <label className="portal-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Street Address</span>
                  <input
                    type="text"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="123 Main St"
                    required
                  />
                </label>
                <label className="portal-field">
                  <span>City</span>
                  <input
                    type="text"
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    placeholder="Houston"
                    required
                  />
                </label>
                <label className="portal-field">
                  <span>State</span>
                  <input
                    type="text"
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase())}
                    maxLength={2}
                    placeholder="TX"
                    required
                  />
                </label>
                <label className="portal-field">
                  <span>ZIP Code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={billingZip}
                    onChange={(e) => setBillingZip(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
                    maxLength={10}
                    placeholder="77001"
                    required
                  />
                </label>
              </div>
            </fieldset>

            <button type="submit" className="portal-primary-btn" disabled={saving || !methodId} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Processing...' : `Pay ${paymentAmount ? formatMoney(Number(paymentAmount)) : formatMoney(amountDue)}`}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default PatientInvoiceCheckoutPage;
