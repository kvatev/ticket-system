import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import InstallPWA from "@/components/InstallPWA";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import TicketListPage from "@/pages/TicketListPage";
import CreateTicketPage from "@/pages/CreateTicketPage";
import TicketDetailPage from "@/pages/TicketDetailPage";
import UsersManagementPage from "@/pages/admin/UsersManagementPage";
import DepartmentsManagementPage from "@/pages/admin/DepartmentsManagementPage";
import ReportsPage from "@/pages/admin/ReportsPage";
import RolesManagementPage from "@/pages/admin/RolesManagementPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import AnnouncementsPage from "@/pages/admin/AnnouncementsPage";
import AuditLogPage from "@/pages/admin/AuditLogPage";
import AnnouncementsListPage from "@/pages/AnnouncementsListPage";
import ProfilePage from "@/pages/ProfilePage";
import OrdersListPage from "@/pages/OrdersListPage";
import CreateOrderPage from "@/pages/CreateOrderPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import ChannelsListPage from "@/pages/ChannelsListPage";
import ChannelDetailPage from "@/pages/ChannelDetailPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <InstallPWA />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginRedirect />} />
            <Route
              element={
                <AuthRedirect>
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                </AuthRedirect>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/tickets" element={<TicketListPage />} />
              <Route path="/tickets/assigned" element={<TicketListPage mode="assigned" />} />
              <Route path="/tickets/department" element={<TicketListPage mode="department" />} />
              <Route path="/tickets/new" element={<CreateTicketPage />} />
              <Route path="/tickets/:id" element={<TicketDetailPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/announcements" element={<AnnouncementsListPage />} />
              <Route path="/admin/users" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <UsersManagementPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/departments" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <DepartmentsManagementPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/reports" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ReportsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/roles" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <RolesManagementPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/settings" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/announcements" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AnnouncementsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/audit-log" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AuditLogPage />
                </ProtectedRoute>
              } />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
