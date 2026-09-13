import crypto from "crypto";
import { NextResponse } from "next/server";

const NONCE_COOKIE = "mtl_oauth_nonce";

function getOrigin(request) {
  return process.env.SITE_ORIGIN || new URL(request.url).origin;
}

// GET /api/auth/login?code=MTL-XXXX-XXXX
// Redireciona pro Discord OAuth2, amarrando o "state" ao código da sessão de
// roleta que o usuário está tentando abrir — assim o callback sabe pra onde
// voltar, e o cookie de nonce garante que ninguém forje esse redirecionamento
// (proteção CSRF do fluxo OAuth).
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Parâmetro 'code' (código da sessão de roleta) é obrigatório." }, { status: 400 });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "DISCORD_CLIENT_ID não configurado no site." }, { status: 500 });
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ code, nonce })).toString("base64url");
  const redirectUri = `${getOrigin(request)}/api/auth/callback`;

  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "none");

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 5 * 60,
    path: "/",
  });
  return response;
}
