"use client";
import { useEffect, useState } from "react";
type Provider = "pinterest" | "facebook" | "mercadolivre";
type Status = "not_configured" | "disconnected" | "connecting" | "connected" | "error" | "token_expired";
type Connection = { provider: Provider; status: Status; expiresAt: string | null };
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const cards: ReadonlyArray<{ name: string; provider: Provider | "openai"; description: string }> = [
  { name: "Pinterest", provider: "pinterest", description: "Boards, pins e analytics conforme os scopes realmente concedidos." },
  { name: "Facebook", provider: "facebook", description: "Páginas, posts e insights mediante permissões aprovadas pela Meta." },
  { name: "Mercado Livre", provider: "mercadolivre", description: "Produtos e vendedores conforme permissões oficiais disponíveis." },
  { name: "OpenAI", provider: "openai", description: "Configurada exclusivamente no servidor por variável de ambiente." },
];
const labels: Record<Status, string> = { not_configured: "Não configurado", disconnected: "Desconectado", connecting: "Conectando", connected: "Conectado", error: "Erro", token_expired: "Token expirado" };
export default function IntegrationsPage() {
  const [connections, setConnections] = useState<Partial<Record<Provider, Connection>>>({});
  const load = async () => { try { const response = await fetch(`${api}/api/integrations`); if (response.ok) setConnections(Object.fromEntries(((await response.json()) as Connection[]).map(item => [item.provider, item]))); } catch { /* Sem detalhes sensíveis na interface. */ } };
  useEffect(() => { void load(); }, []);
  const connect = (provider: Provider) => { setConnections(value => ({ ...value, [provider]: { provider, status: "connecting", expiresAt: null } })); window.location.assign(`${api}/api/integrations/${provider}/connect`); };
  const test = async (provider: Provider) => { try { const response = await fetch(`${api}/api/integrations/${provider}/connect?test=true`); if (!response.ok) throw new Error(); const result = await response.json() as { valid: boolean; status: Status }; setConnections(value => ({ ...value, [provider]: { provider, status: result.valid ? "connected" : result.status, expiresAt: value[provider]?.expiresAt ?? null } })); } catch { setConnections(value => ({ ...value, [provider]: { provider, status: "error", expiresAt: null } })); } };
  const disconnect = async (provider: Provider) => { const response = await fetch(`${api}/api/integrations/${provider}/disconnect`, { method: "POST" }); if (response.ok) await load(); else setConnections(value => ({ ...value, [provider]: { provider, status: "error", expiresAt: null } })); };
  return <main><span className="eyebrow">CONFIGURAÇÕES</span><h1>Integrações</h1><p>Conecte contas por OAuth oficial. A CasaPrática nunca solicita ou armazena sua senha.</p><section className="cards">{cards.map(item => { const status = item.provider === "openai" ? "not_configured" : connections[item.provider]?.status ?? "not_configured"; const provider = item.provider as Provider; return <article className="card" key={item.provider}><h2>{item.name}</h2><p>{item.description}</p><strong>{labels[status]}</strong><div className="buttons">{item.provider === "openai" ? <button type="button" disabled>Configurar no servidor</button> : <><button type="button" onClick={() => connect(provider)}>{status === "connected" || status === "token_expired" ? "Reconectar" : "Conectar"}</button><button type="button" disabled={status !== "connected"} onClick={() => void test(provider)}>Testar conexão</button><button type="button" disabled={status !== "connected" && status !== "token_expired"} onClick={() => void disconnect(provider)}>Desconectar</button></>}</div></article>; })}</section></main>;
}
