# Desenvolvimento local

1. Instale Node 22+, Docker Desktop e Git. Execute `npx pnpm@latest install`.
2. Copie `.env.example` para `.env`; mantenha as flags reais desligadas. A senha presente é somente local.
3. Rode `docker compose -f infra/docker-compose.yml up -d` e aguarde ambos os healthchecks.
4. Defina `DATABASE_URL`, rode `npx pnpm@latest --filter @casapratica/database exec prisma migrate deploy` e configure `DEFAULT_WORKSPACE_ID` após o seed.
5. Na raiz, rode `npx pnpm@latest dev`. Como alternativa, `npx pnpm@latest start:casapratica` sobe Postgres/Redis, aguarda os healthchecks e inicia Web, API e Worker. Nenhum dos fluxos exige ngrok ou OAuth.
6. Abra `http://127.0.0.1:3000/app`. Use `npx pnpm@latest doctor` para o diagnóstico simples e `npx pnpm@latest dev:stop` para encerrar somente os processos do CasaPrática registrados pelo inicializador.
7. Rode `npx pnpm@latest smoke` e `npx pnpm@latest test:e2e:local`.
8. Os contêineres podem permanecer ativos. Se também quiser encerrá-los, use `docker compose -f infra/docker-compose.yml down`. Não use `-v` se quiser preservar os dados.

No Windows, use PowerShell. O provider fake exige `ENABLE_TEST_PUBLISHING_PROVIDER=true`; nunca habilite isso em produção.
