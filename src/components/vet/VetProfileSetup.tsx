import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { fetchVetProfile, createVetProfile, updateVetProfile, VetProfile } from "@/lib/vet-api";
import { Stethoscope, MapPin, Phone, Globe, CheckCircle, Clock, X } from "lucide-react";

export function VetProfileSetup() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<VetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [specInput, setSpecInput] = useState("");
  const [form, setForm] = useState({
    clinic_name: "",
    location: "",
    bio: "",
    phone: "",
    website: "",
    specializations: [] as string[],
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
      };
      if (profile) {
        const updated = await updateVetProfile(profile.id, payload);
        setProfile(updated);
        toast.success("Profile updated!");
      } else {
        const created = await createVetProfile({ ...payload, user_id: user.id });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Vet Profile</h1>
          <p className="text-muted-foreground mt-1">Set up your clinic information</p>
        </div>
        {profile && (
          <Badge variant={profile.is_approved ? "default" : "secondary"} className="gap-1">
            {profile.is_approved ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {profile.is_approved ? "Approved" : "Pending Approval"}
          </Badge>
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
    </div>
  );
}
