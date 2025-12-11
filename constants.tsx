
import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  CreditCard, 
  Kanban, 
  Map, 
  Zap, 
  LifeBuoy,
  History
} from 'lucide-react';
import { MenuItem, ChartDataPoint, Client, Automation, Ticket, Invoice, Expense, Project } from './types';

// Mise à jour du menu selon la demande : Nouvel ordre et renommage
export const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard size={20} /> },
  { id: 'automations', label: 'Automatisations', icon: <Zap size={20} /> },
  { id: 'projects', label: 'Pipeline des projets', icon: <Kanban size={20} /> },
  { id: 'roadmap', label: 'Feuille de route des projets', icon: <Map size={20} /> },
  { id: 'invoices', label: 'Factures', icon: <FileText size={20} /> },
  { id: 'expenses', label: 'Dépenses', icon: <CreditCard size={20} /> },
  { id: 'support', label: 'Demandes de Support', icon: <LifeBuoy size={20} /> },
  { id: 'history', label: 'Historique des Tickets', icon: <History size={20} /> },
];

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

// =========================================================================
// SIMULATION BASE DE DONNÉES
// Pour ajouter un client ou une automatisation, modifiez les listes ci-dessous.
// =========================================================================

// 1. LISTE DES CLIENTS
export const MOCK_CLIENTS: Client[] = [
  {
    id: '1', 
    name: 'Jean Dupont',
    company: 'Immobilier Express',
    avatarInitials: 'JD',
    email: 'jean@immoexpress.fr',
    password: '123', // Mot de passe fictif
    logoUrl: 'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/68dfe97e9c5196724841369b_Design%20sans%20titre%20(24).png'
  },
  {
    id: '2',
    name: 'Sarah Connor',
    company: 'SkyNet Solutions',
    avatarInitials: 'SC',
    email: 'sarah@skynet.com',
    password: '123',
    logoUrl: 'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/68dfdf7f2c7d81e132d4473a_Design%20sans%20titre%20(20).png'
  },
  {
    id: '3',
    name: 'Thomas Anderson',
    company: 'Matrix Consulting',
    avatarInitials: 'TA',
    email: 'neo@matrix.com',
    password: '123',
    logoUrl: 'https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/68a352170f1a2e4d09fa898b_Design%20sans%20titre%20(18).png'
  }
];

// 2. LISTE DES AUTOMATISATIONS
// Assurez-vous que le 'clientId' correspond à l'ID du client dans la liste ci-dessus.
export const MOCK_AUTOMATIONS: Automation[] = [
  // --- Automatisations pour Jean (ID: 1) ---
  {
    id: 'auto_1',
    clientId: '1', 
    name: 'Traitement des Leads Entrants',
    description: 'Capture les leads depuis Facebook Ads, les enrichit via API et les ajoute au CRM.',
    status: 'active',
    lastRun: 'Il y a 2 min',
    runsThisMonth: 1450,
    toolIcons: ['Facebook', 'Make', 'HubSpot'],
    pipelineSteps: [
        { tool: 'Facebook Lead Ads', action: 'Détection d\'un nouveau prospect' },
        { tool: 'Make (Integromat)', action: 'Formatage des données (Nom, Email, Tél)' },
        { tool: 'API Société.com', action: 'Enrichissement des données légales' },
        { tool: 'HubSpot CRM', action: 'Création de la fiche contact et deal' },
        { tool: 'Slack', action: 'Notification à l\'équipe commerciale' }
    ],
    userGuide: `# Guide d'utilisation

Ce workflow permet d'automatiser l'intégration de vos prospects dans votre CRM sans aucune saisie manuelle.

## Fonctionnement général
Dès qu'un prospect remplit un formulaire sur Facebook ou Instagram, ses informations sont instantanément envoyées vers HubSpot.

## Données traitées
Voici les champs qui sont récupérés et synchronisés :
- Nom et Prénom
- Adresse Email professionnelle
- Numéro de téléphone
- **Nom de l'entreprise** (Enrichi automatiquement)

## En cas de problème
Si vous ne recevez pas la notification Slack :
- Vérifiez que le prospect a bien rempli un email valide.
- Assurez-vous que votre compte Facebook Business est bien connecté.`
  },
  {
    id: 'auto_2',
    clientId: '1',
    name: 'Génération de Contrats PDF',
    description: 'Crée automatiquement un PDF de contrat lors du changement de statut dans le CRM.',
    status: 'active',
    lastRun: 'Il y a 2 heures',
    runsThisMonth: 34,
    toolIcons: ['Google Docs', 'Drive', 'Gmail'],
    pipelineSteps: [
        { tool: 'HubSpot', action: 'Déclencheur : Deal passe en "Gagné"' },
        { tool: 'Google Docs', action: 'Remplissage du template de contrat' },
        { tool: 'Google Drive', action: 'Conversion en PDF et stockage' },
        { tool: 'Gmail', action: 'Envoi du contrat au client pour signature' }
    ]
  },
  {
    id: 'auto_3',
    clientId: '1',
    name: 'Synchronisation Facturation',
    description: 'Envoi des factures payées vers le logiciel comptable.',
    status: 'error',
    lastRun: 'Hier à 18:00',
    runsThisMonth: 12,
    toolIcons: ['Stripe', 'Quickbooks']
  },

  // --- Automatisations pour Sarah (ID: 2) ---
  {
    id: 'auto_4',
    clientId: '2', 
    name: 'Onboarding Employés',
    description: 'Création des comptes Slack, Jira et GitHub pour les nouveaux arrivants.',
    status: 'active',
    lastRun: 'Il y a 5 jours',
    runsThisMonth: 4,
    toolIcons: ['Slack', 'Jira', 'GitHub']
  },
  {
    id: 'auto_5',
    clientId: '2',
    name: 'Reporting Hebdomadaire',
    description: 'Agrégation des KPIs marketing et envoi par email.',
    status: 'maintenance',
    lastRun: 'Lundi dernier',
    runsThisMonth: 4,
    toolIcons: ['Airtable', 'Gmail']
  },

  // --- Automatisations pour Thomas (ID: 3) ---
  {
    id: 'auto_6',
    clientId: '3', 
    name: 'Bot de Réponse IA Support',
    description: 'Analyse les emails entrants et propose une réponse brouillon via GPT-4.',
    status: 'active',
    lastRun: 'Il y a 10 min',
    runsThisMonth: 852,
    toolIcons: ['OpenAI', 'Zendesk', 'Python']
  },
  {
    id: 'auto_7',
    clientId: '3',
    name: 'Scraping LinkedIn',
    description: 'Récupération automatique des profils cibles chaque matin.',
    status: 'inactive',
    lastRun: 'Il y a 1 mois',
    runsThisMonth: 0,
    toolIcons: ['PhantomBuster', 'Lemlist']
  }
];

