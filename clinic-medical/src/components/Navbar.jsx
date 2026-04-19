import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { resolveApiBaseUrl } from '../utils/patientPortal';
import {
  clearAdminPortalSession,
  clearDentistPortalSession,
  clearPatientPortalSession,
  clearReceptionPortalSession,
  getAdminPortalSession,
  getDentistPortalSession,
  getPatientPortalSession,
  getReceptionPortalSession
} from '../utils/patientPortal';
import '../styles/Navbar.css';

const LogoutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

function Navbar() {
  const [aboutDropdown, setAboutDropdown] = useState(false);
  const [loginDropdown, setLoginDropdown] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingLogout, setPendingLogout] = useState(null);
  const navigate = useNavigate();

  function openLogoutModal(logoutFn) {
    setPendingLogout(() => logoutFn);
    setShowLogoutConfirm(true);
  }

  function handleLogoutConfirm() {
    if (pendingLogout) pendingLogout();
    setShowLogoutConfirm(false);
    setPendingLogout(null);
  }

  function handleLogoutCancel() {
    setShowLogoutConfirm(false);
    setPendingLogout(null);
  }
  const location = useLocation();
  const [dentistAvatarUrl, setDentistAvatarUrl] = useState('');
  const [receptionAvatarUrl, setReceptionAvatarUrl] = useState('');
  const isLoggedIn = Boolean(getPatientPortalSession()?.patientId);
  const isAdminLoggedIn = Boolean(getAdminPortalSession()?.isAdmin);
  const isDentistLoggedIn = Boolean(getDentistPortalSession()?.doctorId);
  const isReceptionLoggedIn = Boolean(getReceptionPortalSession()?.staffId);

  useEffect(() => {
    const apiBase = resolveApiBaseUrl();
    const dentistSession = getDentistPortalSession();
    if (dentistSession?.staffId) {
      fetch(`${apiBase}/api/staff/profile-image?staffId=${dentistSession.staffId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.profile_image_base64) {
            setDentistAvatarUrl(`data:image/jpeg;base64,${data.profile_image_base64}`);
          }
        })
        .catch(() => {});
    }
    const receptionSession = getReceptionPortalSession();
    if (receptionSession?.staffId) {
      fetch(`${apiBase}/api/staff/profile-image?staffId=${receptionSession.staffId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.profile_image_base64) {
            setReceptionAvatarUrl(`data:image/jpeg;base64,${data.profile_image_base64}`);
          }
        })
        .catch(() => {});
    }
  }, [location.pathname]);

  return (
    <>
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/" className="brand-name">Bright Dental</Link>
        </div>

        {isLoggedIn ? (
          <div className="nav-menu">
            <Link to="/patient-portal" className="nav-link">Dashboard</Link>
            <Link to="/contact-us" className="nav-link">Contact Us</Link>
            <button
              type="button"
              className="nav-link login-btn nav-icon-btn"
              onClick={() => openLogoutModal(() => { clearPatientPortalSession(); navigate('/patient-login'); })}
              title="Log Out"
            >
              <LogoutIcon />
            </button>
          </div>
        ) : isAdminLoggedIn ? (
          <div className="nav-menu">
            <Link to="/admin" className="nav-link">Admin Dashboard</Link>
            <button
              type="button"
              className="nav-link login-btn nav-icon-btn"
              onClick={() => openLogoutModal(() => { clearAdminPortalSession(); navigate('/staff-login'); })}
              title="Staff Log Out"
            >
              <LogoutIcon />
            </button>
          </div>
        ) : isDentistLoggedIn ? (
          <div className="nav-menu">
            <Link to="/dentist-login" className="nav-link">Dentist Page</Link>
            <button
              type="button"
              className="nav-profile-photo-btn"
              onClick={() => navigate('/dentist-profile')}
              aria-label="Open dentist profile"
              title="Open dentist profile"
            >
              {dentistAvatarUrl ? (
                <img className="nav-profile-photo" src={dentistAvatarUrl} alt="Dentist profile" />
              ) : (
                <div className="nav-profile-photo-placeholder">Dr</div>
              )}
            </button>
            <button
              type="button"
              className="nav-link login-btn nav-icon-btn"
              onClick={() => openLogoutModal(() => { clearDentistPortalSession(); navigate('/staff-login'); })}
              title="Dentist Log Out"
            >
              <LogoutIcon />
            </button>
          </div>
        ) : isReceptionLoggedIn ? (
          <div className="nav-menu">
            <Link to="/receptionist" className="nav-link">Receptionist Page</Link>
            <button
              type="button"
              className="nav-profile-photo-btn"
              onClick={() => navigate('/receptionist-profile')}
              aria-label="Open receptionist profile"
              title="Open receptionist profile"
            >
              {receptionAvatarUrl ? (
                <img className="nav-profile-photo" src={receptionAvatarUrl} alt="Receptionist profile" />
              ) : (
                <div className="nav-profile-photo-placeholder">R</div>
              )}
            </button>
            <button
              type="button"
              className="nav-link login-btn nav-icon-btn"
              onClick={() => openLogoutModal(() => { clearReceptionPortalSession(); navigate('/staff-login'); })}
              title="Receptionist Log Out"
            >
              <LogoutIcon />
            </button>
          </div>
        ) : (
          <div className="nav-menu">

            <div
              className="nav-item dropdown"
              onMouseEnter={() => setAboutDropdown(true)}
              onMouseLeave={() => setAboutDropdown(false)}
            >
              <button
                className="nav-link dropdown-toggle"
                aria-haspopup="menu"
                aria-expanded={aboutDropdown}
              >
                About Us
              </button>
              {aboutDropdown && (
                <div className="dropdown-menu" role="menu">
                  <Link to="/department" className="dropdown-item" role="menuitem">Department</Link>
                  <Link to="/meet-our-staff" className="dropdown-item" role="menuitem">Meet Our Staff</Link>
                  <Link to="/testimonies" className="dropdown-item" role="menuitem">Testimonies</Link>
                  <a href="#our-motive" className="dropdown-item" role="menuitem">Our Motive</a>
                </div>
              )}
            </div>

            <Link to="/contact-us" className="nav-link">Contact Us</Link>

            <div
              className="nav-item dropdown"
              onMouseEnter={() => setLoginDropdown(true)}
              onMouseLeave={() => setLoginDropdown(false)}
            >
              <button
                className="nav-link dropdown-toggle login-btn"
                aria-haspopup="menu"
                aria-expanded={loginDropdown}
              >
                Login
              </button>
              {loginDropdown && (
                <div className="dropdown-menu" role="menu">
                  <Link to="/patient-login" className="dropdown-item" role="menuitem">Patient Login</Link>
                  <Link to="/staff-login" className="dropdown-item" role="menuitem">Staff Login</Link>
                </div>
              )}
            </div>

            <Link to="/patient-registration" className="nav-link cta-button">Book Appointment</Link>
          </div>
        )}
      </div>
    </nav>

    {showLogoutConfirm && (
      <div className="logout-modal-overlay" role="dialog" aria-modal="true" onClick={handleLogoutCancel}>
        <div className="logout-modal-card" onClick={(e) => e.stopPropagation()}>
          <h3>Log Out?</h3>
          <p>Are you sure you want to log out?</p>
          <div className="logout-modal-actions">
            <button type="button" className="logout-confirm-btn" onClick={handleLogoutConfirm}>
              Log Out
            </button>
            <button type="button" className="logout-cancel-btn" onClick={handleLogoutCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default Navbar;
