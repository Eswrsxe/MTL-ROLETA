import { PrismaClient } from "@prisma/client";

// Padrão singleton pra não abrir uma conexão nova a cada hot-reload em dev /
// a cada invocação de função serverless na Vercel.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
