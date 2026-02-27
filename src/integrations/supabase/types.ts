export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          pet_id: string
          scheduled_at: string
          service_id: string | null
          status: string
          updated_at: string
          vet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          pet_id: string
          scheduled_at: string
          service_id?: string | null
          status?: string
          updated_at?: string
          vet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          pet_id?: string
          scheduled_at?: string
          service_id?: string | null
          status?: string
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "vet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          contact_name: string
          created_at: string
          id: string
          pet_id: string
          phone: string
          relationship: string | null
        }
        Insert: {
          contact_name: string
          created_at?: string
          id?: string
          pet_id: string
          phone: string
          relationship?: string | null
        }
        Update: {
          contact_name?: string
          created_at?: string
          id?: string
          pet_id?: string
          phone?: string
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          created_at: string
          description: string | null
          id: string
          pet_id: string
          record_date: string
          record_type: string
          title: string
          vet_name: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          pet_id: string
          record_date?: string
          record_type?: string
          title: string
          vet_name?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          pet_id?: string
          record_date?: string
          record_type?: string
          title?: string
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_follows: {
        Row: {
          created_at: string
          id: string
          pet_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pet_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pet_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_follows_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_stories: {
        Row: {
          author_id: string
          comments_count: number
          content: string
          created_at: string
          id: string
          likes_count: number
          pet_id: string
          photo_urls: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          pet_id: string
          photo_urls?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          pet_id?: string
          photo_urls?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_stories_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          age_years: number | null
          breed: string | null
          created_at: string
          followers_count: number
          id: string
          name: string
          notes: string | null
          owner_id: string
          photo_url: string | null
          species: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          age_years?: number | null
          breed?: string | null
          created_at?: string
          followers_count?: number
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          photo_url?: string | null
          species?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          age_years?: number | null
          breed?: string | null
          created_at?: string
          followers_count?: number
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          photo_url?: string | null
          species?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
          vet_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
          vet_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
          vet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_vet_id_fkey"
            columns: ["vet_id"]
            isOneToOne: false
            referencedRelation: "vet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "pet_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "pet_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vet_profiles: {
        Row: {
          bio: string | null
          clinic_name: string
          created_at: string
          id: string
          is_approved: boolean
          location: string | null
          phone: string | null
          specializations: string[] | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          clinic_name?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          location?: string | null
          phone?: string | null
          specializations?: string[] | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          clinic_name?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          location?: string | null
          phone?: string | null
          specializations?: string[] | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          direct_pay_portion: number
          from_user_id: string | null
          id: string
          related_story_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string
          wallet_portion: number
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          direct_pay_portion?: number
          from_user_id?: string | null
          id?: string
          related_story_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string
          wallet_portion?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          direct_pay_portion?: number
          from_user_id?: string | null
          id?: string
          related_story_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          wallet_id?: string
          wallet_portion?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_related_story_id_fkey"
            columns: ["related_story_id"]
            isOneToOne: false
            referencedRelation: "pet_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string
          direct_pay_balance: number
          id: string
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          created_at?: string
          direct_pay_balance?: number
          id?: string
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          created_at?: string
          direct_pay_balance?: number
          id?: string
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pet_owner: {
        Args: { _pet_id: string; _user_id: string }
        Returns: boolean
      }
      is_vet_profile_owner: {
        Args: { _user_id: string; _vet_profile_id: string }
        Returns: boolean
      }
      process_donation: {
        Args: {
          _amount: number
          _from_user_id: string
          _story_id?: string
          _to_user_id: string
        }
        Returns: undefined
      }
      user_has_any_role: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "pet_owner" | "vet" | "admin"
      transaction_type:
        | "donation_received"
        | "donation_sent"
        | "withdrawal"
        | "vet_payment"
        | "refund"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["pet_owner", "vet", "admin"],
      transaction_type: [
        "donation_received",
        "donation_sent",
        "withdrawal",
        "vet_payment",
        "refund",
      ],
    },
  },
} as const
