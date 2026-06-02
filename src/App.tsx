import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import InviteRegisterPage from './pages/auth/InviteRegisterPage';
import DashboardLayout from './components/layouts/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import ProfessionalsPage from './pages/dashboard/ProfessionalsPage';
import ServicesPage from './pages/dashboard/ServicesPage';
import CategoriesPage from './pages/dashboard/CategoriesPage';
import ClientsPage from './pages/dashboard/ClientsPage';
import AppointmentsPage from './pages/dashboard/AppointmentsPage';
import GoalsPage from './pages/dashboard/GoalsPage';
import ChecklistPage from './pages/dashboard/ChecklistPage';
import BillingPage from './pages/dashboard/BillingPage';
import MasterPanel from './pages/MasterPanel';
import OnboardingLayout from './components/layouts/OnboardingLayout';
import OnboardingTeam from './pages/onboarding/OnboardingTeam';
import OnboardingServices from './pages/onboarding/OnboardingServices';
import OnboardingGoals from './pages/onboarding/OnboardingGoals';
import OnboardingChecklist from './pages/onboarding/OnboardingChecklist';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            <Route path="checklist" element={<ChecklistPage />} />
            <Route path="assinatura" element={<BillingPage />} />
          </Route>

          <Route path="/master" element={<ProtectedRoute requireAdmin><MasterPanel /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster theme="dark" />
        <PWAInstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
