import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { PawPrint, Stethoscope } from "lucide-react";

export default function SelectRole() {
  const [selected, setSelected] = useState<"pet_owner" | "vet" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { selectRole } = useAuth();
  const navigate = useNavigate();

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await selectRole(selected);
      toast.success("Role selected!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Failed to set role");
    } finally {
      setSubmitting(false);
    }
  };

  const roles = [
    {
      id: "pet_owner" as const,
      label: "Pet Owner",
      description: "Manage your pets, book consultations, and track health records.",
      icon: PawPrint,
    },
    {
      id: "vet" as const,
      label: "Veterinarian",
      description: "List your services, manage appointments, and connect with pet owners.",
      icon: Stethoscope,
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Choose Your Role</h1>
          <p className="text-muted-foreground">Select how you'll use PetCare</p>
        </div>
        <div className="grid gap-4">
          {roles.map((r) => (
            <Card
              key={r.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selected === r.id
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:ring-1 hover:ring-primary/30"
              }`}
              onClick={() => setSelected(r.id)}
            >
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  selected === r.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                } transition-colors`}>
                  <r.icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg">{r.label}</CardTitle>
                  <CardDescription>{r.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
        <Button
          className="w-full h-12 text-base font-semibold"
          disabled={!selected || submitting}
          onClick={handleConfirm}
        >
          {submitting ? "Setting up..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
