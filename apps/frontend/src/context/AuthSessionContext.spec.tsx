/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';

import { LocalAuthSessionProvider, useAuthSession } from './AuthSessionContext';

function Probe(): JSX.Element {
  const { isAuthenticated, isAdmin, signInWithRole, signOut } = useAuthSession();
  return (
    <div>
      <span>{isAuthenticated ? 'signed-in' : 'signed-out'}</span>
      <span>{isAdmin ? 'admin' : 'user'}</span>
      <button type="button" onClick={() => signInWithRole?.('admin')}>
        Continue as admin
      </button>
      <button
        type="button"
        onClick={() => {
          void signOut();
        }}
      >
        Sign out
      </button>
    </div>
  );
}

describe('LocalAuthSessionProvider', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('starts signed out and can continue as admin', () => {
    render(
      <LocalAuthSessionProvider>
        <Probe />
      </LocalAuthSessionProvider>,
    );

    expect(screen.getByText('signed-out')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue as admin' }));
    expect(screen.getByText('signed-in')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('policy-pilot.local-auth-role')).toBe('admin');
  });
});
