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
  password?: string; // Ajout du mot de passe (optionnel pour éviter les erreurs de typage strict sur l'existant, mais utilisé pour le login)
  logoUrl?: string; // URL du logo de l'entreprise cliente
}

export interface Automation {
  id: string;
  clientId: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  lastRun: string;
  runsThisMonth: number;
  toolIcons: string[]; // Noms des outils (ex: 'Make', 'Airtable')
}

export interface Project {
  id: string;
  clientId: string;
  title: string;
  description: string;
  status: 'uncategorized' | 'onboarding' | 'in_progress' | 'review' | 'completed';
  startDate: string;
  endDate: string;
}

export interface Ticket {
  id: string;
  clientId: string;
  subject: string;
  category: string; // 'bug', 'modify', 'new', etc.
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  date: string;
  lastUpdate: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  number: string; // ex: INV-2023-001
  projectName: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  issueDate: string;
  dueDate: string;
  pdfUrl: string; // Lien fictif pour le PDF
  paymentLink: string; // Lien fictif Stripe/autre
}

export interface Expense {
  id: string;
  clientId: string;
  serviceName: string; // ex: OpenAI API, Make Standard
  provider: string; // ex: OpenAI, Make
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  status: 'active' | 'inactive';
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