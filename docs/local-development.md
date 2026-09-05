# Desenvolvimento local

1. Instale Node 22+, Docker Desktop e Git. Execute `npx pnpm@latest install`.
2. Copie `.env.example` para `.env`; mantenha as flags reais desligadas. A senha presente é somente local.
3. Rode `docker compose -f infra/docker-compose.yml up -d` e aguarde ambos os healthchecks.
4. Defina `DATABASE_URL`, rode `npx pnpm@latest --filter @casapratica/database exec prisma migrate deploy` e configure `DEFAULT_WORKSPACE_ID` após o seed.
5. Na raiz, rode apenas `npx pnpm@latest dev`. O comando valida as portas e inicia Web em 3000, API em 3001 e Worker; ele só anuncia prontidão depois dos checks locais.
6. Confira `http://localhost:3001/health`, `http://localhost:3001/ready` e `http://localhost:3000/analytics`.
7. Rode `npx pnpm@latest smoke` e `npx pnpm@latest test:e2e:local`.
8. Finalize com `docker compose -f infra/docker-compose.yml down`. Não use `-v` se quiser preservar os dados.

No Windows, use PowerShell. O provider fake exige `ENABLE_TEST_PUBLISHING_PROVIDER=true`; nunca habilite isso em produção.
