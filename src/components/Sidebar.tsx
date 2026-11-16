'use client';

import React, { useState, useEffect } from 'react';
import { 
  Home, Inbox, FileText, Folder, HardDrive, CheckSquare, 
  Bot, Settings, LogOut, Brain, User, Plus, Database
} from 'lucide-react';
import { Note } from '@/mockData';
import { getInitials } from '@/lib/services/authService';
import { storageService } from '@/lib/services/storageService';

interface SidebarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  onLogout: () => void;
  onQuickCapture: () => void;
  user?: { name: string; email: string } | null;
  notes?: Note[];
  noteCount?: number;
  loading?: boolean;
  authLoading?: boolean;
}

export default function Sidebar({ 
  currentTab, 
  setTab, 
  onLogout, 
  onQuickCapture, 
  user, 
  notes = [],
  noteCount = 0,
  loading = false,
  authLoading = false 
}: SidebarProps) {
  const isLoading = loading || authLoading;
  const mainNav = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'All Memories', icon: Brain },
    { id: 'collections', label: 'Collections', icon: Folder },
    { id: 'files', label: 'Files', icon: HardDrive },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'memo-ai', label: 'AI Assistant', icon: Bot, badge: 'Live' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const userName = user?.name || 'User';
  const userEmail = user?.email || '';
  const userInitials = getInitials(userName);

  const [storageUsed, setStorageUsed] = useState<string>('0 KB');

  useEffect(() => {
    storageService.calculateUsage(notes).then((metrics) => {
      setStorageUsed(metrics.formattedUsed);
    });
  }, [notes]);

  return (
    <aside className="w-64 border-r border-slate-700/40 bg-[#0B0F19] text-white flex flex-col justify-between h-full pt-3.5 pb-4 px-3 flex-shrink-0 z-30 select-none backdrop-blur-xl font-sans">
      
      {/* Top Header & Brand */}
      <div className="flex flex-col gap-4">
        
        {/* Logo / Header Card (Clean Workspace Branding) */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-white shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-white leading-none">
            MemoFlow
          </span>
        </div>

        {/* Quick Save CTA */}
        <button
          onClick={onQuickCapture}
          className="w-full py-2.5 bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:brightness-105 active:scale-[0.98] transition-all duration-150 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-500/20"
        >
          <Plus className="w-4 h-4 text-white" /> Save Anything
        </button>

        {/* Navigation List */}
        <nav className="flex flex-col gap-0.5">
          <span className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
            Workspace
          </span>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer relative ${
                  active 
                    ? 'bg-purple-500/15 text-purple-200 font-extrabold shadow-2xs border border-purple-400/30' 
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-purple-400 rounded-r-full shadow-2xs" />
                )}
                <Icon className={`w-4 h-4 ${active ? 'text-purple-400' : 'text-slate-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-extrabold border border-purple-400/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Storage & User Profile */}
      <div className="flex flex-col gap-2.5 border-t border-white/10 pt-3">
        
        {/* Storage Usage */}
        <div className="mx-0.5 p-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.09] transition-all duration-150 shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span>Memory Index</span>
            </div>
            <span className="text-[10px] font-extrabold text-purple-400">{storageUsed} used</span>
          </div>
        </div>

        {/* Profile Card & Logout */}
        <div className="flex items-center justify-between p-2 rounded-2xl hover:bg-white/[0.04] transition-colors">
          {isLoading ? (
            <div className="flex items-center gap-2.5 min-w-0 flex-1 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-white/15 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-3 bg-white/15 rounded-md w-20" />
                <div className="h-2 bg-white/15 rounded-md w-28" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-xs text-white block truncate leading-tight">
                  {userName}
                </span>
                <span className="text-[10px] text-slate-500 block truncate leading-tight">
                  {userEmail}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={onLogout}
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer ml-1"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
