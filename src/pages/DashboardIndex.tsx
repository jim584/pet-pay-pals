import { useAuth } from "@/contexts/AuthContext";
import { VetDashboardHome } from "@/components/vet/VetDashboardHome";
import DashboardHomeOwner from "./DashboardHome";

export default function DashboardHome() {
  const { role } = useAuth();

  if (role === "vet") return <VetDashboardHome />;
  return <DashboardHomeOwner />;
}
