import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/theme/ThemeProvider.tsx';
import { SettingsProvider } from './components/settings/SettingsProvider.tsx';
import App from './App.tsx';
import { applyEnvChrome } from './lib/favicon.ts';
import './index.css';

// Visual env cue: yellow "working" favicon + tagged title outside production.
applyEnvChrome();

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>,
);
