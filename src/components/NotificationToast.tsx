'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface NotificationToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function NotificationToast({ toasts, onDismiss }: NotificationToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`p-4 rounded-2xl border shadow-xl backdrop-blur-xl pointer-events-auto flex items-start gap-3 transition-all ${
                toast.type === 'success'
                  ? 'bg-slate-900/90 text-white border-emerald-500/40 shadow-emerald-500/10'
                  : toast.type === 'error'
                  ? 'bg-slate-900/90 text-white border-rose-500/40 shadow-rose-500/10'
                  : 'bg-slate-900/90 text-white border-violet-500/40 shadow-violet-500/10'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />}

              <div className="flex-1 min-w-0 space-y-0.5">
                <h4 className="font-bold text-xs leading-snug">{toast.title}</h4>
                {toast.description && (
                  <p className="text-[11px] text-slate-300 leading-normal">{toast.description}</p>
                )}
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-white p-0.5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
