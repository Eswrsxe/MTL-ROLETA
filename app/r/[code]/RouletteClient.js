"use client";

import { useState } from "react";

export default function RouletteClient({ code, initialSpinsAvailable }) {
  const [spinsAvailable, setSpinsAvailable] = useState(initialSpinsAvailable);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleSpin() {
    if (spinning || spinsAvailable <= 0) return;
    setSpinning(true);
    setError(null);
    setResult(null);

    // A animação aqui é só visual — o prêmio já foi decidido pelo servidor
    // na hora que a resposta chegar. Nunca alteramos o resultado no cliente.
    const spinPromise = fetch("/api/roleta/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).then((res) => res.json().then((data) => ({ ok: res.ok, data })));

    const minAnimationTime = new Promise((resolve) => setTimeout(resolve, 2200));
    const [{ ok, data }] = await Promise.all([spinPromise, minAnimationTime]);

    setSpinning(false);

    if (!ok) {
      setError(data.error || "Não foi possível girar agora.");
      return;
    }

    setResult(data);
    setSpinsAvailable(data.spinsRemaining);
  }

  return (
    <div className="mtl-roulette">
      <h1>🎰 MTL CRAFT</h1>

      <div className={`mtl-wheel ${spinning ? "mtl-wheel-spinning" : ""}`}>
        {spinning ? "🎰" : result ? result.emoji || "🎁" : "🎁"}
      </div>

      {spinning && <p className="mtl-status">GIRANDO...</p>}

      {!spinning && result && (
        <div className="mtl-result">
          <p>🎉 PARABÉNS!</p>
          <p className="mtl-prize">Você ganhou: {result.prizeName}</p>
        </div>
      )}

      {!spinning && error && <p className="mtl-error">❌ {error}</p>}

      <p className="mtl-spins">🎟️ {spinsAvailable} giro(s) restante(s)</p>

      <button className="mtl-btn" onClick={handleSpin} disabled={spinning || spinsAvailable <= 0}>
        {spinning ? "Girando..." : spinsAvailable <= 0 ? "Sem giros disponíveis" : "GIRAR ROLETA"}
      </button>
    </div>
  );
}
