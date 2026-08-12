/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';

import { RequesterProfileProvider } from '../context/RequesterProfileContext';
import { ProfilePage } from './ProfilePage';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Navigate: () => null,
}));

function renderProfilePage(): void {
  function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return <RequesterProfileProvider>{children}</RequesterProfileProvider>;
  }

  render(<ProfilePage />, { wrapper: Wrapper });
}

describe('ProfilePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders title, department, and cost center listboxes and keeps Continue disabled until all are chosen', () => {
    renderProfilePage();

    const titleSelect = screen.getByLabelText('Title');
    const departmentSelect = screen.getByLabelText('Department');
    const costCenterSelect = screen.getByLabelText('Cost center');
    const continueButton = screen.getByRole('button', { name: 'Continue' });

    expect(titleSelect).toBeInTheDocument();
    expect(departmentSelect).toBeInTheDocument();
    expect(costCenterSelect).toBeInTheDocument();
    expect(continueButton).toBeDisabled();

    fireEvent.change(titleSelect, { target: { value: 'Senior Data Analyst' } });
    fireEvent.change(departmentSelect, { target: { value: 'Finance Analytics' } });
    expect(continueButton).toBeDisabled();

    fireEvent.change(costCenterSelect, { target: { value: 'CC-FIN-07' } });
    expect(continueButton).toBeEnabled();
  });
});
