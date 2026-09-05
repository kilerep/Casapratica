import type { Metadata } from "next";
import { ContactSection, PublicFooter, PublicHeader } from "../public-components";

export const metadata: Metadata = {
  title: "Termos de Uso | CasaPrática",
  description: "Conheça as condições de uso e o papel da CasaPrática.",
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "pt_BR", siteName: "CasaPrática", title: "Termos de Uso | CasaPrática", description: "Condições para utilizar os conteúdos da CasaPrática." },
};

export default function TermsPage() {
  return <div className="public-shell"><PublicHeader /><main className="public-main public-legal">
    <header className="public-legal-heading"><span className="public-kicker">Relação clara desde o início</span><h1>Termos de Uso</h1><p>Última atualização: 4 de setembro de 2026.</p></header>
    <div className="public-legal-content">
      <section><h2>1. Sobre a CasaPrática</h2><p>A CasaPrática atua como curadora e divulgadora de produtos para casa, organização, utilidades e decoração. Nosso conteúdo busca facilitar a pesquisa e a comparação de alternativas disponíveis em lojas e marketplaces de terceiros.</p></section>
      <section><h2>2. O que não fazemos</h2><p>A CasaPrática não fabrica, não vende diretamente, não recebe o pagamento e não entrega os produtos apresentados. Também não oferece garantia sobre esses produtos. A relação de compra ocorre entre a pessoa usuária e o marketplace ou vendedor escolhido.</p></section>
      <section><h2>3. Preços, disponibilidade e informações</h2><p>Preços, estoque, frete, condições de pagamento, características e disponibilidade dependem do marketplace ou vendedor e podem mudar sem aviso à CasaPrática. Antes de comprar, confira as informações atualizadas, as políticas da loja e se o produto atende às suas necessidades.</p></section>
      <section><h2>4. Links externos e afiliados</h2><p>Os links levam a serviços de terceiros, sujeitos a seus próprios termos e políticas. Alguns podem ser links de afiliado. Quando uma compra elegível é feita por meio deles, a CasaPrática pode receber uma comissão, sem custo adicional para quem compra.</p></section>
      <section><h2>5. Uso do conteúdo</h2><p>O conteúdo tem finalidade informativa e de curadoria. Você pode utilizá-lo para decisões pessoais, respeitando direitos autorais, marcas e demais direitos aplicáveis. Não é permitido usar a plataforma de forma ilícita, interferir em seu funcionamento ou reproduzir seu conteúdo comercialmente sem autorização.</p></section>
      <section><h2>6. Limites da curadoria</h2><p>Seleções e comparações refletem informações disponíveis no momento da análise e não substituem a avaliação individual. A presença de um item não constitui promessa de desempenho nem garantia de adequação a uma finalidade específica.</p></section>
      <section><h2>7. Alterações</h2><p>Estes termos podem ser atualizados para acompanhar mudanças na plataforma ou em requisitos aplicáveis. A versão vigente será a publicada nesta página, identificada pela data acima.</p></section>
      <ContactSection />
    </div>
  </main><PublicFooter /></div>;
}
