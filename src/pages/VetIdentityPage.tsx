import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import logoColor from "@/assets/logo-color.png";
import { IdentityCapture } from "@/components/vet/IdentityCapture";

export default function VetIdentityPage() {
  const { token } = useParams();
  const [done, setDone] = useState(false);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <img src={logoColor} alt="Help A Pet" className="h-14 w-auto mx-auto" />
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Veterinarian identity photo</h1>
          <p className="text-sm text-muted-foreground">
            Take a live photo of yourself to finish activating your account.
          </p>
        </div>

        {done ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Photo received</AlertTitle>
            <AlertDescription>
              Our team reviews new veterinarian accounts within 24–72 hours. You can close this page.
            </AlertDescription>
          </Alert>
        ) : token ? (
          <IdentityCapture token={token} allowPhoneHandoff={false} onSubmitted={() => setDone(true)} />
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              This link is not valid. Request a new one from your Help A Pet dashboard.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
