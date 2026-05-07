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
      adoption_listings: {
        Row: {
          age_text: string | null
          breed: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_website: string | null
          created_at: string
          description: string | null
          gender: string | null
          id: string
          is_adopted: boolean
          pet_name: string
          photo_urls: string[] | null
          posted_by: string
          shelter_location: string | null
          shelter_name: string
          species: string
          updated_at: string
        }
        Insert: {
          age_text?: string | null
          breed?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_adopted?: boolean
          pet_name: string
          photo_urls?: string[] | null
          posted_by: string
          shelter_location?: string | null
          shelter_name: string
          species?: string
          updated_at?: string
        }
        Update: {
          age_text?: string | null
          breed?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_website?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_adopted?: boolean
          pet_name?: string
          photo_urls?: string[] | null
          posted_by?: string
          shelter_location?: string | null
          shelter_name?: string
          species?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      behave_images: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string
          title: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          title: string
          uploaded_by: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "behave_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      behave_posts: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          is_published: boolean
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "behave_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      behave_videos: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          thumbnail_url: string | null
          title: string
          uploaded_by: string
          video_url: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          thumbnail_url?: string | null
          title: string
          uploaded_by: string
          video_url: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          thumbnail_url?: string | null
          title?: string
          uploaded_by?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "behave_videos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bnpl_obligations: {
        Row: {
          created_at: string
          external_ref: string | null
          id: string
          original_amount: number
          outstanding_amount: number
          owner_id: string
          pet_id: string
          provider: string
          status: Database["public"]["Enums"]["bnpl_obligation_status"]
          ticket_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_ref?: string | null
          id?: string
          original_amount: number
          outstanding_amount: number
          owner_id: string
          pet_id: string
          provider?: string
          status?: Database["public"]["Enums"]["bnpl_obligation_status"]
          ticket_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_ref?: string | null
          id?: string
          original_amount?: number
          outstanding_amount?: number
          owner_id?: string
          pet_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["bnpl_obligation_status"]
          ticket_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      bnpl_payments: {
        Row: {
          amount: number
          created_at: string
          external_ref: string | null
          id: string
          method: string
          notes: string | null
          obligation_id: string
          paid_at: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          external_ref?: string | null
          id?: string
          method?: string
          notes?: string | null
          obligation_id: string
          paid_at?: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          method?: string
          notes?: string | null
          obligation_id?: string
          paid_at?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bnpl_payments_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "bnpl_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "story_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reserve: {
        Row: {
          balance: number
          id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_pay_accruals: {
        Row: {
          accrual_month: string
          amount: number
          created_at: string
          expired: boolean
          expired_at: string | null
          expires_at: string | null
          id: string
          membership_id: string
          remaining_amount: number
          stripe_invoice_id: string | null
          user_id: string
        }
        Insert: {
          accrual_month: string
          amount: number
          created_at?: string
          expired?: boolean
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          membership_id: string
          remaining_amount: number
          stripe_invoice_id?: string | null
          user_id: string
        }
        Update: {
          accrual_month?: string
          amount?: number
          created_at?: string
          expired?: boolean
          expired_at?: string | null
          expires_at?: string | null
          id?: string
          membership_id?: string
          remaining_amount?: number
          stripe_invoice_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_pay_accruals_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      dp_expiry_ledger: {
        Row: {
          accrual_id: string
          admin_portion: number
          community_reserve_portion: number
          created_at: string
          expired_amount: number
          help_now_case_id: string | null
          help_now_portion: number
          id: string
          reason: string
        }
        Insert: {
          accrual_id: string
          admin_portion: number
          community_reserve_portion: number
          created_at?: string
          expired_amount: number
          help_now_case_id?: string | null
          help_now_portion: number
          id?: string
          reason?: string
        }
        Update: {
          accrual_id?: string
          admin_portion?: number
          community_reserve_portion?: number
          created_at?: string
          expired_amount?: number
          help_now_case_id?: string | null
          help_now_portion?: number
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "dp_expiry_ledger_accrual_id_fkey"
            columns: ["accrual_id"]
            isOneToOne: false
            referencedRelation: "direct_pay_accruals"
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
      issued_cards: {
        Row: {
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          last4: string | null
          owner_id: string
          shipping_status: string | null
          status: string
          stripe_card_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          last4?: string | null
          owner_id: string
          shipping_status?: string | null
          status?: string
          stripe_card_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          last4?: string | null
          owner_id?: string
          shipping_status?: string | null
          status?: string
          stripe_card_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      issuing_authorizations: {
        Row: {
          amount: number | null
          created_at: string
          decline_reason: string | null
          id: string
          merchant_category: string | null
          merchant_id: string | null
          payload: Json | null
          status: string
          stripe_authorization_id: string
          stripe_card_id: string | null
          ticket_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          decline_reason?: string | null
          id?: string
          merchant_category?: string | null
          merchant_id?: string | null
          payload?: Json | null
          status: string
          stripe_authorization_id: string
          stripe_card_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          decline_reason?: string | null
          id?: string
          merchant_category?: string | null
          merchant_id?: string | null
          payload?: Json | null
          status?: string
          stripe_authorization_id?: string
          stripe_card_id?: string | null
          ticket_id?: string | null
        }
        Relationships: []
      }
      membership_plans: {
        Row: {
          admin_portion: number
          annual_price: number
          created_at: string
          direct_pay_portion: number
          dp_window_months: number | null
          fear_free_member_charge: number
          id: string
          is_active: boolean
          max_dp_amount: number | null
          membership_fee: number
          plan_cap: number | null
          plan_code: string
          platform_fee: number
          reserve_portion: number
          species: string
          stripe_platform_price_id_monthly: string | null
          stripe_price_id_annual: string | null
          stripe_price_id_monthly: string | null
          tier: string
          tier_label: string
          updated_at: string
        }
        Insert: {
          admin_portion: number
          annual_price: number
          created_at?: string
          direct_pay_portion: number
          dp_window_months?: number | null
          fear_free_member_charge: number
          id?: string
          is_active?: boolean
          max_dp_amount?: number | null
          membership_fee: number
          plan_cap?: number | null
          plan_code: string
          platform_fee: number
          reserve_portion: number
          species: string
          stripe_platform_price_id_monthly?: string | null
          stripe_price_id_annual?: string | null
          stripe_price_id_monthly?: string | null
          tier: string
          tier_label: string
          updated_at?: string
        }
        Update: {
          admin_portion?: number
          annual_price?: number
          created_at?: string
          direct_pay_portion?: number
          dp_window_months?: number | null
          fear_free_member_charge?: number
          id?: string
          is_active?: boolean
          max_dp_amount?: number | null
          membership_fee?: number
          plan_cap?: number | null
          plan_code?: string
          platform_fee?: number
          reserve_portion?: number
          species?: string
          stripe_platform_price_id_monthly?: string | null
          stripe_price_id_annual?: string | null
          stripe_price_id_monthly?: string | null
          tier?: string
          tier_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      membership_status_changes: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          membership_id: string
          notes: string | null
          reason: string | null
          source: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          membership_id: string
          notes?: string | null
          reason?: string | null
          source?: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          membership_id?: string
          notes?: string | null
          reason?: string | null
          source?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_status_changes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          admin_notes: string | null
          billing_interval: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          id: string
          is_fear_free_member: boolean
          pet_id: string | null
          plan_id: string
          rejection_reason: string | null
          requires_admin_approval: boolean
          started_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          billing_interval?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_fear_free_member?: boolean
          pet_id?: string | null
          plan_id: string
          rejection_reason?: string | null
          requires_admin_approval?: boolean
          started_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          billing_interval?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_fear_free_member?: boolean
          pet_id?: string | null
          plan_id?: string
          rejection_reason?: string | null
          requires_admin_approval?: boolean
          started_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          bnpl_obligation_id: string | null
          created_at: string
          currency: string
          description: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_pdf: string | null
          kind: string
          membership_id: string | null
          occurred_at: string
          status: string
          stripe_charge_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          user_id: string
          vet_ticket_id: string | null
        }
        Insert: {
          amount?: number
          bnpl_obligation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          kind?: string
          membership_id?: string | null
          occurred_at?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
          vet_ticket_id?: string | null
        }
        Update: {
          amount?: number
          bnpl_obligation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_pdf?: string | null
          kind?: string
          membership_id?: string | null
          occurred_at?: string
          status?: string
          stripe_charge_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
          vet_ticket_id?: string | null
        }
        Relationships: []
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
          category: string
          comments_count: number
          content: string
          created_at: string
          id: string
          is_urgent: boolean
          likes_count: number
          pet_id: string
          photo_urls: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category?: string
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          is_urgent?: boolean
          likes_count?: number
          pet_id: string
          photo_urls?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category?: string
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          is_urgent?: boolean
          likes_count?: number
          pet_id?: string
          photo_urls?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_stories_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
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
          date_of_birth: string | null
          followers_count: number
          gender: string | null
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
          date_of_birth?: string | null
          followers_count?: number
          gender?: string | null
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
          date_of_birth?: string | null
          followers_count?: number
          gender?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          photo_url?: string | null
          species?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_owner_profile_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_issuing_cardholder_id: string | null
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
          stripe_customer_id?: string | null
          stripe_issuing_cardholder_id?: string | null
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
          stripe_customer_id?: string | null
          stripe_issuing_cardholder_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_bounties: {
        Row: {
          bounty_amount: number
          created_at: string
          gross_membership_amount: number
          hold_until: string
          id: string
          membership_id: string | null
          paid_at: string | null
          payment_history_id: string | null
          payout_id: string | null
          period: string
          rate: number
          referral_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          bounty_amount: number
          created_at?: string
          gross_membership_amount: number
          hold_until: string
          id?: string
          membership_id?: string | null
          paid_at?: string | null
          payment_history_id?: string | null
          payout_id?: string | null
          period: string
          rate: number
          referral_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          bounty_amount?: number
          created_at?: string
          gross_membership_amount?: number
          hold_until?: string
          id?: string
          membership_id?: string | null
          paid_at?: string | null
          payment_history_id?: string | null
          payout_id?: string | null
          period?: string
          rate?: number
          referral_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_bounties_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "referrer_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_bounties_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_bounties_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_program_settings: {
        Row: {
          hold_days: number
          id: string
          intro_months: number
          intro_rate: number
          ongoing_rate: number
          updated_at: string
        }
        Insert: {
          hold_days?: number
          id?: string
          intro_months?: number
          intro_rate?: number
          ongoing_rate?: number
          updated_at?: string
        }
        Update: {
          hold_days?: number
          id?: string
          intro_months?: number
          intro_rate?: number
          ongoing_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          activated_at: string | null
          code_used: string
          created_at: string
          id: string
          membership_id: string | null
          referred_user_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          activated_at?: string | null
          code_used: string
          created_at?: string
          id?: string
          membership_id?: string | null
          referred_user_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          activated_at?: string | null
          code_used?: string
          created_at?: string
          id?: string
          membership_id?: string | null
          referred_user_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
        ]
      }
      referrer_payouts: {
        Row: {
          amount: number
          created_at: string
          external_ref: string | null
          id: string
          method: string
          notes: string | null
          paid_at: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          external_ref?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrer_payouts_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
        ]
      }
      referrers: {
        Row: {
          code: string
          created_at: string
          display_name: string
          fear_free_certified: boolean
          id: string
          is_active: boolean
          notes: string | null
          payout_email: string | null
          payout_method: string
          type: Database["public"]["Enums"]["referrer_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          fear_free_certified?: boolean
          id?: string
          is_active?: boolean
          notes?: string | null
          payout_email?: string | null
          payout_method?: string
          type: Database["public"]["Enums"]["referrer_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          fear_free_certified?: boolean
          id?: string
          is_active?: boolean
          notes?: string | null
          payout_email?: string | null
          payout_method?: string
          type?: Database["public"]["Enums"]["referrer_type"]
          updated_at?: string
          user_id?: string | null
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
      sponsorship_donations: {
        Row: {
          amount: number
          created_at: string
          donor_email: string | null
          donor_name: string | null
          id: string
          message: string | null
          pet_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          message?: string | null
          pet_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          message?: string | null
          pet_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_donations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "sponsorship_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_pets: {
        Row: {
          added_by: string
          condition_details: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          species: string
          sponsorship_goal: number
          sponsorship_raised: number
          sponsorship_status: string
          updated_at: string
        }
        Insert: {
          added_by: string
          condition_details?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          species?: string
          sponsorship_goal?: number
          sponsorship_raised?: number
          sponsorship_status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string
          condition_details?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          species?: string
          sponsorship_goal?: number
          sponsorship_raised?: number
          sponsorship_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      story_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number
          parent_comment_id: string | null
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_comment_id?: string | null
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_comment_id?: string | null
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "story_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "pet_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
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
      ticket_dp_consumptions: {
        Row: {
          accrual_id: string
          amount_consumed: number
          created_at: string
          id: string
          released: boolean
          ticket_id: string
        }
        Insert: {
          accrual_id: string
          amount_consumed: number
          created_at?: string
          id?: string
          released?: boolean
          ticket_id: string
        }
        Update: {
          accrual_id?: string
          amount_consumed?: number
          created_at?: string
          id?: string
          released?: boolean
          ticket_id?: string
        }
        Relationships: []
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
      vet_payouts: {
        Row: {
          amount: number
          created_at: string
          external_ref: string | null
          id: string
          method: Database["public"]["Enums"]["vet_payout_method"]
          notes: string | null
          status: Database["public"]["Enums"]["vet_payout_status"]
          ticket_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          external_ref?: string | null
          id?: string
          method?: Database["public"]["Enums"]["vet_payout_method"]
          notes?: string | null
          status?: Database["public"]["Enums"]["vet_payout_status"]
          ticket_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          method?: Database["public"]["Enums"]["vet_payout_method"]
          notes?: string | null
          status?: Database["public"]["Enums"]["vet_payout_status"]
          ticket_id?: string
          updated_at?: string
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
      vet_tickets: {
        Row: {
          admin_notes: string | null
          approved_amount: number | null
          attestation_url: string | null
          authorized_until: string | null
          card_id: string | null
          clinic_merchant_id: string | null
          clinic_name: string
          coverage_breakdown: Json | null
          created_at: string
          estimate_amount: number
          estimate_url: string | null
          id: string
          issued_card_id: string | null
          last_authorization_id: string | null
          member_remainder_paid: boolean
          member_remainder_stripe_session_id: string | null
          membership_id: string | null
          merchant_lock_type: string | null
          notes: string | null
          owner_id: string
          pet_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["vet_ticket_status"]
          updated_at: string
          vet_profile_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_amount?: number | null
          attestation_url?: string | null
          authorized_until?: string | null
          card_id?: string | null
          clinic_merchant_id?: string | null
          clinic_name: string
          coverage_breakdown?: Json | null
          created_at?: string
          estimate_amount: number
          estimate_url?: string | null
          id?: string
          issued_card_id?: string | null
          last_authorization_id?: string | null
          member_remainder_paid?: boolean
          member_remainder_stripe_session_id?: string | null
          membership_id?: string | null
          merchant_lock_type?: string | null
          notes?: string | null
          owner_id: string
          pet_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["vet_ticket_status"]
          updated_at?: string
          vet_profile_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_amount?: number | null
          attestation_url?: string | null
          authorized_until?: string | null
          card_id?: string | null
          clinic_merchant_id?: string | null
          clinic_name?: string
          coverage_breakdown?: Json | null
          created_at?: string
          estimate_amount?: number
          estimate_url?: string | null
          id?: string
          issued_card_id?: string | null
          last_authorization_id?: string | null
          member_remainder_paid?: boolean
          member_remainder_stripe_session_id?: string | null
          membership_id?: string | null
          merchant_lock_type?: string | null
          notes?: string | null
          owner_id?: string
          pet_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["vet_ticket_status"]
          updated_at?: string
          vet_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_tickets_issued_card_id_fkey"
            columns: ["issued_card_id"]
            isOneToOne: false
            referencedRelation: "issued_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      vetted_products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          external_url: string
          id: string
          image_url: string | null
          listed_by: string
          name: string
          price_text: string | null
          store_name: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          external_url: string
          id?: string
          image_url?: string | null
          listed_by: string
          name: string
          price_text?: string | null
          store_name?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          external_url?: string
          id?: string
          image_url?: string | null
          listed_by?: string
          name?: string
          price_text?: string | null
          store_name?: string | null
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
      consume_dp_for_ticket: {
        Args: {
          _amount: number
          _ticket_id: string
          _user_id: string
          _window_months: number
        }
        Returns: number
      }
      gen_referral_code: { Args: never; Returns: string }
      get_plan_year_window: {
        Args: { _membership_id: string }
        Returns: {
          year_end: string
          year_start: string
        }[]
      }
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
      mark_ticket_settled: {
        Args: {
          _authorization_id: string
          _settled_amount: number
          _ticket_id: string
        }
        Returns: undefined
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
      release_ticket_allocations: {
        Args: { _ticket_id: string }
        Returns: undefined
      }
      resolve_referral_code: {
        Args: { _code: string }
        Returns: {
          display_name: string
          referrer_id: string
          type: Database["public"]["Enums"]["referrer_type"]
        }[]
      }
      set_status_context: {
        Args: { _changer: string; _source: string }
        Returns: undefined
      }
      user_has_any_role: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "pet_owner" | "vet" | "admin"
      bnpl_obligation_status:
        | "pending"
        | "active"
        | "paid_off"
        | "defaulted"
        | "cancelled"
      referrer_type: "vet" | "shelter" | "influencer" | "partner"
      transaction_type:
        | "donation_received"
        | "donation_sent"
        | "withdrawal"
        | "vet_payment"
        | "refund"
      vet_payout_method: "manual_ach" | "issued_card" | "direct_charge"
      vet_payout_status:
        | "pending"
        | "sent"
        | "completed"
        | "failed"
        | "reversed"
      vet_ticket_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "funded"
        | "card_issued"
        | "settled"
        | "expired"
        | "cancelled"
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
      bnpl_obligation_status: [
        "pending",
        "active",
        "paid_off",
        "defaulted",
        "cancelled",
      ],
      referrer_type: ["vet", "shelter", "influencer", "partner"],
      transaction_type: [
        "donation_received",
        "donation_sent",
        "withdrawal",
        "vet_payment",
        "refund",
      ],
      vet_payout_method: ["manual_ach", "issued_card", "direct_charge"],
      vet_payout_status: ["pending", "sent", "completed", "failed", "reversed"],
      vet_ticket_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "funded",
        "card_issued",
        "settled",
        "expired",
        "cancelled",
      ],
    },
  },
} as const
