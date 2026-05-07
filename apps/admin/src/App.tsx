import { UserRole } from '@srs/shared-types';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import { FaqPage } from './pages/catalog/FaqPage';
import { HealthConcernsPage } from './pages/catalog/HealthConcernsPage';
import { NetworksPage } from './pages/catalog/NetworksPage';
import { ProductsPage } from './pages/catalog/ProductsPage';
import { ServicesPage } from './pages/catalog/ServicesPage';
import { SpecialistsPage } from './pages/catalog/SpecialistsPage';
import { StaffPage } from './pages/catalog/StaffPage';
import { StudioDirectionsPage } from './pages/catalog/StudioDirectionsPage';
import { StudiosPage } from './pages/catalog/StudiosPage';
import { DashboardPage } from './pages/DashboardPage';
import { ContentFunnelPage } from './pages/education/ContentFunnelPage';
import { QuizPage } from './pages/education/QuizPage';
import { LoginPage } from './pages/LoginPage';
import { TreatmentFlowPage } from './pages/operations/TreatmentFlowPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleProtectedRoute } from './routes/RoleProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route element={<RoleProtectedRoute allow={[UserRole.SuperAdmin, UserRole.NetworkOwner]} />}>
              <Route path="catalog/networks" element={<NetworksPage />} />
              <Route path="catalog/studios" element={<StudiosPage />} />
              <Route path="catalog/health-concerns" element={<HealthConcernsPage />} />
              <Route path="catalog/studio-directions" element={<StudioDirectionsPage />} />
              <Route path="catalog/faq" element={<FaqPage />} />
            </Route>
            <Route element={<RoleProtectedRoute allow={[UserRole.SuperAdmin, UserRole.NetworkOwner, UserRole.StudioAdmin]} />}>
              <Route path="catalog/services" element={<ServicesPage />} />
              <Route path="catalog/products" element={<ProductsPage />} />
              <Route path="catalog/specialists" element={<SpecialistsPage />} />
            </Route>
            <Route path="catalog/content" element={<Navigate to="/education/content" replace />} />
            <Route path="catalog/quiz" element={<Navigate to="/education/quiz" replace />} />
            <Route path="education" element={<Navigate to="/education/content" replace />} />
            <Route
              element={
                <RoleProtectedRoute allow={[UserRole.SuperAdmin, UserRole.NetworkOwner, UserRole.StudioAdmin]} />
              }
            >
              <Route path="catalog/staff" element={<StaffPage />} />
              <Route path="education/content" element={<ContentFunnelPage />} />
              <Route path="education/quiz" element={<QuizPage />} />
              <Route path="operations/treatment-flow" element={<TreatmentFlowPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
