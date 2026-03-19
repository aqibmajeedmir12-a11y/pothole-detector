/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bbdaff',
          300: '#8cc3ff',
          400: '#55a3ff',
          500: '#2d7fff',
          600: '#1560f5',
          700: '#0e4de1',
          800: '#123fb6',
          900: '#15398f',
          950: '#0f2257',
        },
        dark: {
          50: '#f6f6f9',
          100: '#ecedf2',
          200: '#d5d7e2',
          300: '#b0b4c8',
          400: '#868ca9',
          500: '#666d8e',
          600: '#515776',
          700: '#434760',
          800: '#3a3d51',
          900: '#1e2030',
          950: '#12131f',
        },
        severity: {
          low: '#22c55e',
          medium: '#f59e0b',
          high: '#f97316',
          critical: '#ef4444',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(45, 127, 255, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(45, 127, 255, 0.6)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
