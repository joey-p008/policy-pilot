/** @jest-environment jsdom */

import {
  isRequesterProfileComplete,
  parseRequesterProfile,
  REQUESTER_PROFILE_STORAGE_KEY,
  readStoredRequesterProfile,
  writeStoredRequesterProfile,
} from './requester-profile';

describe('requester-profile', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('treats trimmed non-empty title, department, and costCenter as complete', () => {
    expect(
      isRequesterProfileComplete({
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
      }),
    ).toBe(true);
    expect(
      isRequesterProfileComplete({
        title: '  ',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
      }),
    ).toBe(false);
  });

  it('parses stored JSON and rejects incomplete objects', () => {
    expect(
      parseRequesterProfile({
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
      }),
    ).toEqual({
      title: 'Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
    });
    expect(parseRequesterProfile({ title: 'Data Analyst' })).toBeNull();
  });

  it('persists and reads a complete profile from localStorage', () => {
    writeStoredRequesterProfile({
      title: ' Data Analyst ',
      department: ' Finance Analytics ',
      costCenter: ' CC-FIN-07 ',
    });

    expect(window.localStorage.getItem(REQUESTER_PROFILE_STORAGE_KEY)).toContain('Data Analyst');
    expect(readStoredRequesterProfile()).toEqual({
      title: 'Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
    });
  });
});
