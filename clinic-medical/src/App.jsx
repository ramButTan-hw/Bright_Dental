import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import PatientRegistrationPage from './pages/PatientRegistrationPage';
import PatientLoginPage from './pages/PatientLoginPage';
import PatientPortalPage from './pages/PatientPortalPage';
import PatientInvoicesPage from './pages/PatientInvoicesPage';
import PatientInvoiceCheckoutPage from './pages/PatientInvoiceCheckoutPage';
import PatientNewAppointmentPage from './pages/PatientNewAppointmentPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import StaffLoginPage from './pages/StaffLoginPage';
import DentistLoginPage from './pages/DentistLoginPage';
import DentistProfilePage from './pages/DentistProfilePage';
import ReceptionistPage from './pages/ReceptionistPage';
import CreateAppointmentPage from './pages/CreateAppointmentPage';
import RegisterPatientPage from './pages/RegisterPatientPage';
import PatientProfilePage from './pages/PatientProfilePage';
import AssignAppointmentPage from './pages/AssignAppointmentPage';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getAdminPortalSession, getReceptionPortalSession } from './utils/patientPortal';
import './App.css';

function RequireAdmin({ children }) {
  const adminSession = getAdminPortalSession();
  if (!adminSession?.isAdmin) {
    return <Navigate to="/staff-login" replace />;
  }
  return children;
}

function RequireStaff({ children }) {
  const staffSession = getReceptionPortalSession();
  if (!staffSession?.staffId) {
    return <Navigate to="/staff-login" replace />;
  }
  return children;
}

function App() {
  const location = useLocation();

  const staffRoutes = ['/staff-login', '/dentist-login', '/dentist-profile', '/receptionist', '/admin'];
  const isStaffPage = staffRoutes.some((route) => location.pathname.startsWith(route));

  return (
    <div className="app-wrapper">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/patient-registration" element={<PatientRegistrationPage />} />
        <Route path="/patient-login" element={<PatientLoginPage />} />
        <Route path="/patient-portal" element={<PatientPortalPage />} />
        <Route path="/patient-portal/new-appointment" element={<PatientNewAppointmentPage />} />
        <Route path="/patient-portal/invoices" element={<PatientInvoicesPage />} />
        <Route path="/patient-portal/invoices/:invoiceId/checkout" element={<PatientInvoiceCheckoutPage />} />
        <Route path="/staff-login" element={<StaffLoginPage />} />
        <Route path="/dentist-login" element={<DentistLoginPage />} />
        <Route path="/dentist-profile" element={<DentistProfilePage />} />
        <Route
          path="/receptionist"
          element={
            <RequireStaff>
              <ReceptionistPage />
            </RequireStaff>
          }
        />
        <Route
          path="/receptionist/create-appointment"
          element={
            <RequireStaff>
              <CreateAppointmentPage />
            </RequireStaff>
          }
        />
        <Route
          path="/receptionist/register-patient"
          element={
            <RequireStaff>
              <RegisterPatientPage />
            </RequireStaff>
          }
        />
        <Route
          path="/receptionist/patient-profile/:patientId"
          element={
            <RequireStaff>
              <PatientProfilePage />
            </RequireStaff>
          }
        />
        <Route
          path="/receptionist/assign-appointment/:requestId"
          element={
            <RequireStaff>
              <AssignAppointmentPage />
            </RequireStaff>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
      </Routes>
      {!isStaffPage && <Footer />}
    </div>
  );
}

export default App;
