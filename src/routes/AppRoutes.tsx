import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ShellLayout } from './ShellLayout';
import { InboxPage } from './InboxPage';
import { NextActionsPage } from './NextActionsPage';
import { BacklogPage } from './BacklogPage';
import { ProjectsPage } from './ProjectsPage';
import { ProjectWorkbenchPage } from './ProjectWorkbenchPage';
import { DonePage } from './DonePage';
import { DuePage } from './DuePage';
import { NotFound } from './NotFound';

// Code-split the immersive focus deck (pulls in framer-motion) off the main bundle.
const FocusPage = lazy(() => import('./FocusPage').then((m) => ({ default: m.FocusPage })));

export function AppRoutes() {
  return (
    <Routes>
      {/* Immersive execution surface — no shell chrome; lazily loaded. */}
      <Route
        path="focus"
        element={
          <Suspense
            fallback={
              <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
                Loading…
              </div>
            }
          >
            <FocusPage />
          </Suspense>
        }
      />
      <Route element={<ShellLayout />}>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="next" element={<NextActionsPage />} />
        <Route path="backlog" element={<BacklogPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectWorkbenchPage />} />
        <Route path="done" element={<DonePage />} />
        <Route path="due" element={<DuePage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
