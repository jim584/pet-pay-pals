import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AttestationForm } from "@/components/vet-tickets/AttestationForm";
import { emptyAttestation, type AttestationValues } from "@/lib/attestation-schema";
import { getAttestationByToken, submitAttestation } from "@/lib/attestation-api";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

export default function AttestationPublicPage() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [values, setValues] = useState<AttestationValues>(emptyAttestation());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAttestationByToken(token);
        setMemberName(res.member_name);
        setValues((v) => ({ ...v, ...(res.prefill as Partial<AttestationValues>) }));
      } catch (e: any) {
        setError(e.message || "This link is not valid");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await submitAttestation({ values, token });
      setDone(true);
    } catch (e: any) {
      toast({ title: "Couldn't submit the attestation", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="text-center">
          <h1 className="text-2xl font-bold">Help A Pet — Veterinarian Attestation</h1>
          {memberName && (
            <p className="text-sm text-muted-foreground mt-1">Requested by {memberName}</p>
          )}
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {done ? "Attestation received" : error ? "Link unavailable" : "Complete and sign the form"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the form…
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 text-sm text-destructive py-6">
                <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
              </div>
            ) : done ? (
              <div className="flex items-start gap-2 text-sm py-6">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary" />
                Thank you. The signed attestation has been returned to Help A Pet and attached to the
                member's request. You may close this page.
              </div>
            ) : (
              <>
                <AttestationForm value={values} onChange={setValues} />
                <div className="pt-5">
                  <Button className="w-full" onClick={submit} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Sign and submit
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
