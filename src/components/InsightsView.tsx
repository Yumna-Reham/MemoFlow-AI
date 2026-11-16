'use client';

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from 'recharts';
import { Zap, BookOpen, Star, Clock, Brain, FileText, CheckCircle } from 'lucide-react';
import { weeklyStats, Note } from '../mockData';

interface InsightsViewProps {
  notes: Note[];
  onSelectNote: (noteId: string) => void;
}

export default function InsightsView({ notes, onSelectNote }: InsightsViewProps) {
  const totalSaved = notes.length;
  const recentSaved = notes.slice(0, 3);
  
  // Simulated stats
  const recallAccuracy = 94;
  const totalMinutes = weeklyStats.reduce((sum, item) => sum + item.time, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar bg-memobg">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-memotext">Memory Insights</h1>
        <p className="text-xs text-memotextsec">Evaluate study streak, storage analytics, and recall rates.</p>
      </div>

      {/* Top metrics grids */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="bg-white border border-memoborder rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-memotextsec uppercase block">Daily Streak</span>
            <span className="text-xl font-extrabold text-memotext leading-tight block">12 Days</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-memoborder rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-memoprimary">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-memotextsec uppercase block">Total Elements</span>
            <span className="text-xl font-extrabold text-memotext leading-tight block">{totalSaved} Items</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-memoborder rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-memotextsec uppercase block">Quiz Accuracy</span>
            <span className="text-xl font-extrabold text-memotext leading-tight block">{recallAccuracy}%</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-memoborder rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-memotextsec uppercase block">Study Time</span>
            <span className="text-xl font-extrabold text-memotext leading-tight block">{totalMinutes} mins</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Ingestion vs Review */}
        <div className="bg-white border border-memoborder rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-sm text-memotext">Ingestion vs. Review Activities</h3>
            <p className="text-[10px] text-memotextsec">Comparing weekly volume of items saved and reviewed.</p>
          </div>
          <div className="h-[200px] w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(226, 232, 240, 0.3)' }} />
                <Bar dataKey="saved" fill="#2563EB" radius={[4, 4, 0, 0]} name="Saved" />
                <Bar dataKey="reviewed" fill="#60A5FA" radius={[4, 4, 0, 0]} name="Reviewed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Daily Learning Minutes */}
        <div className="bg-white border border-memoborder rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-sm text-memotext">Learning Time (Minutes)</h3>
            <p className="text-[10px] text-memotextsec">Tracking daily minutes allocated to memory reviews.</p>
          </div>
          <div className="h-[200px] w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="time" stroke="#7C3AED" strokeWidth={2} fillOpacity={1} fill="url(#colorTime)" name="Minutes" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Most viewed notes list */}
      <div className="bg-white border border-memoborder rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-sm text-memotext">Frequently Visited Memories</h3>
          <p className="text-[10px] text-memotextsec">Nodes with high review weight scores inside the graph.</p>
        </div>

        <div className="divide-y divide-slate-100">
          {recentSaved.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              className="py-3 flex items-center justify-between hover:bg-slate-50/50 rounded-xl px-2 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-memoprimary" />
                <span className="text-xs font-bold text-memotext">{note.title}</span>
              </div>
              <span className="text-[10px] font-bold text-memotextsec uppercase bg-slate-100 px-2 py-0.5 rounded">
                High Recall Weight
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
