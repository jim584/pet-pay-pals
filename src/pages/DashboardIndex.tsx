import { useAuth } from "@/contexts/AuthContext";
import { VetDashboardHome } from "@/components/vet/VetDashboardHome";
import DashboardHomeOwner from "./DashboardHome";
import { VetVerificationGate } from "@/components/vet/VetVerificationGate";

export default function DashboardHome() {
  const { role } = useAuth();

  if (role === "vet") return (
    <VetVerificationGate>
      <VetDashboardHome />
    </VetVerificationGate>
  );
  return <DashboardHomeOwner />;
}
