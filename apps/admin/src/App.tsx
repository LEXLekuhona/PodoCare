import { UserRole } from '@srs/shared-types';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import { canManageStaff, canMutateTenantCatalog, canUseClinicalOperations } from './lib/roles';
import { CalendarPage } from './pages/CalendarPage';
import { FaqPage } from './pages/catalog/FaqPage';
import { HealthConcernsPage } from './pages/catalog/HealthConcernsPage';
import { NetworksPage } from './pages/catalog/NetworksPage';
import { ProductsPage } from './pages/catalog/ProductsPage';
import { ServicesPage } from './pages/catalog/ServicesPage';
import { SpecialistsPage } from './pages/catalog/SpecialistsPage';
import { StaffPage } from './pages/catalog/StaffPage';
import { StudioDirectionsPage } from './pages/catalog/StudioDirectionsPage';
import { StudiosPage } from './pages/catalog/StudiosPage';
import { ContentFunnelPage } from './pages/education/ContentFunnelPage';
import { QuizPage } from './pages/education/QuizPage';
import { LoginPage } from './pages/LoginPage';
import { NextAppointmentPage } from './pages/operations/NextAppointmentPage';
import { TreatmentFlowPage } from './pages/operations/TreatmentFlowPage';
import { VisitPaymentPage } from './pages/operations/VisitPaymentPage';
import { WalkInClientPage } from './pages/operations/WalkInClientPage';
import { AcquiringTerminalsPage } from './pages/settings/AcquiringTerminalsPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleProtectedRoute } from './routes/RoleProtectedRoute';

function DefaultLanding() {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (canUseClinicalOperations(user.role)) {
    return <Navigate to="/calendar" replace />;
  }
  if (canMutateTenantCatalog(user.role)) {
    return <Navigate to="/catalog/networks" replace />;
  }
  if (canManageStaff(user.role)) {
    return <Navigate to="/catalog/services" replace />;
  }
  return <Navigate to="/education/content" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DefaultLanding />} />
            <Route element={<RoleProtectedRoute allow={[UserRole.SuperAdmin]} />}>
              <Route path="settings/acquiring-terminals" element={<AcquiringTerminalsPage />} />
            </Route>
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
                <RoleProtectedRoute
                  allow={[
                    UserRole.SuperAdmin,
                    UserRole.NetworkOwner,
                    UserRole.StudioAdmin,
                    UserRole.Specialist,
                  ]}
                />
              }
            >
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="operations/treatment-flow" element={<TreatmentFlowPage />} />
              <Route path="operations/visit-payment" element={<VisitPaymentPage />} />
              <Route path="operations/next-appointment" element={<NextAppointmentPage />} />
              <Route path="operations/walk-in-client" element={<WalkInClientPage />} />
            </Route>
            <Route
              element={
                <RoleProtectedRoute allow={[UserRole.SuperAdmin, UserRole.NetworkOwner, UserRole.StudioAdmin]} />
              }
            >
              <Route path="catalog/staff" element={<StaffPage />} />
              <Route path="education/content" element={<ContentFunnelPage />} />
              <Route path="education/quiz" element={<QuizPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
