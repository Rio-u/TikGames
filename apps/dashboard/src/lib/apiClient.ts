import { ACCESS_TOKEN_KEY, refreshAccessToken } from "./auth";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function authHeaders(token: string | null, isFormData: boolean): HeadersInit {
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * The dashboard tab can sit backgrounded for hours — browsers throttle `setInterval`, so the
 * background silent-refresh loop in auth.tsx isn't guaranteed to have run recently by the time
 * the user comes back and clicks something. Retry once through a fresh token on 401 instead of
 * letting a stale-access-token request just fail.
 */
export async function authedFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const isFormData = opts.body instanceof FormData;
  const doFetch = (token: string | null) =>
    fetch(`${API_URL}${path}`, { ...opts, headers: authHeaders(token, isFormData) });

  let res = await doFetch(localStorage.getItem(ACCESS_TOKEN_KEY));
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch(newToken);
  }
  return res;
}

export async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data;
}
