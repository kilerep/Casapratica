"use client";
import { useEffect, useState } from "react";
type Provider = "pinterest" | "facebook" | "mercadolivre";
type Status =
  | "not_configured"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "token_expired"
  | "pilot_disabled";
type Connection = {
  provider: Provider;
  status: Status;
  expiresAt: string | null;
  externalAccountId?: string | null;
  scopes?: string[];
  capabilities?: Record<string, { available: boolean; reason: string }>;
};
const api = "";
const cards: ReadonlyArray<{
  name: string;
  provider: Provider | "openai";
  description: string;
}> = [
  {
    name: "Pinterest",
    provider: "pinterest",
    description:
      "Boards, pins e analytics conforme os scopes realmente concedidos.",
  },
  {
    name: "Facebook",
    provider: "facebook",
    description:
      "Páginas, posts e insights mediante permissões aprovadas pela Meta.",
  },
  {
    name: "Mercado Livre",
    provider: "mercadolivre",
    description:
      "Produtos e vendedores conforme permissões oficiais disponíveis.",
  },
  {
    name: "OpenAI",
    provider: "openai",
    description:
      "Configurada exclusivamente no servidor por variável de ambiente.",
  },
];
const labels: Record<Status, string> = {
  not_configured: "Não configurado",
  disconnected: "Desconectado",
  connecting: "Conectando",
  connected: "Conectado",
  error: "Erro",
  token_expired: "Token expirado",
  pilot_disabled: "Piloto desligado",
};
export default function IntegrationsPage() {
  const [connections, setConnections] = useState<
    Partial<Record<Provider, Connection>>
  >({});
  const load = async () => {
    try {
      const response = await fetch(`${api}/api/integrations`);
      if (response.ok)
        setConnections(
          Object.fromEntries(
            ((await response.json()) as Connection[]).map((item) => [
              item.provider,
              item,
            ]),
          ),
        );
    } catch {
      /* Sem detalhes sensíveis na interface. */
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const connect = (provider: Provider) => {
    setConnections((value) => ({
      ...value,
      [provider]: { provider, status: "connecting", expiresAt: null },
    }));
    window.location.assign(`${api}/api/integrations/${provider}/connect`);
  };
  const test = async (provider: Provider) => {
    try {
      const response = await fetch(
        `${api}/api/integrations/${provider}/connect?test=true`,
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as {
        valid: boolean;
        status: Status;
      };
      setConnections((value) => ({
        ...value,
        [provider]: {
          provider,
          status: result.valid ? "connected" : result.status,
          expiresAt: value[provider]?.expiresAt ?? null,
        },
      }));
    } catch {
      setConnections((value) => ({
        ...value,
        [provider]: { provider, status: "error", expiresAt: null },
      }));
    }
  };
  const disconnect = async (provider: Provider) => {
    const response = await fetch(
      `${api}/api/integrations/${provider}/disconnect`,
      { method: "POST" },
    );
    if (response.ok) await load();
    else
      setConnections((value) => ({
        ...value,
        [provider]: { provider, status: "error", expiresAt: null },
      }));
  };
  return (
    <main>
      <span className="eyebrow">CONFIGURAÇÕES</span>
      <h1>Integrações</h1>
      <p>
        Conecte contas por OAuth oficial. A CasaPrática nunca solicita ou
        armazena sua senha.
      </p>
      <section className="cards">
        {cards.map((item) => {
          const status =
            item.provider === "openai"
              ? "not_configured"
              : (connections[item.provider]?.status ?? "not_configured");
          const provider = item.provider as Provider;
          return (
            <article className="card" key={item.provider}>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <strong>{labels[status]}</strong>
              {connections[provider]?.externalAccountId && (
                <p>Conta: {connections[provider]?.externalAccountId}</p>
              )}
              <p>Expiração: {connections[provider]?.expiresAt ?? "—"}</p>
              <p>Scopes: {connections[provider]?.scopes?.join(", ") ?? "—"}</p>
              {Object.entries(connections[provider]?.capabilities ?? {}).map(
                ([name, value]) => (
                  <p key={name}>
                    {name}: {value.available ? "Disponível" : value.reason}
                  </p>
                ),
              )}
              <div className="buttons">
                {item.provider === "openai" ? (
                  <button type="button" disabled>
                    Configurar no servidor
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => connect(provider)}>
                      {status === "connected" || status === "token_expired"
                        ? "Reconectar"
                        : "Conectar"}
                    </button>
                    <button
                      type="button"
                      disabled={status !== "connected"}
                      onClick={() => void test(provider)}
                    >
                      Testar conexão
                    </button>
                    <button
                      type="button"
                      disabled={
                        status !== "connected" && status !== "token_expired"
                      }
                      onClick={() => void disconnect(provider)}
                    >
                      Desconectar
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>
      <PinterestPilot />
      <FacebookPilot />
    </main>
  );
}

function FacebookPilot(){const[pages,setPages]=useState<Array<{id:string;name:string;category:string|null;tasks:string[];selected:boolean}>>([]),[itemId,setItemId]=useState(""),[actorId,setActorId]=useState(""),[preview,setPreview]=useState<{ready:boolean;blockers:string[];warnings:string[];payload:unknown;selectedPage:{id:string;name:string}|null;fingerprint:string}|null>(null),[message,setMessage]=useState("");const load=async()=>{const r=await fetch("/api/facebook/pilot/pages");if(!r.ok){setMessage("Piloto desligado, integração desconectada ou páginas indisponíveis.");return}setPages(await r.json())};return <section className="card"><h2>Piloto Facebook / Meta manual</h2><p>Conecte o Facebook, escolha uma Página administrada e valide o post. Nada é publicado pelo dry-run.</p><button onClick={()=>void load()}>Listar minhas Páginas</button>{pages.map(page=><article key={page.id}><strong>{page.name}</strong><p>Page ID: {page.id} · {page.category??"Categoria não disponível"}</p><p>Tasks: {page.tasks.join(", ")||"Não informadas"}</p><button disabled={page.selected} onClick={async()=>{const r=await fetch("/api/facebook/pilot/page",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pageId:page.id})});if(r.ok){setMessage("Página selecionada. Itens dependentes exigirão nova aprovação.");await load()}}}>{page.selected?"Página selecionada":"Selecionar Página"}</button></article>)}<label>Item Facebook aprovado<input value={itemId} onChange={e=>{setItemId(e.target.value);setPreview(null)}}/></label><label>Identificação do operador<input value={actorId} onChange={e=>setActorId(e.target.value)}/></label><button disabled={!itemId} onClick={async()=>{const r=await fetch(`/api/facebook/pilot/${encodeURIComponent(itemId)}/dry-run`,{method:"POST"});if(r.ok)setPreview(await r.json());else setMessage("Dry-run bloqueado. Confira Página, aprovação e capabilities.")}}>Executar dry-run</button>{preview&&<><p>{preview.ready?"Validação concluída":preview.blockers.join(", ")}</p>{preview.warnings.includes("COMMENT_MANUAL_REQUIRED")&&<p>Link no comentário: MANUAL_REQUIRED</p>}<pre>{JSON.stringify(preview.payload,null,2)}</pre><button disabled={!preview.ready||!actorId} onClick={()=>{if(!window.confirm("Publicar este post REAL na Página Facebook agora?"))return;void fetch(`/api/facebook/pilot/${encodeURIComponent(itemId)}/publish`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmation:"PUBLISH_FACEBOOK_PAGE_POST",fingerprint:preview.fingerprint,actorId})}).then(r=>{setPreview(null);setMessage(r.ok?"Publicação confirmada.":"Publicação bloqueada ou requer reconciliação.")})}}>Confirmar publicação real</button></>}<p role="status">{message}</p></section>}

function PinterestPilot() {
  const [boards, setBoards] = useState<Array<{ id: string; name: string }>>([]),
    [itemId, setItemId] = useState(""),
    [boardId, setBoardId] = useState(""),
    [actorId, setActorId] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    ready: boolean;
    blockers: string[];
    payload: unknown;
    fingerprint: string;
  } | null>(null);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch {
      setMessage(
        "Operação bloqueada ou indisponível. Confira a conexão e os requisitos.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card">
      <h2>Piloto Pinterest manual</h2>
      <p>
        O dry-run consulta boards e valida o item, sem publicar. A publicação
        exige aprovação prévia e confirmação explícita.
      </p>
      <button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const r = await fetch("/api/pinterest/pilot/boards");
            if (!r.ok) throw new Error();
            setBoards(await r.json());
          })
        }
      >
        Listar boards reais
      </button>
      <ul>
        {boards.map((board) => (
          <li key={board.id}>
            {board.name} — {board.id}
          </li>
        ))}
      </ul>
      <label>
        Item da fila aprovado
        <input
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setPreview(null);
          }}
        />
      </label>
      <label>
        Board de destino
        <select value={boardId} onChange={(e) => setBoardId(e.target.value)}>
          <option value="">Selecione</option>
          {boards.map((b) => (
            <option value={b.id} key={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy || !itemId || !boardId}
        onClick={() =>
          void run(async () => {
            const r = await fetch(
              `/api/pinterest/pilot/${encodeURIComponent(itemId)}/board`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ boardId }),
              },
            );
            if (!r.ok) throw new Error();
            setPreview(null);
            setMessage("Board salvo. Aprove novamente o item em Operações.");
          })
        }
      >
        Salvar board e solicitar nova aprovação
      </button>
      <label>
        Identificação do operador
        <input value={actorId} onChange={(e) => setActorId(e.target.value)} />
      </label>
      <button
        disabled={busy || !itemId}
        onClick={() =>
          void run(async () => {
            setPreview(null);
            const r = await fetch(
              `/api/pinterest/pilot/${encodeURIComponent(itemId)}/dry-run`,
              { method: "POST" },
            );
            if (!r.ok) throw new Error();
            setPreview(await r.json());
          })
        }
      >
        Executar dry-run
      </button>
      {preview && (
        <>
          <p>
            {preview.ready
              ? "Pronto para confirmação manual"
              : preview.blockers.join(", ")}
          </p>
          <pre>{JSON.stringify(preview.payload, null, 2)}</pre>
          <button
            disabled={busy || !preview.ready || !actorId}
            onClick={() => {
              if (!window.confirm("Publicar este pin REAL no Pinterest agora?"))
                return;
              void run(async () => {
                const r = await fetch(
                  `/api/pinterest/pilot/${encodeURIComponent(itemId)}/publish`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      confirmation: "PUBLISH_PINTEREST_PIN",
                      fingerprint: preview.fingerprint,
                      actorId,
                    }),
                  },
                );
                setPreview(null);
                if (!r.ok) throw new Error();
                const result = (await r.json()) as { externalUrl: string };
                setMessage(`Publicado: ${result.externalUrl}`);
              });
            }}
          >
            Confirmar publicação real
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
