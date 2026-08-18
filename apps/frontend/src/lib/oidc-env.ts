export interface OidcEnvSnapshot {
  authority?: string;
  clientId?: string;
  audience?: string;
  redirectUri?: string;
  postLogoutRedirectUri?: string;
}

function isUsableOidcValue(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const lowered = trimmed.toLowerCase();
  return !lowered.includes('your-tenant') && lowered !== 'local-unconfigured';
}

export function isOidcEnvConfigured(env: OidcEnvSnapshot): boolean {
  return (
    isUsableOidcValue(env.authority) &&
    isUsableOidcValue(env.clientId) &&
    isUsableOidcValue(env.audience) &&
    isUsableOidcValue(env.redirectUri) &&
    isUsableOidcValue(env.postLogoutRedirectUri)
  );
}
