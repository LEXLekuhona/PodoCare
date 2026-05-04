import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import { FaqPage } from './pages/catalog/FaqPage';
import { HealthConcernsPage } from './pages/catalog/HealthConcernsPage';
import { NetworksPage } from './pages/catalog/NetworksPage';
import { SpecialistsPage } from './pages/catalog/SpecialistsPage';
import { StaffPage } from './pages/catalog/StaffPage';
import { StudiosPage } from './pages/catalog/StudiosPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="catalog/networks" element={<NetworksPage />} />
            <Route path="catalog/studios" element={<StudiosPage />} />
            <Route path="catalog/specialists" element={<SpecialistsPage />} />
            <Route path="catalog/staff" element={<StaffPage />} />
            <Route path="catalog/health-concerns" element={<HealthConcernsPage />} />
            <Route path="catalog/faq" element={<FaqPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
