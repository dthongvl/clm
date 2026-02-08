import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/sonner"
import { queryClient } from '@/lib/query-client'
import './style.css'
import App from './App.tsx'
import { ThemeProvider } from './components/theme-provider'
import { PRContextProvider } from './hooks'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="codereview-ui-theme">
        <PRContextProvider>
          <App />
          <Toaster />
        </PRContextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
