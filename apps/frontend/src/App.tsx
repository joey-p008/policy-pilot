import type { JSX } from 'react';
import { AuthProvider } from 'react-oidc-context';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminRoute } from './components/AdminRoute';
import { AppShell } from './components/AppShell';
import { ProfileGate } from './components/ProfileGate';
import { RequireAuth } from './components/RequireAuth';
import { AuthSessionBridge } from './context/AuthSessionBridge';
import { LocalAuthSessionProvider } from './context/AuthSessionContext';
import { RequesterProfileProvider } from './context/RequesterProfileContext';
import { isOidcConfigured, loadOidcAuthProviderProps } from './lib/oidc-config';
import { CallbackPage } from './pages/CallbackPage';
import { HitlReviewPage } from './pages/HitlReviewPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RequestHistoryPage } from './pages/RequestHistoryPage';
import { RequestSubmitPage } from './pages/RequestSubmitPage';

function AppRoutes(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/callback" element={<CallbackPage />} />
        <Route element={<RequireAuth />}>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export function App(): JSX.Element {
  const routes = (
    <RequesterProfileProvider>
      <AppRoutes />
    </RequesterProfileProvider>
  );

  if (!isOidcConfigured()) {
    return <LocalAuthSessionProvider>{routes}</LocalAuthSessionProvider>;
  }

  return (
    <AuthProvider {...loadOidcAuthProviderProps()}>
      <AuthSessionBridge>{routes}</AuthSessionBridge>
    </AuthProvider>
  );
}
