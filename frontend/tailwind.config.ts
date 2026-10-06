import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        dark: {
          950: '#050507',
          900: '#09090b',
          800: '#18181b',
          700: '#27272a',
          600: '#3f3f46',
        }
      }
    },
  },
  plugins: [],
};

export default config;
