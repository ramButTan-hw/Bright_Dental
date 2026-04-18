import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { resolveApiBaseUrl } from '../utils/patientPortal';
import '../styles/ContactUsPage.css';

const API_BASE_URL = resolveApiBaseUrl();

function ContactUsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = 'Contact Us | Bright Dental'; }, []);

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
    <main className="contact-page">
      <div className="contact-page__container">
        <header className="contact-page__hero">
          <p className="contact-page__kicker">Get In Touch</p>
          <h1 className="contact-page__title">Contact Us</h1>
          <p className="contact-page__intro">
            Have questions or need to schedule an appointment? Reach out to any of our convenient locations.
          </p>
        </header>

        <section className="contact-page__section">
          <div className="contact-page__section-header">
            <h2 className="contact-page__section-title">Our Locations</h2>
            <p className="contact-page__section-copy">Call, email, or visit the office that works best for your schedule.</p>
          </div>

          {loading ? (
            <p className="contact-page__status">Loading locations...</p>
          ) : locations.length === 0 ? (
            <p className="contact-page__status">No locations available.</p>
          ) : (
            <div className="contact-page__grid">
              {locations.map((loc) => {
                const address = `${loc.loc_street_no} ${loc.loc_street_name}`;
                const cityState = `${loc.location_city}, ${loc.location_state} ${loc.loc_zip_code}`;

                return (
                  <article key={loc.location_id} className="contact-card">
                    <div className="contact-card__header">
                      <h3 className="contact-card__title">Bright Dental - {loc.location_city}</h3>
                      <p className="contact-card__address">{address}, {cityState}</p>
                    </div>

                    <div className="contact-card__body">
                      <table className="contact-card__table">
                        <tbody>
                          {loc.loc_phone && (
                            <tr>
                              <td className="contact-card__label">Phone</td>
                              <td>{loc.loc_phone}</td>
                            </tr>
                          )}
                          {loc.loc_email && (
                            <tr>
                              <td className="contact-card__label">Email</td>
                              <td>{loc.loc_email}</td>
                            </tr>
                          )}
                          {loc.loc_fax && (
                            <tr>
                              <td className="contact-card__label">Fax</td>
                              <td>{loc.loc_fax}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="contact-cta">
          <h3 className="contact-cta__title">Ready to book your next visit?</h3>
          <p className="contact-cta__copy">
            New and returning patients can schedule appointments online or by calling any location directly.
          </p>
          <Link to="/patient-registration" className="contact-cta__button">
            Book Appointment
          </Link>
        </section>
      </div>
    </main>
  );
}

export default ContactUsPage;
