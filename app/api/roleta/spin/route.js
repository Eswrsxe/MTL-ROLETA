import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";
import { verifySessionCookieValue, COOKIE_NAME } from "../../../../lib/session";

// POST /api/roleta/spin  { code: "MTL-XXXX-XXXX" }
//
// Tudo que decide o prêmio acontece AQUI, nunca no navegador:
//   1. confirma quem está autenticado (cookie assinado, vindo do Discord OAuth2)
//   2. confirma que a sessão existe, não expirou, e pertence a essa mesma conta
//   3. consome 1 giro de forma atômica (updateMany com WHERE spinsAvailable > 0
//      — se duas requisições chegarem ao mesmo tempo, só uma consegue)
//   4. só depois de garantir o consumo, sorteia o prêmio com crypto.randomInt
//      e grava o resultado
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const code = body?.code;
  if (!code) {
    return NextResponse.json({ error: "Código da sessão ausente." }, { status: 400 });
  }

  const cookieValue = cookies().get(COOKIE_NAME)?.value;
  const authenticated = verifySessionCookieValue(cookieValue);
  if (!authenticated) {
    return NextResponse.json({ error: "Sessão não autenticada. Faça login novamente." }, { status: 401 });
  }

  const session = await prisma.rouletteSession.findUnique({ where: { code }, include: { user: true } });
  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }
  if (session.status !== "ATIVA" || session.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Esta sessão expirou. Use /roletar novamente no Discord." }, { status: 410 });
  }
  if (session.user.discordId !== authenticated.discordId) {
    return NextResponse.json({ error: "Esta sessão não pertence a esta conta." }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Consumo atômico: o WHERE é reavaliado pelo Postgres no momento do
      // UPDATE (depois de travar a linha), então uma segunda requisição
      // concorrente só vê o saldo já decrementado e falha aqui — nunca
      // conseguindo gastar o mesmo giro duas vezes.
      const consumed = await tx.user.updateMany({
        where: { id: session.userId, spinsAvailable: { gt: 0 } },
        data: { spinsAvailable: { decrement: 1 } },
      });

      if (consumed.count === 0) {
        throw new Error("SEM_GIROS");
      }

      const prizes = await tx.roulettePrize.findMany({ where: { enabled: true } });
      if (prizes.length === 0) throw new Error("SEM_PREMIOS");

      const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
      let roll = crypto.randomInt(totalWeight);
      let chosen = prizes[prizes.length - 1];
      for (const prize of prizes) {
        if (roll < prize.weight) {
          chosen = prize;
          break;
        }
        roll -= prize.weight;
      }

      const spin = await tx.rouletteSpin.create({
        data: {
          sessionId: session.id,
          userId: session.userId,
          prizeId: chosen.id,
          prizeName: chosen.name,
          channelId: session.channelId,
          deliveryMode: chosen.deliveryMode,
          deliveryStatus: chosen.deliveryMode === "AUTOMATICA" ? "NAO_APLICAVEL" : "PENDENTE",
        },
      });

      const remaining = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });

      return { prize: chosen, spinId: spin.id, spinsRemaining: remaining.spinsAvailable };
    });

    return NextResponse.json({
      prizeId: result.prize.id,
      prizeName: result.prize.name,
      emoji: result.prize.emoji,
      spinsRemaining: result.spinsRemaining,
    });
  } catch (error) {
    if (error.message === "SEM_GIROS") {
      return NextResponse.json({ error: "Você não tem mais giros disponíveis." }, { status: 409 });
    }
    if (error.message === "SEM_PREMIOS") {
      return NextResponse.json({ error: "Nenhum prêmio configurado no momento. Avise a staff." }, { status: 500 });
    }
    console.error("[roleta] Erro ao processar giro:", error);
    return NextResponse.json({ error: "Erro interno ao processar o giro." }, { status: 500 });
  }
}
