import Link from "next/link";

export function PublicHeader() {
  return <header className="public-header"><Link className="public-brand" href="/" aria-label="CasaPrática — início">Casa<span>Prática</span></Link><nav aria-label="Navegação institucional"><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link></nav></header>;
}

export function PublicFooter() {
  return <footer className="public-footer"><div><Link className="public-brand public-brand-footer" href="/">Casa<span>Prática</span></Link><p>Curadoria para uma casa mais simples, acolhedora e sua.</p></div><nav aria-label="Links legais"><Link href="/privacidade">Política de Privacidade</Link><Link href="/termos">Termos de Uso</Link></nav><small>© {new Date().getFullYear()} CasaPrática.</small></footer>;
}

export function ContactSection() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return <section><h2>Contato</h2>{contactEmail ? <p>Para dúvidas relacionadas a estes documentos ou aos seus dados, escreva para <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p> : <p>O canal público de contato ainda precisa ser configurado pela CasaPrática.</p>}</section>;
}
