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
      attestation_link_tokens: {
        Row: {
          attestation_id: string
          clinic_email: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          attestation_id: string
          clinic_email: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          attestation_id?: string
          clinic_email?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attestation_link_tokens_attestation_id_fkey"
            columns: ["attestation_id"]
            isOneToOne: false
            referencedRelation: "vet_attestations"
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
      bnpl_installments: {
        Row: {
          amount: number
          auto_charge_attempts: number
          created_at: string
          due_date: string
          id: string
          last_auto_charge_at: string | null
          last_auto_charge_error: string | null
          last_reminded_at: string | null
          obligation_id: string
          paid_amount: number
          paid_at: string | null
          reminder_stage: string | null
          seq: number
          status: string
        }
        Insert: {
          amount: number
          auto_charge_attempts?: number
          created_at?: string
          due_date: string
          id?: string
          last_auto_charge_at?: string | null
          last_auto_charge_error?: string | null
          last_reminded_at?: string | null
          obligation_id: string
          paid_amount?: number
          paid_at?: string | null
          reminder_stage?: string | null
          seq: number
          status?: string
        }
        Update: {
          amount?: number
          auto_charge_attempts?: number
          created_at?: string
          due_date?: string
          id?: string
          last_auto_charge_at?: string | null
          last_auto_charge_error?: string | null
          last_reminded_at?: string | null
          obligation_id?: string
          paid_amount?: number
          paid_at?: string | null
          reminder_stage?: string | null
          seq?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bnpl_installments_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "bnpl_obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      bnpl_obligations: {
        Row: {
          auto_pay_enabled: boolean
          created_at: string
          default_at: string | null
          external_ref: string | null
          id: string
          installment_count: number
          installment_interval_days: number
          last_payment_attempt_at: string | null
          next_due_date: string | null
          original_amount: number
          outstanding_amount: number
          owner_id: string
          paused: boolean
          paused_at: string | null
          paused_reason: string | null
          pet_id: string
          plan_term_months: number | null
          provider: string
          status: Database["public"]["Enums"]["bnpl_obligation_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          auto_pay_enabled?: boolean
          created_at?: string
          default_at?: string | null
          external_ref?: string | null
          id?: string
          installment_count?: number
          installment_interval_days?: number
          last_payment_attempt_at?: string | null
          next_due_date?: string | null
          original_amount: number
          outstanding_amount: number
          owner_id: string
          paused?: boolean
          paused_at?: string | null
          paused_reason?: string | null
          pet_id: string
          plan_term_months?: number | null
          provider?: string
          status?: Database["public"]["Enums"]["bnpl_obligation_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          auto_pay_enabled?: boolean
          created_at?: string
          default_at?: string | null
          external_ref?: string | null
          id?: string
          installment_count?: number
          installment_interval_days?: number
          last_payment_attempt_at?: string | null
          next_due_date?: string | null
          original_amount?: number
          outstanding_amount?: number
          owner_id?: string
          paused?: boolean
          paused_at?: string | null
          paused_reason?: string | null
          pet_id?: string
          plan_term_months?: number | null
          provider?: string
          status?: Database["public"]["Enums"]["bnpl_obligation_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
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
      bnpl_processor_runs: {
        Row: {
          auto_charges_attempted: number
          auto_charges_failed: number
          auto_charges_succeeded: number
          created_at: string
          details: Json | null
          error_message: string | null
          finished_at: string | null
          id: string
          installments_marked_due: number
          installments_marked_missed: number
          obligations_defaulted: number
          reminders_sent: number
          started_at: string
          status: string
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          auto_charges_attempted?: number
          auto_charges_failed?: number
          auto_charges_succeeded?: number
          created_at?: string
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          installments_marked_due?: number
          installments_marked_missed?: number
          obligations_defaulted?: number
          reminders_sent?: number
          started_at?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Update: {
          auto_charges_attempted?: number
          auto_charges_failed?: number
          auto_charges_succeeded?: number
          created_at?: string
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          installments_marked_due?: number
          installments_marked_missed?: number
          obligations_defaulted?: number
          reminders_sent?: number
          started_at?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      campaign_disbursement_documents: {
        Row: {
          campaign_id: string
          created_at: string
          doc_type: string
          id: string
          notes: string | null
          reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          ticket_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          doc_type: string
          id?: string
          notes?: string | null
          reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          ticket_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          doc_type?: string
          id?: string
          notes?: string | null
          reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          ticket_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_disbursement_documents_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "help_now_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_disbursement_documents_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "vet_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_donations: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          currency: string
          donor_email: string | null
          donor_name: string | null
          donor_notification_status: string
          donor_notified_at: string | null
          donor_user_id: string | null
          id: string
          message: string | null
          paid_at: string | null
          redirected_amount: number
          redirected_at: string | null
          redirection_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          campaign_id: string
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          donor_notification_status?: string
          donor_notified_at?: string | null
          donor_user_id?: string | null
          id?: string
          message?: string | null
          paid_at?: string | null
          redirected_amount?: number
          redirected_at?: string | null
          redirection_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          currency?: string
          donor_email?: string | null
          donor_name?: string | null
          donor_notification_status?: string
          donor_notified_at?: string | null
          donor_user_id?: string | null
          id?: string
          message?: string | null
          paid_at?: string | null
          redirected_amount?: number
          redirected_at?: string | null
          redirection_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "help_now_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_donations_redirection_fk"
            columns: ["redirection_id"]
            isOneToOne: false
            referencedRelation: "campaign_redirections"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_redirection_allocations: {
        Row: {
          amount: number
          applied_at: string | null
          created_at: string
          id: string
          receiving_campaign_id: string
          redirection_id: string
        }
        Insert: {
          amount: number
          applied_at?: string | null
          created_at?: string
          id?: string
          receiving_campaign_id: string
          redirection_id: string
        }
        Update: {
          amount?: number
          applied_at?: string | null
          created_at?: string
          id?: string
          receiving_campaign_id?: string
          redirection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_redirection_allocations_receiving_campaign_id_fkey"
            columns: ["receiving_campaign_id"]
            isOneToOne: false
            referencedRelation: "help_now_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_redirection_allocations_redirection_id_fkey"
            columns: ["redirection_id"]
            isOneToOne: false
            referencedRelation: "campaign_redirections"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_redirections: {
        Row: {
          allocated_amount: number
          created_at: string
          id: string
          reason: string
          released_at: string | null
          released_by: string | null
          source_campaign_id: string
          status: string
          total_amount: number
          unallocated_amount: number
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          created_at?: string
          id?: string
          reason?: string
          released_at?: string | null
          released_by?: string | null
          source_campaign_id: string
          status?: string
          total_amount: number
          unallocated_amount?: number
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          id?: string
          reason?: string
          released_at?: string | null
          released_by?: string | null
          source_campaign_id?: string
          status?: string
          total_amount?: number
          unallocated_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_redirections_source_campaign_id_fkey"
            columns: ["source_campaign_id"]
            isOneToOne: false
            referencedRelation: "help_now_campaigns"
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
      content_blocks: {
        Row: {
          created_at: string
          id: string
          key: string
          kind: string
          updated_at: string
          updated_by: string | null
          value_image_url: string | null
          value_json: Json | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          kind?: string
          updated_at?: string
          updated_by?: string | null
          value_image_url?: string | null
          value_json?: Json | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          kind?: string
          updated_at?: string
          updated_by?: string | null
          value_image_url?: string | null
          value_json?: Json | null
          value_text?: string | null
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
      help_now_campaigns: {
        Row: {
          clock_paused_at: string | null
          created_at: string
          disbursement_block_reason: string | null
          disbursement_eligible_at: string | null
          disbursement_path: string
          document_basis: string
          expires_at: string | null
          funding_offsets: Json
          goal_amount: number
          id: string
          invoice_rejection_reason: string | null
          invoice_reviewed_at: string | null
          invoice_reviewed_by: string | null
          invoice_status: string
          invoice_submitted_at: string | null
          invoice_url: string | null
          over_raised_flagged_at: string | null
          owner_id: string
          pet_id: string
          photo_urls: string[]
          priority_computed_at: string | null
          priority_inputs: Json
          priority_rank: number | null
          priority_source: string
          proof_of_payment_status: string
          proof_of_payment_url: string | null
          proof_rejection_reason: string | null
          proof_reviewed_at: string | null
          proof_reviewed_by: string | null
          proof_submitted_at: string | null
          published_at: string | null
          raised_amount: number
          status: Database["public"]["Enums"]["help_now_campaign_status"]
          story: string | null
          ticket_id: string
          title: string | null
          updated_at: string
          verification_status: string
          verified_amount: number | null
          verified_amount_source: string | null
        }
        Insert: {
          clock_paused_at?: string | null
          created_at?: string
          disbursement_block_reason?: string | null
          disbursement_eligible_at?: string | null
          disbursement_path?: string
          document_basis?: string
          expires_at?: string | null
          funding_offsets?: Json
          goal_amount?: number
          id?: string
          invoice_rejection_reason?: string | null
          invoice_reviewed_at?: string | null
          invoice_reviewed_by?: string | null
          invoice_status?: string
          invoice_submitted_at?: string | null
          invoice_url?: string | null
          over_raised_flagged_at?: string | null
          owner_id: string
          pet_id: string
          photo_urls?: string[]
          priority_computed_at?: string | null
          priority_inputs?: Json
          priority_rank?: number | null
          priority_source?: string
          proof_of_payment_status?: string
          proof_of_payment_url?: string | null
          proof_rejection_reason?: string | null
          proof_reviewed_at?: string | null
          proof_reviewed_by?: string | null
          proof_submitted_at?: string | null
          published_at?: string | null
          raised_amount?: number
          status?: Database["public"]["Enums"]["help_now_campaign_status"]
          story?: string | null
          ticket_id: string
          title?: string | null
          updated_at?: string
          verification_status?: string
          verified_amount?: number | null
          verified_amount_source?: string | null
        }
        Update: {
          clock_paused_at?: string | null
          created_at?: string
          disbursement_block_reason?: string | null
          disbursement_eligible_at?: string | null
          disbursement_path?: string
          document_basis?: string
          expires_at?: string | null
          funding_offsets?: Json
          goal_amount?: number
          id?: string
          invoice_rejection_reason?: string | null
          invoice_reviewed_at?: string | null
          invoice_reviewed_by?: string | null
          invoice_status?: string
          invoice_submitted_at?: string | null
          invoice_url?: string | null
          over_raised_flagged_at?: string | null
          owner_id?: string
          pet_id?: string
          photo_urls?: string[]
          priority_computed_at?: string | null
          priority_inputs?: Json
          priority_rank?: number | null
          priority_source?: string
          proof_of_payment_status?: string
          proof_of_payment_url?: string | null
          proof_rejection_reason?: string | null
          proof_reviewed_at?: string | null
          proof_reviewed_by?: string | null
          proof_submitted_at?: string | null
          published_at?: string | null
          raised_amount?: number
          status?: Database["public"]["Enums"]["help_now_campaign_status"]
          story?: string | null
          ticket_id?: string
          title?: string | null
          updated_at?: string
          verification_status?: string
          verified_amount?: number | null
          verified_amount_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_now_campaigns_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_now_campaigns_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "vet_tickets"
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
      ledger_entries: {
        Row: {
          accrual_id: string | null
          amount: number
          bucket: string
          created_at: string
          description: string | null
          entry_type: string
          external_ref: string | null
          id: string
          idempotency_key: string
          membership_id: string | null
          metadata: Json
          obligation_id: string | null
          parent_entry_id: string | null
          pet_id: string | null
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          accrual_id?: string | null
          amount: number
          bucket: string
          created_at?: string
          description?: string | null
          entry_type: string
          external_ref?: string | null
          id?: string
          idempotency_key: string
          membership_id?: string | null
          metadata?: Json
          obligation_id?: string | null
          parent_entry_id?: string | null
          pet_id?: string | null
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          accrual_id?: string | null
          amount?: number
          bucket?: string
          created_at?: string
          description?: string | null
          entry_type?: string
          external_ref?: string | null
          id?: string
          idempotency_key?: string
          membership_id?: string | null
          metadata?: Json
          obligation_id?: string | null
          parent_entry_id?: string | null
          pet_id?: string | null
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_parent_entry_id_fkey"
            columns: ["parent_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      member_reserve_accruals: {
        Row: {
          accrual_month: string
          amount: number
          created_at: string
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
          id?: string
          membership_id?: string
          remaining_amount?: number
          stripe_invoice_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      member_reserve_consumptions: {
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
        Relationships: [
          {
            foreignKeyName: "member_reserve_consumptions_accrual_id_fkey"
            columns: ["accrual_id"]
            isOneToOne: false
            referencedRelation: "member_reserve_accruals"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          admin_portion: number
          annual_price: number
          bnpl_default_installments: number
          bnpl_default_interval_days: number
          bnpl_default_penalty: number
          bnpl_min_multiplier: number
          bnpl_multiplier: number
          created_at: string
          direct_pay_portion: number
          dp_window_months: number | null
          fear_free_member_charge: number
          id: string
          is_active: boolean
          max_concurrent_obligations: number
          max_dp_amount: number | null
          membership_fee: number
          plan_cap: number | null
          plan_code: string
          platform_fee: number
          platform_fee_annual: number | null
          platform_fee_monthly: number | null
          reserve_portion: number
          species: string
          stripe_platform_price_id_monthly: string | null
          stripe_price_id_annual: string | null
          stripe_price_id_monthly: string | null
          tier: string
          tier_label: string
          transaction_fee_pct: number | null
          updated_at: string
        }
        Insert: {
          admin_portion: number
          annual_price: number
          bnpl_default_installments?: number
          bnpl_default_interval_days?: number
          bnpl_default_penalty?: number
          bnpl_min_multiplier?: number
          bnpl_multiplier?: number
          created_at?: string
          direct_pay_portion: number
          dp_window_months?: number | null
          fear_free_member_charge: number
          id?: string
          is_active?: boolean
          max_concurrent_obligations?: number
          max_dp_amount?: number | null
          membership_fee: number
          plan_cap?: number | null
          plan_code: string
          platform_fee: number
          platform_fee_annual?: number | null
          platform_fee_monthly?: number | null
          reserve_portion: number
          species: string
          stripe_platform_price_id_monthly?: string | null
          stripe_price_id_annual?: string | null
          stripe_price_id_monthly?: string | null
          tier: string
          tier_label: string
          transaction_fee_pct?: number | null
          updated_at?: string
        }
        Update: {
          admin_portion?: number
          annual_price?: number
          bnpl_default_installments?: number
          bnpl_default_interval_days?: number
          bnpl_default_penalty?: number
          bnpl_min_multiplier?: number
          bnpl_multiplier?: number
          created_at?: string
          direct_pay_portion?: number
          dp_window_months?: number | null
          fear_free_member_charge?: number
          id?: string
          is_active?: boolean
          max_concurrent_obligations?: number
          max_dp_amount?: number | null
          membership_fee?: number
          plan_cap?: number | null
          plan_code?: string
          platform_fee?: number
          platform_fee_annual?: number | null
          platform_fee_monthly?: number | null
          reserve_portion?: number
          species?: string
          stripe_platform_price_id_monthly?: string | null
          stripe_price_id_annual?: string | null
          stripe_price_id_monthly?: string | null
          tier?: string
          tier_label?: string
          transaction_fee_pct?: number | null
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
          continuous_paid_months: number
          created_at: string
          current_period_end: string | null
          id: string
          is_fear_free_member: boolean
          last_paid_month: string | null
          pet_id: string
          plan_id: string
          rejection_reason: string | null
          requires_admin_approval: boolean
          reserve_eligible_since: string | null
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
          continuous_paid_months?: number
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_fear_free_member?: boolean
          last_paid_month?: string | null
          pet_id: string
          plan_id: string
          rejection_reason?: string | null
          requires_admin_approval?: boolean
          reserve_eligible_since?: string | null
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
          continuous_paid_months?: number
          created_at?: string
          current_period_end?: string | null
          id?: string
          is_fear_free_member?: boolean
          last_paid_month?: string | null
          pet_id?: string
          plan_id?: string
          rejection_reason?: string | null
          requires_admin_approval?: boolean
          reserve_eligible_since?: string | null
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
          vet_of_record_id: string | null
          vet_of_record_license_id: string | null
          vet_of_record_set_at: string | null
          vet_profile_id: string | null
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
          vet_of_record_id?: string | null
          vet_of_record_license_id?: string | null
          vet_of_record_set_at?: string | null
          vet_profile_id?: string | null
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
          vet_of_record_id?: string | null
          vet_of_record_license_id?: string | null
          vet_of_record_set_at?: string | null
          vet_profile_id?: string | null
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
          {
            foreignKeyName: "pets_vet_of_record_id_fkey"
            columns: ["vet_of_record_id"]
            isOneToOne: false
            referencedRelation: "vet_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_vet_of_record_license_id_fkey"
            columns: ["vet_of_record_license_id"]
            isOneToOne: false
            referencedRelation: "vet_license_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_vet_profile_id_fkey"
            columns: ["vet_profile_id"]
            isOneToOne: false
            referencedRelation: "vet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          default_payment_method_id: string | null
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
          default_payment_method_id?: string | null
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
          default_payment_method_id?: string | null
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
          auto_approve_ticket_threshold: number
          excluded_procedures: string[] | null
          hold_days: number
          id: string
          intro_months: number
          intro_rate: number
          ongoing_rate: number
          risk_flag_thresholds: Json | null
          updated_at: string
        }
        Insert: {
          auto_approve_ticket_threshold?: number
          excluded_procedures?: string[] | null
          hold_days?: number
          id?: string
          intro_months?: number
          intro_rate?: number
          ongoing_rate?: number
          risk_flag_thresholds?: Json | null
          updated_at?: string
        }
        Update: {
          auto_approve_ticket_threshold?: number
          excluded_procedures?: string[] | null
          hold_days?: number
          id?: string
          intro_months?: number
          intro_rate?: number
          ongoing_rate?: number
          risk_flag_thresholds?: Json | null
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
          stripe_transfer_id: string | null
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
          stripe_transfer_id?: string | null
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
          stripe_transfer_id?: string | null
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
          stripe_connect_account_id: string | null
          stripe_connect_status: string
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
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string
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
          stripe_connect_account_id?: string | null
          stripe_connect_status?: string
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
      shelter_milestone_contributions: {
        Row: {
          amount: number
          created_at: string
          id: string
          milestone_id: string
          payment_history_id: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          milestone_id: string
          payment_history_id?: string | null
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          milestone_id?: string
          payment_history_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelter_milestone_contributions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "shelter_referral_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      shelter_referral_milestones: {
        Row: {
          adoption_listing_id: string | null
          completed_at: string | null
          created_at: string
          goal_amount: number
          id: string
          payout_amount: number
          pet_name: string
          raised_amount: number
          referrer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          adoption_listing_id?: string | null
          completed_at?: string | null
          created_at?: string
          goal_amount: number
          id?: string
          payout_amount: number
          pet_name: string
          raised_amount?: number
          referrer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          adoption_listing_id?: string | null
          completed_at?: string | null
          created_at?: string
          goal_amount?: number
          id?: string
          payout_amount?: number
          pet_name?: string
          raised_amount?: number
          referrer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelter_referral_milestones_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
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
      ticket_reconsideration_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reason: string
          requester_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          ticket_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason: string
          requester_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          ticket_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reason?: string
          requester_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_reconsideration_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "vet_tickets"
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
      verification_state_flags: {
        Row: {
          disabled_reason: string | null
          enabled: boolean
          state_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          disabled_reason?: string | null
          enabled?: boolean
          state_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          disabled_reason?: string | null
          enabled?: boolean
          state_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      vet_attestations: {
        Row: {
          answers: Json
          breed: string | null
          certified: boolean
          clinic_city: string | null
          clinic_name: string | null
          clinic_state: string | null
          clinic_street: string | null
          clinic_zip: string | null
          completed_at: string | null
          created_at: string
          date_of_death: string | null
          id: string
          license_number: string | null
          license_state: string | null
          merchant_id: string | null
          method: string
          no_traditional_mid: boolean
          owner_id: string
          pdf_url: string | null
          pet_age_or_dob: string | null
          pet_id: string | null
          pet_name: string | null
          pet_status: string | null
          pet_type: string | null
          pet_type_other: string | null
          primary_breed: string | null
          processor: string | null
          signature_typed_name: string | null
          signed_date: string | null
          status: string
          ticket_id: string | null
          updated_at: string
          vet_legal_name: string | null
          vet_profile_id: string | null
        }
        Insert: {
          answers?: Json
          breed?: string | null
          certified?: boolean
          clinic_city?: string | null
          clinic_name?: string | null
          clinic_state?: string | null
          clinic_street?: string | null
          clinic_zip?: string | null
          completed_at?: string | null
          created_at?: string
          date_of_death?: string | null
          id?: string
          license_number?: string | null
          license_state?: string | null
          merchant_id?: string | null
          method?: string
          no_traditional_mid?: boolean
          owner_id: string
          pdf_url?: string | null
          pet_age_or_dob?: string | null
          pet_id?: string | null
          pet_name?: string | null
          pet_status?: string | null
          pet_type?: string | null
          pet_type_other?: string | null
          primary_breed?: string | null
          processor?: string | null
          signature_typed_name?: string | null
          signed_date?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
          vet_legal_name?: string | null
          vet_profile_id?: string | null
        }
        Update: {
          answers?: Json
          breed?: string | null
          certified?: boolean
          clinic_city?: string | null
          clinic_name?: string | null
          clinic_state?: string | null
          clinic_street?: string | null
          clinic_zip?: string | null
          completed_at?: string | null
          created_at?: string
          date_of_death?: string | null
          id?: string
          license_number?: string | null
          license_state?: string | null
          merchant_id?: string | null
          method?: string
          no_traditional_mid?: boolean
          owner_id?: string
          pdf_url?: string | null
          pet_age_or_dob?: string | null
          pet_id?: string | null
          pet_name?: string | null
          pet_status?: string | null
          pet_type?: string | null
          pet_type_other?: string | null
          primary_breed?: string | null
          processor?: string | null
          signature_typed_name?: string | null
          signed_date?: string | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
          vet_legal_name?: string | null
          vet_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_attestations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_attestations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "vet_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vet_attestations_vet_profile_id_fkey"
            columns: ["vet_profile_id"]
            isOneToOne: false
            referencedRelation: "vet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_identity_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
          vet_profile_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
          vet_profile_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
          vet_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_identity_tokens_vet_profile_id_fkey"
            columns: ["vet_profile_id"]
            isOneToOne: false
            referencedRelation: "vet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_license_import_runs: {
        Row: {
          created_at: string
          error_message: string | null
          error_samples: Json
          file_path: string | null
          finished_at: string | null
          id: string
          import_method: string
          rows_deactivated: number
          rows_filtered_status: number
          rows_filtered_type: number
          rows_inserted: number
          rows_invalid: number
          rows_kept: number
          rows_read: number
          rows_updated: number
          started_at: string
          state_code: string
          status: string
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          error_samples?: Json
          file_path?: string | null
          finished_at?: string | null
          id?: string
          import_method: string
          rows_deactivated?: number
          rows_filtered_status?: number
          rows_filtered_type?: number
          rows_inserted?: number
          rows_invalid?: number
          rows_kept?: number
          rows_read?: number
          rows_updated?: number
          started_at?: string
          state_code: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          error_samples?: Json
          file_path?: string | null
          finished_at?: string | null
          id?: string
          import_method?: string
          rows_deactivated?: number
          rows_filtered_status?: number
          rows_filtered_type?: number
          rows_inserted?: number
          rows_invalid?: number
          rows_kept?: number
          rows_read?: number
          rows_updated?: number
          started_at?: string
          state_code?: string
          status?: string
          trigger_source?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_license_import_runs_state_code_fkey"
            columns: ["state_code"]
            isOneToOne: false
            referencedRelation: "vet_license_sources"
            referencedColumns: ["state_code"]
          },
        ]
      }
      vet_license_records: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          address_state: string | null
          city: string | null
          county: string | null
          created_at: string
          deactivated_at: string | null
          expiration_date: string | null
          first_name: string | null
          full_name: string
          id: string
          is_active: boolean
          issue_date: string | null
          last_name: string | null
          last_synced_at: string
          license_number: string
          license_status: string
          license_status_raw: string | null
          license_type: string
          license_type_raw: string | null
          normalized_name: string
          phone: string | null
          postal_code: string | null
          raw: Json
          source_authority: string | null
          source_synced_at: string | null
          source_url: string | null
          state: string
          updated_at: string
          vet_profile_id: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          address_state?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          deactivated_at?: string | null
          expiration_date?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          issue_date?: string | null
          last_name?: string | null
          last_synced_at?: string
          license_number: string
          license_status: string
          license_status_raw?: string | null
          license_type: string
          license_type_raw?: string | null
          normalized_name: string
          phone?: string | null
          postal_code?: string | null
          raw?: Json
          source_authority?: string | null
          source_synced_at?: string | null
          source_url?: string | null
          state: string
          updated_at?: string
          vet_profile_id?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          address_state?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          deactivated_at?: string | null
          expiration_date?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          issue_date?: string | null
          last_name?: string | null
          last_synced_at?: string
          license_number?: string
          license_status?: string
          license_status_raw?: string | null
          license_type?: string
          license_type_raw?: string | null
          normalized_name?: string
          phone?: string | null
          postal_code?: string | null
          raw?: Json
          source_authority?: string | null
          source_synced_at?: string | null
          source_url?: string | null
          state?: string
          updated_at?: string
          vet_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_license_records_vet_profile_id_fkey"
            columns: ["vet_profile_id"]
            isOneToOne: false
            referencedRelation: "vet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_license_sources: {
        Row: {
          authority: string
          auto_sync_enabled: boolean
          created_at: string
          file_format: string | null
          import_method: string
          is_full_snapshot: boolean
          last_error: string | null
          last_success_at: string | null
          last_synced_at: string | null
          mapping: Json
          notes: string | null
          record_count: number
          refresh_cadence_days: number
          source_url: string | null
          state_code: string
          state_name: string
          updated_at: string
        }
        Insert: {
          authority: string
          auto_sync_enabled?: boolean
          created_at?: string
          file_format?: string | null
          import_method?: string
          is_full_snapshot?: boolean
          last_error?: string | null
          last_success_at?: string | null
          last_synced_at?: string | null
          mapping?: Json
          notes?: string | null
          record_count?: number
          refresh_cadence_days?: number
          source_url?: string | null
          state_code: string
          state_name: string
          updated_at?: string
        }
        Update: {
          authority?: string
          auto_sync_enabled?: boolean
          created_at?: string
          file_format?: string | null
          import_method?: string
          is_full_snapshot?: boolean
          last_error?: string | null
          last_success_at?: string | null
          last_synced_at?: string | null
          mapping?: Json
          notes?: string | null
          record_count?: number
          refresh_cadence_days?: number
          source_url?: string | null
          state_code?: string
          state_name?: string
          updated_at?: string
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
          account_rejection_reason: string | null
          account_status: Database["public"]["Enums"]["vet_account_status"]
          bio: string | null
          clinic_name: string
          created_at: string
          fear_free_cert_number: string | null
          fear_free_cert_url: string | null
          fear_free_certified: boolean
          fear_free_checked_at: string | null
          fear_free_raw: Json | null
          fear_free_reason: string | null
          fear_free_source: string | null
          fear_free_verification_status: Database["public"]["Enums"]["vet_verification_status"]
          fear_free_verified_at: string | null
          fear_free_verified_by: string | null
          first_name: string | null
          id: string
          identity_photo_captured_at: string | null
          identity_photo_path: string | null
          identity_reviewed_at: string | null
          identity_verified_by: string | null
          is_approved: boolean
          is_license_verified: boolean
          last_name: string | null
          license_db_match: Json | null
          license_document_url: string | null
          license_full_legal_name: string | null
          license_number: string | null
          license_state: string | null
          license_verified_at: string | null
          license_verified_by: string | null
          location: string | null
          merchant_id: string | null
          phone: string | null
          specializations: string[] | null
          updated_at: string
          user_id: string
          verification_checked_at: string | null
          verification_raw: Json | null
          verification_reason: string | null
          verification_source: string | null
          verification_source_url: string | null
          verification_status: Database["public"]["Enums"]["vet_verification_status"]
          vetted_affiliate_id: string | null
          vetted_affiliate_link: string | null
          website: string | null
        }
        Insert: {
          account_rejection_reason?: string | null
          account_status?: Database["public"]["Enums"]["vet_account_status"]
          bio?: string | null
          clinic_name?: string
          created_at?: string
          fear_free_cert_number?: string | null
          fear_free_cert_url?: string | null
          fear_free_certified?: boolean
          fear_free_checked_at?: string | null
          fear_free_raw?: Json | null
          fear_free_reason?: string | null
          fear_free_source?: string | null
          fear_free_verification_status?: Database["public"]["Enums"]["vet_verification_status"]
          fear_free_verified_at?: string | null
          fear_free_verified_by?: string | null
          first_name?: string | null
          id?: string
          identity_photo_captured_at?: string | null
          identity_photo_path?: string | null
          identity_reviewed_at?: string | null
          identity_verified_by?: string | null
          is_approved?: boolean
          is_license_verified?: boolean
          last_name?: string | null
          license_db_match?: Json | null
          license_document_url?: string | null
          license_full_legal_name?: string | null
          license_number?: string | null
          license_state?: string | null
          license_verified_at?: string | null
          license_verified_by?: string | null
          location?: string | null
          merchant_id?: string | null
          phone?: string | null
          specializations?: string[] | null
          updated_at?: string
          user_id: string
          verification_checked_at?: string | null
          verification_raw?: Json | null
          verification_reason?: string | null
          verification_source?: string | null
          verification_source_url?: string | null
          verification_status?: Database["public"]["Enums"]["vet_verification_status"]
          vetted_affiliate_id?: string | null
          vetted_affiliate_link?: string | null
          website?: string | null
        }
        Update: {
          account_rejection_reason?: string | null
          account_status?: Database["public"]["Enums"]["vet_account_status"]
          bio?: string | null
          clinic_name?: string
          created_at?: string
          fear_free_cert_number?: string | null
          fear_free_cert_url?: string | null
          fear_free_certified?: boolean
          fear_free_checked_at?: string | null
          fear_free_raw?: Json | null
          fear_free_reason?: string | null
          fear_free_source?: string | null
          fear_free_verification_status?: Database["public"]["Enums"]["vet_verification_status"]
          fear_free_verified_at?: string | null
          fear_free_verified_by?: string | null
          first_name?: string | null
          id?: string
          identity_photo_captured_at?: string | null
          identity_photo_path?: string | null
          identity_reviewed_at?: string | null
          identity_verified_by?: string | null
          is_approved?: boolean
          is_license_verified?: boolean
          last_name?: string | null
          license_db_match?: Json | null
          license_document_url?: string | null
          license_full_legal_name?: string | null
          license_number?: string | null
          license_state?: string | null
          license_verified_at?: string | null
          license_verified_by?: string | null
          location?: string | null
          merchant_id?: string | null
          phone?: string | null
          specializations?: string[] | null
          updated_at?: string
          user_id?: string
          verification_checked_at?: string | null
          verification_raw?: Json | null
          verification_reason?: string | null
          verification_source?: string | null
          verification_source_url?: string | null
          verification_status?: Database["public"]["Enums"]["vet_verification_status"]
          vetted_affiliate_id?: string | null
          vetted_affiliate_link?: string | null
          website?: string | null
        }
        Relationships: []
      }
      vet_ticket_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          read_by_admin: boolean
          read_by_owner: boolean
          read_by_vet: boolean
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_owner?: boolean
          read_by_vet?: boolean
          sender_id: string
          sender_role: string
          ticket_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_owner?: boolean
          read_by_vet?: boolean
          sender_id?: string
          sender_role?: string
          ticket_id?: string
        }
        Relationships: []
      }
      vet_tickets: {
        Row: {
          admin_notes: string | null
          approved_amount: number | null
          attestation_url: string | null
          authorized_until: string | null
          auto_approval_blockers: string[] | null
          bnpl_denied_all_providers: boolean | null
          card_id: string | null
          clinic_merchant_id: string | null
          clinic_name: string
          coverage_breakdown: Json | null
          created_at: string
          estimate_amount: number
          estimate_url: string | null
          id: string
          info_request_message: string | null
          info_requested_at: string | null
          info_requested_by: string | null
          info_responded_at: string | null
          info_response_message: string | null
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
          auto_approval_blockers?: string[] | null
          bnpl_denied_all_providers?: boolean | null
          card_id?: string | null
          clinic_merchant_id?: string | null
          clinic_name: string
          coverage_breakdown?: Json | null
          created_at?: string
          estimate_amount: number
          estimate_url?: string | null
          id?: string
          info_request_message?: string | null
          info_requested_at?: string | null
          info_requested_by?: string | null
          info_responded_at?: string | null
          info_response_message?: string | null
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
          auto_approval_blockers?: string[] | null
          bnpl_denied_all_providers?: boolean | null
          card_id?: string | null
          clinic_merchant_id?: string | null
          clinic_name?: string
          coverage_breakdown?: Json | null
          created_at?: string
          estimate_amount?: number
          estimate_url?: string | null
          id?: string
          info_request_message?: string | null
          info_requested_at?: string | null
          info_requested_by?: string | null
          info_responded_at?: string | null
          info_response_message?: string | null
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
      vet_verification_attempts: {
        Row: {
          attempted_at: string
          created_at: string
          error: string | null
          http_status: number | null
          id: string
          kind: string
          payload: Json | null
          source: string | null
          status: string
          vet_profile_id: string
        }
        Insert: {
          attempted_at?: string
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          kind: string
          payload?: Json | null
          source?: string | null
          status: string
          vet_profile_id: string
        }
        Update: {
          attempted_at?: string
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          kind?: string
          payload?: Json | null
          source?: string | null
          status?: string
          vet_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vet_verification_attempts_vet_profile_id_fkey"
            columns: ["vet_profile_id"]
            isOneToOne: false
            referencedRelation: "vet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vetted_products: {
        Row: {
          admin_hidden: boolean
          approval_status: string
          approved: boolean
          approved_at: string | null
          brand: string | null
          category: string
          created_at: string
          currency: string | null
          delisted_at: string | null
          description: string | null
          external_url: string
          id: string
          image_url: string | null
          listed_by: string | null
          name: string
          price_amount: number | null
          price_text: string | null
          raw_payload: Json
          sku: string | null
          source: string
          source_product_id: string | null
          store_name: string | null
          synced_at: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          admin_hidden?: boolean
          approval_status?: string
          approved?: boolean
          approved_at?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          currency?: string | null
          delisted_at?: string | null
          description?: string | null
          external_url: string
          id?: string
          image_url?: string | null
          listed_by?: string | null
          name: string
          price_amount?: number | null
          price_text?: string | null
          raw_payload?: Json
          sku?: string | null
          source?: string
          source_product_id?: string | null
          store_name?: string | null
          synced_at?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          admin_hidden?: boolean
          approval_status?: string
          approved?: boolean
          approved_at?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          currency?: string | null
          delisted_at?: string | null
          description?: string | null
          external_url?: string
          id?: string
          image_url?: string | null
          listed_by?: string | null
          name?: string
          price_amount?: number | null
          price_text?: string | null
          raw_payload?: Json
          sku?: string | null
          source?: string
          source_product_id?: string | null
          store_name?: string | null
          synced_at?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      vetted_sync_config: {
        Row: {
          adapter: string
          auth_header_name: string | null
          created_at: string
          enabled: boolean
          feed_url: string | null
          id: string
          last_success_at: string | null
          notes: string | null
          source: string
          updated_at: string
        }
        Insert: {
          adapter?: string
          auth_header_name?: string | null
          created_at?: string
          enabled?: boolean
          feed_url?: string | null
          id?: string
          last_success_at?: string | null
          notes?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          adapter?: string
          auth_header_name?: string | null
          created_at?: string
          enabled?: boolean
          feed_url?: string | null
          id?: string
          last_success_at?: string | null
          notes?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      vetted_sync_runs: {
        Row: {
          created_at: string
          created_count: number
          delisted_count: number
          errors: Json
          filename: string | null
          finished_at: string | null
          id: string
          mode: string
          run_by: string | null
          skipped_count: number
          source: string
          started_at: string
          status: string
          total_count: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          delisted_count?: number
          errors?: Json
          filename?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          run_by?: string | null
          skipped_count?: number
          source: string
          started_at?: string
          status?: string
          total_count?: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          delisted_count?: number
          errors?: Json
          filename?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          run_by?: string | null
          skipped_count?: number
          source?: string
          started_at?: string
          status?: string
          total_count?: number
          updated_count?: number
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
      webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string | null
          id: string
          payload: Json | null
          processed_at: string
          provider: string
          status: string
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string
          provider?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string
          provider?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_community_reserve_balance: {
        Row: {
          balance: number | null
        }
        Relationships: []
      }
      v_ledger_balances: {
        Row: {
          accrued: number | null
          available: number | null
          bucket: string | null
          expired: number | null
          held: number | null
          paid_out: number | null
          pet_id: string | null
          spent: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_member_reserve_balance: {
        Row: {
          accrued: number | null
          available: number | null
          held: number | null
          pet_id: string | null
          spent: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_pet_dp_balance: {
        Row: {
          accrued: number | null
          available: number | null
          expired: number | null
          held: number | null
          pet_id: string | null
          spent: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      allocate_bnpl_payment_to_installments: {
        Args: { _obligation_id: string }
        Returns: undefined
      }
      can_access_vet_ticket: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: boolean
      }
      consume_dp_for_ticket: {
        Args: {
          _amount: number
          _ticket_id: string
          _user_id: string
          _window_months: number
        }
        Returns: number
      }
      consume_reserve_for_ticket: {
        Args: { _amount: number; _ticket_id: string; _user_id: string }
        Returns: number
      }
      gen_referral_code: { Args: never; Returns: string }
      generate_bnpl_installments: {
        Args: { _obligation_id: string }
        Returns: undefined
      }
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
      is_verified_vet: { Args: { _user_id: string }; Returns: boolean }
      is_verified_vet_profile: {
        Args: { _user_id: string; _vet_profile_id: string }
        Returns: boolean
      }
      is_vet_profile_owner: {
        Args: { _user_id: string; _vet_profile_id: string }
        Returns: boolean
      }
      mark_obligation_default: {
        Args: { _obligation_id: string }
        Returns: undefined
      }
      mark_ticket_settled: {
        Args: {
          _authorization_id: string
          _settled_amount: number
          _ticket_id: string
        }
        Returns: undefined
      }
      post_ledger_entry: {
        Args: {
          _accrual_id?: string
          _amount: number
          _bucket: string
          _description?: string
          _entry_type: string
          _external_ref?: string
          _idempotency_key: string
          _membership_id?: string
          _metadata?: Json
          _obligation_id?: string
          _pet_id?: string
          _ticket_id?: string
          _user_id: string
        }
        Returns: string
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
      record_milestone_contribution: {
        Args: {
          _amount: number
          _milestone_id: string
          _payment_history_id?: string
          _source?: string
        }
        Returns: undefined
      }
      release_reserve_for_ticket: {
        Args: { _ticket_id: string }
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
      reverse_ticket_settlement: {
        Args: {
          _amount: number
          _external_ref: string
          _reason: string
          _ticket_id: string
        }
        Returns: undefined
      }
      search_vet_licenses: {
        Args: { _limit?: number; _q: string; _state?: string }
        Returns: {
          address_line1: string | null
          address_line2: string | null
          address_state: string | null
          city: string | null
          county: string | null
          created_at: string
          deactivated_at: string | null
          expiration_date: string | null
          first_name: string | null
          full_name: string
          id: string
          is_active: boolean
          issue_date: string | null
          last_name: string | null
          last_synced_at: string
          license_number: string
          license_status: string
          license_status_raw: string | null
          license_type: string
          license_type_raw: string | null
          normalized_name: string
          phone: string | null
          postal_code: string | null
          raw: Json
          source_authority: string | null
          source_synced_at: string | null
          source_url: string | null
          state: string
          updated_at: string
          vet_profile_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vet_license_records"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_status_context: {
        Args: { _changer: string; _source: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_bnpl_paused_for_user: {
        Args: { _user_id: string }
        Returns: undefined
      }
      user_has_any_role: { Args: { _user_id: string }; Returns: boolean }
      vet_ticket_role_for: {
        Args: { _ticket_id: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "pet_owner" | "vet" | "admin" | "content_editor"
      bnpl_obligation_status:
        | "pending"
        | "active"
        | "paid_off"
        | "defaulted"
        | "cancelled"
      help_now_campaign_status:
        | "draft"
        | "published"
        | "funded"
        | "expired"
        | "cancelled"
      referrer_type: "vet" | "shelter" | "influencer" | "partner"
      transaction_type:
        | "donation_received"
        | "donation_sent"
        | "withdrawal"
        | "vet_payment"
        | "refund"
      vet_account_status: "pending_verification" | "verified" | "rejected"
      vet_payout_method: "manual_ach" | "issued_card" | "direct_charge"
      vet_payout_status:
        | "pending"
        | "sent"
        | "completed"
        | "failed"
        | "reversed"
        | "settled"
        | "cancelled"
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
        | "awaiting_secondary_review"
        | "auto_approved"
        | "needs_info"
      vet_verification_status:
        | "pending"
        | "verified"
        | "unverified"
        | "pending_review"
        | "manual_override"
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
      app_role: ["pet_owner", "vet", "admin", "content_editor"],
      bnpl_obligation_status: [
        "pending",
        "active",
        "paid_off",
        "defaulted",
        "cancelled",
      ],
      help_now_campaign_status: [
        "draft",
        "published",
        "funded",
        "expired",
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
      vet_account_status: ["pending_verification", "verified", "rejected"],
      vet_payout_method: ["manual_ach", "issued_card", "direct_charge"],
      vet_payout_status: [
        "pending",
        "sent",
        "completed",
        "failed",
        "reversed",
        "settled",
        "cancelled",
      ],
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
        "awaiting_secondary_review",
        "auto_approved",
        "needs_info",
      ],
      vet_verification_status: [
        "pending",
        "verified",
        "unverified",
        "pending_review",
        "manual_override",
      ],
    },
  },
} as const
