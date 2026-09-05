import type { Metadata } from "next";
import { ContactSection, PublicFooter, PublicHeader } from "../public-components";

export const metadata: Metadata = {
  title: "Política de Privacidade | CasaPrática",
  description: "Saiba como a CasaPrática trata dados, integrações e credenciais.",
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "pt_BR", siteName: "CasaPrática", title: "Política de Privacidade | CasaPrática", description: "Informações sobre o tratamento de dados e integrações da CasaPrática." },
};

export default function PrivacyPage() {
  return <div className="public-shell"><PublicHeader /><main className="public-main public-legal">
    <header className="public-legal-heading"><span className="public-kicker">Transparência e cuidado</span><h1>Política de Privacidade</h1><p>Última atualização: 4 de setembro de 2026.</p></header>
    <div className="public-legal-content">
      <section><h2>1. Quem somos</h2><p>A CasaPrática é uma plataforma de curadoria e divulgação de produtos relacionados a casa, organização, utilidades e decoração. Pesquisamos, comparamos e selecionamos itens, mas não realizamos a venda direta dos produtos apresentados.</p></section>
      <section><h2>2. Integração com o Pinterest</h2><p>Quando uma pessoa autorizada conecta uma conta do Pinterest à CasaPrática, usamos o fluxo oficial de autenticação do Pinterest. Podemos acessar os dados da conta autenticada, sua identificação externa, os boards disponíveis e informações necessárias para criar e consultar Pins, sempre dentro das permissões concedidas.</p><p>Os scopes solicitados podem incluir leitura da conta, leitura de boards, leitura de Pins e criação de Pins. A disponibilidade de cada função depende das permissões efetivamente concedidas pela pessoa e pelo Pinterest.</p></section>
      <section><h2>3. Como usamos os dados</h2><p>Usamos os dados para identificar a conta conectada, mostrar e selecionar boards, preparar conteúdo solicitado, validar as permissões disponíveis, registrar ações e operar as funções que a pessoa autorizada decidir utilizar. Não vendemos dados pessoais.</p></section>
      <section><h2>4. Tokens e credenciais</h2><p>A CasaPrática não solicita nem armazena a senha da conta do Pinterest. Tokens obtidos por autenticação são tratados como credenciais confidenciais, protegidos em repouso por criptografia e não são exibidos nas páginas públicas. O acesso é limitado aos componentes necessários para operar a integração.</p></section>
      <section><h2>5. Desconexão</h2><p>A integração pode ser desconectada nas configurações da CasaPrática. A desconexão remove as credenciais ativas da plataforma. A pessoa também pode revisar ou revogar acessos nas configurações da própria conta do Pinterest. Registros mínimos podem ser preservados quando necessários para histórico, auditoria, segurança e cumprimento de obrigações aplicáveis.</p></section>
      <section><h2>6. Links de afiliado</h2><p>Alguns links apresentados podem ser links de afiliado. Podemos receber comissão quando uma compra elegível é realizada por meio deles, sem custo adicional para quem compra. O marketplace ou a loja de destino processa seus próprios dados conforme suas políticas.</p></section>
      <section><h2>7. Segurança e conservação</h2><p>Adotamos medidas técnicas e organizacionais para reduzir riscos de acesso indevido, alteração, divulgação ou perda. Nenhum método de armazenamento ou transmissão é totalmente imune a riscos. Os dados são mantidos pelo tempo necessário às finalidades descritas e às obrigações aplicáveis.</p></section>
      <section><h2>8. Atualizações desta política</h2><p>Esta política pode ser atualizada para refletir mudanças na plataforma, nas integrações ou em requisitos aplicáveis. A data indicada no início será ajustada quando houver uma nova versão.</p></section>
      <ContactSection />
    </div>
  </main><PublicFooter /></div>;
}
