
import { ReactNode } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface KPIData {
  label: string;
  value: string;
  unit?: string;
  color: 'green' | 'purple' | 'blue' | 'red';
  trend?: string;
  subtext?: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

// Nouvelles interfaces pour la gestion client
export interface Client {
  id: string;
  name: string;
  company: string;
  avatarInitials: string;
  email: string;
  password?: string;
  logoUrl?: string;
  role?: 'admin' | 'client';
  stripeCustomerId?: string; // Ajout ID Stripe
}

export interface Automation {
  id: string;
  clientId: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  lastRun: string;
  runsThisMonth: number;
  toolIcons: string[];
  pipelineSteps?: { tool: string; action: string }[];
  userGuide?: string;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  status: 'success' | 'error' | 'warning';
  createdAt: string;
  duration: string;
  minutesSaved: number;
}

export interface ProjectResource {
  id: string;
  type: 'file' | 'link';
  name: string;
  url: string;
  addedAt: string;
  size?: string; // Pour les fichiers
}

export interface ProjectTask {
  id: string;
  name: string;
  completed: boolean;
  type?: 'client' | 'agency'; // Distinction propriétaire de la tâche
  createdAt?: string; // Ajouté pour le tri stable
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: 'uncategorized' | 'onboarding' | 'in_progress' | 'review' | 'completed';
  startDate: string;
  endDate: string;
  tags?: string[];
  progress?: number; // Calculé dynamiquement (frontend)
  tasks?: ProjectTask[]; // Liste détaillée (issue de la jointure)
  resources?: ProjectResource[]; // Fichiers et liens (JSONB)
  tasksCount?: number;
  tasksCompleted?: number;
  ownerName?: string; 
  ownerAvatar?: string; // URL de la photo du responsable
}

export interface Ticket {
  id: string;
  clientId: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  date: string;
  lastUpdate: string;
  description?: string; // Description initiale
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: 'client' | 'admin' | 'system';
  message: string;
  attachments?: string[];
  createdAt: string;
  senderName?: string;
  avatar?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  number: string;
  projectName: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'open' | 'void'; // Ajout des statuts Stripe
  issueDate: string;
  dueDate: string;
  pdfUrl: string;
  paymentLink: string;
  stripeInvoiceId?: string; // ID technique Stripe
  items?: InvoiceItem[]; // Liste des prestations
  taxRate?: number; // Taux TVA (ex: 20)
}

export interface Expense {
  id: string;
  clientId: string;
  serviceName: string;
  provider: string;
  category: string; // Ex: 'Automation', 'AI', 'Hosting'
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  status: 'active' | 'inactive';
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// --- CRM TYPES ---
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'negotiation' | 'won' | 'lost';

export interface CRMField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options?: string[]; // Pour type 'select'
}

export interface Lead {
  id: string;
  created_at: string;
  updated_at?: string; 
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string;
  value: number;
  status: LeadStatus;
  source: string;
  notes: string;
  custom_data: Record<string, any>; // Stockage flexible
}

export interface CRMActivity {
  id: string;
  lead_id: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'status_change';
  content: string;
  created_at: string;
  created_by?: string;
}

// --- QUOTE TYPES (Updated for Magic Flow) ---
export interface QuoteItemData {
    description: string;
    quantity: number;
    unit_price: number;
    billing_frequency: 'once' | 'monthly' | 'yearly'; // Nouveau : Fréquence
}

export interface QuotePaymentTerms {
    type: '100_percent' | '50_50' | '30_70' | 'custom';
    deposit_percentage?: number;
    custom_label?: string;
    tax_rate?: number;
    billing_address?: string;
    vat_number?: string;
    audit_trail?: any;
}

export interface Quote {
    id: string;
    profile_id: string | null; // Nullable si prospect
    lead_id?: string | null; // Lien optionnel vers CRM Lead
    
    // Infos Prospect (si profile_id null)
    recipient_email?: string;
    recipient_name?: string;
    recipient_company?: string;
    
    title: string;
    description: string;
    status: 'draft' | 'sent' | 'signed' | 'rejected' | 'paid';
    valid_until: string;
    delivery_delay?: string; // NOUVEAU CHAMP
    total_amount: number; // Total théorique One-Shot + 1 mois récurrent
    
    // Tracking
    view_count?: number;
    last_viewed_at?: string;
    
    payment_terms?: QuotePaymentTerms; // Nouveau : Conditions
    
    items?: QuoteItemData[];
    created_at: string;
}
