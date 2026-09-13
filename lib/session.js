import crypto from "crypto";

export const COOKIE_NAME = "mtl_discord_session";
export const MAX_AGE_SECONDS = 60 * 60; // 1h — só precisa durar o suficiente pra girar

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado no .env do site.");
  return secret;
}

function sign(payloadBase64) {
  return crypto.createHmac("sha256", getSecret()).update(payloadBase64).digest("base64url");
}

/** Cria o valor do cookie a partir do discordId autenticado. */
export function createSessionCookieValue(discordId) {
  const payload = { discordId, exp: Date.now() + MAX_AGE_SECONDS * 1000 };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

/** Valida o cookie e devolve { discordId } ou null se inválido/expirado/adulterado. */
export function verifySessionCookieValue(value) {
  if (!value || typeof value !== "string" || !value.includes(".")) return null;
  const [payloadBase64, signature] = value.split(".");
  if (!payloadBase64 || !signature) return null;

  const expected = sign(payloadBase64);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
    if (!payload.discordId || !payload.exp || Date.now() > payload.exp) return null;
    return { discordId: payload.discordId };
  } catch {
    return null;
  }
}
