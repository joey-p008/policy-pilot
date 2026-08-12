import type { JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminRoute } from './components/AdminRoute';
import { AppShell } from './components/AppShell';
import { ProfileGate } from './components/ProfileGate';
import { DemoRoleProvider } from './context/DemoRoleContext';
import { RequesterProfileProvider } from './context/RequesterProfileContext';
import { HitlReviewPage } from './pages/HitlReviewPage';
import { ProfilePage } from './pages/ProfilePage';
import { RequestHistoryPage } from './pages/RequestHistoryPage';
import { RequestSubmitPage } from './pages/RequestSubmitPage';

export function App(): JSX.Element {
  return (
    <RequesterProfileProvider>
      <DemoRoleProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route element={<ProfileGate />}>
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
            </Route>
          </Routes>
        </BrowserRouter>
      </DemoRoleProvider>
    </RequesterProfileProvider>
  );
}
