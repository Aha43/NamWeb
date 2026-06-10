import { Navigate, Route, Routes } from 'react-router-dom';
import { ShellLayout } from './ShellLayout';
import { InboxPage } from './InboxPage';
import { NextActionsPage } from './NextActionsPage';
import { BacklogPage } from './BacklogPage';
import { FocusPage } from './FocusPage';
import { NotFound } from './NotFound';

export function AppRoutes() {
  return (
    <Routes>
      {/* Immersive execution surface — no shell chrome. */}
      <Route path="focus" element={<FocusPage />} />
      <Route element={<ShellLayout />}>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="next" element={<NextActionsPage />} />
        <Route path="backlog" element={<BacklogPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
