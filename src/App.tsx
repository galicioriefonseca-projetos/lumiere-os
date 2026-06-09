import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';

// Lightweight pages (loaded immediately)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import InviteRegisterPage from './pages/auth/InviteRegisterPage';
import DashboardLayout from './components/layouts/DashboardLayout';
import OnboardingLayout from './components/layouts/OnboardingLayout';

// Heavy pages (lazy loaded)
const DashboardHome = React.lazy(() => import('./pages/dashboard/DashboardHome'));
const ProfessionalsPage = React.lazy(() => import('./pages/dashboard/ProfessionalsPage'));
const ServicesPage = React.lazy(() => import('./pages/dashboard/ServicesPage'));
const CategoriesPage = React.lazy(() => import('./pages/dashboard/CategoriesPage'));
const ClientsPage = React.lazy(() => import('./pages/dashboard/ClientsPage'));
const AppointmentsPage = React.lazy(() => import('./pages/dashboard/AppointmentsPage'));
const GoalsPage = React.lazy(() => import('./pages/dashboard/GoalsPage'));
const ChecklistPage = React.lazy(() => import('./pages/dashboard/ChecklistPage'));
const BillingPage = React.lazy(() => import('./pages/dashboard/BillingPage'));
const CommissionsPage = React.lazy(() => import('./pages/dashboard/CommissionsPage'));
const AccountPage = React.lazy(() => import('./pages/dashboard/AccountPage'));
const ReportsPage = React.lazy(() => import('./pages/dashboard/ReportsPage'));
const MasterPanel = React.lazy(() => import('./pages/MasterPanel'));
const OnboardingTeam = React.lazy(() => import('./pages/onboarding/OnboardingTeam'));
const OnboardingServices = React.lazy(() => import('./pages/onboarding/OnboardingServices'));
const OnboardingGoals = React.lazy(() => import('./pages/onboarding/OnboardingGoals'));
const OnboardingChecklist = React.lazy(() => import('./pages/onboarding/OnboardingChecklist'));

// Suspense fallback spinner
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-950">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37] mb-4"></div>
      <p className="text-neutral-400 text-sm">Carregando...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route path="/cadastro-profissional" element={<InviteRegisterPage />} />
            
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingLayout /></ProtectedRoute>}>
              <Route path="equipe" element={<OnboardingTeam />} />
              <Route path="servicos" element={<OnboardingServices />} />
              <Route path="metas" element={<OnboardingGoals />} />
              <Route path="checklist" element={<OnboardingChecklist />} />
              <Route index element={<Navigate to="equipe" replace />} />
            </Route>

            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<DashboardHome />} />
              <Route path="profissional" element={<DashboardHome />} />
              <Route path="meu-painel" element={<DashboardHome />} />
              <Route path="equipe" element={<ProfessionalsPage />} />
              <Route path="servicos" element={<ServicesPage />} />
              <Route path="categorias" element={<CategoriesPage />} />
              <Route path="clientes" element={<ClientsPage />} />
              <Route path="agendamentos" element={<AppointmentsPage />} />
              <Route path="metas" element={<GoalsPage />} />
              <Route path="comissoes" element={<CommissionsPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="minha-conta" element={<AccountPage />} />
              <Route path="checklist" element={<ChecklistPage />} />
              <Route path="assinatura" element={<BillingPage />} />
            </Route>

            <Route path="/master" element={<ProtectedRoute requireAdmin><MasterPanel /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster theme="dark" />
        <PWAInstallPrompt />
        <OfflineIndicator />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
