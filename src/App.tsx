import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';

import PublicHomePage from './pages/PublicHomePage';
import PricingPage from './pages/PricingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import InviteRegisterPage from './pages/auth/InviteRegisterPage';
import ActivationPage from './pages/auth/ActivationPage';
import WaitingPaymentPage from './pages/auth/WaitingPaymentPage';
import PreparingEnvironmentPage from './pages/auth/PreparingEnvironmentPage';
import DashboardLayout from './components/layouts/DashboardLayout';
import OnboardingLayout from './components/layouts/OnboardingLayout';

import DashboardHome from './pages/dashboard/DashboardHome';
const ProfessionalsPage = React.lazy(() => import('./pages/dashboard/ProfessionalsPage'));
const ServicesPage = React.lazy(() => import('./pages/dashboard/ServicesPage'));
const CategoriesPage = React.lazy(() => import('./pages/dashboard/CategoriesPage'));
const ClientsPage = React.lazy(() => import('./pages/dashboard/ClientsPage'));
const AppointmentsPage = React.lazy(() => import('./pages/dashboard/AppointmentsPage'));
const GoalsPage = React.lazy(() => import('./pages/dashboard/GoalsPage'));
const ChecklistPage = React.lazy(() => import('./pages/dashboard/ChecklistPage'));
const CommissionsPage = React.lazy(() => import('./pages/dashboard/CommissionsPage'));
const AccountPage = React.lazy(() => import('./pages/dashboard/AccountPage'));
const ReportsPage = React.lazy(() => import('./pages/dashboard/ReportsPage'));
const SubscriptionPage = React.lazy(() => import('./pages/dashboard/SubscriptionCenterPage'));
const BillingCustomerPage = React.lazy(() => import('./pages/dashboard/BillingCustomerPage'));
const FinancialPage = React.lazy(() => import('./pages/dashboard/FinancialPage'));
const InventoryPage = React.lazy(() => import('./pages/dashboard/InventoryPage'));
const PricingCalculatorPage = React.lazy(() => import('./pages/dashboard/PricingCalculatorPage'));
const GamificationPage = React.lazy(() => import('./pages/dashboard/GamificationPage'));
const MasterPanel = React.lazy(() => import('./pages/MasterPanel'));
const OnboardingTeam = React.lazy(() => import('./pages/onboarding/OnboardingTeam'));
const OnboardingServices = React.lazy(() => import('./pages/onboarding/OnboardingServices'));
const OnboardingGoals = React.lazy(() => import('./pages/onboarding/OnboardingGoals'));
const OnboardingChecklist = React.lazy(() => import('./pages/onboarding/OnboardingChecklist'));
const BookingPage = React.lazy(() => import('./pages/booking/BookingPage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-neutral-950">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37] mb-4" />
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
            <Route path="/" element={<PublicHomePage />} />
            <Route path="/planos" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route path="/cadastro-profissional" element={<InviteRegisterPage />} />
            <Route path="/ativar-conta" element={<ActivationPage />} />
            <Route path="/aguardando-pagamento" element={<ProtectedRoute><WaitingPaymentPage /></ProtectedRoute>} />
            <Route path="/preparando-ambiente" element={<PreparingEnvironmentPage />} />
            <Route path="/agendar/:salonSlug" element={<BookingPage />} />
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
              <Route path="crm" element={<ClientsPage />} />
              <Route path="agendamentos" element={<AppointmentsPage />} />
              <Route path="metas" element={<GoalsPage />} />
              <Route path="comissoes" element={<CommissionsPage />} />
              <Route path="gamificacao" element={<GamificationPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="minha-conta" element={<AccountPage />} />
              <Route path="checklist" element={<ChecklistPage />} />
              <Route path="assinatura" element={<SubscriptionPage />} />
              <Route path="dados-faturamento" element={<BillingCustomerPage />} />
              <Route path="financeiro" element={<FinancialPage />} />
              <Route path="estoque" element={<InventoryPage />} />
              <Route path="precificacao" element={<PricingCalculatorPage />} />
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
