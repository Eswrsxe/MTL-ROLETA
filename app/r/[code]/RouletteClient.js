"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PrizeEmoji from "./PrizeEmoji";
import { parseEmoji } from "@/lib/emoji";
import { playWin, scheduleConstantTicks, scheduleDeceleratingTicks } from "@/lib/sound";

// Paleta neon do MTL CRAFT, alternada entre as fatias — mantém a identidade
// visual em vez de um arco-íris genérico de roleta.
const SLICE_COLORS = ["#1d4ed8", "#0f172a", "#7c3aed", "#111827"];

const SPIN_UP_MS = 900; // fase 1: giro indeterminado, esperando o servidor responder
const SPIN_DOWN_MS = 3400; // fase 2: desaceleração até parar no prêmio real
const EXTRA_FULL_SPINS = 4;

function buildSlices(prizes) {
  const total = prizes.reduce((sum, p) => sum + p.weight, 0) || 1;
  let acc = 0;
  return prizes.map((p, i) => {
    const angle = (p.weight / total) * 360;
    const start = acc;
    const mid = start + angle / 2;
    acc += angle;
    return { ...p, start, angle, mid, color: SLICE_COLORS[i % SLICE_COLORS.length] };
  });
}

export default function RouletteClient({ code, initialSpinsAvailable, prizes }) {
  const slices = useMemo(() => buildSlices(prizes), [prizes]);
  const conicGradient = useMemo(() => {
    const stops = slices.map((s) => `${s.color} ${s.start}deg ${s.start + s.angle}deg`);
    return `conic-gradient(${stops.join(", ")})`;
  }, [slices]);

  const [spinsAvailable, setSpinsAvailable] = useState(initialSpinsAvailable);
  const [spinning, setSpinning] = useState(false);
  const [statusLabel, setStatusLabel] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);

  const rotationRef = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [transitionDuration, setTransitionDuration] = useState(0);
  const rafRef = useRef(null);
  const wheelOuterRef = useRef(null);
  const [labelRadius, setLabelRadius] = useState(120);

  useEffect(() => {
    const el = wheelOuterRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width) setLabelRadius(width * 0.36);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" && window.localStorage.getItem("mtl_roleta_muted");
    if (saved === "1") setMuted(true);
  }, []);

  function toggleMuted() {
    setMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem("mtl_roleta_muted", next ? "1" : "0");
      return next;
    });
  }

  const stopIndeterminateSpin = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => stopIndeterminateSpin, [stopIndeterminateSpin]);

  async function handleSpin() {
    if (spinning || spinsAvailable <= 0) return;
    setSpinning(true);
    setError(null);
    setResult(null);
    setStatusLabel("GIRANDO...");

    // Fase 1 — giro rápido e indeterminado enquanto esperamos o servidor
    // decidir o prêmio de verdade. Isso disfarça a latência da rede e já
    // deixa a física "acelerando" desde o primeiro frame.
    setTransitionDuration(0);
    let lastTs = null;
    const speedDegPerMs = 0.9;
    const tick = (ts) => {
      if (lastTs != null) {
        rotationRef.current += speedDegPerMs * (ts - lastTs);
        setRotation(rotationRef.current);
      }
      lastTs = ts;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    const stopFastTicks = scheduleConstantTicks(90, muted);

    const spinPromise = fetch("/api/roleta/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data })));

    const [{ ok, data }] = await Promise.all([
      spinPromise,
      new Promise((resolve) => setTimeout(resolve, SPIN_UP_MS)),
    ]);

    stopFastTicks();
    stopIndeterminateSpin();

    if (!ok) {
      setSpinning(false);
      setStatusLabel(null);
      setError(data.error || "Não foi possível girar agora.");
      return;
    }

    // Fase 2 — agora que sabemos o prêmio real (data.prizeId), calculamos o
    // ângulo exato que alinha aquela fatia com o ponteiro fixo no topo, e
    // deixamos a transição CSS (com easing de desaceleração) fazer o resto.
    const targetSlice = slices.find((s) => s.id === data.prizeId) || slices[0];
    const current = rotationRef.current;
    const remainder = current % 360;
    const angleToAlignAtTop = (360 - targetSlice.mid) % 360;
    let delta = angleToAlignAtTop - remainder;
    while (delta < 0) delta += 360;
    const finalRotation = current + delta + EXTRA_FULL_SPINS * 360;

    scheduleDeceleratingTicks(SPIN_DOWN_MS, muted);

    setTransitionDuration(SPIN_DOWN_MS);
    rotationRef.current = finalRotation;
    setRotation(finalRotation);

    setTimeout(() => {
      setSpinning(false);
      setStatusLabel(null);
      setResult(data);
      setSpinsAvailable(data.spinsRemaining);
      playWin(muted);
    }, SPIN_DOWN_MS + 60);
  }

  return (
    <div className="mtl-roulette">
      <button className="mtl-mute-btn" onClick={toggleMuted} aria-label={muted ? "Ativar som" : "Desativar som"}>
        {muted ? "🔇" : "🔊"}
      </button>

      <h1 className="mtl-title">🎰 MTL CRAFT</h1>

      <div className="mtl-wheel-area">
        <div className="mtl-wheel-pointer" />
        <div className="mtl-wheel-outer" ref={wheelOuterRef}>
          <div
            className="mtl-wheel"
            style={{
              background: conicGradient,
              transform: `rotate(${rotation}deg)`,
              transition: transitionDuration ? `transform ${transitionDuration}ms cubic-bezier(0.12, 0.75, 0.18, 1)` : "none",
            }}
          >
            {slices.map((s) => {
              const parsed = parseEmoji(s.emoji);
              return (
                <div key={s.id} className="mtl-wheel-slice-label" style={{ transform: `rotate(${s.mid}deg) translateY(-${labelRadius}px)` }}>
                  {parsed.kind === "custom" ? (
                    <img src={parsed.url} alt={parsed.alt} width={20} height={20} className="mtl-emoji-img" draggable={false} />
                  ) : (
                    <span style={{ fontSize: 18 }}>{parsed.char || "🎁"}</span>
                  )}
                  <span className="mtl-slice-name">{s.name}</span>
                </div>
              );
            })}
          </div>
          <div className="mtl-wheel-hub">🎰</div>
        </div>
      </div>

      {statusLabel && <p className="mtl-status">{statusLabel}</p>}
      {!spinning && error && <p className="mtl-error">❌ {error}</p>}

      <p className="mtl-spins">🎟️ {spinsAvailable} giro(s) restante(s)</p>

      <button className="mtl-btn" onClick={handleSpin} disabled={spinning || spinsAvailable <= 0}>
        {spinning ? "GIRANDO..." : spinsAvailable <= 0 ? "Sem giros disponíveis" : "GIRAR ROLETA"}
      </button>

      <div className="mtl-prize-list">
        {slices.map((s) => (
          <span key={s.id} className="mtl-prize-chip">
            <PrizeEmoji emoji={s.emoji} size={16} />
            {s.name}
          </span>
        ))}
      </div>

      {result && (
        <div className="mtl-modal-overlay" onClick={() => setResult(null)}>
          <div className="mtl-modal-card" onClick={(e) => e.stopPropagation()}>
            <p className="mtl-modal-congrats">🎉 PARABÉNS!</p>
            <PrizeEmoji emoji={result.emoji} size={64} />
            <p className="mtl-modal-prize-name">Você ganhou: {result.prizeName}</p>
            <p className="mtl-modal-sub">Recompensa registrada com sucesso! Acompanhe o resultado no Discord.</p>
            <button className="mtl-btn" style={{ marginTop: "1.25rem" }} onClick={() => setResult(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}