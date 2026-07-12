const DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USERINFO_URL = "https://discord.com/api/users/@me";

function redirectUri(): string {
  return process.env.DISCORD_OAUTH_REDIRECT_URI ?? "http://localhost:4000/auth/discord/callback";
}

export function getDiscordAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_OAUTH_CLIENT_ID ?? "",
    response_type: "code",
    scope: "identify email",
    redirect_uri: redirectUri(),
    state,
  });
  return `${DISCORD_AUTH_URL}?${params.toString()}`;
}

interface DiscordTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeDiscordCode(code: string): Promise<DiscordTokenResponse> {
  const res = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.DISCORD_OAUTH_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? "فشل الاتصال بـ Discord");
  }
  return data as DiscordTokenResponse;
}

interface DiscordProfile {
  id: string;
  username: string;
  email: string | null;
  avatar: string | null;
}

export async function fetchDiscordProfile(accessToken: string): Promise<DiscordProfile> {
  const res = await fetch(DISCORD_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("فشل جلب بيانات حساب Discord");
  }
  const data = await res.json();
  return {
    id: data.id,
    username: data.username,
    email: data.email ?? null,
    avatar: data.avatar
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
      : null,
  };
}
