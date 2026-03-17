import { supabase } from "@/integrations/supabase/client";

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  breed: string | null;
  species: string;
  age_years: number | null;
  date_of_birth: string | null;
  weight_kg: number | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function calculateAge(dob: string): { years: number; months: number } {
  const birth = new Date(dob);
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return { years, months };
}

export function formatAge(pet: Pet): string {
  if (pet.date_of_birth) {
    const { years, months } = calculateAge(pet.date_of_birth);
    if (years === 0) return `${months} mo${months !== 1 ? "s" : ""}`;
    return `${years} yr${years !== 1 ? "s" : ""}, ${months} mo${months !== 1 ? "s" : ""}`;
  }
  if (pet.age_years != null) return `${pet.age_years} yr${pet.age_years !== 1 ? "s" : ""}`;
  return "—";
}

export interface HealthRecord {
  id: string;
  pet_id: string;
  record_type: string;
  title: string;
  description: string | null;
  record_date: string;
  vet_name: string | null;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  pet_id: string;
  contact_name: string;
  phone: string;
  relationship: string | null;
  created_at: string;
}

export async function fetchPets() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Pet[];
}

export async function createPet(pet: Omit<Pet, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase.from("pets").insert(pet).select().single();
  if (error) throw error;
  return data as Pet;
}

export async function updatePet(id: string, updates: Partial<Pet>) {
  const { data, error } = await supabase.from("pets").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as Pet;
}

export async function deletePet(id: string) {
  const { error } = await supabase.from("pets").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchHealthRecords(petId: string) {
  const { data, error } = await supabase
    .from("health_records")
    .select("*")
    .eq("pet_id", petId)
    .order("record_date", { ascending: false });
  if (error) throw error;
  return data as HealthRecord[];
}

export async function createHealthRecord(record: Omit<HealthRecord, "id" | "created_at">) {
  const { data, error } = await supabase.from("health_records").insert(record).select().single();
  if (error) throw error;
  return data as HealthRecord;
}

export async function updateHealthRecord(id: string, updates: Partial<HealthRecord>) {
  const { data, error } = await supabase.from("health_records").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as HealthRecord;
}

export async function deleteHealthRecord(id: string) {
  const { error } = await supabase.from("health_records").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchEmergencyContacts(petId: string) {
  const { data, error } = await supabase
    .from("emergency_contacts")
    .select("*")
    .eq("pet_id", petId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as EmergencyContact[];
}

export async function createEmergencyContact(contact: Omit<EmergencyContact, "id" | "created_at">) {
  const { data, error } = await supabase.from("emergency_contacts").insert(contact).select().single();
  if (error) throw error;
  return data as EmergencyContact;
}

export async function updateEmergencyContact(id: string, updates: Partial<EmergencyContact>) {
  const { data, error } = await supabase.from("emergency_contacts").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as EmergencyContact;
}

export async function deleteEmergencyContact(id: string) {
  const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
  if (error) throw error;
}
