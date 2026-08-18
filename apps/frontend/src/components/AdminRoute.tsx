import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthSession } from '../context/AuthSessionContext';

export function AdminRoute({ children }: { children: JSX.Element }): JSX.Element {
  const { isAdmin } = useAuthSession();
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
