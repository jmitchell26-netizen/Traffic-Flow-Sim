/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Traffic light colors
        'traffic-green': '#10b981',
        'traffic-yellow': '#f59e0b',
        'traffic-red': '#ef4444',
        
        // Congestion levels
        'congestion-free': '#22c55e',
        'congestion-light': '#84cc16',
        'congestion-moderate': '#eab308',
        'congestion-heavy': '#f97316',
        'congestion-severe': '#dc2626',
        
        // Dashboard theme - Midnight blue aesthetic
        'dash-bg': '#0f172a',
        'dash-card': '#1e293b',
        'dash-border': '#334155',
        'dash-accent': '#06b6d4',
        'dash-text': '#e2e8f0',
        'dash-muted': '#94a3b8',
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #06b6d4, 0 0 10px #06b6d4' },
          '100%': { boxShadow: '0 0 10px #06b6d4, 0 0 20px #06b6d4, 0 0 30px #06b6d4' },
        },
      },
    },
  },
  plugins: [],
}

