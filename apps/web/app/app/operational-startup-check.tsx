type Ready = {
  status: "ready" | "degraded" | "not_ready";
  database: string;
  redis: string;
  worker: string;
  integrations: Record<string, string>;
};
type Integration = { provider: string; status: string; connected?: boolean };
const label: Record<string, string> = {
  available: "PRONTO",
  connected: "PRONTO",
  optional: "ATENÇÃO",
  pilot_disabled: "ATENÇÃO",
  integration_disabled: "ATENÇÃO",
  not_configured: "ATENÇÃO",
  unavailable: "AÇÃO NECESSÁRIA",
  degraded: "ATENÇÃO",
  unknown: "ATENÇÃO",
};
function Item({
  name,
  value,
  detail,
}: {
  name: string;
  value: string;
  detail: string;
}) {
  const state = label[value] ?? "ATENÇÃO";
  return (
    <article className="startup-item">
      <div>
        <strong>{name}</strong>
        <span>{detail}</span>
      </div>
      <b className={`startup-${state.replaceAll(" ", "-").toLowerCase()}`}>
        {state}
      </b>
    </article>
  );
}
export function OperationalStartupCheck({
  apiOk,
  ready,
  integrations,
  assistedOk,
  discoveryOk,
}: {
  apiOk: boolean | null;
  ready: Ready | null;
  integrations: Integration[];
  assistedOk: boolean | null;
  discoveryOk: boolean | null;
}) {
  const integration = (provider: string) =>
      integrations.find((item) => item.provider === provider),
    readyToday =
      apiOk === true &&
      ready?.database === "available" &&
      ready.redis === "available" &&
      ready.worker === "available" &&
      assistedOk === true;
  return (
    <section className="dashboard-panel">
      <div className="panel-heading">
        <div>
          <span className="dashboard-kicker">Verificação automática</span>
          <h2>O sistema está pronto?</h2>
        </div>
        <span
          className={`readiness readiness-${readyToday ? "ready" : "degraded"}`}
        >
          {readyToday
            ? "CASAPRÁTICA PRONTO PARA USO ASSISTIDO"
            : "NÚCLEO PRECISA DE ATENÇÃO"}
        </span>
      </div>
      <h3 className="startup-group-title">Núcleo operacional</h3>
      <div className="startup-list">
        <Item
          name="Aplicativo e API"
          value={apiOk ? "available" : "unavailable"}
          detail={
            apiOk
              ? "Aplicativo respondendo normalmente"
              : "Reinicie o CasaPrática"
          }
        />
        <Item
          name="Banco de dados"
          value={ready?.database ?? "unknown"}
          detail={
            ready?.database === "available"
              ? "Banco de dados pronto"
              : "Verifique o Docker"
          }
        />
        <Item
          name="Redis"
          value={ready?.redis ?? "unknown"}
          detail={
            ready?.redis === "available"
              ? "Fila de trabalho pronta"
              : "Verifique o Docker"
          }
        />
        <Item
          name="Worker"
          value={ready?.worker ?? "unknown"}
          detail={
            ready?.worker === "available"
              ? "Processamento em segundo plano pronto"
              : "Reinicie o CasaPrática"
          }
        />
        <Item
          name="Publicação assistida"
          value={assistedOk ? "available" : "unavailable"}
          detail={
            assistedOk
              ? "Publicação assistida pronta"
              : "Reinicie o CasaPrática; se continuar, abra Configurações"
          }
        />
      </div>
      <h3 className="startup-group-title">Integrações opcionais</h3>
      <div className="startup-list">
        <Item
          name="Pesquisa de produtos"
          value={discoveryOk ? "available" : "optional"}
          detail={
            discoveryOk
              ? "Pesquisa disponível"
              : "Pesquisa pública disponível mesmo sem integração oficial"
          }
        />
        <Item
          name="Mercado Livre"
          value={integration("mercadolivre")?.status ?? "integration_disabled"}
          detail={
            integration("mercadolivre")?.connected
              ? "Conta conectada"
              : "Não conectado"
          }
        />
        <Item
          name="Pinterest"
          value={
            integration("pinterest")?.status ??
            ready?.integrations?.pinterest ??
            "pilot_disabled"
          }
          detail={
            integration("pinterest")?.connected
              ? "Conta conectada"
              : "Aguardando configuração; preparo manual disponível"
          }
        />
        <Item
          name="Facebook"
          value={
            integration("facebook")?.status ??
            ready?.integrations?.meta ??
            "pilot_disabled"
          }
          detail={
            integration("facebook")?.connected
              ? "Conta conectada"
              : "Não conectado; preparo manual disponível"
          }
        />
      </div>
      <p className="startup-note">
        Mercado Livre, Pinterest e Facebook não impedem o modo manual assistido.
        Nada é publicado automaticamente.
      </p>
    </section>
  );
}
