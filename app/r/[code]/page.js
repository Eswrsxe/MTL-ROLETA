import { cookies } from "next/headers";
import { prisma } from "../../../lib/prisma";
import { verifySessionCookieValue, COOKIE_NAME } from "../../../lib/session";
import RouletteClient from "./RouletteClient";

export default async function Page({ params }) {
  const { code } = params;

  const session = await prisma.rouletteSession.findUnique({
    where: { code },
    include: { user: true },
  });

  if (!session) {
    return (
      <StatusScreen
        title="Sessão não encontrada"
        message="Esse código de roleta não existe. Use /roletar no Discord pra gerar um novo."
      />
    );
  }

  const expired = session.expiresAt.getTime() < Date.now() || session.status === "EXPIRADA";
  if (expired) {
    return (
      <StatusScreen
        title="⏰ Sessão expirada"
        message="Esse código expirou. Use /roletar no Discord de novo pra gerar um link novo."
      />
    );
  }

  const cookieValue = cookies().get(COOKIE_NAME)?.value;
  const authenticated = verifySessionCookieValue(cookieValue);
  const loginUrl = `/api/auth/login?code=${encodeURIComponent(code)}`;

  if (!authenticated) {
    return (
      <Shell>
        <h1>🎰 ROLETA MTL CRAFT</h1>
        <p>Sessão encontrada.</p>
        <p style={{ opacity: 0.8 }}>Confirme que essa conta do Discord é sua pra continuar.</p>
        <a className="mtl-btn" href={loginUrl}>🔵 Continuar com Discord</a>
      </Shell>
    );
  }

  if (authenticated.discordId !== session.user.discordId) {
    return (
      <StatusScreen
        title="❌ Esta sessão não pertence a esta conta"
        message="Você está logado com uma conta diferente da que gerou este código. Peça pro dono do código usar /roletar e abrir o link dele mesmo."
      />
    );
  }

  const freshUser = await prisma.user.findUnique({ where: { id: session.userId } });

  return (
    <Shell>
      <RouletteClient code={code} initialSpinsAvailable={freshUser.spinsAvailable} />
    </Shell>
  );
}

function Shell({ children }) {
  return <main className="mtl-shell">{children}</main>;
}

function StatusScreen({ title, message }) {
  return (
    <Shell>
      <h1>{title}</h1>
      <p>{message}</p>
    </Shell>
  );
}
