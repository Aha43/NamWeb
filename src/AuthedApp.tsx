import { BrowserRouter } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { AuthUserContext } from './auth/auth-context';
import { WorkspaceProvider } from './store/WorkspaceProvider';
import { CaptureProvider } from './capture/CaptureProvider';
import { ActionEditorProvider } from './features/actions/ActionEditorProvider';
import { DeleteProjectProvider } from './features/projects/delete/DeleteProjectProvider';
import { ToastProvider } from './components/ui/toast/ToastProvider';
import { AppRoutes } from './routes/AppRoutes';
import { ShareEventDrain } from './features/sharing/ShareEventDrain';

/** Mounted only once authenticated; owns the workspace, capture, edit, and the routed shell. */
export function AuthedApp({ user }: { user: User }) {
  return (
    <AuthUserContext.Provider value={user}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <WorkspaceProvider>
          <ShareEventDrain />
          <ToastProvider>
            <CaptureProvider>
              <DeleteProjectProvider>
                <ActionEditorProvider>
                  <AppRoutes />
                </ActionEditorProvider>
              </DeleteProjectProvider>
            </CaptureProvider>
          </ToastProvider>
        </WorkspaceProvider>
      </BrowserRouter>
    </AuthUserContext.Provider>
  );
}
