import "./globals.css";

export const metadata = {
  title: "Roleta MTL CRAFT",
  description: "Roleta de prêmios do servidor MTL CRAFT",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
