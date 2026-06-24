import { BrowserRouter } from 'react-router-dom';
import { AuthUserContext } from '@/auth/auth-context';
import { CaptureProvider } from '@/capture/CaptureProvider';
import { ActionEditorProvider } from '@/features/actions/ActionEditorProvider';
import { AppRoutes } from '@/routes/AppRoutes';
import { DemoWorkspaceProvider } from './DemoWorkspaceProvider';
import { DemoBanner } from './DemoBanner';
import { DEMO_USER } from './demoUser';

/**
 * The no-account demo: the real app tree (same providers, routes, shell) but with a synthetic user
 * and a local, seeded workspace instead of Supabase. `onSignUp` exits the demo to the sign-up screen.
 */
export function DemoApp({ onSignUp }: { onSignUp: () => void }) {
  return (
    <AuthUserContext.Provider value={DEMO_USER}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DemoWorkspaceProvider onSignUp={onSignUp}>
          <CaptureProvider>
            <ActionEditorProvider>
              <DemoBanner />
              <AppRoutes />
            </ActionEditorProvider>
          </CaptureProvider>
        </DemoWorkspaceProvider>
      </BrowserRouter>
    </AuthUserContext.Provider>
  );
}
