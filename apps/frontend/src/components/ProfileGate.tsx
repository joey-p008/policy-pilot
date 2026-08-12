import type { JSX } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useRequesterProfile } from '../context/RequesterProfileContext';

export function ProfileGate(): JSX.Element {
  const { isComplete } = useRequesterProfile();
  if (!isComplete) {
    return <Navigate to="/profile" replace />;
  }
  return <Outlet />;
}
