# Compatibilidade das integrações

Esta auditoria prepara contratos para conexão futura. Publicação real e importação real de métricas permanecem desligadas por padrão. Nenhum teste desta fase chama APIs externas.

## Matriz

| Provider | Autenticação | Permissões/scopes mínimos configurados | Capabilities internas | Limitações atuais |
| --- | --- | --- | --- | --- |
| Mercado Livre | OAuth 2.0, refresh token | `offline_access`, `read` | `search_product`, `read_product`, `seller_info`; geração de afiliado marcada como não suportada | Consultas unitárias; não usa multiget antigo. Comissão ausente permanece `null`. |
| Pinterest | OAuth 2.0 | `user_accounts:read`, `boards:read`, `pins:read`, `pins:write` | `read_account`, `read_boards`, `read_pins`, `create_pin`; `write_boards` e analytics preparados mas não suportados | `create_pin` exige flag real, desligada. Criação de boards e importação de analytics não implementadas. |
| Meta/Facebook | OAuth 2.0 | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights` | `read_pages`, `read_page_content`, `create_post`, `read_insights` | `create_post` exige flag real, desligada. `create_comment` não existe; links em comentário continuam `MANUAL_REQUIRED`. |

OAuth permissions e capabilities internas são conceitos separados. Uma capability só fica disponível quando o token é validado, o scope foi concedido, o provider implementa a operação e a feature flag aplicável está habilitada.

## Endpoints Mercado Livre

A busca usa `/sites/{site}/search`, itens unitários usam `/items/{id}` e vendedores unitários usam `/users/{id}`. Não foram encontrados `/items?ids=` ou `/users?ids=`. Como não há multiget, não foi necessária migração para `/items/bulk?ids=` ou `/users/bulk?ids=`.

Sinais como reputação, loja oficial, MercadoLíder e destaque são normalizados somente quando presentes na resposta. Campos ausentes permanecem `null` e são listados em `missingFields`.

## Tokens e segurança

Access token e refresh token são criptografados antes da persistência e gravados juntos por uma única operação do repositório. Na rotação, ambos são atualizados em conjunto; se o provider não devolver um novo refresh token, o anterior é mantido. Capabilities são recalculadas após refresh.

Tokens não fazem parte dos DTOs públicos, não são enviados ao frontend ou aos agents e chaves sensíveis são redigidas. O callback consome state armazenado uma única vez, valida provider e expiração e recupera o verifier criptografado.

## HTTP, erros e rate limit

O cliente compartilhado aplica timeout de 10 segundos, retry exponencial limitado somente para GET em falhas transitórias e no máximo duas repetições. Não há retry automático de POST/DELETE.

Erros normalizados: `AUTH_EXPIRED`, `AUTH_INVALID`, `CAPABILITY_MISSING`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `INVALID_REQUEST`, `NOT_FOUND`, `TIMEOUT` e `UNKNOWN_PROVIDER_ERROR`. Corpo bruto do provider não é anexado ao erro.

O `RateLimitGuard` interpreta `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset` e `retry-after`, mantendo estados `NORMAL`, `LOW` e `EXHAUSTED`. Chamadas não essenciais são bloqueadas quando o limite está baixo ou esgotado. O snapshot pode alimentar alertas operacionais sem loops de polling.

## Ambientes e flags

`INTEGRATION_MODE` aceita `TEST`, `SANDBOX` ou `PRODUCTION` e usa `TEST` por padrão. O provider fake somente pode ser habilitado fora de `NODE_ENV=production` e fora de `INTEGRATION_MODE=PRODUCTION`.

Defaults seguros:

- `ENABLE_REAL_PINTEREST_PUBLISHING=false`
- `ENABLE_REAL_FACEBOOK_PUBLISHING=false`
- `ENABLE_AUTOPILOT=false`
- `ENABLE_REAL_METRICS_IMPORT=false`
- `ENABLE_TEST_PUBLISHING_PROVIDER=false`

Antes da primeira integração real ainda serão necessários cadastro e aprovação dos aplicativos, redirect URIs oficiais, credenciais em secret manager, revisão dos termos vigentes, confirmação do tier/rate limits, testes no sandbox de cada plataforma e um rollout controlado das flags.
