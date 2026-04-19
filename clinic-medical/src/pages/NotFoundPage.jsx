import { Link } from 'react-router-dom';
import '../styles/PatientPortalPage.css';

function NotFoundPage() {
  return (
    <main className="patient-portal-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7faf9' }}>
      <div style={{ textAlign: 'center', background: '#fff', padding: '3rem 2.5rem', borderRadius: '18px', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
        <h1 style={{ fontSize: '3.5rem', color: '#005050', marginBottom: '0.5rem', fontWeight: 900 }}>404</h1>
        <h2 style={{ fontSize: '1.5rem', color: '#181c1c', marginBottom: '1.5rem', fontWeight: 700 }}>Page Not Found</h2>
        <p style={{ color: '#3e4948', marginBottom: '2.5rem', fontSize: '1.1rem' }}>
          Sorry, the page you are looking for does not exist.<br />
          You may have mistyped the address or the page may have moved.
        </p>
        <Link to="/" className="portal-primary-btn" style={{ fontSize: '1.1rem', padding: '0.7rem 2.2rem' }}>
          Go to Home
        </Link>
      </div>
    </main>
  );
}

export default NotFoundPage;
