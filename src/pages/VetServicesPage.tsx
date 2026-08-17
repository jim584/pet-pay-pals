import { VetServicesPage as VetServicesComponent } from "@/components/vet/VetServicesPage";
import { VetVerificationGate } from "@/components/vet/VetVerificationGate";

export default function VetServicesPage() {
  return (
    <VetVerificationGate>
      <VetServicesComponent />
    </VetVerificationGate>
  );
}
