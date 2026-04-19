import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { resolveApiBaseUrl } from '../utils/patientPortal';

const API_BASE_URL = resolveApiBaseUrl();

function ContactUsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/public/locations`)
      .then((r) => r.json())
      .then((data) => {
        setLocations(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main style={{ paddingTop: '90px', minHeight: '100vh', background: '#f7faf9' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={{ color: '#005050', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Get In Touch
          </p>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#181c1c', margin: 0, fontFamily: "'Manrope', sans-serif" }}>
            Contact Us
          </h1>
          <p style={{ color: '#3e4948', marginTop: '0.75rem', fontSize: '1.05rem', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            Have questions or need to schedule an appointment? Reach out to any of our convenient locations.
          </p>
        </div>

        {/* Locations */}
        <h2 style={{
          fontSize: '1.5rem', fontWeight: 700, color: '#005050',
          borderBottom: '3px solid #84d4d3', paddingBottom: '0.5rem',
          marginBottom: '1.5rem', fontFamily: "'Manrope', sans-serif"
        }}>
          Our Locations
        </h2>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '2rem 0' }}>Loading locations...</p>
        ) : locations.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '2rem 0' }}>No locations available.</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem'
          }}>
            {locations.map((loc) => {
              const address = `${loc.loc_street_no} ${loc.loc_street_name}`;
              const cityState = `${loc.location_city}, ${loc.location_state} ${loc.loc_zip_code}`;

              return (
                <div key={loc.location_id} style={{
                  background: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.25s, transform 0.25s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {/* Header bar */}
                  <div style={{
                    background: 'linear-gradient(135deg, #005050, #006a6a)',
                    padding: '1rem 1.25rem',
                    color: '#fff'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                      Bright Dental — {loc.location_city}
                    </h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', opacity: 0.85 }}>
                      {address}, {cityState}
                    </p>
                  </div>

                  {/* Contact details */}
                  <div style={{ padding: '1.25rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem', color: '#3e4948' }}>
                      <tbody>
                        {loc.loc_phone && (
                          <tr>
                            <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#005050', width: 60 }}>Phone</td>
                            <td style={{ padding: '0.35rem 0' }}>{loc.loc_phone}</td>
                          </tr>
                        )}
                        {loc.loc_email && (
                          <tr>
                            <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#005050' }}>Email</td>
                            <td style={{ padding: '0.35rem 0' }}>{loc.loc_email}</td>
                          </tr>
                        )}
                        {loc.loc_fax && (
                          <tr>
                            <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#005050' }}>Fax</td>
                            <td style={{ padding: '0.35rem 0' }}>{loc.loc_fax}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{
          marginTop: '3rem',
          textAlign: 'center',
          padding: '2rem',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#181c1c' }}>
            Ready to book your next visit?
          </h3>
          <p style={{ color: '#3e4948', margin: '0.5rem 0 1.25rem', fontSize: '0.95rem' }}>
            New and returning patients can schedule appointments online or by calling any location directly.
          </p>
          <Link
            to="/patient-registration"
            style={{
              display: 'inline-block',
              background: '#005050',
              color: '#fff',
              padding: '0.75rem 2rem',
              borderRadius: '0.75rem',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '1rem',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#006a6a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#005050'; }}
          >
            Book Appointment
          </Link>
        </div>
      </div>
    </main>
  );
}

export default ContactUsPage;
