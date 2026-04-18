import { Link } from 'react-router-dom';
import '../styles/Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-grid">
          <div className="footer-column">
            <p className="footer-kicker">Bright Dental</p>
            <div className="footer-brand">Bright Dental</div>
            <p className="footer-description">
              Redefining clinical excellence through empathetic care and advanced technology.
            </p>
          </div>

          <div className="footer-column">
            <h4 className="footer-column-title">Contact Information</h4>
            <div className="footer-info">
              <p>4302 University Dr, Houston, TX 77004</p>
              <p>(832) 461-3355</p>
              <p>hello@brightdental.com</p>
            </div>
          </div>

          <div className="footer-column">
            <h4 className="footer-column-title">Hours of Operation</h4>
            <div className="footer-hours">
              <p>Mon - Fri: 8:00 AM - 7:00 PM</p>
              <p>Sat: 9:00 AM - 3:00 PM</p>
            </div>
          </div>

          <div className="footer-column">
            <h4 className="footer-column-title">Quick Links</h4>
            <div className="footer-links">
              <Link to="/">Home</Link>
              <Link to="/services">Services</Link>
              <Link to="/our-motive">Our Motive</Link>
              <Link to="/contact-us">Contact Us</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>Serving Houston-area patients with modern dental care and dependable scheduling support.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
