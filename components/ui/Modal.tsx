
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
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
        document.body.style.overflow = 'hidden';
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    } else {
        setIsVisible(false);
        const timer = setTimeout(() => {
            document.body.style.overflow = 'unset';
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            
            {/* BACKDROP FLOU */}
            <div 
                className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
                aria-hidden="true"
            />
            
            {/* CONTENU */}
            <div 
                className={`relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all duration-300 sm:w-full ${maxWidth} flex flex-col max-h-[90vh] border border-slate-200 ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white shrink-0">
                    <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-white">
                    {children}
                </div>
            </div>
        </div>
    </div>
  );

  // On utilise createPortal pour injecter le modal directement dans le body
  return ReactDOM.createPortal(modalContent, document.body);
};

export default Modal;
