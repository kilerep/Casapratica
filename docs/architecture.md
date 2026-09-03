# Arquitetura

O CasaPrática OS começa como monólito modular, acompanhado por um worker separado para tarefas assíncronas. O web consome a API Fastify; API e worker reutilizam módulos internos sem expor detalhes de infraestrutura ao domínio.

## Camadas

`agents → tools → services → repositories/providers`

- **Domain:** entidades, políticas e regras independentes de plataforma.
- **Services:** coordenação dos casos de uso.
- **Repositories/providers:** persistência e integrações externas.
- **Tools:** superfície explícita e validada oferecida aos agentes.
- **Agents:** escolhem tools; nunca acessam Prisma ou rede diretamente.

PostgreSQL é a persistência de produção. Redis e BullMQ suportam filas. Não há microserviços, Kubernetes ou banco em memória de produção.
