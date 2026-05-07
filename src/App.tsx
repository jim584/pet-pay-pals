import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MobileBottomNav } from "@/components/home/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SelectRole from "./pages/SelectRole";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardIndex from "./pages/DashboardIndex";
import PetsPage from "./pages/PetsPage";
import CommunityPage from "./pages/CommunityPage";
import WalletPage from "./pages/WalletPage";
import VetProfilePage from "./pages/VetProfilePage";
import VetServicesPage from "./pages/VetServicesPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import NotFound from "./pages/NotFound";
import PlaceholderSection from "./pages/PlaceholderSection";
import HelpForeverPage from "./pages/HelpForeverPage";
import HelpProtectPage from "./pages/HelpProtectPage";
import FearFreedPage from "./pages/FearFreedPage";
import VettedPage from "./pages/VettedPage";
import HelpBehavePage from "./pages/HelpBehavePage";
import HelpOvercomePage from "./pages/HelpOvercomePage";
import PlansPage from "./pages/PlansPage";
import VetTicketsPage from "./pages/VetTicketsPage";
import AdminVetTicketsPage from "./pages/AdminVetTicketsPage";
import VetCardPage from "./pages/VetCardPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminMembershipsPage from "./pages/admin/AdminMembershipsPage";
import AdminPlaceholder from "./pages/admin/AdminPlaceholder";
import AdminVetsPage from "./pages/admin/AdminVetsPage";
import AdminVetDetailPage from "./pages/admin/AdminVetDetailPage";
import AdminPaymentPlansPage from "./pages/admin/AdminPaymentPlansPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";

const queryClient = new QueryClient();

function AppRoutes() {
  const isMobile = useIsMobile();

  return (
    <>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/select-role" element={<SelectRole />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardIndex />} />
          <Route path="pets" element={<PetsPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="vet-profile" element={<VetProfilePage />} />
          <Route path="vet-services" element={<VetServicesPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
          <Route path="vet-tickets" element={<VetTicketsPage />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="vets" element={<AdminVetsPage />} />
          <Route path="vets/:vetProfileId" element={<AdminVetDetailPage />} />
          <Route path="vet-tickets" element={<AdminVetTicketsPage />} />
          <Route path="memberships" element={<AdminMembershipsPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="payment-plans" element={<AdminPaymentPlansPage />} />
          <Route path="reserve" element={<AdminPlaceholder title="Wallet & Reserve" />} />
        </Route>
        <Route path="/vet-tickets/:id/card" element={<VetCardPage />} />
        {/* Compass menu placeholder routes */}
        
        <Route path="/help-forever" element={<HelpForeverPage />} />
        <Route path="/four-feet-under" element={<PlaceholderSection title="Four Feet Under™" />} />
        <Route path="/fearfreed" element={<FearFreedPage />} />
        <Route path="/help-overcome" element={<HelpOvercomePage />} />
        <Route path="/help-protect" element={<HelpProtectPage />} />
        <Route path="/help-behave" element={<HelpBehavePage />} />
        <Route path="/vetted" element={<VettedPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {isMobile && <MobileBottomNav />}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
