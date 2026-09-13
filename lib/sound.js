"use client";

// Todos os sons são sintetizados na hora (osciladores simples), então não
// precisamos hospedar/baixar nenhum arquivo .mp3. O AudioContext só é criado
// na primeira interação do usuário (clique em girar), respeitando a
// política de autoplay dos navegadores mobile.
let audioContext = null;

function getContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

/** Um "tick" curto e seco, como a lingueta de uma roleta passando por uma divisão. */
export function playTick(muted) {
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 900;
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

/** Pequeno arpejo ascendente de vitória ao parar a roleta. */
export function playWin(muted) {
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const start = ctx.currentTime + i * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

/**
 * Agenda uma sequência de ticks que vai desacelerando junto com a roleta
 * (intervalo cada vez maior), simulando a lingueta física de uma roleta de
 * cassino. Retorna uma função pra cancelar caso precise interromper cedo.
 */
export function scheduleDeceleratingTicks(durationMs, muted, tickCount = 28) {
  const timeouts = [];
  // Curva quadrática: os primeiros ticks são rápidos, os últimos bem espaçados.
  for (let i = 0; i < tickCount; i += 1) {
    const progress = i / (tickCount - 1);
    const eased = progress * progress; // acelera o espaçamento no final
    const delay = eased * durationMs;
    timeouts.push(setTimeout(() => playTick(muted), delay));
  }
  return () => timeouts.forEach(clearTimeout);
}

/** Ticks rápidos e constantes, usados na fase inicial (giro indeterminado). */
export function scheduleConstantTicks(intervalMs, muted) {
  const id = setInterval(() => playTick(muted), intervalMs);
  return () => clearInterval(id);
}
