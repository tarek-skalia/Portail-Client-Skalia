
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
        // Bloquer le scroll du body quand le modal est ouvert
        document.body.style.overflow = 'hidden';
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
        // Réactiver le scroll après la fermeture (avec un délai pour l'animation)
        const timer = setTimeout(() => {
            document.body.style.overflow = 'unset';
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Container principal Fixe (Z-Index très haut)
    <div className="fixed inset-0 z-[200] overflow-y-auto">
        
        {/* Container Flex pour le centrage vertical et horizontal parfait */}
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            
            {/* 1. BACKDROP (FOND FLOU) */}
            <div 
                className={`fixed inset-0 bg-slate-900/80 backdrop-blur-md transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
                aria-hidden="true"
            />
            
            {/* 2. CONTENU DU MODAL */}
            {/* transform transition-all permet l'animation d'échelle */}
            <div 
                className={`relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all duration-300 sm:w-full ${maxWidth} flex flex-col max-h-[85vh] border border-slate-200 ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white shrink-0">
                    <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body (Scrollable si le contenu est trop grand) */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-white/50">
                    {children}
                </div>
            </div>

        </div>
    </div>
  );
};

export default Modal;
