import { createClient } from '@supabase/supabase-js';

// IMPORTANT : REMPLACEZ CES VALEURS PAR CELLES DE VOTRE PROJET SUPABASE
// Allez dans Settings > API sur votre dashboard Supabase
const SUPABASE_URL = 'https://pryrldpafnlpzcvgpyar.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByeXJsZHBhZm5scHpjdmdweWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTAzODcsImV4cCI6MjA4MDcyNjM4N30.bUpEZmmvBdJp33FdjfRGftr_GnoZLpcnlS6KDMMTK_I';

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
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          company_name?: string | null
          avatar_initials?: string | null
          logo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          company_name?: string | null
          avatar_initials?: string | null
          logo_url?: string | null
          updated_at?: string | null
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
          last_run: string | null
          runs_this_month: number
          tool_icons: string[] | null
          created_at: string
        }
        Insert: {
            id?: string
            user_id: string
            name: string
            description?: string | null
            status?: 'active' | 'inactive' | 'error' | 'maintenance'
            last_run?: string | null
            runs_this_month?: number
            tool_icons?: string[] | null
            created_at?: string
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
            created_at: string
        }
      }
      expenses: {
        Row: {
            id: string
            user_id: string
            service_name: string
            provider: string | null
            amount: number
            billing_cycle: 'monthly' | 'yearly'
            next_billing_date: string | null
            status: 'active' | 'inactive'
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
    }
  }
}