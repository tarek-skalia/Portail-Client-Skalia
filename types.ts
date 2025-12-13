
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
}

export interface Invoice {
  id: string;
  clientId: string;
  number: string;
  projectName: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  issueDate: string;
  dueDate: string;
  pdfUrl: string;
  paymentLink: string;
}

export interface Expense {
  id: string;
  clientId: string;
  serviceName: string;
  provider: string;
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
