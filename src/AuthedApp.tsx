import { BrowserRouter } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { AuthUserContext } from './auth/auth-context';
import { WorkspaceProvider } from './store/WorkspaceProvider';
import { CaptureProvider } from './capture/CaptureProvider';
import { ActionEditorProvider } from './features/actions/ActionEditorProvider';
import { AppRoutes } from './routes/AppRoutes';

/** Mounted only once authenticated; owns the workspace, capture, edit, and the routed shell. */
export function AuthedApp({ user }: { user: User }) {
  return (
    <AuthUserContext.Provider value={user}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <WorkspaceProvider>
          <CaptureProvider>
            <ActionEditorProvider>
              <AppRoutes />
            </ActionEditorProvider>
          </CaptureProvider>
        </WorkspaceProvider>
      </BrowserRouter>
    </AuthUserContext.Provider>
  );
}
