import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        memobg: '#F8F9FE',
        memocard: '#FFFFFF',
        memoprimary: '#8B5CF6',
        memosecondary: '#6366F1',
        memoaccent: '#06B6D4',
        memopink: '#EC4899',
        memotext: '#0F172A',
        memotextsec: '#64748B',
        memoborder: '#E2E8F0',
        memosuccess: '#10B981',
        memowarning: '#F59E0B',
        memodanger: '#F43F5E',
        'hero-bg': '#090C15',
        'hero-card': 'rgba(15, 23, 42, 0.65)',
        'hero-border': 'rgba(255, 255, 255, 0.08)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        landing: ['var(--font-landing)', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float-delayed 8s ease-in-out infinite',
        'orbit-slow': 'orbit 25s linear infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        aurora: 'aurora 15s ease infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(1deg)' },
        },
        'float-delayed': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(10px) rotate(-1deg)' },
        },
        orbit: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 25px rgba(139, 92, 246, 0.35), 0 0 50px rgba(6, 182, 212, 0.15)',
            transform: 'scale(1)',
          },
          '50%': {
            boxShadow: '0 0 55px rgba(139, 92, 246, 0.6), 0 0 90px rgba(236, 72, 153, 0.3)',
            transform: 'scale(1.03)',
          },
        },
        aurora: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
