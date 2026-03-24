import { supabase } from "@/integrations/supabase/client";

export interface SponsorshipPet {
  id: string;
  name: string;
  species: string;
  description: string | null;
  condition_details: string | null;
  photo_url: string | null;
  sponsorship_status: string;
  sponsorship_goal: number;
  sponsorship_raised: number;
  is_active: boolean;
  added_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchSponsorshipPets(): Promise<SponsorshipPet[]> {
  const { data, error } = await supabase
    .from("sponsorship_pets" as any)
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any) ?? [];
}

export async function createSponsorshipPet(pet: {
  name: string;
  species: string;
  description?: string;
  condition_details?: string;
  photo_url?: string;
  sponsorship_goal: number;
  added_by: string;
}) {
  const { error } = await supabase.from("sponsorship_pets" as any).insert(pet as any);
  if (error) throw error;
}

export async function updateSponsorshipPet(
  id: string,
  updates: Partial<{
    name: string;
    species: string;
    description: string;
    condition_details: string;
    photo_url: string;
    sponsorship_goal: number;
    sponsorship_status: string;
    is_active: boolean;
  }>
) {
  const { error } = await supabase
    .from("sponsorship_pets" as any)
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSponsorshipPet(id: string) {
  const { error } = await supabase
    .from("sponsorship_pets" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function submitDonation(donation: {
  pet_id: string;
  user_id: string;
  amount: number;
  donor_name?: string;
  donor_email?: string;
  message?: string;
}) {
  const { error } = await supabase
    .from("sponsorship_donations" as any)
    .insert(donation as any);
  if (error) throw error;
}
