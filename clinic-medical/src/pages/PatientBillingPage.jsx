import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatMoney, getPatientPortalSession, resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/PatientPortalPage.css';

function PatientBillingPage() {
  const navigate = useNavigate();
  const session = useMemo(() => getPatientPortalSession(), []);
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const [billing, setBilling] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.patientId) {
      navigate('/patient-login');
      return;
    }

    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/patients/${session.patientId}/billing`);
        if (!response.ok) {
          throw new Error('Unable to load billing summary.');
        }
        const payload = await response.json();
        setBilling(payload);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load billing summary.');
      }
    };

    load();
  }, [API_BASE_URL, navigate, session?.patientId]);

  return (
    <main className="patient-portal-page">
      <section className="portal-card">
        <div className="portal-row-between">
          <h1>Billing Summary</h1>
          <Link to="/patient-portal" className="portal-link-btn">Back to Portal</Link>
        </div>

        {error && <p className="portal-error">{error}</p>}

        {!billing ? (
          <p>No billing data available.</p>
        ) : (
          <div className="portal-grid portal-grid-small">
            {Object.entries(billing).map(([key, value]) => {
              const label = key
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase());
              const maybeMoney = /amount|balance|total|cost|covered|paid/i.test(key);
              return (
                <article key={key} className="portal-card portal-card-soft">
                  <p className="portal-stat-label">{label}</p>
                  <p className="portal-stat-value">{maybeMoney ? formatMoney(value) : String(value ?? 'N/A')}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default PatientBillingPage;
