/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      padding: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        wizzilist: {
          // Pulled directly from the WizziList logo
          'primary':          '#2563eb',   // logo blue
          'primary-content':  '#ffffff',
          'secondary':        '#f97316',   // logo orange
          'secondary-content':'#ffffff',
          'accent':           '#f97316',
          'accent-content':   '#ffffff',
          'neutral':          '#374151',
          'neutral-content':  '#f9fafb',
          'base-100':         '#ffffff',   // page background
          'base-200':         '#f9fafb',   // subtle tint
          'base-300':         '#f3f4f6',   // card borders / dividers
          'base-content':     '#111827',   // primary text
          'info':             '#0ea5e9',
          'info-content':     '#ffffff',
          'success':          '#16a34a',
          'success-content':  '#ffffff',
          'warning':          '#d97706',
          'warning-content':  '#ffffff',
          'error':            '#dc2626',
          'error-content':    '#ffffff',
        },
      },
    ],
    darkTheme: false,
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
}
