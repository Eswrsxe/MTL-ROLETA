const MENSAGENS = {
  oauth_negado: "Você cancelou o login com o Discord.",
  parametros_invalidos: "Faltam parâmetros no retorno do Discord. Tente de novo.",
  state_invalido: "Não foi possível validar o retorno do Discord. Tente de novo.",
  nonce_invalido: "O link de login expirou ou é inválido. Volte ao Discord e use /roletar de novo.",
  token_invalido: "Não foi possível confirmar seu login com o Discord. Tente de novo.",
  usuario_invalido: "Não foi possível confirmar sua conta do Discord. Tente de novo.",
};

export default function ErroPage({ searchParams }) {
  const motivo = searchParams?.motivo;
  const mensagem = MENSAGENS[motivo] || "Ocorreu um erro ao processar o login.";

  return (
    <main className="mtl-shell">
      <h1>❌ Não foi possível continuar</h1>
      <p>{mensagem}</p>
      <p style={{ opacity: 0.7 }}>Volte ao Discord e use <code>/roletar</code> pra gerar um novo link.</p>
    </main>
  );
}
