import { Link } from 'react-router-dom';
import '../styles/Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-grid">
          {/* Brand Column */}
          <div className="footer-column">
            <div className="footer-brand">Bright Dental</div>
            <p className="footer-description">
              Redefining clinical excellence through empathetic care and advanced technology.
            </p>
          </div>

          {/* Contact Information */}
          <div className="footer-column">
            <h4 className="footer-column-title">Contact Information</h4>
            <div className="footer-info">
              <p> Location: 4302 University Dr</p>
              <p> Phone: (832) 461-3355</p>
              <p> Email: hello@brightdental.com</p>
            </div>
          </div>

          {/* Business Hours */}
          <div className="footer-column">
            <h4 className="footer-column-title">Hours of Operation</h4>
            <div className="footer-hours">
              <p>Mon - Fri: 8:00 AM - 7:00 PM</p>
              <p>Sat: 9:00 AM - 3:00 PM</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-column">
            <h4 className="footer-column-title">Quick Links</h4>
            <div className="footer-links">
              <Link to="/">Home</Link>
              <Link to="/meet-our-staff">About Us</Link>
              <Link to="/contact-us">Contact</Link>
              <Link to="/appointment-checklist">Dental Appointment Checklist</Link>
            </div>
          </div>
        </div>

        
      </div>
    </footer>
  );
}

export default Footer;
