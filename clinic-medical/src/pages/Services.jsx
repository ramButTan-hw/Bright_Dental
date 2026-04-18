import { useEffect, useMemo, useState } from 'react';
import { resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/Services.css';

function getMarker(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Services() {
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Departments | Bright Dental';
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/departments`)
      .then((r) => r.json())
      .then((data) => {
        setDepartments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load departments.');
        setLoading(false);
      });
  }, [API_BASE_URL]);

  return (
    <section className="services-section">
      <div className="services-background"></div>

      <div className="services-container">
        <div className="services-header">
          <h1 className="services-main-title">OUR DEPARTMENTS</h1>
          <p className="services-tagline">Comprehensive dental care tailored for your comfort and confidence.</p>
        </div>

        {loading && <p className="services-tagline">Loading departments…</p>}
        {error && <p className="services-tagline">{error}</p>}

        {!loading && !error && (
          <div className="services-grid">
            {departments.map((dept) => (
              <div key={dept.department_id} className="service-card">
                <div className="service-icon-wrapper">
                  <div className="service-icon" aria-hidden="true">{getMarker(dept.department_name)}</div>
                </div>
                <h3 className="service-title">{dept.department_name}</h3>
                <p className="service-description">{dept.description}</p>
                <div className="service-flourish"></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
