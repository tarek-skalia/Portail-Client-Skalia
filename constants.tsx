
import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  CreditCard, 
  Kanban, 
  Map, 
  Zap, 
  LifeBuoy,
  History,
  Globe,
  Users,
  Briefcase,
  PieChart,
  Target,
  Layers,
  CheckSquare
} from 'lucide-react';
import { MenuItem, ChartDataPoint, Client, Automation, Ticket, Invoice, Expense, Project } from './types';

// Menu standard (Clients)
export const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard size={20} /> },
  { id: 'automations', label: 'Automatisations', icon: <Zap size={20} /> },
  { id: 'projects', label: 'Pipeline des projets', icon: <Kanban size={20} /> },
  { id: 'roadmap', label: 'Feuille de route', icon: <Map size={20} /> },
  { id: 'invoices', label: 'Factures', icon: <FileText size={20} /> },
  { id: 'expenses', label: 'Dépenses', icon: <CreditCard size={20} /> },
  { id: 'support', label: 'Support & Tickets', icon: <LifeBuoy size={20} /> },
  { id: 'history', label: 'Historique', icon: <History size={20} /> },
];

// Menu Admin (ERP / Agence)
export const ADMIN_MENU_ITEMS: MenuItem[] = [
  { id: 'global_view', label: 'Vue Globale Agence', icon: <Globe size={20} /> },
  { id: 'global_projects', label: 'Opérations (Projets)', icon: <Briefcase size={20} /> },
  { id: 'global_tasks', label: 'Tâches & To-Do', icon: <CheckSquare size={20} /> }, // NOUVEAU
  { id: 'global_automations', label: 'Systèmes (Autos)', icon: <Zap size={20} /> },
  { id: 'global_expenses', label: 'Dépenses Clients', icon: <CreditCard size={20} /> },
  { id: 'global_finance', label: 'Finance & Tréso', icon: <PieChart size={20} /> },
  { id: 'crm', label: 'CRM & Leads', icon: <Target size={20} /> },
  { id: 'users', label: 'Annuaire Clients', icon: <Users size={20} /> },
];

// --- CONFIGURATION DES RESPONSABLES ---
export const PROJECT_OWNERS: Record<string, string> = {
  'Tarek Zreik': 'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/693e208badeaae7b477b5ee4_Design%20sans%20titre%20(17).png',
  'Zakaria Jellouli': 'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/693e20a344d8467df0c49ca8_1742836594868.jpeg'
};

export const MOCK_CHART_DATA_TIME: ChartDataPoint[] = [
  { name: 'Lun', value: 4 },
  { name: 'Mar', value: 7 },
  { name: 'Mer', value: 5 },
  { name: 'Jeu', value: 8 },
  { name: 'Ven', value: 6 },
  { name: 'Sam', value: 2 },
  { name: 'Dim', value: 1 },
];

export const MOCK_CHART_DATA_EXEC: ChartDataPoint[] = [
  { name: 'Lun', value: 120 },
  { name: 'Mar', value: 230 },
  { name: 'Mer', value: 180 },
  { name: 'Jeu', value: 260 },
  { name: 'Ven', value: 210 },
  { name: 'Sam', value: 80 },
  { name: 'Dim', value: 40 },
];

export const MOCK_CHART_DATA_COST: ChartDataPoint[] = [
  { name: 'S1', value: 450 },
  { name: 'S2', value: 620 },
  { name: 'S3', value: 580 },
  { name: 'S4', value: 710 },
];
