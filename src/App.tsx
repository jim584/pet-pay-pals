import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
