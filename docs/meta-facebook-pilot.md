# Piloto Meta/Facebook

O piloto reutiliza `IntegrationService`, OAuth state de uso único, AES-256-GCM, o cliente HTTP central, capabilities, auditoria, fila editorial e reservas de publicação existentes. Não usa senha, cookies de sessão ou automação de navegador.

## Configuração

Defina no servidor `META_CLIENT_ID`, `META_CLIENT_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_API_VERSION` e `INTEGRATION_ENCRYPTION_KEY`. `META_LOGIN_CONFIGURATION_ID` é opcional para Facebook Login for Business. O piloto exige `ENABLE_META_PILOT=true`; publicação real exige também `ENABLE_REAL_FACEBOOK_PUBLISHING=true`. Ambas ficam falsas por padrão.

O redirect cadastrado deve coincidir exatamente com `META_REDIRECT_URI`. O OAuth solicita somente `pages_show_list`, `pages_read_engagement` e `pages_manage_posts`. Grants efetivos, não os solicitados, determinam as capabilities.

## OAuth, Página e tokens

O state é aleatório, persistido como hash, expira em dez minutos e é consumido uma vez. Um cookie HttpOnly, SameSite=Lax e Secure em HTTPS vincula o callback ao navegador. Tokens nunca chegam ao frontend. O token do usuário e o Page Access Token são criptografados separadamente com AES-256-GCM.

`GET /api/facebook/pilot/pages` pagina `/me/accounts`. O operador só pode selecionar um ID devolvido pela Meta. A seleção guarda ID, nome, categoria, tasks e data; trocar Página remove aprovações dependentes e exige nova revisão.

## Dry-run e publicação

O dry-run não chama a Meta. Ele valida integração, Página, capabilities, produto/conteúdo, aprovação humana, creative/HTTPS, destino e texto; devolve blockers, warnings, payload sanitizado, Página e fingerprint. Alterações no item, Página, creative, destino ou aprovação mudam o fingerprint.

Publicação exige as duas flags, capability, item aprovado, fingerprint atual, operador e confirmação literal `PUBLISH_FACEBOOK_PAGE_POST`. Uma reserva única por item/Página/fingerprint é criada antes do POST. POST não recebe retry automático. Resposta ambígua resulta em `reconciliation_required`.

Posts de texto/link usam `/{page-id}/feed`; posts com foto usam `/{page-id}/photos`. O token vai no header Authorization. `create_comment` permanece indisponível; link preparado para comentário é `MANUAL_REQUIRED` e nunca é movido silenciosamente ao corpo.

## Meta Developer Dashboard

Crie/configure o app, escolha Facebook Login ou Facebook Login for Business, cadastre o redirect exato, forneça Política de Privacidade e Termos públicos, configure os domínios e solicite App Review/Advanced Access para as permissões necessárias. Teste primeiro com usuário, Página e papel autorizados no app, em SANDBOX/TEST, mantendo publicação real desligada.

Configure Deauthorization Callback em `/api/integrations/meta/deauthorize` e User Data Deletion URL em `/api/integrations/meta/data-deletion`. Ambos validam o `signed_request` HMAC-SHA256 com o App Secret e desconectam apenas contas Meta cujo identificador externo corresponda ao `user_id`; produtos, conteúdos, analytics e demais integrações não são apagados. A solicitação de exclusão retorna URL de status e código de confirmação opaco.
