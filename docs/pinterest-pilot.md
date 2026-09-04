# Fase 11.7 — Pinterest real integration pilot

Continuação das Fases 11.5 e 11.6. Sem autopilot, autoaprovação, publicação agendada real ou publicação automática. O provider real ? ligado somente ao serviço manual do piloto; ferramentas de agentes e workers mantém seus providers anteriores.

## Configuração manual e primeiro OAuth

1. No portal de desenvolvedores Pinterest, crie/configure seu aplicativo e confira o nível de acesso e as contas autorizadas para teste. Cadastre exatamente `PINTEREST_REDIRECT_URI`; o padrão local ? `http://localhost:3001/api/integrations/pinterest/callback`. Se o portal exigir HTTPS para seu aplicativo, configure um callback HTTPS com proteção de acesso adequada; não exponha a aplicação inteira publicamente.
2. Configure no ambiente do processo `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`, `DEFAULT_WORKSPACE_ID`, `DATABASE_URL`, `REDIS_URL` e `INTEGRATION_ENCRYPTION_KEY` (32 bytes aleatórios em base64). Guarde e preserve a chave fora do Git; trocá-la sem recriptografar credenciais invalida os tokens armazenados. Nunca configure sua senha Pinterest.
3. Configure `WEB_ORIGIN=http://localhost:3000`, `NEXT_PUBLIC_API_URL=http://localhost:3001` e use o mesmo hostname no navegador e callback. Carregue explicitamente as variáveis no processo: o servidor não lê automaticamente um arquivo `.env`.
4. Para o primeiro OAuth: `ENABLE_PINTEREST_PILOT=true`, `ENABLE_REAL_PINTEREST_PUBLISHING=false`, `ENABLE_AUTOPILOT=false`, `ENABLE_TEST_PUBLISHING_PROVIDER=false`. Reinicie API/web após alterações de ambiente. O piloto força API em `127.0.0.1`; scripts web dev/start também usam loopback. Este piloto ? para operador local confiável, sem autenticação multiusuário. Não publique o proxy web/API na rede.
5. Abra `/integrations`, clique Conectar e conceda acesso no Pinterest. Após callback, confira identidade, expiração, scopes e capabilities. Liste boards reais. OAuth não publica pins.
6. Escolha manualmente o item e um board listado. Salvar board coloca o item em `awaiting_approval`; aprove-o novamente em Operações. Disponibilize o creative aprovado como imagem PNG/JPEG em HTTPS público e configure seu `CreativeAsset.storageKey` com a URL verdadeira. Arquivos locais continuam bloqueados; este piloto não faz upload/hosting automático. Confira título, descrição e URL de destino reais.
7. Somente quando decidir publicar: habilite também `ENABLE_REAL_PINTEREST_PUBLISHING=true`, reinicie a API, execute dry-run, confira o payload, informe seu identificador de operador e confirme a publicação real na UI. Identificador ? atribuição de auditoria, não autenticação.

## OAuth e segurança

Authorization Code oficial; scopes separados por vírgula na autorização; autenticação HTTP Basic na troca e refresh. `continuous_refresh=true`. Identidade vem de `/v5/user_account`; não ? inventada a partir do nome. Respostas sem identidade, token válido ou scope de leitura da conta são rejeitadas.

State aleatório, SHA-256 no banco, expiração em 10 minutos e consumo via update condicional atômico (`consumedAt IS NULL`, expiração futura). Cookie HttpOnly/SameSite=Lax liga callback ao navegador iniciador; Secure em callback HTTPS. Callback de recusa com state válido consome a transação sem trocar código. Replay, expiração e provider errado são bloqueados. Nenhum querystring OAuth ? registrado pelo logger da API; respostas não usam cache e enviam Referrer-Policy no-referrer.

Access/refresh tokens e verifier são criptografados com AES-256-GCM, IV aleatório e tag de autenticação separados. DTOs públicos contém apenas identidade, status, expiração, scopes e capabilities. Auditoria usa códigos estáticos de falha, nunca mensagens externas ou tokens.

Desconexão remove tokens e desabilita capabilities sem apagar conta, identidade, auditoria ou publicações. Reconectar a mesma identidade reutiliza a conta; uma identidade diferente cria nova conta e desconecta a anterior. A revogação OAuth comum deve ser feita também nas configurações do Pinterest quando desejada: o endpoint atual de revogação documentado atende tokens de system users, não este fluxo comum.

