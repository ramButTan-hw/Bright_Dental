import { useState, useEffect, useMemo } from 'react';
import { resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/MeetOurStaffPage.css';

const ROLE_LABELS = {
  DOCTOR: 'Our Doctors',
  RECEPTIONIST: 'Front Desk & Reception',
  ADMIN: 'Administration'
};

const ROLE_ORDER = ['DOCTOR', 'RECEPTIONIST', 'ADMIN'];

function MeetOurStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = useMemo(() => resolveApiBaseUrl(), []);

  useEffect(() => { document.title = 'Meet Our Staff | Bright Dental'; }, []);

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
    <main className="staff-page">
      <div className="staff-container">
        <div className="staff-hero">
          <p className="staff-kicker">About Us</p>
          <h1 className="staff-title">Meet Our Staff</h1>
          <p className="staff-intro">
            Get to know the dedicated professionals behind Bright Dental. Our team is committed to providing you with exceptional care.
          </p>
        </div>

        {loading ? (
          <p className="staff-status">Loading staff...</p>
        ) : grouped.length === 0 ? (
          <p className="staff-status">No staff information available.</p>
        ) : (
          grouped.map(({ role, label, members }) => (
            <section key={role} className="staff-group">
              <h2 className="staff-group__title">{label}</h2>

              <div className="staff-grid">
                {members.map((m) => {
                  const locations = m.locations ? m.locations.split('||') : [];
                  const hasImage = m.profile_image_base64 && m.profile_image_base64 !== 'NULL';
                  const initials = `${(m.first_name || '')[0] || ''}${(m.last_name || '')[0] || ''}`.toUpperCase();

                  return (
                    <article key={m.staff_id} className="staff-card">
                      {hasImage ? (
                        <div className="staff-card__banner">
                          <img
                            src={`data:image/jpeg;base64,${m.profile_image_base64}`}
                            alt={`${m.first_name} ${m.last_name}`}
                            className="staff-card__photo"
                          />
                        </div>
                      ) : (
                        <div className="staff-card__placeholder">
                          <span className="staff-card__initials">{initials}</span>
                        </div>
                      )}

                      <div className="staff-card__body">
                        <h3 className="staff-card__name">
                          {role === 'DOCTOR' ? 'Dr. ' : ''}{m.first_name} {m.last_name}
                        </h3>
                        <p className="staff-card__role">
                          {role === 'DOCTOR' ? 'Dentist' : role === 'RECEPTIONIST' ? 'Receptionist' : 'Administrator'}
                        </p>

                        <div className="staff-card__contact">
                          {m.user_email && (
                            <p className="staff-card__contact-row">
                              <span className="staff-card__contact-label">Email:</span> {m.user_email}
                            </p>
                          )}
                          {m.phone_number && (
                            <p className="staff-card__contact-row">
                              <span className="staff-card__contact-label">Phone:</span> {m.phone_number}
                            </p>
                          )}
                        </div>

                        {locations.length > 0 && (
                          <div className="staff-card__locations">
                            <p className="staff-card__locations-label">Locations</p>
                            {locations.map((loc, i) => (
                              <p key={i} className="staff-card__location">{loc}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
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
