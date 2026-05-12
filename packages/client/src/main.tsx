import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { queryClient } from '@/lib/query-client'
import './style.css'
import App from './App.tsx'
import { ThemeProvider } from './components/theme-provider'
import { PRContextProvider } from './hooks'
import { DiffsWorkerPoolProvider } from './lib/diffs-worker-pool'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" cacheKey="clm-ui-theme">
        <DiffsWorkerPoolProvider>
          <PRContextProvider>
            <TooltipProvider>
              <App />
              <Toaster />
            </TooltipProvider>
          </PRContextProvider>
        </DiffsWorkerPoolProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
