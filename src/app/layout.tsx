import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import { Plus_Jakarta_Sans, Fira_Mono } from 'next/font/google'
import BottomBar from '@/components/ui/BottomBar'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const firaMono = Fira_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'WizziList',
  description: 'Your household pantry, always in order.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WizziList',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="wizzilist" className={`${plusJakartaSans.variable} ${firaMono.variable}`}>
      <body className="bg-base-100 text-base-content font-sans antialiased min-h-screen">
        {children}
        <BottomBar />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            },
            success: { iconTheme: { primary: '#16a34a', secondary: '#ffffff' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: '#ffffff' } },
          }}
        />
      </body>
    </html>
  )
}
