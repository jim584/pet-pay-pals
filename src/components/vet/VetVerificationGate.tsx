import { ReactNode, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldAlert, ShieldX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchVetAccount, type VetAccountInfo } from "@/lib/vet-account-api";
import { IdentityCapture } from "./IdentityCapture";

/**
 * Blocks every veterinarian tool until the account has been manually verified.
 * Server-side RLS enforces the same rule; this is the friendly surface for it.
 */
export function VetVerificationGate({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [account, setAccount] = useState<VetAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!user) return;
    fetchVetAccount(user.id)
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (role !== "vet") return <>{children}</>;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!account || account.account_status === "verified") return <>{children}</>;

  if (account.account_status === "rejected") {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <ShieldX className="h-4 w-4" />
            <AlertTitle>Account not approved</AlertTitle>
            <AlertDescription>
              {account.account_rejection_reason ||
                "We could not verify your veterinary credentials. Contact support to review your account."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Pending verification</AlertTitle>
        <AlertDescription>
          Veterinarian tools unlock after our team manually reviews your license and identity photo.
          Reviews are completed within 24–72 hours.
          {!account.identity_photo_path && " We still need your live identity photo below."}
        </AlertDescription>
      </Alert>
      {!account.identity_photo_path && <IdentityCapture onSubmitted={load} />}
      {account.identity_photo_path && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Identity photo received
            {account.identity_photo_captured_at
              ? ` on ${new Date(account.identity_photo_captured_at).toLocaleString()}`
              : ""}
            . Nothing else is needed from you right now.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
