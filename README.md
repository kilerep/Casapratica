# CasaPrática OS

Monólito modular com aplicações web, API e worker para apoiar pesquisa, seleção, conteúdo, publicação aprovada e aprendizado da CasaPrática.

## Requisitos

- Node.js LTS (22 ou superior)
- Corepack e pnpm 10
- Docker com Docker Compose

## Início rápido

```bash
docker compose -f infra/docker-compose.yml up -d
npx pnpm@latest dev
```

Abra `http://127.0.0.1:3000/app`. Essa é a tela principal do operador.

Para diagnosticar e parar:

```bash
npx pnpm@latest doctor
npx pnpm@latest dev:stop
```

`dev:stop` encerra somente o processo registrado pelo inicializador do CasaPrática. Os contêineres e dados locais são preservados.

## Qualidade

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Integrações oficiais

Crie aplicativos nas áreas oficiais de desenvolvedores do Pinterest, Meta e Mercado Livre e cadastre exatamente as URLs de callback definidas em `.env`. Não use credenciais de usuário: a aplicação aceita somente Client IDs e Client Secrets de aplicativos OAuth.

- Gere `INTEGRATION_ENCRYPTION_KEY` como 32 bytes aleatórios codificados em Base64. Alterar essa chave invalida tokens já armazenados.
- Preencha `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` e `PINTEREST_REDIRECT_URI` no portal Pinterest Developers.
- Preencha `META_CLIENT_ID`, `META_CLIENT_SECRET`, `META_GRAPH_API_VERSION` e `META_REDIRECT_URI` no Meta for Developers.
- Preencha `MERCADOLIVRE_CLIENT_ID`, `MERCADOLIVRE_CLIENT_SECRET` e `MERCADOLIVRE_REDIRECT_URI` no portal Mercado Livre Developers.
- `NEXT_PUBLIC_API_URL` contém apenas a URL pública da API. Secrets, tokens e a chave de criptografia são exclusivos do servidor.

Os recursos dependem dos scopes efetivamente concedidos. `affiliate_link_generation` permanece indisponível até um provider oficial conceder explicitamente esse escopo. Esta fase não publica conteúdo automaticamente.
