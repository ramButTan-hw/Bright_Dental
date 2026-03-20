import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../utils/Sidebar';

const PortalLayout = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f9' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '220px' }}>
        <Outlet />
      </div>
    </div>
  );
};

export default PortalLayout;
