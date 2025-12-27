
import { createClient } from '@supabase/supabase-js';

// IMPORTANT : REMPLACEZ CES VALEURS PAR CELLES DE VOTRE PROJET SUPABASE
// Allez dans Settings > API sur votre dashboard Supabase
export const SUPABASE_URL = 'https://pryrldpafnlpzcvgpyar.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByeXJsZHBhZm5scHpjdmdweWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTAzODcsImV4cCI6MjA4MDcyNjM4N30.bUpEZmmvBdJp33FdjfRGftr_GnoZLpcnlS6KDMMTK_I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types Database Helpers
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          company_name: string | null
          avatar_initials: string | null
          logo_url: string | null
          stripe_customer_id: string | null
          onboarding_step: number | null
          phone: string | null
          address: string | null
          vat_number: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          company_name?: string | null
          avatar_initials?: string | null
          logo_url?: string | null
          stripe_customer_id?: string | null
          onboarding_step?: number | null
          phone?: string | null
          address?: string | null
          vat_number?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          company_name?: string | null
          avatar_initials?: string | null
          logo_url?: string | null
          stripe_customer_id?: string | null
          onboarding_step?: number | null
          phone?: string | null
          address?: string | null
          vat_number?: string | null
          updated_at?: string | null
        }
      }
      quotes: {
        Row: {
          id: string
          profile_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_company: string | null
          sender_name: string | null
          title: string
          description: string | null
          status: 'draft' | 'sent' | 'signed' | 'rejected' | 'paid'
          total_amount: number
          payment_terms: Json | null
          valid_until: string | null
          delivery_delay: string | null
          public_token: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_company?: string | null
          sender_name?: string | null
          title: string
          description?: string | null
          status?: 'draft' | 'sent' | 'signed' | 'rejected' | 'paid'
          total_amount?: number
          payment_terms?: Json | null
          valid_until?: string | null
          delivery_delay?: string | null
          public_token?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_company?: string | null
          sender_name?: string | null
          title?: string
          description?: string | null
          status?: 'draft' | 'sent' | 'signed' | 'rejected' | 'paid'
          total_amount?: number
          payment_terms?: Json | null
          valid_until?: string | null
          delivery_delay?: string | null
          public_token?: string
          created_at?: string
          updated_at?: string
        }
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          description: string
          quantity: number
          unit_price: number
          total: number
          billing_frequency: 'once' | 'monthly' | 'yearly'
        }
        Insert: {
          id?: string
          quote_id: string
          description: string
          quantity?: number
          unit_price?: number
          billing_frequency?: 'once' | 'monthly' | 'yearly'
          // total est généré automatiquement
        }
        Update: {
          id?: string
          quote_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          billing_frequency?: 'once' | 'monthly' | 'yearly'
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: 'uncategorized' | 'onboarding' | 'in_progress' | 'review' | 'completed'
          start_date: string | null
          end_date: string | null
          owner_name: string | null
          owner_avatar: string | null
          resources: Json | null
          messages: Json | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          status: 'uncategorized' | 'onboarding' | 'in_progress' | 'review' | 'completed'
          start_date?: string | null
          end_date?: string | null
          owner_name?: string | null
          owner_avatar?: string | null
          resources?: Json | null
          messages?: Json | null
          tags?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          status?: 'uncategorized' | 'onboarding' | 'in_progress' | 'review' | 'completed'
          start_date?: string | null
          end_date?: string | null
          owner_name?: string | null
          owner_avatar?: string | null
          resources?: Json | null
          messages?: Json | null
          tags?: string[] | null
          created_at?: string
        }
      }
      project_tasks: {
        Row: {
          id: string
          project_id: string
          name: string
          completed: boolean
          type: 'client' | 'agency'
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          completed?: boolean
          type?: 'client' | 'agency'
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          completed?: boolean
          type?: 'client' | 'agency'
          created_at?: string
        }
      }
      internal_tasks: {
        Row: {
          id: string
          title: string
          assignee: string | null
          priority: 'low' | 'medium' | 'high'
          due_date: string | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          assignee?: string | null
          priority?: 'low' | 'medium' | 'high'
          due_date?: string | null
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          assignee?: string | null
          priority?: 'low' | 'medium' | 'high'
          due_date?: string | null
          completed?: boolean
          created_at?: string
        }
      }
      automations: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          status: 'active' | 'inactive' | 'error' | 'maintenance'
          tool_icons: string[] | null
          pipeline_steps: Json | null
          user_guide: string | null
          created_at: string
        }
        Insert: {
            id?: string
            user_id: string
            name: string
            description?: string | null
            status?: 'active' | 'inactive' | 'error' | 'maintenance'
            tool_icons?: string[] | null
            pipeline_steps?: Json | null
            user_guide?: string | null
            created_at?: string
        }
      }
      automation_logs: {
        Row: {
          id: string
          automation_id: string
          status: 'success' | 'error' | 'warning'
          minutes_saved: number
          duration: string | null
          error_message: string | null
          created_at: string
        }
      }
      invoices: {
        Row: {
            id: string
            user_id: string
            number: string
            project_name: string | null
            amount: number
            status: 'paid' | 'pending' | 'overdue'
            issue_date: string | null
            due_date: string | null
            pdf_url: string | null
            payment_link: string | null
            items: Json | null
            tax_rate: number | null
            created_at: string
        }
      }
      expenses: {
        Row: {
            id: string
            user_id: string
            service_name: string
            provider: string | null
            category: string | null
            description: string | null
            amount: number
            billing_cycle: 'monthly' | 'yearly'
            next_billing_date: string | null
            status: 'active' | 'inactive'
            website_url: string | null
            logo_url: string | null
            created_at: string
        }
      }
      tickets: {
        Row: {
            id: string
            user_id: string
            subject: string
            category: string | null
            priority: 'low' | 'medium' | 'high'
            status: 'open' | 'in_progress' | 'resolved' | 'closed'
            date: string | null
            last_update: string | null
            description: string | null
            created_at: string
        }
        Insert: {
            id?: string
            user_id: string
            subject: string
            category?: string | null
            priority?: 'low' | 'medium' | 'high'
            status?: 'open' | 'in_progress' | 'resolved' | 'closed'
            date?: string | null
            last_update?: string | null
            description?: string | null
            created_at?: string
        }
        Update: {
            id?: string
            user_id?: string
            subject?: string
            category?: string | null
            priority?: 'low' | 'medium' | 'high'
            status?: 'open' | 'in_progress' | 'resolved' | 'closed'
            date?: string | null
            last_update?: string | null
            description?: string | null
            created_at?: string
        }
      }
      ticket_messages: {
        Row: {
            id: string
            ticket_id: string
            sender_id: string
            sender_type: 'client' | 'admin' | 'system'
            message: string
            attachments: string[] | null
            created_at: string
        }
        Insert: {
            id?: string
            ticket_id: string
            sender_id: string
            sender_type: 'client' | 'admin' | 'system'
            message: string
            attachments?: string[] | null
            created_at?: string
        }
        Update: {
            id?: string
            ticket_id?: string
            sender_id?: string
            sender_type?: 'client' | 'admin' | 'system'
            message?: string
            attachments?: string[] | null
            created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string | null
          type: 'info' | 'success' | 'warning' | 'error'
          link: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message?: string | null
          type?: 'info' | 'success' | 'warning' | 'error'
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string | null
          type?: 'info' | 'success' | 'warning' | 'error'
          link?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      // CRM
      crm_leads: {
        Row: {
          id: string
          status: string
          value: number
          company: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          phone: string | null
          source: string | null
          notes: string | null
          custom_data: Json
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          status?: string
          value?: number
          company?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          source?: string | null
          notes?: string | null
          custom_data?: Json
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          status?: string
          value?: number
          company?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          source?: string | null
          notes?: string | null
          custom_data?: Json
          created_at?: string
          updated_at?: string | null
        }
      }
      crm_fields: {
        Row: {
          id: string
          key: string
          label: string
          type: 'text' | 'number' | 'date' | 'select' | 'boolean'
          options: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          label: string
          type: 'text' | 'number' | 'date' | 'select' | 'boolean'
          options?: string[] | null
          created_at?: string
        }
      }
    }
  }
}
