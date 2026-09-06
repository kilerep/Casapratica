"use client";
import { useEffect, useState } from "react";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
type Run = {
  candidates?: unknown[];
  recommended?: number;
  opportunities?: number;
  rejected?: number;
  categories?: string[];
  provider?: string;
  date?: string;
};
type Result = {
  status?: string;
  connected?: boolean;
  message?: string | null;
  run?: Run | null;
};
export function DiscoveryPanel() {
  const [result, setResult] = useState<Result | null>(null),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    void fetch(`${api}/api/product-discovery/latest`, { cache: "no-store" })
      .then(async (response) => {
        if (response.ok) {
          const value = (await response.json()) as Run | null;
          setResult(value ? { connected: true, run: value } : { run: null });
        }
      })
      .catch(() => undefined);
  }, []);
  const run = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${api}/api/product-discovery/run`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: "auto" }),
        }),
        value = (await response.json()) as Result;
      setResult(value);
      if (response.ok && value.run && location.pathname === "/app/produtos")
        location.reload();
    } finally {
      setLoading(false);
    }
  };
  const isPublic = result?.run?.provider === "public_web";
  return (
    <section className="dashboard-panel">
      <div className="panel-heading">
        <div>
          <span className="dashboard-kicker">Descoberta diária</span>
          <h2>Produtos de hoje</h2>
        </div>
        <button type="button" onClick={() => void run()} disabled={loading}>
          {loading ? "Pesquisando…" : "PESQUISAR PRODUTOS DE HOJE"}
        </button>
      </div>
      {result?.status === "source_unavailable" ||
      result?.connected === false ? (
        <p className="friendly-empty">
          Fonte pública indisponível no momento. Tente novamente mais tarde ou
          use o cadastro manual.
        </p>
      ) : result?.status === "no_structured_products" ? (
        <p className="friendly-empty">
          Nenhum produto confiável foi encontrado nesta busca. Tentando outras
          categorias.
        </p>
      ) : result?.status === "no_results" ? (
        <p className="friendly-empty">
          A busca foi concluída, mas não retornou produtos.
        </p>
      ) : result?.run ? (
        <>
          {result.status === "partial_success" && (
            <p className="startup-note">
              Pesquisa concluída com cobertura parcial.
            </p>
          )}
          <p>
            <strong>Fonte:</strong>{" "}
            {isPublic
              ? "Pesquisa pública da web · Dados públicos"
              : "Mercado Livre oficial"}
            {result.run.date
              ? ` · ${new Date(result.run.date).toLocaleString("pt-BR")}`
              : ""}
          </p>
          {isPublic && (
            <p className="startup-note" title="Dados públicos">
              Algumas informações podem não estar disponíveis sem integração
              oficial.
            </p>
          )}
          <div className="metric-grid">
            <div className="metric">
              <strong>{result.run.candidates?.length ?? 0}</strong>
              <span>Analisados</span>
            </div>
            <div className="metric">
              <strong>{result.run.recommended ?? 0}</strong>
              <span>Aprovados</span>
            </div>
            <div className="metric">
              <strong>{result.run.opportunities ?? 0}</strong>
              <span>Oportunidades</span>
            </div>
            <div className="metric">
              <strong>{result.run.rejected ?? 0}</strong>
              <span>Rejeitados</span>
            </div>
            <div className="metric">
              <strong>
                {result.run.categories?.slice(0, 3).join(", ") || "—"}
              </strong>
              <span>Categorias mais fortes</span>
            </div>
          </div>
        </>
      ) : (
        <p className="friendly-empty">
          Nenhuma pesquisa diária executada ainda.
        </p>
      )}
    </section>
  );
}
