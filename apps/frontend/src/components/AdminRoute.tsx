import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';

import { useDemoRole } from '../context/DemoRoleContext';

export function AdminRoute({ children }: { children: JSX.Element }): JSX.Element {
  const { isAdmin } = useDemoRole();
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}
