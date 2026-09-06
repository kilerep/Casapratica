"use client";
import { useEffect, useMemo, useState } from "react";
import { InternalNav } from "../../internal-nav";
import { ProductImage } from "../publicar/product-image";
import { ZoeImportPanel } from "./zoe-import-panel";
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  missing = "Dado não disponível";
type P = {
  id: string;
  name: string;
  image: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  reviewCount: number | null;
  salesCount: number | null;
  seller: string | null;
  sellerReputation: number | null;
  score: number | null;
  opportunityScore: number | null;
  confidence: number | null;
  status: string;
  verdict: string | null;
  reasons: string[];
  signals: Record<string, boolean | null>;
  sourceUrl: string;
  source: string | null;
  observedAt: string | null;
  researchDate: string | null;
  researchId: string | null;
};
type D = Record<string, any>;
const value = (v: unknown, suffix = "") =>
  v === null || v === undefined || v === "" ? missing : `${String(v)}${suffix}`;
export default function ProductsReviewPage() {
  const [products, setProducts] = useState<P[]>([]),
    [selected, setSelected] = useState<D | null>(null),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [score, setScore] = useState(""),
    [verdict, setVerdict] = useState(""),
    [research, setResearch] = useState(""),
    [comment, setComment] = useState(""),
    [actor, setActor] = useState("web-user"),
    [error, setError] = useState<string | null>(null);
  const load = async () => {
    const r = await fetch(`${api}/api/products/review`, { cache: "no-store" });
    if (r.ok) setProducts(await r.json());
  };
  useEffect(() => {
    void load();
  }, []);
  const categories = [
      ...new Set(products.map((p) => p.category).filter(Boolean)),
    ] as string[],
    researches = [
      ...new Set(products.map((p) => p.researchId).filter(Boolean)),
    ] as string[];
  const shown = useMemo(
    () =>
      products.filter(
        (p) =>
          (!status || p.status === status) &&
          (!category || p.category === category) &&
          (!score ||
            (score === "unknown"
              ? p.score === null
              : score === "high"
                ? (p.score ?? -1) >= 70
                : score === "medium"
                  ? (p.score ?? -1) >= 55 && (p.score ?? -1) < 70
                  : (p.score ?? 101) < 55)) &&
          (!verdict || p.verdict === verdict) &&
          (!research || p.researchId === research),
      ),
    [products, status, category, score, verdict, research],
  );
  const open = async (id: string) => {
    const r = await fetch(`${api}/api/products/${id}/review`, {
      cache: "no-store",
    });
    if (r.ok) setSelected(await r.json());
  };
  const decide = async (action: "approve" | "test" | "reject") => {
    if (!selected) return;
    setError(null);
    const r = await fetch(
      `${api}/api/products/${selected.id}/review/${action}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actorId: actor,
          comment: comment.trim() || null,
        }),
      },
    );
    if (!r.ok) {
      setError("Não foi possível registrar a decisão.");
      return;
    }
    setSelected(null);
    setComment("");
    await load();
  };
  return (
    <div className="internal-shell">
      <InternalNav />
      <main className="review-main">
        <header className="review-heading">
          <span className="dashboard-kicker">Curadoria humana</span>
          <h1>Este produto é bom para divulgar?</h1>
          <p>
            Revise os dados encontrados antes de liberar o produto para o fluxo
            editorial.
          </p>
        </header>
        <ZoeImportPanel onImported={load} />
        <section className="review-filters" aria-label="Filtros">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {[
                "candidate",
                "under_review",
                "approved",
                "test",
                "rejected",
                "active",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Score
            <select value={score} onChange={(e) => setScore(e.target.value)}>
              <option value="">Todos</option>
              <option value="high">70 ou mais</option>
              <option value="medium">55 a 69</option>
              <option value="low">Abaixo de 55</option>
              <option value="unknown">Não disponível</option>
            </select>
          </label>
          <label>
            Veredito
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
            >
              <option value="">Todos</option>
              {[
                "APROVADO PARA REVISÃO",
                "OPORTUNIDADE PARA REVISÃO",
                "NÃO RECOMENDADO",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Pesquisa
            <select
              value={research}
              onChange={(e) => setResearch(e.target.value)}
            >
              <option value="">Todas as datas</option>
              {researches.map((id) => (
                <option key={id} value={id}>
                  {new Date(
                    products.find((p) => p.researchId === id)?.researchDate ??
                      "",
                  ).toLocaleDateString("pt-BR")}
                </option>
              ))}
            </select>
          </label>
        </section>
        {shown.length ? (
          <section className="review-grid">
            {shown.map((p) => (
              <article className="product-card" key={p.id}>
                <ProductImage src={p.image} alt={p.name} />
                <div>
                  <small>{value(p.category)}</small>
                  <h2>{p.name}</h2>
                  <p>
                    {p.price === null
                      ? missing
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: p.currency ?? "BRL",
                        }).format(p.price)}
                  </p>
                  <dl>
                    <div>
                      <dt>Avaliação</dt>
                      <dd>{value(p.rating)}</dd>
                    </div>
                    <div>
                      <dt>Avaliações</dt>
                      <dd>{value(p.reviewCount)}</dd>
                    </div>
                    <div>
                      <dt>Vendas</dt>
                      <dd>{value(p.salesCount)}</dd>
                    </div>
                    <div>
                      <dt>Vendedor</dt>
                      <dd>{value(p.seller)}</dd>
                    </div>
                    <div>
                      <dt>Score</dt>
                      <dd>{value(p.score)}</dd>
                    </div>
                    <div>
                      <dt>Confiança</dt>
                      <dd>
                        {p.confidence === null
                          ? missing
                          : `${Math.round(p.confidence * 100)}%`}
                      </dd>
                    </div>
                    <div>
                      <dt>Pesquisa</dt>
                      <dd>
                        {p.researchDate
                          ? new Date(p.researchDate).toLocaleDateString("pt-BR")
                          : missing}
                      </dd>
                    </div>
                  </dl>
                  <span className="product-verdict">{value(p.verdict)}</span>
                  {p.source === "public_web" && (
                    <small title="Algumas informações podem não estar disponíveis sem integração oficial.">
                      Dados públicos
                    </small>
                  )}
                  <p>
                    OpportunityScore: {value(p.opportunityScore)} ·
                    ProductScore: {value(p.score)}
                  </p>
                  <p>
                    Sinais:{" "}
                    {Object.entries(p.signals ?? {})
                      .filter(([, active]) => active)
                      .map(([name]) => name)
                      .join(", ") || missing}
                  </p>
                  <p>Motivo e riscos: {p.reasons?.join(" ") || missing}</p>
                  {p.observedAt && (
                    <p>
                      Observado em{" "}
                      {new Date(p.observedAt).toLocaleString("pt-BR")}
                    </p>
                  )}
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                    Abrir fonte
                  </a>
                  <button onClick={() => void open(p.id)}>
                    Revisar produto
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <p className="friendly-empty">
            Nenhum produto encontrado para estes filtros.
          </p>
        )}
        {selected && (
          <div className="review-overlay" role="dialog" aria-modal="true">
            <article className="review-detail">
              <button
                className="close-detail"
                onClick={() => setSelected(null)}
              >
                Fechar
              </button>
              <h2>{selected.name}</h2>
              <div className="detail-images">
                {(
                  (selected.candidates?.[0]?.capturedData?.product?.images ??
                    []) as string[]
                ).map((x) => (
                  <img src={x} alt="" key={x} />
                ))}
                {!selected.candidates?.[0]?.capturedData?.product?.images
                  ?.length && <p>{missing}</p>}
              </div>
              <h3>Dados e sinais</h3>
              <p>
                Preço: {value(selected.price)} · Avaliação:{" "}
                {value(selected.rating)} · Vendas: {value(selected.salesCount)}
              </p>
              <p>
                Vendedor: {value(selected.seller?.name)} · Reputação:{" "}
                {value(selected.seller?.reputation)}
              </p>
              {selected.scores?.[0] ? (
                <section>
                  <h3>Score detalhado</h3>
                  <p>{selected.scores[0].explanation}</p>
                  <p>
                    Score {selected.scores[0].score} · confidence{" "}
                    {Math.round(Number(selected.scores[0].confidence) * 100)}%
                  </p>
                  <p>
                    Fatores disponíveis:{" "}
                    {selected.scores[0].availableFactors?.join(", ") || missing}
                  </p>
                  <p>
                    Fatores ausentes:{" "}
                    {selected.scores[0].missingFactors?.join(", ") || missing}
                  </p>
                  <pre>
                    {JSON.stringify(selected.scores[0].factorScores, null, 2)}
                  </pre>
                </section>
              ) : (
                <p>{missing}</p>
              )}
              <h3>Histórico de pesquisa</h3>
              {selected.candidates?.length ? (
                selected.candidates.map((c: D) => (
                  <p key={c.id}>
                    {new Date(
                      c.researchRun.completedAt ?? c.createdAt,
                    ).toLocaleDateString("pt-BR")}{" "}
                    · {value(c.capturedData?.verdict)} ·{" "}
                    {(c.capturedData?.reasons ?? []).join(" ")}
                  </p>
                ))
              ) : (
                <p>{missing}</p>
              )}
              <h3>Comparação</h3>
              {selected.candidates?.[0]?.researchRun?.comparisons?.length ? (
                <div className="comparison-grid">
                  {selected.candidates[0].researchRun.comparisons.map(
                    (c: D) => (
                      <div key={c.id}>
                        <strong>{c.product.name}</strong>
                        <span>Preço: {value(c.product.price)}</span>
                        <span>Avaliação: {value(c.product.rating)}</span>
                        <span>Vendedor: {value(c.product.seller?.name)}</span>
                        <span>
                          Score: {value(c.product.scores?.[0]?.score)}
                        </span>
                        <span>
                          Confiança:{" "}
                          {c.product.scores?.[0]?.confidence
                            ? `${Math.round(Number(c.product.scores[0].confidence) * 100)}%`
                            : missing}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p>Sem comparação disponível</p>
              )}
              <h3>Conteúdo e criativos</h3>
              {selected.contents?.length ? (
                selected.contents.map((c: D) => (
                  <div key={c.id}>
                    <p>
                      {c.title} · {c.status}
                    </p>
                    {c.creativeAssets?.length ? (
                      c.creativeAssets.map((a: D) => (
                        <span key={a.id}>
                          {a.kind} · {a.status}
                        </span>
                      ))
                    ) : (
                      <p>Nenhum criativo criado ainda</p>
                    )}
                  </div>
                ))
              ) : (
                <>
                  <p>Nenhum conteúdo criado ainda</p>
                  <p>Nenhum criativo criado ainda</p>
                </>
              )}
              <div className="decision-box">
                <label>
                  Operador
                  <input
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                  />
                </label>
                <label>
                  Comentário opcional
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
                {error && <p role="alert">{error}</p>}
                <div>
                  <button onClick={() => void decide("approve")}>
                    APROVAR
                  </button>
                  <button onClick={() => void decide("test")}>
                    MANTER COMO TESTE
                  </button>
                  <button onClick={() => void decide("reject")}>
                    REJEITAR
                  </button>
                </div>
              </div>
            </article>
          </div>
        )}
      </main>
    </div>
  );
}
