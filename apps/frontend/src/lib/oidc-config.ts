import type { AuthProviderProps } from 'react-oidc-context';

export const DEFAULT_OIDC_ROLE_CLAIM = 'https://policy-pilot.local/roles';

function requiredEnv(
  name:
    | 'VITE_OIDC_AUTHORITY'
    | 'VITE_OIDC_CLIENT_ID'
    | 'VITE_OIDC_AUDIENCE'
    | 'VITE_OIDC_REDIRECT_URI'
    | 'VITE_OIDC_POST_LOGOUT_REDIRECT_URI',
): string {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required OIDC environment variable: ${name}`);
  }
  return value;
}

export function readOidcRoleClaim(): string {
  const configured = import.meta.env.VITE_OIDC_ROLE_CLAIM;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured;
  }
  return DEFAULT_OIDC_ROLE_CLAIM;
}

export function loadOidcAuthProviderProps(): AuthProviderProps {
  const audience = requiredEnv('VITE_OIDC_AUDIENCE');

  return {
    authority: requiredEnv('VITE_OIDC_AUTHORITY'),
    client_id: requiredEnv('VITE_OIDC_CLIENT_ID'),
    redirect_uri: requiredEnv('VITE_OIDC_REDIRECT_URI'),
    post_logout_redirect_uri: requiredEnv('VITE_OIDC_POST_LOGOUT_REDIRECT_URI'),
    response_type: 'code',
    scope: 'openid profile email',
    automaticSilentRenew: true,
    loadUserInfo: false,
    extraQueryParams: {
      audience,
    },
    onSigninCallback: (): void => {
      window.history.replaceState({}, document.title, window.location.pathname);
    },
  };
}
