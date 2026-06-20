import { Toaster } from "@/components/ui/toaster";

import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import RoleGuard from '@/components/RoleGuard';

// Public pages
import Home from '@/pages/Home';
import HowItWorks from '@/pages/HowItWorks';
import Guarantees from '@/pages/Guarantees';
import FAQPage from '@/pages/FAQPage';
import RegisterReferrer from '@/pages/RegisterReferrer';
import RefLanding from '@/pages/RefLanding';
import SecretCodeLogin from '@/pages/SecretCodeLogin';
import ResendCode from '@/pages/ResendCode';
import AdminBootstrap from '@/pages/AdminBootstrap';

// Dashboard (referrer)
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Overview from '@/pages/dashboard/Overview';
import MyLink from '@/pages/dashboard/MyLink';
import MyCandidates from '@/pages/dashboard/MyCandidates';
import MyRewards from '@/pages/dashboard/MyRewards';
import Payouts from '@/pages/dashboard/Payouts';
import Leaderboard from '@/pages/dashboard/Leaderboard';
import Security from '@/pages/dashboard/Security';

// Admin
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverview from '@/pages/admin/AdminOverview';
import AdminMasterLinks from '@/pages/admin/AdminMasterLinks';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminCandidates from '@/pages/admin/AdminCandidates';
import AdminRewards from '@/pages/admin/AdminRewards';
import AdminPayouts from '@/pages/admin/AdminPayouts';
import AdminAnalytics from '@/pages/admin/AdminAnalytics';
import AdminLogs from '@/pages/admin/AdminLogs';

// Moderator
import ModeratorLayout from '@/components/moderator/ModeratorLayout';
import ModeratorOverview from '@/pages/moderator/ModeratorOverview';
import ModeratorCandidates from '@/pages/moderator/ModeratorCandidates';
import ModeratorTasks from '@/pages/moderator/ModeratorTasks';

const AuthenticatedApp = () => {
  const { isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Only block hard errors — auth_required is normal since we use secret-code flow
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }
  // Ignore auth_required — our pages handle their own session-based auth

  return (
    <Routes>
      {/* Public — no auth required */}
      <Route path="/" element={<Home />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/guarantees" element={<Guarantees />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/register-referrer" element={<RegisterReferrer />} />
      <Route path="/ref/:code" element={<RefLanding />} />
      <Route path="/secret-login" element={<SecretCodeLogin />} />
      <Route path="/resend-code" element={<ResendCode />} />
      <Route path="/admin-bootstrap" element={<AdminBootstrap />} />

      {/* Legacy redirects */}
      <Route path="/login" element={<Navigate to="/secret-login" replace />} />
      <Route path="/register" element={<Navigate to="/register-referrer" replace />} />
      <Route path="/forgot-password" element={<Navigate to="/resend-code" replace />} />
      <Route path="/reset-password" element={<Navigate to="/secret-login" replace />} />

      {/* Referrer dashboard — guarded by role */}
      <Route path="/dashboard" element={<RoleGuard allowedRoles={["referrer"]}><DashboardLayout /></RoleGuard>}>
        <Route index element={<Overview />} />
        <Route path="link" element={<MyLink />} />
        <Route path="candidates" element={<MyCandidates />} />
        <Route path="rewards" element={<MyRewards />} />
        <Route path="payouts" element={<Payouts />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="security" element={<Security />} />
      </Route>

      {/* Admin panel — guarded by role */}
      <Route path="/admin" element={<RoleGuard allowedRoles={["admin", "super_admin"]}><AdminLayout /></RoleGuard>}>
        <Route index element={<AdminOverview />} />
        <Route path="master-links" element={<AdminMasterLinks />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="candidates" element={<AdminCandidates />} />
        <Route path="rewards" element={<AdminRewards />} />
        <Route path="payouts" element={<AdminPayouts />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="logs" element={<AdminLogs />} />
      </Route>

      {/* Moderator CRM — guarded by role */}
      <Route path="/moderator" element={<RoleGuard allowedRoles={["moderator"]}><ModeratorLayout /></RoleGuard>}>
        <Route index element={<ModeratorOverview />} />
        <Route path="candidates" element={<ModeratorCandidates />} />
        <Route path="tasks" element={<ModeratorTasks />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App