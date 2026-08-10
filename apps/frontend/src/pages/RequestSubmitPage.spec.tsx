/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';

import { DemoRoleProvider } from '../context/DemoRoleContext';
import { useSubmitAccessRequest } from '../hooks/useAccessRequests';
import { setDemoIdentity } from '../lib/demo-identity';
import { RequestSubmitPage } from './RequestSubmitPage';

jest.mock('../hooks/useAccessRequests', () => ({
  useSubmitAccessRequest: jest.fn(),
}));

const mockedUseSubmitAccessRequest = useSubmitAccessRequest as jest.MockedFunction<
  typeof useSubmitAccessRequest
>;

function renderWithProviders(ui: JSX.Element): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return (
      <QueryClientProvider client={queryClient}>
        <DemoRoleProvider>{children}</DemoRoleProvider>
      </QueryClientProvider>
    );
  }

  render(ui, { wrapper: Wrapper });
}

describe('RequestSubmitPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDemoIdentity('user');
    mockedUseSubmitAccessRequest.mockReturnValue({
      mutate: jest.fn(),
      reset: jest.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as ReturnType<typeof useSubmitAccessRequest>);
  });

  it('submits entitlement and justification through the create mutation', () => {
    const submitMutate = jest.fn();
    mockedUseSubmitAccessRequest.mockReturnValue({
      mutate: submitMutate,
      reset: jest.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as ReturnType<typeof useSubmitAccessRequest>);

    renderWithProviders(<RequestSubmitPage />);

    fireEvent.change(screen.getByPlaceholderText('e.g. prod-postgres-admin'), {
      target: { value: 'analytics-warehouse-writer' },
    });
    fireEvent.change(screen.getByPlaceholderText('Explain why this access is needed…'), {
      target: { value: 'Quarterly reporting pipeline' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for recommendation' }));

    expect(submitMutate).toHaveBeenCalledWith(
      {
        targetEntitlement: 'analytics-warehouse-writer',
        justification: 'Quarterly reporting pipeline',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
