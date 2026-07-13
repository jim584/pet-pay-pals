import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { fetchVetProfile, createVetProfile, updateVetProfile, triggerVetVerification, VetProfile } from "@/lib/vet-api";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stethoscope, MapPin, Phone, Globe, CheckCircle, Clock, X, FileText, ShieldCheck, Upload, AlertCircle } from "lucide-react";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export function VetProfileSetup() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<VetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [specInput, setSpecInput] = useState("");
  const licenseInputRef = useRef<HTMLInputElement>(null);
  const ffInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<null | "license" | "ff">(null);
  const [form, setForm] = useState({
    clinic_name: "",
    location: "",
    bio: "",
    phone: "",
    website: "",
    specializations: [] as string[],
    license_number: "",
    license_state: "",
    fear_free_cert_number: "",
  });

  useEffect(() => {
    if (!user) return;
    fetchVetProfile(user.id).then((p) => {
      setProfile(p);
      if (p) {
        setForm({
          clinic_name: p.clinic_name,
          location: p.location || "",
          bio: p.bio || "",
          phone: p.phone || "",
          website: p.website || "",
          specializations: p.specializations || [],
          license_number: p.license_number || "",
          license_state: p.license_state || "",
          fear_free_cert_number: p.fear_free_cert_number || "",
        });
      }
      setLoading(false);
    });
  }, [user]);

  const addSpec = () => {
    if (specInput.trim() && !form.specializations.includes(specInput.trim())) {
      setForm({ ...form, specializations: [...form.specializations, specInput.trim()] });
      setSpecInput("");
    }
  };

  const removeSpec = (s: string) => {
    setForm({ ...form, specializations: form.specializations.filter((x) => x !== s) });
  };

  const uploadCredential = async (
    file: File,
    kind: "license" | "ff",
  ) => {
    if (!user) return;
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("vet-credentials")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const field = kind === "license" ? "license_document_url" : "fear_free_cert_url";
      // Persist the path; we'll create signed URLs on demand for display.
      if (profile) {
        const updated = await updateVetProfile(profile.id, { [field]: path } as any);
        setProfile(updated);
      } else {
        toast.message("Save your profile first, then upload credentials.");
      }
      toast.success("Document uploaded. Awaiting admin verification.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        clinic_name: form.clinic_name,
        location: form.location || null,
        bio: form.bio || null,
        phone: form.phone || null,
        website: form.website || null,
        specializations: form.specializations,
        license_number: form.license_number || null,
        license_state: form.license_state || null,
        fear_free_cert_number: form.fear_free_cert_number || null,
      };
      if (profile) {
        const updated = await updateVetProfile(profile.id, payload as any);
        setProfile(updated);
        toast.success("Profile updated!");
      } else {
        const created = await createVetProfile({ ...payload, user_id: user.id } as any);
        setProfile(created);
        toast.success("Vet profile created! Awaiting admin approval.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold font-display">Vet Profile</h1>
          <p className="text-muted-foreground mt-1">Set up your clinic information & credentials</p>
        </div>
        {profile && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant={profile.is_approved ? "default" : "secondary"} className="gap-1">
              {profile.is_approved ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              Clinic: {profile.is_approved ? "Approved" : "Pending"}
            </Badge>
            <Badge variant={profile.is_license_verified ? "default" : "outline"} className="gap-1">
              <FileText className="h-3 w-3" />
              License: {profile.is_license_verified ? "Verified" : "Unverified"}
            </Badge>
            <Badge variant={profile.fear_free_certified ? "default" : "outline"} className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Fear Free: {profile.fear_free_certified ? "Verified" : "Not verified"}
            </Badge>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Clinic Name *</Label>
            <Input value={form.clinic_name} onChange={(e) => setForm({ ...form, clinic_name: e.target.value })} placeholder="Happy Paws Veterinary" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="123 Main St, City" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0123" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Globe className="h-3 w-3" /> Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Tell pet owners about your practice..." />
          </div>
          <div className="space-y-2">
            <Label>Specializations</Label>
            <div className="flex gap-2">
              <Input value={specInput} onChange={(e) => setSpecInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSpec())} placeholder="e.g. Surgery, Dermatology" />
              <Button type="button" variant="outline" onClick={addSpec}>Add</Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {form.specializations.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeSpec(s)}>
                  {s} <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !form.clinic_name} className="w-full">
            {saving ? "Saving..." : profile ? "Update Profile" : "Create Profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Veterinary License</CardTitle>
          <CardDescription>
            Required for clinic verification. An admin will review your document.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>License number</Label>
              <Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} placeholder="VET-12345" />
            </div>
            <div className="space-y-2">
              <Label>State / region</Label>
              <Input value={form.license_state} onChange={(e) => setForm({ ...form, license_state: e.target.value })} placeholder="CA" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={licenseInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadCredential(f, "license");
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => licenseInputRef.current?.click()}
              disabled={!profile || uploading === "license"}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading === "license" ? "Uploading…" : profile?.license_document_url ? "Replace document" : "Upload document"}
            </Button>
            {profile?.license_document_url && (
              <span className="text-xs text-muted-foreground">Document on file</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Fear Free Certification</CardTitle>
          <CardDescription>
            Optional. When verified, your clients with you set as Vet of Record qualify for a 5% Fear Free membership discount.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Certification number</Label>
            <Input value={form.fear_free_cert_number} onChange={(e) => setForm({ ...form, fear_free_cert_number: e.target.value })} placeholder="FF-XXXXXX" />
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={ffInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadCredential(f, "ff");
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => ffInputRef.current?.click()}
              disabled={!profile || uploading === "ff"}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading === "ff" ? "Uploading…" : profile?.fear_free_cert_url ? "Replace certificate" : "Upload certificate"}
            </Button>
            {profile?.fear_free_cert_url && (
              <span className="text-xs text-muted-foreground">Certificate on file</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
