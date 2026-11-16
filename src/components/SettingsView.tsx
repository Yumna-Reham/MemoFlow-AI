'use client';

import React, { useState, useEffect } from 'react';
import { User, Shield, LogOut, CheckCircle2, HardDrive, AlertCircle } from 'lucide-react';
import { Note, Collection } from '@/mockData';
import { authService } from '@/lib/services/authService';
import { storageService, StorageMetrics } from '@/lib/services/storageService';

interface SettingsViewProps {
  user?: { id?: string; name: string; email: string } | null;
  notes?: Note[];
  collections?: Collection[];
  noteCount?: number;
  onLogout?: () => void;
  onUpdateUser?: (updated: { name: string; email: string }) => void;
}

export default function SettingsView({ 
  user, 
  notes = [], 
  collections = [],
  noteCount = 0,
  onLogout,
  onUpdateUser 
}: SettingsViewProps) {
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Keep name input synchronized when user prop arrives or changes
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  // Real storage usage calculation
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics>({
    usedBytes: 0,
    formattedUsed: '0 KB',
    totalGigabytes: 5.0,
    percentage: 1,
  });

  useEffect(() => {
    storageService.calculateUsage(notes).then(setStorageMetrics);
  }, [notes]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMsg('Name cannot be empty.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await authService.updateProfile(trimmed);
      if (res.success) {
        setSuccessMsg('Settings updated successfully!');
        if (onUpdateUser && user?.email) {
          onUpdateUser({ name: trimmed, email: user.email });
        }
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to save changes.');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred while saving.');
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await authService.signOut();
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const userEmail = user?.email || '';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 font-sans">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
          Settings & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Manage your account profile and storage usage.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-8">
        
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-600">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Profile */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-3">
            <h3 className="font-extrabold text-sm text-slate-800">User Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name" 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white"
              />
              <input 
                type="email" 
                value={userEmail} 
                disabled 
                placeholder="Email Address" 
                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Storage */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-extrabold text-sm text-slate-800">Storage Usage</h3>
            <p className="text-xs text-slate-400">{storageMetrics.formattedUsed} used</p>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Security */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800">Security</h3>
            <div className="flex flex-wrap gap-3">
              <button 
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-700 hover:text-rose-600 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all duration-150 shadow-2xs hover:shadow-xs active:scale-[0.98]"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all duration-150 cursor-pointer disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 id="logout-dialog-title" className="font-extrabold text-sm text-slate-800">
                  Log Out
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to log out?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
