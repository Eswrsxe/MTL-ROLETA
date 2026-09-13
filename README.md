# Roleta MTL CRAFT — Site

Mini-site (Next.js) que abre quando alguém usa `/roletar` no Discord. Ele:

1. Confirma a identidade da pessoa via **Discord OAuth2** (login "Continuar com Discord").
2. Confirma que o código da URL (`/r/CODIGO`) pertence mesmo à conta logada.
3. Manda o giro pro servidor (`/api/roleta/spin`), que é quem **decide o
   prêmio de verdade** — a animação na tela é só visual.

Não envolve dinheiro real em nenhum ponto: os giros vêm de moedas do próprio
servidor (ganhas em missões/eventos/sorteios) ou de concessão direta da
staff pelo bot.

## Como funciona a segurança do giro

- O código da sala (`MTL-XXXX-XXXX`) sozinho não é suficiente — o site exige
  login Discord e compara o ID autenticado com o dono da sessão.
- O sorteio roda inteiramente no servidor, dentro de uma transação Postgres.
  O consumo do giro usa um `UPDATE ... WHERE spinsAvailable > 0`, que o
  Postgres reavalia depois de travar a linha — então duas requisições
  simultâneas nunca conseguem gastar o mesmo giro duas vezes.
- Nada relacionado ao prêmio (peso, sorteio, gravação do resultado) roda no
  navegador; o cliente só recebe o nome do prêmio já decidido.

## Banco de dados

Este site usa o **mesmo Postgres** do bot (`DATABASE_URL` idêntica). As
tabelas são criadas e alteradas **só pelo bot** (`bot/prisma/migrations`) —
o site nunca roda `prisma migrate`, só `prisma generate` (pra gerar o
client) no build.

## Configurar

1. Copie `.env.example` para `.env.local` (dev) ou configure as mesmas
   variáveis nas *Environment Variables* do projeto na Vercel.
2. No [Discord Developer Portal](https://discord.com/developers/applications),
   abra a aplicação do bot (ou crie uma nova) → **OAuth2** → em **Redirects**,
   adicione:
   ```
   https://SEU-DOMINIO-NA-VERCEL/api/auth/callback
   ```
3. Preencha `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (na mesma aba
   OAuth2 da aplicação).
4. Gere um `SESSION_SECRET` forte: `openssl rand -hex 32`.
5. Configure `SITE_ORIGIN` com a URL final do deploy (ex.:
   `https://mtl-roleta.vercel.app`).
6. No `.env` do **bot**, aponte `ROLETA_SITE_URL` pra essa mesma URL.

## Deploy (Vercel)

```bash
cd site
vercel
```

Ou conecte este diretório (`site/`) como um projeto separado no dashboard da
Vercel, apontando pra pasta `site` do repositório.

## Rodando localmente

```bash
cd site
npm install
npm run dev
```

Abra `http://localhost:3000/r/CODIGO` com um código gerado pelo bot (via
`/roletar` num ambiente apontando pro mesmo banco).
