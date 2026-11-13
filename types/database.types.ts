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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          audience: Database["public"]["Enums"]["announcement_audience"]
          created_at: string
          created_by: string
          delivery_channels: Database["public"]["Enums"]["communication_channel"][]
          event_id: string
          id: string
          message: string
          metadata: Json
          organization_id: string
          published_at: string | null
          race_category_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["announcement_status"]
          title: string
          updated_at: string
        }
        Insert: {
          audience: Database["public"]["Enums"]["announcement_audience"]
          created_at?: string
          created_by: string
          delivery_channels?: Database["public"]["Enums"]["communication_channel"][]
          event_id: string
          id?: string
          message: string
          metadata?: Json
          organization_id: string
          published_at?: string | null
          race_category_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["announcement_audience"]
          created_at?: string
          created_by?: string
          delivery_channels?: Database["public"]["Enums"]["communication_channel"][]
          event_id?: string
          id?: string
          message?: string
          metadata?: Json
          organization_id?: string
          published_at?: string | null
          race_category_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_race_category_id_fkey"
            columns: ["race_category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_role_context: string | null
          actor_user_id: string | null
          created_at: string
          event_id: string | null
          id: string
          ip_address: unknown
          metadata: Json
          new_values: Json | null
          occurred_at: string
          organization_id: string | null
          previous_values: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_role_context?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          occurred_at?: string
          organization_id?: string | null
          previous_values?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_role_context?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_values?: Json | null
          occurred_at?: string
          organization_id?: string | null
          previous_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bibs: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assignment_source:
            | Database["public"]["Enums"]["bib_assignment_source"]
            | null
          bib_code: string
          bib_number: number
          category_id: string
          created_at: string
          event_id: string
          id: string
          metadata: Json
          prefix: string | null
          registration_id: string | null
          released_at: string | null
          released_by: string | null
          status: Database["public"]["Enums"]["bib_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignment_source?:
            | Database["public"]["Enums"]["bib_assignment_source"]
            | null
          bib_code: string
          bib_number: number
          category_id: string
          created_at?: string
          event_id: string
          id?: string
          metadata?: Json
          prefix?: string | null
          registration_id?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: Database["public"]["Enums"]["bib_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assignment_source?:
            | Database["public"]["Enums"]["bib_assignment_source"]
            | null
          bib_code?: string
          bib_number?: number
          category_id?: string
          created_at?: string
          event_id?: string
          id?: string
          metadata?: Json
          prefix?: string | null
          registration_id?: string | null
          released_at?: string | null
          released_by?: string | null
          status?: Database["public"]["Enums"]["bib_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bibs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bibs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bibs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          background_asset_reference: string | null
          certificate_message: string | null
          certificate_title: string
          created_at: string
          created_by: string | null
          event_logo_reference: string | null
          id: string
          is_system_template: boolean
          layout_config: Json
          name: string
          organization_id: string | null
          organizer_logo_reference: string | null
          signatory_name: string | null
          signatory_position: string | null
          signature_image_reference: string | null
          sponsor_logo_config: Json
          status: Database["public"]["Enums"]["certificate_template_status"]
          updated_at: string
          version: number
        }
        Insert: {
          background_asset_reference?: string | null
          certificate_message?: string | null
          certificate_title: string
          created_at?: string
          created_by?: string | null
          event_logo_reference?: string | null
          id?: string
          is_system_template?: boolean
          layout_config?: Json
          name: string
          organization_id?: string | null
          organizer_logo_reference?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          signature_image_reference?: string | null
          sponsor_logo_config?: Json
          status?: Database["public"]["Enums"]["certificate_template_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          background_asset_reference?: string | null
          certificate_message?: string | null
          certificate_title?: string
          created_at?: string
          created_by?: string | null
          event_logo_reference?: string | null
          id?: string
          is_system_template?: boolean
          layout_config?: Json
          name?: string
          organization_id?: string | null
          organizer_logo_reference?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          signature_image_reference?: string | null
          sponsor_logo_config?: Json
          status?: Database["public"]["Enums"]["certificate_template_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          bib_code_snapshot: string | null
          bib_id: string | null
          category_name_snapshot: string
          certificate_reference: string
          created_at: string
          document_storage_reference: string | null
          event_date_snapshot: string
          event_id: string
          event_name_snapshot: string
          finish_time_snapshot: string | null
          generated_at: string
          generated_by: string | null
          generation_metadata: Json
          id: string
          organization_id: string
          participant_id: string | null
          participant_name_snapshot: string
          race_category_id: string
          rank_snapshot: number | null
          registration_id: string
          result_id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: Database["public"]["Enums"]["certificate_status"]
          template_id: string
          template_snapshot: Json
          template_version: number
          updated_at: string
          verification_path: string | null
          verification_token: string
        }
        Insert: {
          bib_code_snapshot?: string | null
          bib_id?: string | null
          category_name_snapshot: string
          certificate_reference: string
          created_at?: string
          document_storage_reference?: string | null
          event_date_snapshot: string
          event_id: string
          event_name_snapshot: string
          finish_time_snapshot?: string | null
          generated_at?: string
          generated_by?: string | null
          generation_metadata?: Json
          id?: string
          organization_id: string
          participant_id?: string | null
          participant_name_snapshot: string
          race_category_id: string
          rank_snapshot?: number | null
          registration_id: string
          result_id: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          template_id: string
          template_snapshot: Json
          template_version: number
          updated_at?: string
          verification_path?: string | null
          verification_token?: string
        }
        Update: {
          bib_code_snapshot?: string | null
          bib_id?: string | null
          category_name_snapshot?: string
          certificate_reference?: string
          created_at?: string
          document_storage_reference?: string | null
          event_date_snapshot?: string
          event_id?: string
          event_name_snapshot?: string
          finish_time_snapshot?: string | null
          generated_at?: string
          generated_by?: string | null
          generation_metadata?: Json
          id?: string
          organization_id?: string
          participant_id?: string | null
          participant_name_snapshot?: string
          race_category_id?: string
          rank_snapshot?: number | null
          registration_id?: string
          result_id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          template_id?: string
          template_snapshot?: Json
          template_version?: number
          updated_at?: string
          verification_path?: string | null
          verification_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_bib_id_fkey"
            columns: ["bib_id"]
            isOneToOne: false
            referencedRelation: "bibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_race_category_id_fkey"
            columns: ["race_category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      content_blocks: {
        Row: {
          body: string | null
          configuration: Json
          content_key: string
          content_type: Database["public"]["Enums"]["platform_content_type"]
          created_at: string
          created_by: string | null
          display_order: number
          event_id: string | null
          id: string
          is_active: boolean
          is_published: boolean
          media_reference: string | null
          published_at: string | null
          published_by: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string | null
          configuration?: Json
          content_key: string
          content_type: Database["public"]["Enums"]["platform_content_type"]
          created_at?: string
          created_by?: string | null
          display_order?: number
          event_id?: string | null
          id?: string
          is_active?: boolean
          is_published?: boolean
          media_reference?: string | null
          published_at?: string | null
          published_by?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string | null
          configuration?: Json
          content_key?: string
          content_type?: Database["public"]["Enums"]["platform_content_type"]
          created_at?: string
          created_by?: string | null
          display_order?: number
          event_id?: string | null
          id?: string
          is_active?: boolean
          is_published?: boolean
          media_reference?: string | null
          published_at?: string | null
          published_by?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_blocks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_logs: {
        Row: {
          created_at: string
          email_message_id: string
          event_type: Database["public"]["Enums"]["email_delivery_event_type"]
          failure_reason: string | null
          id: string
          metadata: Json
          occurred_at: string
          provider_event_id: string
          provider_message_id: string | null
          provider_response: Json
        }
        Insert: {
          created_at?: string
          email_message_id: string
          event_type: Database["public"]["Enums"]["email_delivery_event_type"]
          failure_reason?: string | null
          id?: string
          metadata?: Json
          occurred_at: string
          provider_event_id: string
          provider_message_id?: string | null
          provider_response?: Json
        }
        Update: {
          created_at?: string
          email_message_id?: string
          event_type?: Database["public"]["Enums"]["email_delivery_event_type"]
          failure_reason?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          provider_event_id?: string
          provider_message_id?: string | null
          provider_response?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_logs_email_message_id_fkey"
            columns: ["email_message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          announcement_id: string | null
          created_at: string
          delivered_at: string | null
          email_type: Database["public"]["Enums"]["email_type"]
          event_id: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          invoice_id: string | null
          organization_id: string | null
          payment_id: string | null
          provider_message_id: string | null
          provider_metadata: Json
          queued_at: string
          receipt_id: string | null
          recipient_email: string
          recipient_user_id: string | null
          registration_id: string | null
          reminder_setting_id: string | null
          rendered_body_reference: string | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template_id: string | null
          template_snapshot: Json
          template_version: number
          updated_at: string
        }
        Insert: {
          announcement_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email_type: Database["public"]["Enums"]["email_type"]
          event_id?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          invoice_id?: string | null
          organization_id?: string | null
          payment_id?: string | null
          provider_message_id?: string | null
          provider_metadata?: Json
          queued_at?: string
          receipt_id?: string | null
          recipient_email: string
          recipient_user_id?: string | null
          registration_id?: string | null
          reminder_setting_id?: string | null
          rendered_body_reference?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template_id?: string | null
          template_snapshot: Json
          template_version: number
          updated_at?: string
        }
        Update: {
          announcement_id?: string | null
          created_at?: string
          delivered_at?: string | null
          email_type?: Database["public"]["Enums"]["email_type"]
          event_id?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string | null
          organization_id?: string | null
          payment_id?: string | null
          provider_message_id?: string | null
          provider_metadata?: Json
          queued_at?: string
          receipt_id?: string | null
          recipient_email?: string
          recipient_user_id?: string | null
          registration_id?: string | null
          reminder_setting_id?: string | null
          rendered_body_reference?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template_id?: string | null
          template_snapshot?: Json
          template_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "payment_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_reminder_setting_id_fkey"
            columns: ["reminder_setting_id"]
            isOneToOne: false
            referencedRelation: "event_reminder_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          content_template: Json
          created_at: string
          event_id: string | null
          id: string
          name: string
          organization_id: string | null
          status: Database["public"]["Enums"]["template_status"]
          subject_template: string
          system_managed: boolean
          template_type: Database["public"]["Enums"]["email_type"]
          updated_at: string
          version_number: number
        }
        Insert: {
          content_template: Json
          created_at?: string
          event_id?: string | null
          id?: string
          name: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          subject_template: string
          system_managed?: boolean
          template_type: Database["public"]["Enums"]["email_type"]
          updated_at?: string
          version_number: number
        }
        Update: {
          content_template?: Json
          created_at?: string
          event_id?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          status?: Database["public"]["Enums"]["template_status"]
          subject_template?: string
          system_managed?: boolean
          template_type?: Database["public"]["Enums"]["email_type"]
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_certificate_categories: {
        Row: {
          created_at: string
          race_category_id: string
          settings_id: string
        }
        Insert: {
          created_at?: string
          race_category_id: string
          settings_id: string
        }
        Update: {
          created_at?: string
          race_category_id?: string
          settings_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_certificate_categories_race_category_id_fkey"
            columns: ["race_category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_certificate_categories_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "event_certificate_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      event_certificate_settings: {
        Row: {
          certificate_message: string | null
          certificate_title: string | null
          created_at: string
          eligibility_mode: Database["public"]["Enums"]["certificate_eligibility_mode"]
          enabled: boolean
          event_id: string
          event_logo_reference: string | null
          id: string
          organization_id: string
          organizer_logo_reference: string | null
          signatory_name: string | null
          signatory_position: string | null
          signature_image_reference: string | null
          sponsor_logo_config: Json
          template_id: string | null
          updated_at: string
        }
        Insert: {
          certificate_message?: string | null
          certificate_title?: string | null
          created_at?: string
          eligibility_mode?: Database["public"]["Enums"]["certificate_eligibility_mode"]
          enabled?: boolean
          event_id: string
          event_logo_reference?: string | null
          id?: string
          organization_id: string
          organizer_logo_reference?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          signature_image_reference?: string | null
          sponsor_logo_config?: Json
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          certificate_message?: string | null
          certificate_title?: string | null
          created_at?: string
          eligibility_mode?: Database["public"]["Enums"]["certificate_eligibility_mode"]
          enabled?: boolean
          event_id?: string
          event_logo_reference?: string | null
          id?: string
          organization_id?: string
          organizer_logo_reference?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          signature_image_reference?: string | null
          sponsor_logo_config?: Json
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_certificate_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_certificate_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_certificate_settings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_partners: {
        Row: {
          display_order: number | null
          event_id: string
          id: string
          logo_url: string | null
          name: string
          partner_type: string | null
        }
        Insert: {
          display_order?: number | null
          event_id: string
          id?: string
          logo_url?: string | null
          name: string
          partner_type?: string | null
        }
        Update: {
          display_order?: number | null
          event_id?: string
          id?: string
          logo_url?: string | null
          name?: string
          partner_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_partners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_field_options: {
        Row: {
          display_order: number
          field_id: string
          id: string
          label: string
          value: string
        }
        Insert: {
          display_order?: number
          field_id: string
          id?: string
          label: string
          value: string
        }
        Update: {
          display_order?: number
          field_id?: string
          id?: string
          label?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_field_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "event_registration_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_fields: {
        Row: {
          created_at: string
          display_order: number
          event_id: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          section_key: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          event_id: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          section_key?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          event_id?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          section_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_fields_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminder_settings: {
        Row: {
          created_at: string
          custom_schedule_at: string | null
          enabled: boolean
          event_id: string
          id: string
          instructions: string | null
          lead_time_minutes: number
          organization_id: string
          reminder_key: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_schedule_at?: string | null
          enabled?: boolean
          event_id: string
          id?: string
          instructions?: string | null
          lead_time_minutes: number
          organization_id: string
          reminder_key: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_schedule_at?: string | null
          enabled?: boolean
          event_id?: string
          id?: string
          instructions?: string | null
          lead_time_minutes?: number
          organization_id?: string
          reminder_key?: string
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminder_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reminder_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_review_history: {
        Row: {
          event_id: string
          feedback: string | null
          from_status: Database["public"]["Enums"]["event_review_status"] | null
          id: string
          reviewed_at: string
          reviewed_by: string | null
          to_status: Database["public"]["Enums"]["event_review_status"]
        }
        Insert: {
          event_id: string
          feedback?: string | null
          from_status?:
            | Database["public"]["Enums"]["event_review_status"]
            | null
          id?: string
          reviewed_at?: string
          reviewed_by?: string | null
          to_status: Database["public"]["Enums"]["event_review_status"]
        }
        Update: {
          event_id?: string
          feedback?: string | null
          from_status?:
            | Database["public"]["Enums"]["event_review_status"]
            | null
          id?: string
          reviewed_at?: string
          reviewed_by?: string | null
          to_status?: Database["public"]["Enums"]["event_review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_review_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_routes: {
        Row: {
          category_label: string | null
          description: string | null
          event_id: string
          finish_point: string | null
          id: string
          route_map_url: string | null
          starting_point: string | null
        }
        Insert: {
          category_label?: string | null
          description?: string | null
          event_id: string
          finish_point?: string | null
          id?: string
          route_map_url?: string | null
          starting_point?: string | null
        }
        Update: {
          category_label?: string | null
          description?: string | null
          event_id?: string
          finish_point?: string | null
          id?: string
          route_map_url?: string | null
          starting_point?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_routes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_schedules: {
        Row: {
          event_id: string
          id: string
          label: string
          notes: string | null
          scheduled_at: string
        }
        Insert: {
          event_id: string
          id?: string
          label: string
          notes?: string | null
          scheduled_at: string
        }
        Update: {
          event_id?: string
          id?: string
          label?: string
          notes?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_schedules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          event_id: string
          from_status:
            | Database["public"]["Enums"]["event_lifecycle_status"]
            | null
          id: string
          to_status: Database["public"]["Enums"]["event_lifecycle_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          event_id: string
          from_status?:
            | Database["public"]["Enums"]["event_lifecycle_status"]
            | null
          id?: string
          to_status: Database["public"]["Enums"]["event_lifecycle_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          event_id?: string
          from_status?:
            | Database["public"]["Enums"]["event_lifecycle_status"]
            | null
          id?: string
          to_status?: Database["public"]["Enums"]["event_lifecycle_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_status_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waiver_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          device_context: Json
          event_id: string
          event_waiver_id: string
          id: string
          ip_address: unknown
          organization_id: string
          participant_id: string | null
          registration_id: string
          source_context: string | null
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          device_context?: Json
          event_id: string
          event_waiver_id: string
          id?: string
          ip_address?: unknown
          organization_id: string
          participant_id?: string | null
          registration_id: string
          source_context?: string | null
        }
        Update: {
          accepted_at?: string
          created_at?: string
          device_context?: Json
          event_id?: string
          event_waiver_id?: string
          id?: string
          ip_address?: unknown
          organization_id?: string
          participant_id?: string | null
          registration_id?: string
          source_context?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_waiver_acceptances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waiver_acceptances_event_waiver_id_fkey"
            columns: ["event_waiver_id"]
            isOneToOne: false
            referencedRelation: "event_waivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waiver_acceptances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waiver_acceptances_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_waivers: {
        Row: {
          content: string | null
          content_storage_reference: string | null
          created_at: string
          created_by: string | null
          effective_at: string
          event_id: string
          id: string
          organization_id: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["event_waiver_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: string | null
          content_storage_reference?: string | null
          created_at?: string
          created_by?: string | null
          effective_at: string
          event_id: string
          id?: string
          organization_id: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["event_waiver_status"]
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          content?: string | null
          content_storage_reference?: string | null
          created_at?: string
          created_by?: string | null
          effective_at?: string
          event_id?: string
          id?: string
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["event_waiver_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_waivers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_waivers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          assembly_time: string | null
          banner_url: string | null
          banner_position_x: number
          banner_position_y: number
          banner_zoom: number
          created_at: string
          created_by: string | null
          cutoff_time: string | null
          description: string | null
          event_date: string
          gun_start_time: string | null
          id: string
          is_featured: boolean
          latitude: number | null
          lifecycle_status: Database["public"]["Enums"]["event_lifecycle_status"]
          logo_url: string | null
          longitude: number | null
          name: string
          organization_id: string
          overall_capacity: number | null
          registration_availability: Database["public"]["Enums"]["registration_availability_status"]
          registration_closes_at: string | null
          registration_opens_at: string | null
          review_feedback: string | null
          review_status: Database["public"]["Enums"]["event_review_status"]
          slug: string
          social_links: Json | null
          registration_personal_fields: string[]
          start_time: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          address?: string | null
          assembly_time?: string | null
          banner_url?: string | null
          banner_position_x?: number
          banner_position_y?: number
          banner_zoom?: number
          created_at?: string
          created_by?: string | null
          cutoff_time?: string | null
          description?: string | null
          event_date: string
          gun_start_time?: string | null
          id?: string
          is_featured?: boolean
          latitude?: number | null
          lifecycle_status?: Database["public"]["Enums"]["event_lifecycle_status"]
          logo_url?: string | null
          longitude?: number | null
          name: string
          organization_id: string
          overall_capacity?: number | null
          registration_availability?: Database["public"]["Enums"]["registration_availability_status"]
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          review_feedback?: string | null
          review_status?: Database["public"]["Enums"]["event_review_status"]
          slug: string
          social_links?: Json | null
          registration_personal_fields?: string[]
          start_time?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          address?: string | null
          assembly_time?: string | null
          banner_url?: string | null
          banner_position_x?: number
          banner_position_y?: number
          banner_zoom?: number
          created_at?: string
          created_by?: string | null
          cutoff_time?: string | null
          description?: string | null
          event_date?: string
          gun_start_time?: string | null
          id?: string
          is_featured?: boolean
          latitude?: number | null
          lifecycle_status?: Database["public"]["Enums"]["event_lifecycle_status"]
          logo_url?: string | null
          longitude?: number | null
          name?: string
          organization_id?: string
          overall_capacity?: number | null
          registration_availability?: Database["public"]["Enums"]["registration_availability_status"]
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          review_feedback?: string | null
          review_status?: Database["public"]["Enums"]["event_review_status"]
          slug?: string
          social_links?: Json | null
          registration_personal_fields?: string[]
          start_time?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_reconciliation_records: {
        Row: {
          created_at: string
          discrepancy_amount: number
          discrepancy_status: Database["public"]["Enums"]["reconciliation_discrepancy_status"]
          gateway_provider: string | null
          gateway_reported_gross_amount: number
          gateway_reported_net_collected_amount: number | null
          id: string
          net_collected_amount: number
          notes: string | null
          organization_id: string | null
          organizer_split_amount: number
          other_adjustments_amount: number
          platform_fees_amount: number
          processing_fees_amount: number
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_period_end: string
          reconciliation_period_start: string
          reconciliation_reference: string
          recorded_gross_payments: number
          refunds_amount: number
          source_metadata: Json
          status: Database["public"]["Enums"]["reconciliation_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          discrepancy_amount?: number
          discrepancy_status?: Database["public"]["Enums"]["reconciliation_discrepancy_status"]
          gateway_provider?: string | null
          gateway_reported_gross_amount?: number
          gateway_reported_net_collected_amount?: number | null
          id?: string
          net_collected_amount?: number
          notes?: string | null
          organization_id?: string | null
          organizer_split_amount?: number
          other_adjustments_amount?: number
          platform_fees_amount?: number
          processing_fees_amount?: number
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_period_end: string
          reconciliation_period_start: string
          reconciliation_reference: string
          recorded_gross_payments?: number
          refunds_amount?: number
          source_metadata?: Json
          status?: Database["public"]["Enums"]["reconciliation_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          discrepancy_amount?: number
          discrepancy_status?: Database["public"]["Enums"]["reconciliation_discrepancy_status"]
          gateway_provider?: string | null
          gateway_reported_gross_amount?: number
          gateway_reported_net_collected_amount?: number | null
          id?: string
          net_collected_amount?: number
          notes?: string | null
          organization_id?: string | null
          organizer_split_amount?: number
          other_adjustments_amount?: number
          platform_fees_amount?: number
          processing_fees_amount?: number
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_period_end?: string
          reconciliation_period_start?: string
          reconciliation_reference?: string
          recorded_gross_payments?: number
          refunds_amount?: number
          source_metadata?: Json
          status?: Database["public"]["Enums"]["reconciliation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_reconciliation_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_role_permissions: {
        Row: {
          permission_id: string
          role: Database["public"]["Enums"]["racedeck_internal_role"]
        }
        Insert: {
          permission_id: string
          role: Database["public"]["Enums"]["racedeck_internal_role"]
        }
        Update: {
          permission_id?: string
          role?: Database["public"]["Enums"]["racedeck_internal_role"]
        }
        Relationships: [
          {
            foreignKeyName: "internal_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string
          discount_amount: number
          document_hash: string | null
          event_id: string
          event_name: string
          id: string
          invoice_number: number
          invoice_reference: string
          is_official_tax_invoice: boolean
          issuance_mode: Database["public"]["Enums"]["organization_invoice_mode"]
          issued_at: string | null
          issuer_address: string
          issuer_business_name: string | null
          issuer_organization_name: string
          issuer_tax_address: string | null
          issuer_tax_registered_name: string | null
          issuer_tax_registration_number: string | null
          line_items: Json
          metadata: Json
          organization_id: string
          participant_email: string
          participant_name: string
          payment_id: string
          platform_fee: number
          processing_fee: number
          registration_amount: number
          registration_id: string
          registration_number: string
          status: Database["public"]["Enums"]["invoice_status"]
          storage_reference: string | null
          subtotal_amount: number
          tax_amount: number
          tax_details: Json
          tax_invoice_disclaimer: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          discount_amount?: number
          document_hash?: string | null
          event_id: string
          event_name: string
          id?: string
          invoice_number?: never
          invoice_reference: string
          is_official_tax_invoice?: boolean
          issuance_mode: Database["public"]["Enums"]["organization_invoice_mode"]
          issued_at?: string | null
          issuer_address: string
          issuer_business_name?: string | null
          issuer_organization_name: string
          issuer_tax_address?: string | null
          issuer_tax_registered_name?: string | null
          issuer_tax_registration_number?: string | null
          line_items?: Json
          metadata?: Json
          organization_id: string
          participant_email: string
          participant_name: string
          payment_id: string
          platform_fee?: number
          processing_fee?: number
          registration_amount?: number
          registration_id: string
          registration_number: string
          status?: Database["public"]["Enums"]["invoice_status"]
          storage_reference?: string | null
          subtotal_amount?: number
          tax_amount?: number
          tax_details?: Json
          tax_invoice_disclaimer?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          discount_amount?: number
          document_hash?: string | null
          event_id?: string
          event_name?: string
          id?: string
          invoice_number?: never
          invoice_reference?: string
          is_official_tax_invoice?: boolean
          issuance_mode?: Database["public"]["Enums"]["organization_invoice_mode"]
          issued_at?: string | null
          issuer_address?: string
          issuer_business_name?: string | null
          issuer_organization_name?: string
          issuer_tax_address?: string | null
          issuer_tax_registered_name?: string | null
          issuer_tax_registration_number?: string | null
          line_items?: Json
          metadata?: Json
          organization_id?: string
          participant_email?: string
          participant_name?: string
          payment_id?: string
          platform_fee?: number
          processing_fee?: number
          registration_amount?: number
          registration_id?: string
          registration_number?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          storage_reference?: string | null
          subtotal_amount?: number
          tax_amount?: number
          tax_details?: Json
          tax_invoice_disclaimer?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          device_context: Json
          id: string
          ip_address: unknown
          legal_document_id: string
          source_context: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          device_context?: Json
          id?: string
          ip_address?: unknown
          legal_document_id: string
          source_context?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          device_context?: Json
          id?: string
          ip_address?: unknown
          legal_document_id?: string
          source_context?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: string | null
          content_storage_reference: string | null
          created_at: string
          created_by: string | null
          document_type: Database["public"]["Enums"]["legal_document_type"]
          effective_at: string
          id: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["legal_document_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: string | null
          content_storage_reference?: string | null
          created_at?: string
          created_by?: string | null
          document_type: Database["public"]["Enums"]["legal_document_type"]
          effective_at: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["legal_document_status"]
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          content?: string | null
          content_storage_reference?: string | null
          created_at?: string
          created_by?: string | null
          document_type?: Database["public"]["Enums"]["legal_document_type"]
          effective_at?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["legal_document_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          delivered_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          notification_id: string
          provider_reference: string | null
          queued_at: string
          recipient_user_id: string
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          notification_id: string
          provider_reference?: string | null
          queued_at?: string
          recipient_user_id: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          notification_id?: string
          provider_reference?: string | null
          queued_at?: string
          recipient_user_id?: string
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          notification_type: Database["public"]["Enums"]["notification_type"]
          organization_id: string | null
          read_at: string | null
          recipient_user_id: string
          registration_id: string | null
          reminder_setting_id: string | null
          source_announcement_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          notification_type: Database["public"]["Enums"]["notification_type"]
          organization_id?: string | null
          read_at?: string | null
          recipient_user_id: string
          registration_id?: string | null
          reminder_setting_id?: string | null
          source_announcement_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          notification_type?: Database["public"]["Enums"]["notification_type"]
          organization_id?: string | null
          read_at?: string | null
          recipient_user_id?: string
          registration_id?: string | null
          reminder_setting_id?: string | null
          source_announcement_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_reminder_setting_id_fkey"
            columns: ["reminder_setting_id"]
            isOneToOne: false
            referencedRelation: "event_reminder_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_source_announcement_id_fkey"
            columns: ["source_announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          restricted_event_ids: string[] | null
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id: string
          restricted_event_ids?: string[] | null
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          restricted_event_ids?: string[] | null
          role?: Database["public"]["Enums"]["organization_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          role: Database["public"]["Enums"]["organization_role"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          role: Database["public"]["Enums"]["organization_role"]
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          role?: Database["public"]["Enums"]["organization_role"]
        }
        Relationships: []
      }
      organizations: {
        Row: {
          account_status: Database["public"]["Enums"]["organization_account_status"]
          address: string | null
          city: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contact_phone_extension: string | null
          country_code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          invoice_mode: Database["public"]["Enums"]["organization_invoice_mode"]
          is_nonprofit: boolean
          logo_url: string | null
          name: string
          postal_code: string | null
          slug: string
          social_links: Json | null
          state_province: string | null
          timezone: string
          updated_at: string
          verification_documents: Json | null
          verification_status: Database["public"]["Enums"]["organization_verification_status"]
          website: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["organization_account_status"]
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contact_phone_extension?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invoice_mode?: Database["public"]["Enums"]["organization_invoice_mode"]
          is_nonprofit?: boolean
          logo_url?: string | null
          name: string
          postal_code?: string | null
          slug: string
          social_links?: Json | null
          state_province?: string | null
          timezone?: string
          updated_at?: string
          verification_documents?: Json | null
          verification_status?: Database["public"]["Enums"]["organization_verification_status"]
          website?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["organization_account_status"]
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contact_phone_extension?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invoice_mode?: Database["public"]["Enums"]["organization_invoice_mode"]
          is_nonprofit?: boolean
          logo_url?: string | null
          name?: string
          postal_code?: string | null
          slug?: string
          social_links?: Json | null
          state_province?: string | null
          timezone?: string
          updated_at?: string
          verification_documents?: Json | null
          verification_status?: Database["public"]["Enums"]["organization_verification_status"]
          website?: string | null
        }
        Relationships: []
      }
      organizer_verifications: {
        Row: {
          business_name: string | null
          created_at: string
          document_storage_references: Json
          id: string
          legal_name: string | null
          organization_id: string
          registration_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["organizer_verification_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          document_storage_references?: Json
          id?: string
          legal_name?: string | null
          organization_id: string
          registration_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["organizer_verification_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          document_storage_references?: Json
          id?: string
          legal_name?: string | null
          organization_id?: string
          registration_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["organizer_verification_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizer_verifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_receipts: {
        Row: {
          created_at: string
          currency: string
          discount_amount: number
          document_hash: string | null
          event_id: string
          event_name: string
          gateway_transaction_reference: string | null
          generated_at: string
          id: string
          metadata: Json
          organization_id: string
          organization_name: string
          participant_email: string
          participant_name: string
          payment_date: string
          payment_id: string
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          platform_fee: number
          processing_fee: number
          race_category_name: string
          receipt_reference: string
          registration_amount: number
          registration_id: string
          registration_number: string
          storage_reference: string | null
          total_paid: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          discount_amount?: number
          document_hash?: string | null
          event_id: string
          event_name: string
          gateway_transaction_reference?: string | null
          generated_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          organization_name: string
          participant_email: string
          participant_name: string
          payment_date: string
          payment_id: string
          payment_method: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number
          processing_fee?: number
          race_category_name: string
          receipt_reference: string
          registration_amount?: number
          registration_id: string
          registration_number: string
          storage_reference?: string | null
          total_paid: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          discount_amount?: number
          document_hash?: string | null
          event_id?: string
          event_name?: string
          gateway_transaction_reference?: string | null
          generated_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          organization_name?: string
          participant_email?: string
          participant_name?: string
          payment_date?: string
          payment_id?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number
          processing_fee?: number
          race_category_name?: string
          receipt_reference?: string
          registration_amount?: number
          registration_id?: string
          registration_number?: string
          storage_reference?: string | null
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_receipts_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          attempt_number: number
          created_at: string
          currency: string
          event_id: string
          failure_code: string | null
          failure_message: string | null
          gateway: string
          gateway_response: Json
          gateway_transaction_id: string | null
          id: string
          idempotency_key: string | null
          organization_id: string
          payment_id: string
          processed_at: string | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_transaction_status"]
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          attempt_number?: number
          created_at?: string
          currency?: string
          event_id: string
          failure_code?: string | null
          failure_message?: string | null
          gateway: string
          gateway_response?: Json
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id: string
          payment_id: string
          processed_at?: string | null
          registration_id: string
          status?: Database["public"]["Enums"]["payment_transaction_status"]
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attempt_number?: number
          created_at?: string
          currency?: string
          event_id?: string
          failure_code?: string | null
          failure_message?: string | null
          gateway?: string
          gateway_response?: Json
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id?: string
          payment_id?: string
          processed_at?: string | null
          registration_id?: string
          status?: Database["public"]["Enums"]["payment_transaction_status"]
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string | null
          event_type: string
          gateway: string
          gateway_event_id: string
          id: string
          next_retry_at: string | null
          organization_id: string | null
          payload: Json
          payload_hash: string | null
          payment_id: string | null
          processed_at: string | null
          processing_attempts: number
          received_at: string
          registration_id: string | null
          status: Database["public"]["Enums"]["payment_webhook_event_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type: string
          gateway: string
          gateway_event_id: string
          id?: string
          next_retry_at?: string | null
          organization_id?: string | null
          payload: Json
          payload_hash?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processing_attempts?: number
          received_at?: string
          registration_id?: string | null
          status?: Database["public"]["Enums"]["payment_webhook_event_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          gateway?: string
          gateway_event_id?: string
          id?: string
          next_retry_at?: string | null
          organization_id?: string | null
          payload?: Json
          payload_hash?: string | null
          payment_id?: string | null
          processed_at?: string | null
          processing_attempts?: number
          received_at?: string
          registration_id?: string | null
          status?: Database["public"]["Enums"]["payment_webhook_event_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_webhook_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_due: number
          amount_paid: number
          amount_refunded: number
          checkout_url: string | null
          created_at: string
          currency: string
          event_id: string
          expires_at: string | null
          failure_code: string | null
          failure_message: string | null
          gateway: string
          gateway_customer_id: string | null
          gateway_payment_id: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          organization_id: string
          paid_at: string | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          amount_refunded?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          event_id: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          gateway: string
          gateway_customer_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          organization_id: string
          paid_at?: string | null
          registration_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          amount_refunded?: number
          checkout_url?: string | null
          created_at?: string
          currency?: string
          event_id?: string
          expires_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          gateway?: string
          gateway_customer_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          organization_id?: string
          paid_at?: string | null
          registration_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string | null
          id: string
          key: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      platform_fees: {
        Row: {
          amount: number
          collected_at: string | null
          created_at: string
          currency: string
          event_id: string
          fee_type: string
          id: string
          metadata: Json
          organization_id: string
          payment_id: string
          reversed_at: string | null
          status: Database["public"]["Enums"]["platform_fee_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          collected_at?: string | null
          created_at?: string
          currency?: string
          event_id: string
          fee_type?: string
          id?: string
          metadata?: Json
          organization_id: string
          payment_id: string
          reversed_at?: string | null
          status?: Database["public"]["Enums"]["platform_fee_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          collected_at?: string | null
          created_at?: string
          currency?: string
          event_id?: string
          fee_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
          payment_id?: string
          reversed_at?: string | null
          status?: Database["public"]["Enums"]["platform_fee_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fees_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fees_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_categories: {
        Row: {
          category_id: string
          created_at: string
          promo_code_id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          promo_code_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          promo_code_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_categories_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_code_redemptions: {
        Row: {
          created_at: string
          currency: string
          discount_amount: number
          eligible_amount: number
          event_id: string
          id: string
          organization_id: string
          payment_id: string | null
          promo_code_id: string
          redeemed_at: string
          registration_id: string
          reversed_at: string | null
          status: Database["public"]["Enums"]["promo_redemption_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          discount_amount: number
          eligible_amount: number
          event_id: string
          id?: string
          organization_id: string
          payment_id?: string | null
          promo_code_id: string
          redeemed_at?: string
          registration_id: string
          reversed_at?: string | null
          status?: Database["public"]["Enums"]["promo_redemption_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          discount_amount?: number
          eligible_amount?: number
          event_id?: string
          id?: string
          organization_id?: string
          payment_id?: string | null
          promo_code_id?: string
          redeemed_at?: string
          registration_id?: string
          reversed_at?: string | null
          status?: Database["public"]["Enums"]["promo_redemption_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_redemptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_redemptions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          applies_to_all_categories: boolean
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          event_id: string
          expires_at: string | null
          id: string
          max_discount_amount: number | null
          minimum_subtotal: number
          organization_id: string
          per_user_limit: number | null
          starts_at: string
          status: Database["public"]["Enums"]["promo_code_status"]
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          applies_to_all_categories?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          event_id: string
          expires_at?: string | null
          id?: string
          max_discount_amount?: number | null
          minimum_subtotal?: number
          organization_id: string
          per_user_limit?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["promo_code_status"]
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          applies_to_all_categories?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          discount_value?: number
          event_id?: string
          expires_at?: string | null
          id?: string
          max_discount_amount?: number | null
          minimum_subtotal?: number
          organization_id?: string
          per_user_limit?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["promo_code_status"]
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      race_categories: {
        Row: {
          bib_prefix: string | null
          bib_range_end: number | null
          bib_range_start: number | null
          confirmed_count: number
          created_at: string
          cutoff_time: string | null
          distance_km: number | null
          early_bird_deadline: string | null
          early_bird_fee: number | null
          event_id: string
          gun_start_time: string | null
          id: string
          max_slots: number | null
          name: string
          registration_availability: Database["public"]["Enums"]["registration_availability_status"]
          category_group_name: string | null
          registration_opens_at: string | null
          registration_closes_at: string | null
          registration_fee: number
          updated_at: string
        }
        Insert: {
          bib_prefix?: string | null
          bib_range_end?: number | null
          bib_range_start?: number | null
          confirmed_count?: number
          created_at?: string
          cutoff_time?: string | null
          distance_km?: number | null
          early_bird_deadline?: string | null
          early_bird_fee?: number | null
          event_id: string
          gun_start_time?: string | null
          id?: string
          max_slots?: number | null
          name: string
          registration_availability?: Database["public"]["Enums"]["registration_availability_status"]
          category_group_name?: string | null
          registration_opens_at?: string | null
          registration_closes_at?: string | null
          registration_fee?: number
          updated_at?: string
        }
        Update: {
          bib_prefix?: string | null
          bib_range_end?: number | null
          bib_range_start?: number | null
          confirmed_count?: number
          created_at?: string
          cutoff_time?: string | null
          distance_km?: number | null
          early_bird_deadline?: string | null
          early_bird_fee?: number | null
          event_id?: string
          gun_start_time?: string | null
          id?: string
          max_slots?: number | null
          name?: string
          registration_availability?: Database["public"]["Enums"]["registration_availability_status"]
          category_group_name?: string | null
          registration_opens_at?: string | null
          registration_closes_at?: string | null
          registration_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      race_kit_claims: {
        Row: {
          bib_id: string
          category_id: string
          claim_method: Database["public"]["Enums"]["race_kit_claim_method"]
          claimed_at: string
          claimed_by: string
          config_id: string
          created_at: string
          event_id: string
          id: string
          metadata: Json
          registration_id: string
          scan_reference: string | null
          updated_at: string
        }
        Insert: {
          bib_id: string
          category_id: string
          claim_method: Database["public"]["Enums"]["race_kit_claim_method"]
          claimed_at?: string
          claimed_by: string
          config_id: string
          created_at?: string
          event_id: string
          id?: string
          metadata?: Json
          registration_id: string
          scan_reference?: string | null
          updated_at?: string
        }
        Update: {
          bib_id?: string
          category_id?: string
          claim_method?: Database["public"]["Enums"]["race_kit_claim_method"]
          claimed_at?: string
          claimed_by?: string
          config_id?: string
          created_at?: string
          event_id?: string
          id?: string
          metadata?: Json
          registration_id?: string
          scan_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_kit_claims_bib_id_fkey"
            columns: ["bib_id"]
            isOneToOne: false
            referencedRelation: "bibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_kit_claims_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_kit_claims_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "race_kit_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_kit_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_kit_claims_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      race_kit_configs: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          event_id: string
          id: string
          name: string
          status: Database["public"]["Enums"]["race_kit_config_status"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["race_kit_config_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["race_kit_config_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_kit_configs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "race_kit_configs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      race_kit_items: {
        Row: {
          config_id: string
          created_at: string
          details: Json
          display_order: number
          id: string
          is_active: boolean
          is_required: boolean
          item_code: string
          item_name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          config_id: string
          created_at?: string
          details?: Json
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          item_code: string
          item_name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          config_id?: string
          created_at?: string
          details?: Json
          display_order?: number
          id?: string
          is_active?: boolean
          is_required?: boolean
          item_code?: string
          item_name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "race_kit_items_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "race_kit_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      racedeck_internal_user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          is_active: boolean
          role: Database["public"]["Enums"]["racedeck_internal_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["racedeck_internal_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["racedeck_internal_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          currency: string
          event_id: string
          failure_code: string | null
          failure_message: string | null
          gateway: string
          gateway_refund_id: string | null
          id: string
          idempotency_key: string | null
          organization_id: string
          payment_id: string
          processed_at: string | null
          reason: string | null
          registration_id: string
          requested_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          event_id: string
          failure_code?: string | null
          failure_message?: string | null
          gateway: string
          gateway_refund_id?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id: string
          payment_id: string
          processed_at?: string | null
          reason?: string | null
          registration_id: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          event_id?: string
          failure_code?: string | null
          failure_message?: string | null
          gateway?: string
          gateway_refund_id?: string | null
          id?: string
          idempotency_key?: string | null
          organization_id?: string
          payment_id?: string
          processed_at?: string | null
          reason?: string | null
          registration_id?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_activity: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          metadata: Json | null
          registration_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          registration_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_activity_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_holds: {
        Row: {
          category_id: string
          created_at: string
          event_id: string
          expires_at: string
          id: string
          session_id: string | null
          status: Database["public"]["Enums"]["slot_hold_status"]
          user_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          event_id: string
          expires_at: string
          id?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["slot_hold_status"]
          user_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          event_id?: string
          expires_at?: string
          id?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["slot_hold_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_holds_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_holds_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_responses: {
        Row: {
          field_id: string
          id: string
          registration_id: string
          value: string | null
        }
        Insert: {
          field_id: string
          id?: string
          registration_id: string
          value?: string | null
        }
        Update: {
          field_id?: string
          id?: string
          registration_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_responses_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "event_registration_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_responses_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["registration_status"] | null
          id: string
          reason: string | null
          registration_id: string
          to_status: Database["public"]["Enums"]["registration_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?:
            | Database["public"]["Enums"]["registration_status"]
            | null
          id?: string
          reason?: string | null
          registration_id: string
          to_status: Database["public"]["Enums"]["registration_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?:
            | Database["public"]["Enums"]["registration_status"]
            | null
          id?: string
          reason?: string | null
          registration_id?: string
          to_status?: Database["public"]["Enums"]["registration_status"]
        }
        Relationships: [
          {
            foreignKeyName: "registration_status_history_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          address: string | null
          bib_id: string | null
          birthdate: string | null
          category_id: string
          checkout_group_id: string | null
          competition_classification: string | null
          created_at: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          emergency_contact_relationship: string | null
          event_id: string
          first_name: string
          gender: string | null
          hold_id: string | null
          id: string
          last_name: string
          middle_name: string | null
          mobile: string | null
          promo_code_id: string | null
          registration_number: string
          shirt_size: string | null
          status: Database["public"]["Enums"]["registration_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bib_id?: string | null
          birthdate?: string | null
          category_id: string
          checkout_group_id?: string | null
          competition_classification?: string | null
          created_at?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relationship?: string | null
          event_id: string
          first_name: string
          gender?: string | null
          hold_id?: string | null
          id?: string
          last_name: string
          middle_name?: string | null
          mobile?: string | null
          promo_code_id?: string | null
          registration_number: string
          shirt_size?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bib_id?: string | null
          birthdate?: string | null
          category_id?: string
          checkout_group_id?: string | null
          competition_classification?: string | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          emergency_contact_relationship?: string | null
          event_id?: string
          first_name?: string
          gender?: string | null
          hold_id?: string | null
          id?: string
          last_name?: string
          middle_name?: string | null
          mobile?: string | null
          promo_code_id?: string | null
          registration_number?: string
          shirt_size?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_bib_id_fkey"
            columns: ["bib_id"]
            isOneToOne: false
            referencedRelation: "bibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "registration_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      result_batches: {
        Row: {
          created_at: string
          event_id: string
          id: string
          imported_at: string
          imported_by: string
          invalid_row_count: number
          metadata: Json
          organization_id: string
          publication_status: Database["public"]["Enums"]["result_batch_publication_status"]
          published_at: string | null
          published_by: string | null
          row_count: number
          source_filename: string
          storage_reference: string | null
          unmatched_row_count: number
          updated_at: string
          valid_row_count: number
          validation_status: Database["public"]["Enums"]["result_batch_validation_status"]
          validation_summary: Json
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          imported_at?: string
          imported_by: string
          invalid_row_count?: number
          metadata?: Json
          organization_id: string
          publication_status?: Database["public"]["Enums"]["result_batch_publication_status"]
          published_at?: string | null
          published_by?: string | null
          row_count?: number
          source_filename: string
          storage_reference?: string | null
          unmatched_row_count?: number
          updated_at?: string
          valid_row_count?: number
          validation_status?: Database["public"]["Enums"]["result_batch_validation_status"]
          validation_summary?: Json
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          imported_at?: string
          imported_by?: string
          invalid_row_count?: number
          metadata?: Json
          organization_id?: string
          publication_status?: Database["public"]["Enums"]["result_batch_publication_status"]
          published_at?: string | null
          published_by?: string | null
          row_count?: number
          source_filename?: string
          storage_reference?: string | null
          unmatched_row_count?: number
          updated_at?: string
          valid_row_count?: number
          validation_status?: Database["public"]["Enums"]["result_batch_validation_status"]
          validation_summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "result_batches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          bib_code: string | null
          bib_id: string | null
          bib_number: number | null
          category_name: string | null
          category_rank: number | null
          chip_time: string | null
          classification_rank: number | null
          created_at: string
          event_id: string
          gun_time: string | null
          id: string
          metadata: Json
          organization_id: string
          overall_rank: number | null
          participant_display_name: string | null
          participant_id: string | null
          race_category_id: string | null
          registration_id: string | null
          result_batch_id: string
          result_status: Database["public"]["Enums"]["participant_result_status"]
          source_bib: string | null
          source_row_number: number | null
          updated_at: string
          validation_errors: Json
          validation_status: Database["public"]["Enums"]["result_row_validation_status"]
        }
        Insert: {
          bib_code?: string | null
          bib_id?: string | null
          bib_number?: number | null
          category_name?: string | null
          category_rank?: number | null
          chip_time?: string | null
          classification_rank?: number | null
          created_at?: string
          event_id: string
          gun_time?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          overall_rank?: number | null
          participant_display_name?: string | null
          participant_id?: string | null
          race_category_id?: string | null
          registration_id?: string | null
          result_batch_id: string
          result_status: Database["public"]["Enums"]["participant_result_status"]
          source_bib?: string | null
          source_row_number?: number | null
          updated_at?: string
          validation_errors?: Json
          validation_status?: Database["public"]["Enums"]["result_row_validation_status"]
        }
        Update: {
          bib_code?: string | null
          bib_id?: string | null
          bib_number?: number | null
          category_name?: string | null
          category_rank?: number | null
          chip_time?: string | null
          classification_rank?: number | null
          created_at?: string
          event_id?: string
          gun_time?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          overall_rank?: number | null
          participant_display_name?: string | null
          participant_id?: string | null
          race_category_id?: string | null
          registration_id?: string | null
          result_batch_id?: string
          result_status?: Database["public"]["Enums"]["participant_result_status"]
          source_bib?: string | null
          source_row_number?: number | null
          updated_at?: string
          validation_errors?: Json
          validation_status?: Database["public"]["Enums"]["result_row_validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "results_bib_id_fkey"
            columns: ["bib_id"]
            isOneToOne: false
            referencedRelation: "bibs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_race_category_id_fkey"
            columns: ["race_category_id"]
            isOneToOne: false
            referencedRelation: "race_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_result_batch_id_fkey"
            columns: ["result_batch_id"]
            isOneToOne: false
            referencedRelation: "result_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role: Database["public"]["Enums"]["organization_role"]
        }
        Insert: {
          permission_id: string
          role: Database["public"]["Enums"]["organization_role"]
        }
        Update: {
          permission_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assigned_staff_user_id: string | null
          case_reference: string
          case_type: Database["public"]["Enums"]["support_case_type"]
          closed_at: string | null
          created_at: string
          description: string
          event_id: string | null
          id: string
          opened_at: string
          organization_id: string | null
          payment_id: string | null
          priority: Database["public"]["Enums"]["support_case_priority"]
          refund_id: string | null
          registration_id: string | null
          requester_organization_id: string | null
          requester_user_id: string
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_case_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_staff_user_id?: string | null
          case_reference: string
          case_type: Database["public"]["Enums"]["support_case_type"]
          closed_at?: string | null
          created_at?: string
          description: string
          event_id?: string | null
          id?: string
          opened_at?: string
          organization_id?: string | null
          payment_id?: string | null
          priority?: Database["public"]["Enums"]["support_case_priority"]
          refund_id?: string | null
          registration_id?: string | null
          requester_organization_id?: string | null
          requester_user_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_case_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_staff_user_id?: string | null
          case_reference?: string
          case_type?: Database["public"]["Enums"]["support_case_type"]
          closed_at?: string | null
          created_at?: string
          description?: string
          event_id?: string | null
          id?: string
          opened_at?: string
          organization_id?: string | null
          payment_id?: string | null
          priority?: Database["public"]["Enums"]["support_case_priority"]
          refund_id?: string | null
          registration_id?: string | null
          requester_organization_id?: string | null
          requester_user_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_case_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_requester_organization_id_fkey"
            columns: ["requester_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          address: string | null
          birthdate: string | null
          created_at: string
          default_shirt_size: string | null
          emergency_contact_name: string | null
          emergency_contact_number: string | null
          first_name: string
          id: string
          last_name: string
          mobile: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birthdate?: string | null
          created_at?: string
          default_shirt_size?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          first_name: string
          id: string
          last_name: string
          mobile?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birthdate?: string | null
          created_at?: string
          default_shirt_size?: string | null
          emergency_contact_name?: string | null
          emergency_contact_number?: string | null
          first_name?: string
          id?: string
          last_name?: string
          mobile?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_bibs_bulk: {
        Args: {
          p_assigned_by: string
          p_registration_ids: string[]
          p_start_number: number
        }
        Returns: string[]
      }
      confirm_registration: {
        Args: { p_registration_id: string }
        Returns: boolean
      }
      expire_stale_holds: { Args: never; Returns: number }
      has_org_role: {
        Args: {
          org_id: string
          required_role: Database["public"]["Enums"]["organization_role"]
        }
        Returns: boolean
      }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      publish_event: { Args: { p_event_id: string }; Returns: string }
      redeem_promo_code: {
        Args: {
          p_category_id: string
          p_currency?: string
          p_eligible_amount: number
          p_event_id: string
          p_payment_id: string
          p_promo_code_id: string
          p_registration_id: string
          p_user_id: string
        }
        Returns: string
      }
      release_registration_slot: {
        Args: {
          p_new_status: Database["public"]["Enums"]["registration_status"]
          p_registration_id: string
        }
        Returns: undefined
      }
      review_event: {
        Args: {
          p_event_id: string
          p_decision: Database["public"]["Enums"]["event_review_status"]
          p_feedback?: string | null
        }
        Returns: string
      }
      reserve_registration_slot: {
        Args: {
          p_category_id: string
          p_event_id: string
          p_expires_at: string
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      reverse_promo_redemption: {
        Args: { p_payment_id: string; p_registration_id: string }
        Returns: boolean
      }
      submit_event_for_review: { Args: { p_event_id: string }; Returns: string }
      verify_certificate: {
        Args: { p_verification_token: string }
        Returns: {
          category_name: string
          certificate_reference: string
          event_date: string
          event_name: string
          finish_time: string
          participant_name: string
          rank: number
          status: Database["public"]["Enums"]["certificate_status"]
        }[]
      }
    }
    Enums: {
      announcement_audience: "all_confirmed" | "category_confirmed"
      announcement_status:
        | "draft"
        | "published"
        | "sent"
        | "failed"
        | "cancelled"
      bib_assignment_source: "manual" | "sequential" | "bulk" | "reassignment"
      bib_status: "unassigned" | "active" | "released" | "void"
      certificate_eligibility_mode:
        | "finished_all"
        | "finished_selected_categories"
        | "organizer_defined"
      certificate_status: "generated" | "issued" | "revoked"
      certificate_template_status: "active" | "inactive"
      communication_channel: "in_app" | "email"
      custom_field_type:
        | "short_text"
        | "long_text"
        | "dropdown"
        | "radio"
        | "checkbox"
        | "yes_no"
        | "multi_select"
      email_delivery_event_type:
        | "delivered"
        | "failed"
        | "bounced"
        | "suppressed"
      email_status:
        | "queued"
        | "sending"
        | "delivered"
        | "failed"
        | "bounced"
        | "suppressed"
      email_type:
        | "organizer_verification"
        | "event_approval"
        | "event_needs_changes"
        | "event_rejection"
        | "registration_pending_payment"
        | "payment_successful"
        | "payment_failed"
        | "registration_confirmed"
        | "payment_receipt"
        | "invoice"
        | "refund_processed"
        | "race_reminder"
        | "race_kit_available"
        | "race_kit_claiming_deadline"
        | "race_kit_claimed"
        | "organizer_announcement"
        | "results_published"
        | "e_certificate_available"
      event_lifecycle_status:
        | "draft"
        | "published"
        | "ongoing"
        | "completed"
        | "cancelled"
        | "archived"
      event_review_status:
        | "not_submitted"
        | "pending_review"
        | "needs_changes"
        | "approved"
        | "rejected"
      event_waiver_status: "draft" | "published" | "retired"
      invoice_status: "draft" | "issued" | "void" | "cancelled"
      legal_document_status: "draft" | "published" | "retired"
      legal_document_type: "terms" | "privacy_policy" | "refund_policy"
      notification_delivery_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "failed"
        | "bounced"
        | "suppressed"
      notification_type:
        | "registration_created"
        | "payment_pending"
        | "payment_confirmed"
        | "payment_failed"
        | "registration_confirmed"
        | "receipt_available"
        | "invoice_available"
        | "refund_completed"
        | "race_kit_available"
        | "race_kit_claiming_deadline"
        | "race_kit_claimed"
        | "event_reminder"
        | "race_tomorrow"
        | "organizer_announcement"
        | "results_published"
        | "e_certificate_ready"
        | "organizer_verification_result"
        | "event_review_result"
        | "new_registration"
        | "payment_notification"
        | "refund_notification"
        | "payout_notification"
        | "important_email_delivery_failure"
      organization_account_status: "active" | "suspended" | "deactivated"
      organization_invoice_mode: "receipt_only" | "receipt_and_sales_invoice"
      organization_role:
        | "owner"
        | "event_manager"
        | "registration_staff"
        | "race_kit_staff"
        | "results_staff"
      organization_verification_status:
        | "draft"
        | "pending_review"
        | "needs_changes"
        | "approved"
        | "rejected"
      organizer_verification_status:
        | "draft"
        | "pending_review"
        | "needs_changes"
        | "approved"
        | "rejected"
      participant_result_status: "finished" | "dnf" | "dns" | "dq"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "partially_refunded"
        | "refunded"
        | "expired"
      payment_transaction_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
        | "refunded"
      payment_webhook_event_status:
        | "received"
        | "processing"
        | "processed"
        | "failed"
        | "ignored"
      platform_content_type:
        | "featured_race"
        | "homepage_banner"
        | "homepage_section"
        | "platform_announcement"
      platform_fee_status:
        | "pending"
        | "accrued"
        | "collected"
        | "reversed"
        | "waived"
      promo_code_status: "active" | "inactive"
      promo_discount_type: "fixed_amount" | "percentage"
      promo_redemption_status: "applied" | "reversed" | "cancelled"
      race_kit_claim_method: "qr_scan" | "manual_lookup"
      race_kit_config_status: "active" | "inactive"
      racedeck_internal_role: "super_admin" | "admin" | "finance" | "support"
      reconciliation_discrepancy_status: "none" | "open" | "resolved"
      reconciliation_status: "pending" | "matched" | "discrepancy" | "reviewed"
      refund_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "cancelled"
      registration_availability_status:
        | "not_yet_open"
        | "open"
        | "closed"
        | "sold_out"
      registration_status:
        | "pending_payment"
        | "confirmed"
        | "cancelled"
        | "transferred"
        | "refunded"
        | "expired"
      reminder_type:
        | "race_reminder"
        | "race_tomorrow"
        | "race_kit_claiming_deadline"
        | "custom"
      result_batch_publication_status: "draft" | "published"
      result_batch_validation_status:
        | "pending"
        | "validating"
        | "valid"
        | "invalid"
      result_row_validation_status:
        | "pending"
        | "valid"
        | "invalid"
        | "unmatched"
      slot_hold_status: "active" | "expired" | "converted" | "released"
      support_case_priority: "low" | "normal" | "high" | "urgent"
      support_case_status: "open" | "in_progress" | "resolved" | "closed"
      support_case_type:
        | "general_account"
        | "event"
        | "registration"
        | "payment"
        | "refund"
        | "race_kit"
      template_status: "active" | "inactive"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      announcement_audience: ["all_confirmed", "category_confirmed"],
      announcement_status: [
        "draft",
        "published",
        "sent",
        "failed",
        "cancelled",
      ],
      bib_assignment_source: ["manual", "sequential", "bulk", "reassignment"],
      bib_status: ["unassigned", "active", "released", "void"],
      certificate_eligibility_mode: [
        "finished_all",
        "finished_selected_categories",
        "organizer_defined",
      ],
      certificate_status: ["generated", "issued", "revoked"],
      certificate_template_status: ["active", "inactive"],
      communication_channel: ["in_app", "email"],
      custom_field_type: [
        "short_text",
        "long_text",
        "dropdown",
        "radio",
        "checkbox",
        "yes_no",
        "multi_select",
      ],
      email_delivery_event_type: [
        "delivered",
        "failed",
        "bounced",
        "suppressed",
      ],
      email_status: [
        "queued",
        "sending",
        "delivered",
        "failed",
        "bounced",
        "suppressed",
      ],
      email_type: [
        "organizer_verification",
        "event_approval",
        "event_needs_changes",
        "event_rejection",
        "registration_pending_payment",
        "payment_successful",
        "payment_failed",
        "registration_confirmed",
        "payment_receipt",
        "invoice",
        "refund_processed",
        "race_reminder",
        "race_kit_available",
        "race_kit_claiming_deadline",
        "race_kit_claimed",
        "organizer_announcement",
        "results_published",
        "e_certificate_available",
      ],
      event_lifecycle_status: [
        "draft",
        "published",
        "ongoing",
        "completed",
        "cancelled",
        "archived",
      ],
      event_review_status: [
        "not_submitted",
        "pending_review",
        "needs_changes",
        "approved",
        "rejected",
      ],
      event_waiver_status: ["draft", "published", "retired"],
      invoice_status: ["draft", "issued", "void", "cancelled"],
      legal_document_status: ["draft", "published", "retired"],
      legal_document_type: ["terms", "privacy_policy", "refund_policy"],
      notification_delivery_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "failed",
        "bounced",
        "suppressed",
      ],
      notification_type: [
        "registration_created",
        "payment_pending",
        "payment_confirmed",
        "payment_failed",
        "registration_confirmed",
        "receipt_available",
        "invoice_available",
        "refund_completed",
        "race_kit_available",
        "race_kit_claiming_deadline",
        "race_kit_claimed",
        "event_reminder",
        "race_tomorrow",
        "organizer_announcement",
        "results_published",
        "e_certificate_ready",
        "organizer_verification_result",
        "event_review_result",
        "new_registration",
        "payment_notification",
        "refund_notification",
        "payout_notification",
        "important_email_delivery_failure",
      ],
      organization_account_status: ["active", "suspended", "deactivated"],
      organization_invoice_mode: ["receipt_only", "receipt_and_sales_invoice"],
      organization_role: [
        "owner",
        "event_manager",
        "registration_staff",
        "race_kit_staff",
        "results_staff",
      ],
      organization_verification_status: [
        "draft",
        "pending_review",
        "needs_changes",
        "approved",
        "rejected",
      ],
      organizer_verification_status: [
        "draft",
        "pending_review",
        "needs_changes",
        "approved",
        "rejected",
      ],
      participant_result_status: ["finished", "dnf", "dns", "dq"],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
        "partially_refunded",
        "refunded",
        "expired",
      ],
      payment_transaction_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
        "refunded",
      ],
      payment_webhook_event_status: [
        "received",
        "processing",
        "processed",
        "failed",
        "ignored",
      ],
      platform_content_type: [
        "featured_race",
        "homepage_banner",
        "homepage_section",
        "platform_announcement",
      ],
      platform_fee_status: [
        "pending",
        "accrued",
        "collected",
        "reversed",
        "waived",
      ],
      promo_code_status: ["active", "inactive"],
      promo_discount_type: ["fixed_amount", "percentage"],
      promo_redemption_status: ["applied", "reversed", "cancelled"],
      race_kit_claim_method: ["qr_scan", "manual_lookup"],
      race_kit_config_status: ["active", "inactive"],
      racedeck_internal_role: ["super_admin", "admin", "finance", "support"],
      reconciliation_discrepancy_status: ["none", "open", "resolved"],
      reconciliation_status: ["pending", "matched", "discrepancy", "reviewed"],
      refund_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "cancelled",
      ],
      registration_availability_status: [
        "not_yet_open",
        "open",
        "closed",
        "sold_out",
      ],
      registration_status: [
        "pending_payment",
        "confirmed",
        "cancelled",
        "transferred",
        "refunded",
        "expired",
      ],
      reminder_type: [
        "race_reminder",
        "race_tomorrow",
        "race_kit_claiming_deadline",
        "custom",
      ],
      result_batch_publication_status: ["draft", "published"],
      result_batch_validation_status: [
        "pending",
        "validating",
        "valid",
        "invalid",
      ],
      result_row_validation_status: [
        "pending",
        "valid",
        "invalid",
        "unmatched",
      ],
      slot_hold_status: ["active", "expired", "converted", "released"],
      support_case_priority: ["low", "normal", "high", "urgent"],
      support_case_status: ["open", "in_progress", "resolved", "closed"],
      support_case_type: [
        "general_account",
        "event",
        "registration",
        "payment",
        "refund",
        "race_kit",
      ],
      template_status: ["active", "inactive"],
    },
  },
} as const
