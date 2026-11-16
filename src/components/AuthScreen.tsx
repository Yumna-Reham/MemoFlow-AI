'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowLeft, Brain, User, AlertCircle, Sparkles, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Chrome, Github } from './BrandIcons';
import { authService } from '@/lib/services/authService';

interface AuthScreenProps {
  initialMode: 'login' | 'signup';
  onBack: () => void;
  onSuccess: () => void;
}

export default function AuthScreen({ initialMode, onBack, onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (mode !== 'forgot' && !password.trim()) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await authService.signIn(email, password);
        setSuccessMessage('Sign in successful! Accessing workspace...');
        setTimeout(() => {
          onSuccess();
        }, 700);
      } else if (mode === 'signup') {
        const result: any = await authService.signUp(email, password, name);
        if (result?.requiresConfirmation) {
          setSuccessMessage(result.message || 'Confirmation link sent! Please check your inbox.');
        } else {
          setSuccessMessage('Account created successfully! Accessing workspace...');
          setTimeout(() => {
            onSuccess();
          }, 800);
        }
      } else if (mode === 'forgot') {
        await authService.resetPasswordForEmail(email);
        setSuccessMessage('Password reset instructions sent! Please check your email inbox.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      await authService.signInWithOAuth(provider);
    } catch (err: any) {
      setError(err.message || `Failed to authenticate with ${provider}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090C15] text-[#F8FAFC] relative flex items-center justify-center p-6 font-sans overflow-hidden">
      
      {/* Landing Page Mesh Aurora Lights */}
      <div className="absolute top-1/4 left-1/4 w-[550px] h-[550px] bg-violet-600/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[550px] h-[550px] bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Back to landing button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 px-4 py-2 rounded-full border border-white/20 bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white flex items-center gap-2 text-xs font-semibold transition-all cursor-pointer z-20 shadow-lg backdrop-blur-md"
      >
        <ArrowLeft className="w-4 h-4 text-violet-400" /> Back to Landing
      </button>

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-violet-500 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-2xl shadow-violet-500/30 border border-white/20 mb-4">
            <Brain className="w-7 h-7" />
          </div>
          <h1 className="font-bold text-3xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            MemoFlow
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-2">
            {mode === 'login' && 'Sign in to your AI memory workspace'}
            {mode === 'signup' && 'Create your neural second brain account'}
            {mode === 'forgot' && 'Reset your secure account password'}
          </p>
        </div>

        {/* Lighter Premium Glass Card with Prominent Light Border */}
        <div className="bg-[#121829]/80 backdrop-blur-2xl rounded-3xl p-8 border border-white/35 shadow-2xl shadow-violet-500/20 ring-1 ring-white/10 space-y-6">
          
          {/* Mode Switcher Tabs */}
          <div className="flex bg-white/10 border border-white/20 rounded-2xl p-1">
            <button
              onClick={() => {
                setMode('login');
                setError('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                mode === 'login' 
                  ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-violet-500/30 border border-white/20' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                mode === 'signup' 
                  ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-violet-500/30 border border-white/20' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Toast feedback alerts */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 flex items-start gap-3 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-start gap-3 text-xs text-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider block">Full Name</label>
                <div className="relative flex items-center">
                  <User className="absolute left-4 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 hover:border-white/30 rounded-2xl text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-cyan-300 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider block">Email Address</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-4 w-4 h-4 text-slate-300" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 hover:border-white/30 rounded-2xl text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-cyan-300 transition-all"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider block">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError('');
                        setSuccessMessage('');
                      }}
                      className="text-[11px] text-cyan-400 hover:underline font-semibold cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-slate-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-11 pr-11 py-3 bg-white/10 border border-white/20 hover:border-white/30 rounded-2xl text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-cyan-300 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:opacity-95 disabled:opacity-75 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-violet-500/30 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer border border-white/25 flex items-center justify-center gap-2.5 tracking-wide"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Processing request...</span>
                </div>
              ) : (
                <>
                  {mode !== 'signup' && <Sparkles className="w-4 h-4 text-cyan-300" />}
                  <span>
                    {mode === 'login' && 'Sign In to Workspace'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Send Reset Instructions'}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
