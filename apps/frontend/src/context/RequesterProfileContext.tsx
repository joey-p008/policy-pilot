import { createContext, useContext, useMemo, useState, type JSX, type ReactNode } from 'react';

import {
  isRequesterProfileComplete,
  readStoredRequesterProfile,
  writeStoredRequesterProfile,
  type RequesterProfile,
} from '../lib/requester-profile';

interface RequesterProfileContextValue {
  profile: RequesterProfile | null;
  isComplete: boolean;
  setProfile: (profile: RequesterProfile) => void;
}

const RequesterProfileContext = createContext<RequesterProfileContextValue | null>(null);

export function RequesterProfileProvider({ children }: { children: ReactNode }): JSX.Element {
  const [profile, setProfileState] = useState<RequesterProfile | null>(() =>
    readStoredRequesterProfile(),
  );

  const setProfile = (next: RequesterProfile): void => {
    setProfileState(writeStoredRequesterProfile(next));
  };

  const value = useMemo(
    (): RequesterProfileContextValue => ({
      profile,
      isComplete: isRequesterProfileComplete(profile),
      setProfile,
    }),
    [profile],
  );

  return (
    <RequesterProfileContext.Provider value={value}>{children}</RequesterProfileContext.Provider>
  );
}

export function useRequesterProfile(): RequesterProfileContextValue {
  const value = useContext(RequesterProfileContext);
  if (value === null) {
    throw new Error('useRequesterProfile must be used within RequesterProfileProvider');
  }
  return value;
}
