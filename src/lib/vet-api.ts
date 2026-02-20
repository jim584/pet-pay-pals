import { supabase } from "@/integrations/supabase/client";

export interface VetProfile {
  id: string;
  user_id: string;
  clinic_name: string;
  specializations: string[];
  location: string | null;
  bio: string | null;
  phone: string | null;
  website: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface VetService {
  id: string;
  vet_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  pet_id: string;
  owner_id: string;
  vet_id: string;
  service_id: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
  created_at: string;
  pets?: { name: string; species: string };
  profiles?: { full_name: string };
  services?: { name: string; price: number } | null;
}

export async function fetchVetProfile(userId: string) {
  const { data, error } = await supabase
    .from("vet_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as VetProfile | null;
}

export async function createVetProfile(profile: Partial<VetProfile> & { user_id: string }) {
  const { data, error } = await supabase.from("vet_profiles").insert(profile).select().single();
  if (error) throw error;
  return data as VetProfile;
}

export async function updateVetProfile(id: string, updates: Partial<VetProfile>) {
  const { data, error } = await supabase.from("vet_profiles").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as VetProfile;
}

export async function fetchVetServices(vetId: string) {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("vet_id", vetId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as VetService[];
}

export async function createVetService(service: Omit<VetService, "id" | "created_at" | "is_active">) {
  const { data, error } = await supabase.from("services").insert(service).select().single();
  if (error) throw error;
  return data as VetService;
}

export async function updateVetService(id: string, updates: Partial<VetService>) {
  const { data, error } = await supabase.from("services").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as VetService;
}

export async function deleteVetService(id: string) {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchVetAppointments(vetProfileId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, pets(name, species), profiles:owner_id(full_name), services(name, price)")
    .eq("vet_id", vetProfileId)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return data as unknown as Appointment[];
}

export async function updateAppointmentStatus(id: string, status: string) {
  const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchAllVets() {
  const { data, error } = await supabase
    .from("vet_profiles")
    .select("*, profiles:user_id(full_name, avatar_url)")
    .eq("is_approved", true)
    .order("clinic_name");
  if (error) throw error;
  return data;
}

export async function createAppointment(appointment: {
  pet_id: string;
  owner_id: string;
  vet_id: string;
  service_id: string | null;
  scheduled_at: string;
  notes: string | null;
}) {
  const { data, error } = await supabase.from("appointments").insert(appointment).select().single();
  if (error) throw error;
  return data;
}

export async function fetchOwnerAppointments(ownerId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, pets(name, species), services(name, price), vet_profiles:vet_id(clinic_name)")
    .eq("owner_id", ownerId)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return data;
}
