import type { JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminRoute } from './components/AdminRoute';
import { AppShell } from './components/AppShell';
import { DemoRoleProvider } from './context/DemoRoleContext';
import { HitlReviewPage } from './pages/HitlReviewPage';
import { RequestHistoryPage } from './pages/RequestHistoryPage';
import { RequestSubmitPage } from './pages/RequestSubmitPage';

export function App(): JSX.Element {
  return (
    <DemoRoleProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<RequestSubmitPage />} />
            <Route
              path="review"
              element={
                <AdminRoute>
                  <HitlReviewPage />
                </AdminRoute>
              }
            />
            <Route
              path="history"
              element={
                <AdminRoute>
                  <RequestHistoryPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DemoRoleProvider>
  );
}