// 3. LISTE DES PROJETS (Pipeline)
export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj_1',
    clientId: '1',
    title: 'Refonte Intégration CRM',
    description: 'Migration du CRM client vers une plateforme unifiée et automatisation des flux d\'attribution des leads.',
    status: 'in_progress',
    startDate: '01/10/2025',
    endDate: '15/12/2025'
  },
  {
    id: 'proj_2',
    clientId: '2',
    title: 'Audit de Sécurité Infrastructure',
    description: 'Analyse complète des accès, des logs et mise en place de la 2FA pour tous les employés.',
    status: 'review',
    startDate: '10/10/2025',
    endDate: '20/10/2025'
  }
];

// 4. LISTE DES TICKETS SUPPORT (Historique)
export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'T-1024',
    clientId: '1',
    subject: 'Erreur 401 sur le scénario Make',
    category: 'Bug ou Erreur',
    priority: 'high',
    status: 'in_progress',
    date: '12 Oct 2023',
    lastUpdate: 'Il y a 2h'
  },
  {
    id: 'T-1020',
    clientId: '1',
    subject: 'Ajouter champ "Siret" au CRM',
    category: 'Modification',
    priority: 'low',
    status: 'resolved',
    date: '05 Oct 2023',
    lastUpdate: '06 Oct 2023'
  },
  {
    id: 'T-0988',
    clientId: '1',
    subject: 'Nouvelle automation : Scrapping Instagram',
    category: 'Nouvelle demande',
    priority: 'medium',
    status: 'closed',
    date: '20 Sept 2023',
    lastUpdate: '25 Sept 2023'
  },
  {
    id: 'T-1102',
    clientId: '2',
    subject: 'Problème webhook Slack',
    category: 'Bug',
    priority: 'medium',
    status: 'open',
    date: 'Aujourd\'hui',
    lastUpdate: 'À l\'instant'
  }
];

// 5. LISTE DES FACTURES
export const MOCK_INVOICES: Invoice[] = [
  // Factures Jean
  {
    id: 'inv_001',
    clientId: '1',
    number: 'INV-2023-10-01',
    projectName: 'Mise en place CRM Hubspot',
    amount: 1500.00,
    status: 'paid',
    issueDate: '01 Oct 2023',
    dueDate: '31 Oct 2023',
    pdfUrl: '#',
    paymentLink: '#'
  },
  {
    id: 'inv_002',
    clientId: '1',
    number: 'INV-2023-11-04',
    projectName: 'Maintenance Mensuelle Octobre',
    amount: 350.00,
    status: 'pending',
    issueDate: '01 Nov 2023',
    dueDate: '15 Nov 2023',
    pdfUrl: '#',
    paymentLink: '#'
  },
  // Factures Sarah
  {
    id: 'inv_003',
    clientId: '2',
    number: 'INV-2023-09-12',
    projectName: 'Audit Processus RH',
    amount: 2200.00,
    status: 'paid',
    issueDate: '12 Sept 2023',
    dueDate: '12 Oct 2023',
    pdfUrl: '#',
    paymentLink: '#'
  },
  {
    id: 'inv_004',
    clientId: '2',
    number: 'INV-2023-10-15',
    projectName: 'Implémentation Onboarding Slack',
    amount: 850.00,
    status: 'overdue',
    issueDate: '15 Oct 2023',
    dueDate: '30 Oct 2023',
    pdfUrl: '#',
    paymentLink: '#'
  }
];

// 6. LISTE DES DÉPENSES (Abonnements tiers)
export const MOCK_EXPENSES: Expense[] = [
  // Dépenses Jean
  {
    id: 'exp_001',
    clientId: '1',
    serviceName: 'Make (Integromat)',
    provider: 'Make',
    amount: 29.00,
    billingCycle: 'monthly',
    nextBillingDate: '10 Nov 2023',
    status: 'active'
  },
  {
    id: 'exp_002',
    clientId: '1',
    serviceName: 'OpenAI API',
    provider: 'OpenAI',
    amount: 12.50,
    billingCycle: 'monthly',
    nextBillingDate: '01 Nov 2023',
    status: 'active'
  },
  // Dépenses Sarah
  {
    id: 'exp_003',
    clientId: '2',
    serviceName: 'Airtable Pro',
    provider: 'Airtable',
    amount: 20.00,
    billingCycle: 'monthly',
    nextBillingDate: '15 Nov 2023',
    status: 'active'
  },
  {
    id: 'exp_004',
    clientId: '2',
    serviceName: 'Hébergement VPS',
    provider: 'DigitalOcean',
    amount: 15.00,
    billingCycle: 'monthly',
    nextBillingDate: '20 Nov 2023',
    status: 'active'
  }
];
