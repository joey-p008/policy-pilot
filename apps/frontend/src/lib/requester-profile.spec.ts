/** @jest-environment jsdom */

import {
  isRequesterProfileComplete,
  parseRequesterProfile,
  REQUESTER_COST_CENTERS,
  REQUESTER_DEPARTMENTS,
  REQUESTER_PROFILE_STORAGE_KEY,
  REQUESTER_TITLES,
  readStoredRequesterProfile,
  selectRequesterProfileValue,
  writeStoredRequesterProfile,
} from './requester-profile';

const VALID_PROFILE = {
  title: 'Senior Data Analyst',
  department: 'Finance Analytics',
  costCenter: 'CC-FIN-07',
};

describe('requester-profile', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('treats allowlisted title, department, and costCenter as complete', () => {
    expect(isRequesterProfileComplete(VALID_PROFILE)).toBe(true);
    expect(
      isRequesterProfileComplete({
        title: '  ',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
      }),
    ).toBe(false);
  });

  it('rejects unknown titles even when department and cost center are valid', () => {
    expect(
      isRequesterProfileComplete({
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
      }),
    ).toBe(false);
    expect(
      parseRequesterProfile({
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
      }),
    ).toBeNull();
  });

  it('parses stored JSON and rejects incomplete objects', () => {
    expect(parseRequesterProfile(VALID_PROFILE)).toEqual(VALID_PROFILE);
    expect(parseRequesterProfile({ title: 'Senior Data Analyst' })).toBeNull();
  });

  it('persists and reads a complete profile from localStorage', () => {
    writeStoredRequesterProfile({
      title: ' Senior Data Analyst ',
      department: ' Finance Analytics ',
      costCenter: ' CC-FIN-07 ',
    });

    expect(window.localStorage.getItem(REQUESTER_PROFILE_STORAGE_KEY)).toContain(
      'Senior Data Analyst',
    );
    expect(readStoredRequesterProfile()).toEqual(VALID_PROFILE);
  });

  it('preselects stored catalog values and ignores unknown ones', () => {
    expect(selectRequesterProfileValue('Senior Data Analyst', ['Senior Data Analyst'])).toBe(
      'Senior Data Analyst',
    );
    expect(selectRequesterProfileValue('Data Analyst', ['Senior Data Analyst'])).toBe('');
    expect(selectRequesterProfileValue(undefined, ['Senior Data Analyst'])).toBe('');
  });

  it('keeps requester catalogs in alphabetical order', () => {
    const byLocale = (left: string, right: string): number => left.localeCompare(right);
    expect([...REQUESTER_TITLES]).toEqual([...REQUESTER_TITLES].sort(byLocale));
    expect([...REQUESTER_DEPARTMENTS]).toEqual([...REQUESTER_DEPARTMENTS].sort(byLocale));
    expect([...REQUESTER_COST_CENTERS]).toEqual([...REQUESTER_COST_CENTERS].sort(byLocale));
  });
});
