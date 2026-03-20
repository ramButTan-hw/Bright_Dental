import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import './index.css';

import PublicLayout   from './layouts/PublicLayout';
import PortalLayout   from './layouts/PortalLayout';
import Login          from './routes/Login';
import Dashboard      from './routes/Dashboard';
import Patients       from './routes/Patients';
import Appointments   from './routes/Appointments';
import Doctors        from './routes/Doctors';
import Staff          from './routes/Staff';
import Invoices       from './routes/Invoices';
import LabOrders             from './routes/LabOrders';
import Locations             from './routes/Locations';
import PatientAppointments   from './routes/PatientAppointments';
import PatientPayments       from './routes/PatientPayments';
import DentalAssistantVitals from './routes/DentalAssistantVitals';

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/',       element: <Login /> },
      { path: '/login',  element: <Login /> },
    ],
  },
  {
    path: '/portal',
    element: <PortalLayout />,
    children: [
      { path: 'dashboard',    element: <Dashboard /> },
      { path: 'patients',     element: <Patients /> },
      { path: 'appointments', element: <Appointments /> },
      { path: 'doctors',      element: <Doctors /> },
      { path: 'staff',        element: <Staff /> },
      { path: 'invoices',     element: <Invoices /> },
      { path: 'lab-orders',        element: <LabOrders /> },
      { path: 'locations',         element: <Locations /> },
      { path: 'vitals',            element: <DentalAssistantVitals /> },
      { path: 'my-appointments',   element: <PatientAppointments /> },
      { path: 'my-payments',       element: <PatientPayments /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
