# Arquitetura de IA

Agentes serão adicionados somente na Fase 3. Eles atuarão como coordenadores limitados a tools tipadas e auditáveis. Tools validam entrada, aplicam autorização e chamam services; services usam repositories ou providers.

Nenhum agente recebe Prisma, conexão de banco, token ou cliente de API externa. Resultados externos mantêm proveniência e campos ausentes. Toda ação com efeito externo requer confirmação real, e publicação depende do approval engine.

## Orquestração

`CasaPraticaManagerAgent` mantém o controle da conversa e invoca oito especialistas como tools. Não há handoffs permanentes nem swarm autônomo. Especialistas acessam somente tools registradas no `ToolRegistry`; essas tools chamam application services, que por sua vez dependem de repositories ou providers.

## Memória e dados

Memória conversacional é persistida em `AgentSession` e `ConversationMessage`. Produtos, publicações, estratégias, métricas e decisões permanecem em seus modelos de negócio e nunca são derivados da conversa como fonte de verdade.

## Segurança e observabilidade

Guardrails bloqueiam credenciais e claims não sustentados, exigem aprovação para ações externas e publicação e validam links. Traces registram agente, tool, duração, status, código de erro e uso quando fornecido pelo SDK; conteúdo sensível não integra o registro.
