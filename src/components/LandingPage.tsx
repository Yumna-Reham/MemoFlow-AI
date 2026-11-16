'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, ArrowUp, Play, MessageSquare, FileText, Camera, Mic, Brain, 
  Search, CheckCircle2, Plus, Minus, Shield, Zap, Sparkles, File, 
  Link as LinkIcon, Layers, Bookmark, Cpu, Clock, CheckSquare, GraduationCap,
  Microscope, Code, Video, Briefcase, Rocket, ChevronRight, FileSearch, HardDrive, Terminal
} from 'lucide-react';
import Floating3DOrb from './Floating3DOrb';
import { landingFAQs } from '../mockData';

interface LandingPageProps {
  onStart: (mode: 'login' | 'signup') => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);

  // Orbiting Document Cards cleanly positioned around the central 3D Neural Orb
  const orbitingCards = [
    { icon: FileText, title: 'PDF Research', tag: 'Academic PDF', color: 'text-red-400 border-red-500/30 bg-red-500/10 shadow-red-500/10', position: 'top-[4%] left-[2%] sm:left-[8%]', delay: 0 },
    { icon: Mic, title: 'Voice Memo', tag: '2 min audio', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/10', position: 'top-[4%] right-[2%] sm:right-[8%]', delay: 0.4 },
    { icon: Camera, title: 'UI Screenshot', tag: 'OCR text', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10 shadow-purple-500/10', position: 'top-[42%] left-[-1%] sm:left-[2%]', delay: 0.8 },
    { icon: File, title: 'Doc Notes', tag: 'Markdown', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10 shadow-blue-500/10', position: 'top-[42%] right-[-1%] sm:right-[2%]', delay: 1.2 },
    { icon: LinkIcon, title: 'Resource URL', tag: 'Web Article', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-amber-500/10', position: 'bottom-[4%] left-[4%] sm:left-[10%]', delay: 1.6 },
  ];

  // Real AI Pipeline Workflow Steps with Interactive Stage Previews
  const workflowSteps = [
    {
      step: '01',
      title: 'Upload',
      subtitle: 'Multi-Format Capture',
      desc: 'Upload PDFs, documents, images, audio notes, or web links through one centralized capture hub.',
      icon: FileText,
      gradient: 'from-blue-600 via-indigo-600 to-cyan-400',
      badge: 'Multi-Format Input',
      status: 'Ready to Process',
      buttonText: 'Try Upload Stage',
      preview: {
        type: 'upload',
        filename: 'Lecture_Notes_2026.pdf',
        size: '4.2 MB',
        status: 'Ready to Process'
      }
    },
    {
      step: '02',
      title: 'OCR',
      subtitle: 'Image Text Extraction',
      desc: 'Extract readable text from screenshots, photos, whiteboards, and other text-rich images with AI vision OCR.',
      icon: Camera,
      gradient: 'from-purple-600 via-violet-600 to-indigo-500',
      badge: 'Vision Parsing',
      status: 'On-Demand AI Processing',
      buttonText: 'Try OCR Stage',
      preview: {
        type: 'ocr',
        extracted: '"Transformer self-attention Mechanism reduces O(N) sequential bottleneck..."',
        status: 'Text extracted via AI vision'
      }
    },
    {
      step: '03',
      title: 'AI Understanding',
      subtitle: 'AI Understanding',
      desc: 'Transcribe audio on demand and generate concise summaries, key takeaways, and suggested tags with AI.',
      icon: Sparkles,
      gradient: 'from-violet-600 via-fuchsia-600 to-pink-500',
      badge: 'AI Synthesis',
      status: 'On-Demand AI Processing',
      buttonText: 'Try AI Understanding Stage',
      preview: {
        type: 'synthesis',
        summary: 'Key Topic: Deep Learning Architectures',
        bullet: '1. Multi-Head Attention enables parallelized sequence modeling.'
      }
    },
    {
      step: '04',
      title: 'Structured Memory',
      subtitle: 'Structured Memory',
      desc: 'Turn captured content into organized memories with titles, summaries, takeaways, tags, categories, and attached source files.',
      icon: Cpu,
      gradient: 'from-emerald-600 via-teal-600 to-cyan-500',
      badge: 'Structured Memory',
      status: 'Memory Ready',
      buttonText: 'Explore Structured Memory Stage',
      preview: {
        type: 'memory',
        title: 'Lecture Notes',
        summary: 'Key concepts and useful takeaways',
        tagsLabel: 'Tags',
        tags: ['Machine Learning', 'Architecture']
      }
    },
    {
      step: '05',
      title: 'Organization',
      subtitle: 'Smart Organization',
      desc: 'Organize saved memories with automatic tags and content-based category routing, while keeping manual control when needed.',
      icon: Layers,
      gradient: 'from-amber-600 via-orange-600 to-yellow-500',
      badge: 'Smart Organization',
      status: 'Automatic + Manual Organization',
      buttonText: 'Try Smart Organization Stage',
      preview: {
        type: 'routing',
        collection: 'University',
        tagsLabel: 'Suggested Tags',
        tags: ['Machine Learning', 'Architecture']
      }
    },
    {
      step: '06',
      title: 'Search',
      subtitle: 'Fast Workspace Search',
      desc: 'Search your saved memories quickly by title, summary, and tags with the Ctrl+K workspace search.',
      icon: Search,
      gradient: 'from-cyan-500 via-blue-600 to-indigo-600',
      badge: 'Workspace Search',
      status: 'Instant Local Search',
      buttonText: 'Try Workspace Search Stage',
      preview: {
        type: 'search',
        search: 'Machine Learning',
        matches: 'Lecture Notes, Deep Learning Notes'
      }
    },
    {
      step: '07',
      title: 'AI Recall',
      subtitle: 'AI Memory Recall',
      desc: 'Ask questions about your saved workspace notes and receive AI-generated answers grounded in retrieved memory context with source references.',
      icon: Brain,
      gradient: 'from-fuchsia-600 via-violet-600 to-cyan-500',
      badge: 'Cited AI Recall',
      status: 'AI-Powered Recall',
      buttonText: 'Try AI Recall Stage',
      preview: {
        type: 'recall',
        answer: 'Self-attention computes dynamic weight scores across input tokens.',
        citation: 'Source: Lecture Notes 2026'
      }
    }
  ];

  return (
    <div className="min-h-screen bg-[#070913] text-white selection:bg-cyan-500 selection:text-black overflow-x-hidden font-landing">
      
      {/* Background Radial Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-violet-600/20 via-indigo-600/10 to-transparent blur-[160px] pointer-events-none -z-10" />
      <div className="absolute top-[900px] right-0 w-[600px] h-[600px] bg-cyan-500/10 blur-[180px] pointer-events-none -z-10" />
      <div className="absolute top-[1800px] left-0 w-[600px] h-[600px] bg-purple-500/10 blur-[180px] pointer-events-none -z-10" />

      {/* Modern Glassmorphism Sticky Navbar */}
      <header className="sticky top-0 z-50 glass-nav px-6 py-4 border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-violet-500/25 border border-white/20">
              <Brain className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              MemoFlow
            </span>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#experience" className="hover:text-white transition-colors relative group">
              <span>Workflow</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-violet-400 transition-all duration-300 group-hover:w-full" />
            </a>
            <a href="#features" className="hover:text-white transition-colors relative group">
              <span>Features</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-violet-400 transition-all duration-300 group-hover:w-full" />
            </a>
            <a href="#built-for" className="hover:text-white transition-colors relative group">
              <span>Built For</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-violet-400 transition-all duration-300 group-hover:w-full" />
            </a>
            <a href="#faq" className="hover:text-white transition-colors relative group">
              <span>FAQ</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-violet-400 transition-all duration-300 group-hover:w-full" />
            </a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onStart('login')}
              className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Log In
            </button>
            <button 
              onClick={() => onStart('signup')}
              className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:opacity-90 rounded-full shadow-lg shadow-violet-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/20"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-32 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Large Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] max-w-5xl mb-8"
        >
          Everything You Save.{' '}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
            Finally Makes Sense.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed mb-10 font-medium"
        >
          Turn scattered notes, screenshots, PDFs, links, voice memos and documents into one intelligent, searchable AI memory.
        </motion.p>

        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 z-20"
        >
          <button 
            onClick={() => onStart('signup')}
            className="px-8 py-4 text-base font-extrabold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:opacity-95 rounded-full shadow-xl shadow-purple-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/20 flex items-center gap-2"
          >
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <a 
            href="#experience"
            className="px-8 py-4 rounded-full glass-card-dark hover:bg-white/10 text-slate-200 border border-white/20 font-extrabold text-base flex items-center gap-2.5 shadow-xl shadow-cyan-500/10 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 text-cyan-400 fill-current" /> Watch Product Demo
          </a>
        </motion.div>

        {/* Central 3D Canvas Orb & Clean Non-Overlapping Orbit Cards */}
        <div className="relative w-full max-w-5xl h-[450px] sm:h-[520px] flex items-center justify-center pointer-events-none select-none">
          
          {/* Central 3D Neural Sphere Canvas */}
          <div className="relative z-10">
            <Floating3DOrb size={300} interactive={true} />
          </div>

          {/* Glowing Ambient Orbital Arcs */}
          <div className="absolute w-[380px] h-[380px] sm:w-[460px] sm:h-[460px] rounded-full border border-violet-500/20 border-dashed animate-spin-slow pointer-events-none" />
          <div className="absolute w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] rounded-full border border-cyan-500/15 pointer-events-none" />

          {/* Clean Non-Overlapping Orbit Cards */}
          {orbitingCards.map((card, idx) => {
            const CardIcon = card.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  y: [0, -8, 0]
                }}
                transition={{
                  duration: 4 + idx * 0.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: card.delay
                }}
                className={`absolute ${card.position} glass-card-dark px-4 py-3 rounded-2xl border ${card.color} flex items-center gap-3 shadow-2xl backdrop-blur-xl z-20 pointer-events-auto cursor-default`}
              >
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                  <CardIcon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-extrabold text-slate-100 block leading-tight">{card.title}</span>
                  <span className="text-[10px] text-slate-400 font-medium block">{card.tag}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Product Experience Real AI Pipeline Workflow */}
      <section id="experience" className="py-32 bg-[#0C101D] border-y border-white/10 relative">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-4 py-1.5 rounded-full mb-4 shadow-sm">
              7-Stage AI Pipeline
            </span>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              From Raw Data to Instant Neural Recall
            </h2>
            <p className="text-slate-400 text-base font-medium pt-1">
              Click through our automated ingestion workflow to see how MemoFlow processes your memory.
            </p>
          </div>

          {/* Modern Interactive Pipeline Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-12">
            {workflowSteps.map((ws, idx) => {
              const StepIcon = ws.icon;
              const isActive = activeWorkflowStep === idx;
              return (
                <button
                  key={ws.step}
                  onClick={() => setActiveWorkflowStep(idx)}
                  className={`p-4 rounded-2xl text-left transition-all duration-300 cursor-pointer flex flex-col justify-between gap-3 relative ${
                    isActive
                      ? 'border-2 border-cyan-400 bg-slate-800/90 shadow-[0_0_20px_rgba(34,211,238,0.35)] text-white scale-[1.03] z-10 ring-2 ring-cyan-400/40'
                      : 'border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold ${isActive ? 'text-cyan-300' : 'text-slate-500'}`}>{ws.step}</span>
                    <StepIcon className={`w-4 h-4 ${isActive ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white font-black' : 'text-slate-300 font-semibold'}`}>{ws.title}</span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Workflow Detail Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeWorkflowStep}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="bg-slate-900/90 border border-slate-700/60 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 blur-[120px] pointer-events-none" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-cyan-300 bg-cyan-500/15 border border-cyan-400/30 px-3.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                      {workflowSteps[activeWorkflowStep].badge}
                    </span>
                    <span className="text-xs font-bold text-slate-400">Stage {workflowSteps[activeWorkflowStep].step} of 07</span>
                  </div>

                  <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {workflowSteps[activeWorkflowStep].subtitle}
                  </h3>

                  <p className="text-slate-300 text-base leading-relaxed font-medium">
                    {workflowSteps[activeWorkflowStep].desc}
                  </p>

                  <div className="pt-2 flex items-center gap-4">
                    <button
                      onClick={() => onStart('signup')}
                      className="px-6 py-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 cursor-pointer"
                    >
                      {workflowSteps[activeWorkflowStep].buttonText || `Try ${workflowSteps[activeWorkflowStep].title} Stage`} <ArrowRight className="w-4 h-4 text-slate-950" />
                    </button>
                    <span className="text-xs text-slate-400 font-semibold">{workflowSteps[activeWorkflowStep].status || 'Ready to Process'}</span>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <div className="flex justify-center">
                    <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-3xl bg-gradient-to-tr ${workflowSteps[activeWorkflowStep].gradient} flex items-center justify-center text-white shadow-2xl shadow-cyan-500/20 border border-white/20 relative group`}>
                      {React.createElement(workflowSteps[activeWorkflowStep].icon, { className: "w-16 h-16 transform group-hover:scale-110 transition-transform duration-300" })}
                    </div>
                  </div>

                  {/* Interactive Code/Data Terminal Preview */}
                  <div className="w-full bg-[#080C19] border border-slate-700/80 rounded-2xl p-5 text-left font-mono text-xs text-slate-200 space-y-2 shadow-inner">
                    <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-300">Stage Live Console</span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>

                    {workflowSteps[activeWorkflowStep].preview.filename && (
                      <p><span className="text-cyan-400 font-bold">Payload:</span> {workflowSteps[activeWorkflowStep].preview.filename} ({workflowSteps[activeWorkflowStep].preview.size})</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.status && (
                      <p className="text-slate-300 text-[11px]"><span className="text-cyan-400 font-bold">Status:</span> {workflowSteps[activeWorkflowStep].preview.status}</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.extracted && (
                      <p className="text-purple-300 italic">{workflowSteps[activeWorkflowStep].preview.extracted}</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.title && (
                      <p><span className="text-cyan-400 font-bold">Title:</span> {workflowSteps[activeWorkflowStep].preview.title}</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.summary && (
                      <p className="text-emerald-400 font-bold">{workflowSteps[activeWorkflowStep].preview.summary}</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.bullet && (
                      <p className="text-slate-300 text-[11px]">{workflowSteps[activeWorkflowStep].preview.bullet}</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.search && (
                      <p><span className="text-cyan-400 font-bold">Search:</span> &quot;{workflowSteps[activeWorkflowStep].preview.search}&quot;</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.matches && (
                      <p className="text-slate-300 text-[11px]"><span className="text-cyan-400 font-bold">Matches:</span> {workflowSteps[activeWorkflowStep].preview.matches}</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.collection && (
                      <p><span className="text-cyan-400 font-bold">Collection:</span> {workflowSteps[activeWorkflowStep].preview.collection}</p>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.tags && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-slate-400 text-[10px]">{workflowSteps[activeWorkflowStep].preview.tagsLabel || 'Tags'}:</span>
                        {workflowSteps[activeWorkflowStep].preview.tags.map(t => (
                          <span key={t} className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-bold">{t}</span>
                        ))}
                      </div>
                    )}
                    {workflowSteps[activeWorkflowStep].preview.answer && (
                      <div>
                        <p className="text-violet-300 font-semibold">{workflowSteps[activeWorkflowStep].preview.answer}</p>
                        {workflowSteps[activeWorkflowStep].preview.citation && (
                          <span className="text-[10px] text-cyan-400 font-bold block pt-1">{workflowSteps[activeWorkflowStep].preview.citation}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-32 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-4 py-1.5 rounded-full mb-4 shadow-sm">
            Core Features
          </span>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Engineered for Effortless Retention
          </h2>
          <p className="text-slate-400 text-base font-medium pt-1">
            Discover the intelligent tools built into your personal MemoFlow workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              title: 'Universal Ingestion',
              desc: 'Store text notes, PDFs, code, screenshots, voice clips, and web links in one unified memory node.',
              icon: HardDrive,
              color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
            },
            {
              title: 'Computer Vision OCR',
              desc: 'Extract readable text automatically from uploaded images, diagrams, whiteboard photos, and infographics.',
              icon: Camera,
              color: 'text-purple-400 bg-purple-500/10 border-purple-500/20'
            },
            {
              title: 'Voice Transcription',
              desc: 'Record or upload audio memos and receive instant text transcripts with key takeaway summaries.',
              icon: Mic,
              color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            },
            {
              title: 'Fast Workspace Search',
              desc: 'Search your memory quickly by title, summary, and tags using Ctrl+K spotlight search.',
              icon: Search,
              color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
            },
            {
              title: 'Context Workspace Categories',
              desc: 'Organize memories effortlessly across Personal, University, Office, Research, Projects, and Finance contexts.',
              icon: Layers,
              color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            },
            {
              title: 'Action Item Extraction',
              desc: 'Automatically generate interactive task checklists from your saved notes and meeting transcripts.',
              icon: CheckSquare,
              color: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            }
          ].map((feat, idx) => {
            const FeatIcon = feat.icon;
            return (
              <div
                key={idx}
                className="glass-card-dark rounded-3xl p-8 border border-white/10 hover:border-violet-500/40 hover:shadow-2xl transition-all space-y-4 group"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${feat.color}`}>
                  <FeatIcon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                  {feat.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed font-normal">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Built For Section */}
      <section id="built-for" className="py-28 bg-[#090D1A] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full mb-4 shadow-sm">
              Tailored Workspaces
            </span>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Designed for High Performers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { role: 'Students & Researchers', icon: GraduationCap, text: 'Synthesize lecture slides, PDFs, and exam notes into instant AI quiz decks.' },
              { role: 'Software Developers', icon: Code, text: 'Store code snippets, architecture diagrams, and tech specs with fast workspace search.' },
              { role: 'Product Managers', icon: Briefcase, text: 'Keep user interview clips, PRDs, and action item checklists organized in one place.' },
              { role: 'Content Creators', icon: Video, text: 'Capture inspiring video links, web bookmarks, and voice memos on the go.' },
            ].map((item, idx) => {
              const RoleIcon = item.icon;
              return (
                <div key={idx} className="glass-card-dark rounded-3xl p-6 border border-white/10 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 flex items-center justify-center">
                    <RoleIcon className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-base text-white">{item.role}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 max-w-4xl mx-auto px-6">
        <div className="text-center space-y-4 mb-16">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-4 py-1.5 rounded-full mb-4 shadow-sm">
            Got Questions?
          </span>
          <h2 className="text-4xl font-black tracking-tight text-white leading-tight">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {landingFAQs.map((faq, idx) => (
            <div 
              key={idx}
              className="glass-card-dark rounded-2xl border border-white/10 overflow-hidden"
            >
              <button
                onClick={() => setActiveFAQ(activeFAQ === idx ? null : idx)}
                className="w-full p-6 text-left flex items-center justify-between font-bold text-base text-slate-200 hover:text-white cursor-pointer"
              >
                <span>{faq.q}</span>
                {activeFAQ === idx ? <Minus className="w-5 h-5 text-cyan-400 shrink-0" /> : <Plus className="w-5 h-5 text-slate-400 shrink-0" />}
              </button>
              {activeFAQ === idx && (
                <div className="px-6 pb-6 text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Back to Top */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-dark border border-white/10 hover:border-cyan-400/40 text-xs font-semibold text-slate-400 hover:text-white transition-all duration-200 cursor-pointer shadow-sm hover:shadow-cyan-500/10"
            aria-label="Back to top"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5 text-cyan-400 group-hover:-translate-y-0.5 transition-transform duration-200" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-white/10 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 MemoFlow. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="#experience" className="hover:text-slate-300 transition-colors">Workflow</a>
            <a href="#features" className="hover:text-slate-300 transition-colors">Features</a>
            <a href="#faq" className="hover:text-slate-300 transition-colors">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
