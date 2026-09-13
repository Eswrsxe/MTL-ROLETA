import { NextResponse } from "next/server";
import { createSessionCookieValue, COOKIE_NAME, MAX_AGE_SECONDS } from "@/lib/session";

const NONCE_COOKIE = "mtl_oauth_nonce";

function getOrigin(request) {
  return process.env.SITE_ORIGIN || new URL(request.url).origin;
}

export async function GET(request) {
  const url = new URL(request.url);
  const discordCode = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(`${getOrigin(request)}/erro?motivo=oauth_negado`);
  }
  if (!discordCode || !state) {
    return NextResponse.redirect(`${getOrigin(request)}/erro?motivo=parametros_invalidos`);
  }

  let parsedState;
  try {
    parsedState = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return NextResponse.redirect(`${getOrigin(request)}/erro?motivo=state_invalido`);
  }

  const cookieNonce = request.cookies.get(NONCE_COOKIE)?.value;
  if (!cookieNonce || cookieNonce !== parsedState.nonce) {
    // Nonce não bate: ou o cookie expirou, ou é uma tentativa de forjar o
    // redirecionamento. Nunca autentica nesse caso.
    return NextResponse.redirect(`${getOrigin(request)}/erro?motivo=nonce_invalido`);
  }

  const redirectUri = `${getOrigin(request)}/api/auth/callback`;

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: discordCode,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    console.error("[auth] Falha ao trocar code por token:", await tokenResponse.text().catch(() => ""));
    return NextResponse.redirect(`${getOrigin(request)}/erro?motivo=token_invalido`);
  }

  const tokenData = await tokenResponse.json();

  const meResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meResponse.ok) {
    console.error("[auth] Falha ao buscar usuário autenticado:", await meResponse.text().catch(() => ""));
    return NextResponse.redirect(`${getOrigin(request)}/erro?motivo=usuario_invalido`);
  }

  const discordUser = await meResponse.json();

  const response = NextResponse.redirect(`${getOrigin(request)}/r/${parsedState.code}`);
  response.cookies.set(COOKIE_NAME, createSessionCookieValue(discordUser.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  response.cookies.delete(NONCE_COOKIE);
  return response;
}