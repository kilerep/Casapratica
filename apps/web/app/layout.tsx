import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = { title: "CasaPrática OS", description: "Operação confiável de conteúdo para casa." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
