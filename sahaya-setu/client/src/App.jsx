import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import CitizenPortal from './pages/CitizenPortal';
import DepartmentDashboard from './pages/DepartmentDashboard';
import FieldApp from './pages/FieldApp';
import DisasterDashboard from './pages/DisasterDashboard';
import SuperAdminAnalytics from './pages/SuperAdminAnalytics';
import PublicBoard from './pages/PublicBoard';
import './theme.css';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Navbar />
          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/citizen/*" element={<CitizenPortal />} />
              <Route path="/dashboard/*" element={<DepartmentDashboard />} />
              <Route path="/field/*" element={<FieldApp />} />
              <Route path="/disaster/*" element={<DisasterDashboard />} />
              <Route path="/analytics/*" element={<SuperAdminAnalytics />} />
              <Route path="/board/*" element={<PublicBoard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </SocketProvider>
    </AuthProvider>
  );
}
