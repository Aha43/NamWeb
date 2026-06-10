import { BrowserRouter } from 'react-router-dom';
import { WorkspaceProvider } from './store/WorkspaceProvider';
import { AppRoutes } from './routes/AppRoutes';

/** Mounted only once authenticated; owns the workspace and the routed shell. */
export function AuthedApp() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <WorkspaceProvider>
        <AppRoutes />
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
