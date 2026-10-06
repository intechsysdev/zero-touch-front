/**
 * Módulo de Integración SSO (Single Sign-On) con Intechsys One.
 * Implementa el protocolo OAuth 2.0 PKCE con One Portal.
 */

export const ONE_FRONTEND_URL =
  import.meta.env.VITE_ONE_FRONTEND_URL ||
  'https://jolly-tree-0c459ee10.6.azurestaticapps.net';

export const ONE_API_URL =
  import.meta.env.VITE_ONE_API_URL ||
  'https://intechsys-one-api-b5b5a6cbf9emevev.centralus-01.azurewebsites.net';

export const ONE_APP_SLUG = 'zero-touch';
const SSO_STORAGE_KEY = 'zerotouch.sso.pkce';

function randomBase64(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const bytes = new Uint8Array(digest);
  let str = '';
  for (let i = 0; i < bytes.length; i += 1) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getRedirectUri(): string {
  return `${window.location.origin}/sso/callback`;
}

/**
 * Inicia el flujo de autenticación PKCE redirigiendo a la pantalla de autorización de One.
 */
export async function iniciarSSO(tenantId?: string | null, selectAccount = false): Promise<void> {
  const pkce = {
    verificador: randomBase64(32),
    estado: randomBase64(16),
    tenantId: tenantId || null,
  };

  sessionStorage.setItem(SSO_STORAGE_KEY, JSON.stringify(pkce));

  const codeChallenge = await sha256Base64(pkce.verificador);
  const authUrl = new URL(`${ONE_FRONTEND_URL.replace(/\/+$/, '')}/autorizar`);

  authUrl.searchParams.set('client_id', ONE_APP_SLUG);
  authUrl.searchParams.set('redirect_uri', getRedirectUri());
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', pkce.estado);

  if (tenantId) {
    authUrl.searchParams.set('tenant', tenantId);
  }

  if (selectAccount) {
    authUrl.searchParams.set('prompt', 'select_account');
  }

  window.location.replace(authUrl.toString());
}

export type SsoTokenResult = {
  accessToken: string;
  refreshToken?: string;
  tenantId?: string | null;
  user?: {
    id: string;
    email: string;
    fullName?: string;
  };
};

/**
 * Procesa el callback de One (/sso/callback) canjeando el código de autorización por el token JWT.
 */
export async function procesarCallbackSSO(): Promise<SsoTokenResult> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const tenant = params.get('tenant');

  let savedPkce: { verificador: string; estado: string; tenantId?: string | null } | null = null;
  try {
    const raw = sessionStorage.getItem(SSO_STORAGE_KEY);
    if (raw) {
      savedPkce = JSON.parse(raw);
    }
  } catch {
    savedPkce = null;
  }

  sessionStorage.removeItem(SSO_STORAGE_KEY);

  if (!code || !savedPkce || state !== savedPkce.estado) {
    throw new Error('El inicio de sesión con One no se pudo completar o el estado de seguridad no coincide.');
  }

  const response = await fetch(`${ONE_API_URL.replace(/\/+$/, '')}/api/v1/sso/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId: ONE_APP_SLUG,
      code,
      codeVerifier: savedPkce.verificador,
      redirectUri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error canjeando código con One (${response.status}): ${errText}`);
  }

  const tokenData = await response.json();

  return {
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    tenantId: tokenData.tenantId || tenant || savedPkce.tenantId || null,
    user: tokenData.user,
  };
}
