import { useState, useEffect, useMemo } from 'react';
import { resolveApiBaseUrl } from '../utils/patientPortal';

const ROLE_LABELS = {
  DOCTOR: 'Our Doctors',
  RECEPTIONIST: 'Front Desk & Reception',
  ADMIN: 'Administration'
};

const ROLE_ORDER = ['DOCTOR', 'RECEPTIONIST', 'ADMIN'];

function MeetOurStaffPage() {
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/public/staff`)
      .then((r) => r.json())
      .then((data) => {
        setStaff(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const grouped = ROLE_ORDER.reduce((acc, role) => {
    const members = staff.filter((s) => s.user_role === role);
    if (members.length) acc.push({ role, label: ROLE_LABELS[role] || role, members });
    return acc;
  }, []);

  return (
    <main style={{ paddingTop: '90px', minHeight: '100vh', background: '#f7faf9' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={{ color: '#005050', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            About Us
          </p>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#181c1c', margin: 0, fontFamily: "'Manrope', sans-serif" }}>
            Meet Our Staff
          </h1>
          <p style={{ color: '#3e4948', marginTop: '0.75rem', fontSize: '1.05rem', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            Get to know the dedicated professionals behind Bright Dental. Our team is committed to providing you with exceptional care.
          </p>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '3rem 0' }}>Loading staff...</p>
        ) : grouped.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', padding: '3rem 0' }}>No staff information available.</p>
        ) : (
          grouped.map(({ role, label, members }) => (
            <section key={role} style={{ marginBottom: '3rem' }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#005050',
                borderBottom: '3px solid #84d4d3',
                paddingBottom: '0.5rem',
                marginBottom: '1.5rem',
                fontFamily: "'Manrope', sans-serif"
              }}>
                {label}
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1.5rem'
              }}>
                {members.map((m) => {
                  const locations = m.locations ? m.locations.split('||') : [];
                  const hasImage = m.profile_image_base64 && m.profile_image_base64 !== 'NULL';
                  const initials = `${(m.first_name || '')[0] || ''}${(m.last_name || '')[0] || ''}`.toUpperCase();

                  return (
                    <div key={m.staff_id} style={{
                      background: '#fff',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'box-shadow 0.25s, transform 0.25s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      {/* Image banner */}
                      {hasImage ? (
                        <div style={{ width: '100%', height: 200, overflow: 'hidden' }}>
                          <img
                            src={`data:image/jpeg;base64,${m.profile_image_base64}`}
                            alt={`${m.first_name} ${m.last_name}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      ) : (
                        <div style={{
                          background: 'linear-gradient(135deg, #005050, #006a6a)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 200
                        }}>
                          <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#fff', opacity: 0.7 }}>
                            {initials}
                          </span>
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ padding: '1.25rem 1.25rem 1.5rem', flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#181c1c' }}>
                          {role === 'DOCTOR' ? 'Dr. ' : ''}{m.first_name} {m.last_name}
                        </h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#005050', fontWeight: 600 }}>
                          {role === 'DOCTOR' ? 'Dentist' : role === 'RECEPTIONIST' ? 'Receptionist' : 'Administrator'}
                        </p>

                        {/* Contact */}
                        <div style={{ marginTop: '0.85rem', fontSize: '0.88rem', color: '#3e4948' }}>
                          {m.user_email && (
                            <p style={{ margin: '0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ opacity: 0.6 }}>Email:</span> {m.user_email}
                            </p>
                          )}
                          {m.phone_number && (
                            <p style={{ margin: '0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ opacity: 0.6 }}>Phone:</span> {m.phone_number}
                            </p>
                          )}
                        </div>

                        {/* Locations */}
                        {locations.length > 0 && (
                          <div style={{ marginTop: '0.75rem' }}>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#005050', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Locations
                            </p>
                            {locations.map((loc, i) => (
                              <p key={i} style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#555' }}>
                                {loc}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}

export default MeetOurStaffPage;