## Estados, scopes e capabilities

Estados públicos existentes: `not_configured`, `disconnected`, `connecting` (UI durante redirecionamento), `connected`, `error`, `token_expired`. Sem credenciais após disconnect permanece `disconnected`. Erro de validação remota ? `error`; token expirado bloqueia acesso. Estado `connected` corresponde ao requisito CONNECTED do piloto.

Scopes solicitados: `user_accounts:read`, `boards:read`, `pins:read`, `pins:write`. Só scopes retornados pelo Pinterest são aceitos. Sem grants presumidos. `read_account`, `read_boards`, `read_pins` dependem de token válido e scope; `create_pin` depende também das duas flags. `write_boards` e `read_analytics` permanecem indisponíveis. Status recalcula e persiste capabilities atuais.

`/ready` mantém verificações locais anteriores e informa dinamicamente Pinterest como `pilot_disabled`, `not_configured`, `disconnected`, `connected`, `token_expired` ou `error`; integração opcional não derruba a liveness.

## Endpoints

| Método | Caminho | Comportamento |
| --- | --- | --- |
| GET | `/api/integrations` | Lista estados públicos |
| GET | `/api/integrations/pinterest/status` | Status e capabilities atuais |
| GET | `/api/integrations/pinterest/connect` | Inicia OAuth; `?test=true` valida conexão |
| GET | `/api/integrations/pinterest/callback` | Consome state, troca código, persiste credenciais e retorna ? UI |
| POST | `/api/integrations/pinterest/disconnect` | Desconecta preservando histórico |
| GET | `/api/pinterest/pilot/boards` | Boards reais com paginação; sem fallback inventado |
| POST | `/api/pinterest/pilot/:id/board` | `{boardId}` real; invalida aprovação anterior |
| POST | `/api/pinterest/pilot/:id/dry-run` | Retorna blockers, payload e fingerprint; não publica/reserva |
| POST | `/api/pinterest/pilot/:id/publish` | Exige `confirmation: PUBLISH_PINTEREST_PIN`, `actorId` e fingerprint revisado |

POSTs Pinterest exigem Origin igual a WEB_ORIGIN. A UI usa proxy no mesmo origin. Boards vêm exclusivamente de GET `/v5/boards`, incluindo todas as páginas; paginação circular/incompleta falha de modo explícito.

## Publicação e idempotência

Guardas cumulativos: ambas as flags, conta conectada e correspondente ao item, capability `create_pin`, item `approved` com aprovação atribuída e datada, produto elegível, preço atual quando exibido, board real, creative pronto, imagem HTTPS PNG/JPEG, destino HTTPS e texto dentro dos limites. A publicação usa o approval/publishing engine existente e revalida o payload antes do envio. O fingerprint impede publicar conteúdo alterado desde o dry-run.

Reserva persistente de Publication antes de POST `/v5/pins`; índices únicos de `queueItemId` e `idempotencyKey` impedem chamadas duplicadas inclusive com processos concorrentes. POST não tem retry HTTP automático. Resposta deve conter ID real; timeout, resultado incerto ou falha de persistência exigem conferência manual. Não há promessa de exactly-once remoto: sem evidência de sucesso, não se inventa publicação nem se reenvia. Não apague reservas para repetir: confira primeiro no Pinterest e reconcilie o registro com evidência real. Workers não fazem essa reconciliação/publicação automaticamente.

## Validação

Testes usam HTTP mockado; os testes do piloto bloqueiam fetch real. Cobertura inclui flags, grants ausentes, identidade ausente, paginação, state concorrente/expirado/provider incorreto, desconexão sem exclusão, bloqueios de publicação, mudança após dry-run e timeout sem reenvio.

Executar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check`, `pnpm smoke`. No Windows sem pnpm global, usar shim Corepack/pnpm.cmd. Smoke exige PostgreSQL e Redis reais locais, mas nunca chama Pinterest. A fase só está validada quando todos os comandos passam; consulte o relato da execução, não interprete esta documentação como comprovação de validação.

Fonte oficial consultada: https://github.com/pinterest/api-description/blob/main/v5/openapi.yaml (OAuth token, user_account, boards, pins; consulta em 2026-09-04).
