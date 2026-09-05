import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "./public-components";

export const metadata: Metadata = {
  title: "CasaPrática | Curadoria para casa e decoração",
  description: "Pesquisamos, comparamos e selecionamos produtos para casa, organização, utilidades e decoração.",
  robots: { index: true, follow: true },
  openGraph: { type: "website", locale: "pt_BR", siteName: "CasaPrática", title: "CasaPrática | Escolhas mais simples para a sua casa", description: "Curadoria de produtos para casa, organização, utilidades e decoração." },
};

export default function HomePage() {
  return <div className="public-shell"><PublicHeader /><main className="public-main public-home">
    <section className="public-hero" aria-labelledby="hero-title"><div className="public-hero-copy">
      <span className="public-kicker">Casa, escolhas e leveza</span><h1 id="hero-title">Boas escolhas deixam a casa mais sua.</h1>
      <p className="public-lead">A CasaPrática pesquisa, compara e seleciona produtos que ajudam a organizar, cuidar e decorar os espaços do dia a dia.</p>
      <a className="public-button" href="#como-funciona">Conheça nossa curadoria</a>
    </div><div className="public-hero-scene" aria-hidden="true"><div className="public-sun" /><div className="public-arch"><span className="public-vase" /><span className="public-leaf public-leaf-one" /><span className="public-leaf public-leaf-two" /><span className="public-shelf" /></div></div></section>
    <section className="public-section" id="como-funciona"><div className="public-section-heading"><span className="public-kicker">Curadoria com simplicidade</span><h2>Menos ruído, mais clareza para escolher.</h2></div>
      <div className="public-feature-grid">
        <article className="public-feature"><span className="public-feature-number">01</span><h3>Pesquisamos</h3><p>Buscamos opções em marketplaces e reunimos informações úteis para facilitar a descoberta de produtos.</p></article>
        <article className="public-feature"><span className="public-feature-number">02</span><h3>Comparamos</h3><p>Observamos características, proposta e contexto de uso para tornar a comparação mais direta.</p></article>
        <article className="public-feature"><span className="public-feature-number">03</span><h3>Selecionamos</h3><p>Destacamos alternativas para casa, organização, utilidades e decoração, sempre com linguagem clara.</p></article>
      </div>
    </section>
    <section className="public-disclosure"><div><span className="public-kicker">Transparência faz parte</span><h2>Curadoria independente de compra e entrega.</h2></div><div>
      <p>A CasaPrática não vende produtos diretamente. A compra, o pagamento e a entrega acontecem no marketplace ou na loja indicada.</p>
      <p>Alguns links podem ser afiliados. Nesse caso, podemos receber uma comissão pela indicação, sem custo adicional para você.</p>
    </div></section>
  </main><PublicFooter /></div>;
}
