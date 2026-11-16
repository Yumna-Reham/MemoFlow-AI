'use client';

import React from 'react';
import { Calendar, Award, Star, CheckCircle, ArrowRight, Brain, Zap } from 'lucide-react';

export default function MemoryJourney() {
  const milestones = [
    {
      month: 'January',
      year: '2026',
      title: 'Initiated Vector Search Ingestion',
      description: 'Ingested 54 ChatGPT and WhatsApp vector indexing specifications. Consolidated deep learning logs.',
      icon: Brain,
      color: 'from-blue-500 to-indigo-600',
      badge: 'Completed'
    },
    {
      month: 'February',
      year: '2026',
      title: 'Prompt Engineering Specialization',
      description: 'Compiled Chain of Thought models, few-shot prompt libraries, and self-consistency logics.',
      icon: Zap,
      color: 'from-violet-500 to-purple-600',
      badge: '98% recall'
    },
    {
      month: 'March',
      year: '2026',
      title: 'Product Marketing Launch Strategy',
      description: 'Added Q3 Launch Plan, landing pages mockup files, and Product Hunt positioning targets.',
      icon: Star,
      color: 'from-pink-500 to-rose-600',
      badge: 'In review'
    },
    {
      month: 'April',
      year: '2026',
      title: 'React Concurrent Workspaces',
      description: 'Refactored frontend assets. Saved React 18 Concurrent Deep Dive and Suspense notes.',
      icon: CheckCircle,
      color: 'from-emerald-500 to-teal-600',
      badge: 'Mastered'
    },
    {
      month: 'May',
      year: '2026',
      title: 'Completed Glassmorphic UI Systems',
      description: 'Finalized premium layout structures, breathing voice assistant orbs, and parallax canvases.',
      icon: Award,
      color: 'from-amber-500 to-orange-600',
      badge: 'Current Goal'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar bg-memobg">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-memotext">Memory Journey</h1>
        <p className="text-xs text-memotextsec">Walk through your historical milestones and conceptual growth.</p>
      </div>

      {/* Horizontal Scroll Area */}
      <div className="relative overflow-x-auto py-8 flex gap-8 px-4 no-scrollbar border border-memoborder bg-white rounded-3xl shadow-sm min-h-[350px] items-center">
        {/* Connecting track line */}
        <div className="absolute top-[88px] left-10 right-10 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-amber-400 z-0 rounded-full opacity-30" />

        {milestones.map((item, idx) => {
          const MilestoneIcon = item.icon;
          return (
            <div key={idx} className="relative flex-shrink-0 w-80 z-10">
              {/* Timeline dot header */}
              <div className="flex flex-col items-center mb-6">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-lg shadow-blue-500/10`}>
                  <MilestoneIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-black text-memotext mt-3 leading-none">{item.month}</span>
                <span className="text-[10px] text-memotextsec mt-1 font-semibold">{item.year}</span>
              </div>

              {/* Detail Card */}
              <div className="glass-card rounded-[22px] p-5 border-slate-200/80 shadow-sm relative group hover:border-memoprimary/35">
                <span className={`absolute top-4 right-4 text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                  idx === milestones.length - 1 ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                  {item.badge}
                </span>

                <h3 className="font-extrabold text-sm text-memotext leading-snug pr-12 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-memotextsec leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Connect arrow indicator */}
              {idx < milestones.length - 1 && (
                <div className="absolute top-[38px] -right-6 flex items-center justify-center text-slate-300">
                  <ArrowRight className="w-5 h-5 animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
