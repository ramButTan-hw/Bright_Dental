import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import PatientRegistrationPage from './pages/PatientRegistrationPage';
import PatientLoginPage from './pages/PatientLoginPage';
import PatientPortalPage from './pages/PatientPortalPage';
import PatientInvoicesPage from './pages/PatientInvoicesPage';
import PatientInvoiceCheckoutPage from './pages/PatientInvoiceCheckoutPage';
import PatientNewAppointmentPage from './pages/PatientNewAppointmentPage';
import PatientSettingsPage from './pages/PatientSettingsPage';
import OurMotive from "./pages/OurMotive";
import Services from "./pages/Services";
import AdminDashboardPage from './pages/AdminDashboardPage';
import StaffLoginPage from './pages/StaffLoginPage';
import DentistLoginPage from './pages/DentistLoginPage';
import DentistProfilePage from './pages/DentistProfilePage';
import DentistPatientProfilePage from './pages/DentistPatientProfilePage';
import ReceptionistPage from './pages/ReceptionistPage';
import ReceptionistProfilePage from './pages/ReceptionistProfilePage';
import ReceptionistPatientProfilePage from './pages/ReceptionistPatientProfilePage';
import ReceptionistRecallPage from './pages/ReceptionistRecallPage';
import CreateAppointmentPage from './pages/CreateAppointmentPage';
import RegisterPatientPage from './pages/RegisterPatientPage';
import AssignAppointmentPage from './pages/AssignAppointmentPage';
import PatientDashboardPage from './pages/PatientDashboardPage';
import MeetOurStaffPage from './pages/MeetOurStaffPage';
import TestimoniesPage from './pages/testimonies';
import FAQPage from './pages/FAQPage';
import ContactUsPage from './pages/ContactUsPage';
import NotFoundPage from './pages/NotFoundPage';
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

  const staffRoutes = ['/staff-login', '/dentist-login', '/dentist-profile', '/receptionist', '/receptionist-profile', '/receptionist/patient-profile', '/admin'];
  const isStaffPage = staffRoutes.some((route) => location.pathname.startsWith(route));

  return (
    <div className="app-wrapper">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/department" element={<Services />} />
        <Route path="/meet-our-staff" element={<MeetOurStaffPage />} />
        <Route path="/testimonies" element={<TestimoniesPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/contact-us" element={<ContactUsPage />} />
        <Route path="/patient-registration" element={<PatientRegistrationPage />} />
        <Route path="/patient-login" element={<PatientLoginPage />} />
        <Route path="/patient-portal" element={<PatientPortalPage />} />
        <Route path="/our-motive" element={<OurMotive />} />
        <Route path="/patient-portal/settings" element={<PatientSettingsPage />} />
        <Route path="/patient-portal/new-appointment" element={<PatientNewAppointmentPage />} />
        <Route path="/patient-portal/dashboard" element={<PatientDashboardPage />} />
        <Route path="/patient-portal/invoices" element={<PatientInvoicesPage />} />
        <Route path="/patient-portal/invoices/:invoiceId/checkout" element={<PatientInvoiceCheckoutPage />} />
        <Route path="/staff-login" element={<StaffLoginPage />} />
        <Route path="/dentist-login" element={<DentistLoginPage />} />
        <Route path="/dentist-profile" element={<DentistProfilePage />} />
        <Route path="/dentist/patient/:appointmentId" element={<DentistPatientProfilePage />} />
        <Route
          path="/receptionist"
          element={
            <RequireStaff>
              <ReceptionistPage />
            </RequireStaff>
          }
        />
        <Route
          path="/receptionist-profile"
          element={
            <RequireStaff>
              <ReceptionistProfilePage />
            </RequireStaff>
          }
        />
        <Route
          path="/receptionist/recall"
          element={
            <RequireStaff>
              <ReceptionistRecallPage />
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
          path="/patient-dashboard/:patientId"
          element={
            <RequireStaff>
              <PatientDashboardPage />
            </RequireStaff>
          }
        />
        <Route
          path="/receptionist/patient-profile/:patientId"
          element={
            <RequireStaff>
              <ReceptionistPatientProfilePage />
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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isStaffPage && <Footer />}
    </div>
  );
}

export default App;
