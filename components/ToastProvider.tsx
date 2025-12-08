
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
}

interface ToastContextType {
  addToast: (type: ToastType, title: string, message: string) => void;
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
  info: (title: string, message: string) => void;
  warning: (title: string, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  const success = (title: string, message: string) => addToast('success', title, message);
  const error = (title: string, message: string) => addToast('error', title, message);
  const info = (title: string, message: string) => addToast('info', title, message);
  const warning = (title: string, message: string) => addToast('warning', title, message);

  return (
    <ToastContext.Provider value={{ addToast, success, error, info, warning }}>
      {/* Styles globaux pour l'animation du timer */}
      <style>{`
        @keyframes timer {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      {children}
      
      {/* Toast Container - Fixed bottom right */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto w-96 bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-0 flex flex-col animate-fade-in-up relative overflow-hidden group transition-all hover:scale-[1.02]"
          >
             <div className="flex items-start gap-4 p-5 pb-6">
                <div className={`shrink-0 mt-0.5 p-2 rounded-full ${
                  toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                  toast.type === 'error' ? 'bg-red-50 text-red-600' :
                  toast.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  {toast.type === 'success' && <CheckCircle2 size={20} />}
                  {toast.type === 'error' && <XCircle size={20} />}
                  {toast.type === 'warning' && <AlertCircle size={20} />}
                  {toast.type === 'info' && <Info size={20} />}
                </div>

                <div className="flex-1">
                  <h4 className="font-bold text-sm text-slate-900 mb-1">
                    {toast.title}
                  </h4>
                  <p className="text-slate-500 text-xs leading-relaxed font-medium">
                    {toast.message}
                  </p>
                </div>

                <button 
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-300 hover:text-slate-500 transition-colors p-1"
                >
                  <X size={16} />
                </button>
            </div>

            {/* Timer Bar */}
             <div className="w-full h-1 bg-slate-100 absolute bottom-0 left-0">
                <div 
                    className={`h-full ${
                        toast.type === 'success' ? 'bg-emerald-500' :
                        toast.type === 'error' ? 'bg-red-500' :
                        toast.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'
                    }`} 
                    style={{ animation: 'timer 5s linear forwards' }}
                />
             </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
