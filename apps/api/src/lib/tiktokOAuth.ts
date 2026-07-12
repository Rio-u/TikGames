const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/";

function redirectUri(): string {
  return process.env.TIKTOK_OAUTH_REDIRECT_URI ?? "http://localhost:4000/auth/tiktok/callback";
}

export function getTikTokAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_OAUTH_CLIENT_KEY ?? "",
    response_type: "code",
    scope: "user.info.basic",
    redirect_uri: redirectUri(),
    state,
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  open_id: string;
}

export async function exchangeTikTokCode(code: string): Promise<TikTokTokenResponse> {
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_OAUTH_CLIENT_KEY ?? "",
      client_secret: process.env.TIKTOK_OAUTH_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? "فشل الاتصال بـ TikTok");
  }
  return data as TikTokTokenResponse;
}

interface TikTokProfile {
  open_id: string;
  display_name: string;
  avatar_url: string;
}

export async function fetchTikTokProfile(accessToken: string): Promise<TikTokProfile> {
  const params = new URLSearchParams({ fields: "open_id,display_name,avatar_url" });
  const res = await fetch(`${TIKTOK_USERINFO_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!res.ok || data.error?.code !== "ok") {
    throw new Error("فشل جلب بيانات حساب TikTok");
  }
  return data.data.user as TikTokProfile;
}
