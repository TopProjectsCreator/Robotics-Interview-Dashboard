import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { CrashFallback } from '@/pages/error-pages';
import { getStoredAuthToken } from './authSession';
import { setAuthTokenGetter } from '@workspace/api-client-react';

import './index.css';

setAuthTokenGetter(getStoredAuthToken);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary FallbackComponent={CrashFallback}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <App />
    </ThemeProvider>
  </ErrorBoundary>,
);
