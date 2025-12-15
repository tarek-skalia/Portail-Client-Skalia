
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Z-INDEX augmenté à 200 pour être sûr d'être au-dessus de la barre Admin (z-100) et des Toasts (z-100)
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <div 
            className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={onClose}
        />
        
        {/* Content */}
        <div className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl transform transition-all duration-300 flex flex-col max-h-[90vh] ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white rounded-t-2xl">
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {children}
            </div>

        </div>
    </div>
  );
};

export default Modal;
