# Validação do sistema

Execute, nesta ordem: `prisma validate`, `prisma generate`, `prisma migrate status`, `prisma migrate deploy`, `pnpm smoke`, o E2E local, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `git diff --check`.

O E2E local requer PostgreSQL e Redis saudáveis. Ele deve criar dados exclusivos, renderizar a fixture local com Sharp, exigir aprovação, agendar um job BullMQ, publicar somente pelo provider fake, confirmar uma única `Publication`, inserir snapshots/conversões e consultar analytics. Falhas 401/429/500/timeout nunca são sucesso; retries e jobs duplicados devem convergir pela chave idempotente. `/ready` retorna 503 se banco ou Redis obrigatório estiver indisponível, e `degraded` quando apenas worker ou integração opcional faltar.

Publicação real exige flag, OAuth conectado, capability, aprovação e validações. Autopilot permanece desligado.
