import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lookupLicense, type VetLicenseRecord } from "@/lib/vet-licenses-api";
import { createVetAccount } from "@/lib/vet-account-api";
import { US_STATE_OPTIONS } from "@/lib/us-states";
import { IdentityCapture } from "./IdentityCapture";

type Step = "details" | "identity" | "done";

export function VetSignupForm() {
  const { signUp, refreshRole } = useAuth();
  const [step, setStep] = useState<Step>("details");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [match, setMatch] = useState<VetLicenseRecord | null>(null);
  const [checked, setChecked] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    license_number: "",
    license_state: "",
    merchant_id: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const checkLicense = async () => {
    if (!form.license_number.trim() || !form.license_state) {
      toast.error("Enter your license number and state first");
      return;
    }
    setChecking(true);
    try {
      const rec = await lookupLicense(form.license_state, form.license_number);
      setMatch(rec);
      setChecked(true);
    } catch {
      setMatch(null);
      setChecked(true);
    } finally {
      setChecking(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signUp(form.email.trim(), form.password, `${form.first_name} ${form.last_name}`.trim());
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) {
        toast.success("Account created. Sign in to finish your identity photo.");
        return;
      }
      await createVetAccount(userId, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        license_number: form.license_number,
        license_state: form.license_state,
        merchant_id: form.merchant_id.trim(),
        license_record_id: match?.id ?? null,
        license_matched: !!match,
      });
      await refreshRole();
      setStep("identity");
    } catch (err) {
      toast.error((err as Error).message || "Could not create your account");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "identity") {
    return (
      <div className="space-y-4">
        <IdentityCapture onSubmitted={() => setStep("done")} />
      </div>
    );
  }

  if (step === "done") {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          <span className="font-medium">Account pending verification.</span> Our team manually
          reviews new veterinarian accounts within 24–72 hours. You can sign in now, but
          veterinarian tools stay locked until you are approved.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vetEmail">Email</Label>
        <Input
          id="vetEmail"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="you@clinic.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vetPassword">Password</Label>
        <div className="relative">
          <Input
            id="vetPassword"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="licenseNumber">License number</Label>
          <Input
            id="licenseNumber"
            value={form.license_number}
            onChange={(e) => { set("license_number", e.target.value); setChecked(false); setMatch(null); }}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="licenseState">License state</Label>
          <Select
            value={form.license_state}
            onValueChange={(v) => { set("license_state", v); setChecked(false); setMatch(null); }}
          >
            <SelectTrigger id="licenseState"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent className="max-h-64">
              {US_STATE_OPTIONS.map((s) => (
                <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={checkLicense} disabled={checking}>
        {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Check license database
      </Button>

      {checked && match && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Match found: <span className="font-medium">{match.full_name}</span> · {match.license_type} ·{" "}
            {match.license_status}
          </AlertDescription>
        </Alert>
      )}
      {checked && !match && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            We could not find this license in our imported state data yet. You can still continue —
            your account will be flagged for manual review.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="merchantId">Merchant ID</Label>
        <Input
          id="merchantId"
          value={form.merchant_id}
          onChange={(e) => set("merchant_id", e.target.value)}
          placeholder="e.g. 123456789012345"
          required
        />
        <p className="text-xs text-muted-foreground">
          Your Merchant ID is the identifier your clinic's card processor assigns you. It appears on
          your monthly processing statement or in your payment terminal's settings, and is often
          labelled "MID". Ask your practice manager or processor if you are unsure — we use it to
          route payments for approved tickets to your clinic.
        </p>
      </div>

      <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Continue to identity photo
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        New veterinarian accounts start as Pending Verification and are manually reviewed within
        24–72 hours.
      </p>
    </form>
  );
}
