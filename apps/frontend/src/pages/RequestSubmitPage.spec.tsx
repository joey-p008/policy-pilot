/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';

import { DemoRoleProvider } from '../context/DemoRoleContext';
import { RequesterProfileProvider } from '../context/RequesterProfileContext';
import { useSubmitAccessRequest } from '../hooks/useAccessRequests';
import { setDemoIdentity } from '../lib/demo-identity';
import { writeStoredRequesterProfile } from '../lib/requester-profile';
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
        <RequesterProfileProvider>
          <DemoRoleProvider>{children}</DemoRoleProvider>
        </RequesterProfileProvider>
      </QueryClientProvider>
    );
  }

  render(ui, { wrapper: Wrapper });
}

describe('RequestSubmitPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    writeStoredRequesterProfile({
      title: 'Senior Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
    });
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

  it('submits profile and ticket fields through the create mutation', () => {
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

    fireEvent.change(screen.getByLabelText('System name'), {
      target: { value: 'DATA_WAREHOUSE' },
    });
    fireEvent.change(screen.getByLabelText('Entitlement key'), {
      target: { value: 'FIN_DATASET_EDIT' },
    });
    fireEvent.change(screen.getByPlaceholderText('Explain why this access is needed…'), {
      target: { value: 'Quarterly reporting pipeline' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for recommendation' }));

    expect(submitMutate).toHaveBeenCalledWith({
      title: 'Senior Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
      systemName: 'DATA_WAREHOUSE',
      entitlementKey: 'FIN_DATASET_EDIT',
      justification: 'Quarterly reporting pipeline',
    });
  });
});
