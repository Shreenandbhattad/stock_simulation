/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#080d18',
          900: '#0b1020',
          800: '#0e1524',
          700: '#111d30',
          600: '#1a2740',
          500: '#2a3a55',
          400: '#3d5278',
        },
        rose: {
          DEFAULT: '#e8b4b8',
          light:   '#f2d4d7',
          dark:    '#c97f86',
        },
        slate: {
          text:    '#e2e8f4',
          muted:   '#94a3b8',
          dim:     '#64748b',
          faint:   '#475569',
        },
      },
      fontFamily: {
        sans:    ['Roboto', 'sans-serif'],
        mono:    ['Roboto Mono', 'Roboto', 'monospace'],
        display: ['Bebas Neue', 'cursive'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        glow:  '0 0 20px rgba(232,180,184,0.15)',
        inner: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
}
