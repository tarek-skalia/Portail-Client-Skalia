
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ToastProvider';
import { useAdmin } from '../AdminContext';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { InvoiceItem } from '../../types';

interface InvoiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSuccess, onCancel }) => {
  const { targetUserId } = useAdmin();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Fields
  const [number, setNumber] = useState(`INV-${new Date().getFullYear()}-`);
  const [projectName, setProjectName] = useState('');
  const [status, setStatus] = useState('pending');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  
  // Items Repeater
  const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  const [taxRate, setTaxRate] = useState(20); // 20% TVA default

  // Computed
  const subTotal = items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  const totalAmount = subTotal * (1 + taxRate / 100);

  const handleAddItem = () => {
      setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
      const newItems = [...items];
      (newItems[index] as any)[field] = value;
      setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
          const { error } = await supabase.from('invoices').insert({
              user_id: targetUserId,
              number,
              project_name: projectName,
              amount: totalAmount, // Total calculé stocké
              status,
              issue_date: issueDate,
              due_date: dueDate,
              pdf_url: pdfUrl,
              payment_link: paymentLink,
              items: items, // JSONB
              tax_rate: taxRate
          });

          if (error) throw error;
          
          toast.success("Facture créée", "Le client peut désormais la voir.");
          onSuccess();

      } catch (err: any) {
          toast.error("Erreur", err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Numéro Facture</label>
                <input 
                    type="text" required value={number} onChange={e => setNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Statut</label>
                <select 
                    value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                    <option value="pending">En attente</option>
                    <option value="paid">Payée</option>
                    <option value="overdue">En retard</option>
                </select>
            </div>
        </div>

        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titre / Projet</label>
            <input 
                type="text" required value={projectName} onChange={e => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                placeholder="Ex: Setup Automatisation CRM"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date émission</label>
                <input type="date" required value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date échéance</label>
                <input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
            </div>
        </div>

        {/* ITEMS REPEATER */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-indigo-600 uppercase mb-3">Lignes de prestation</label>
            
            <div className="space-y-3">
                {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                        <input 
                            type="text" placeholder="Description" value={item.description}
                            onChange={e => updateItem(idx, 'description', e.target.value)}
                            className="flex-[3] px-3 py-2 text-sm border rounded-lg outline-none"
                        />
                        <input 
                            type="number" placeholder="Qté" value={item.quantity} min="1"
                            onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                            className="flex-[1] px-3 py-2 text-sm border rounded-lg outline-none"
                        />
                        <input 
                            type="number" placeholder="Prix Unitaire" value={item.unit_price}
                            onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))}
                            className="flex-[1] px-3 py-2 text-sm border rounded-lg outline-none"
                        />
                        <button type="button" onClick={() => handleRemoveItem(idx)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={handleAddItem} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <Plus size={14} /> Ajouter une ligne
            </button>
        </div>

        {/* TOTALS & TAX */}
        <div className="flex justify-end gap-6 items-center border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-500">TVA %</label>
                <input 
                    type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value))}
                    className="w-16 px-2 py-1 border rounded text-right"
                />
            </div>
            <div className="text-right">
                <p className="text-xs text-slate-400 uppercase font-bold">Total TTC Calculé</p>
                <p className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                    <Calculator size={18} /> {totalAmount.toFixed(2)} €
                </p>
            </div>
        </div>

        {/* LINKS */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lien PDF (Stripe/Drive)</label>
                <input type="text" value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="https://..." />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lien de paiement</label>
                <input type="text" value={paymentLink} onChange={e => setPaymentLink(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="https://buy.stripe.com/..." />
            </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50">
                {loading ? 'Enregistrement...' : 'Générer Facture'}
            </button>
        </div>
    </form>
  );
};

export default InvoiceForm;
