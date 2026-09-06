# Callback HTTPS público do Mercado Livre

## Decisão

Use um domínio de desenvolvimento estático do ngrok para encaminhar HTTPS exclusivamente à API local em `127.0.0.1:3001`. O Postgres e o Redis continuam locais e não recebem portas públicas. O hostname público é restringido pela API a `GET /health` e `/api/integrations/mercadolivre/*`; as demais rotas retornam 404 nesse hostname.

O domínio atribuído pela conta ngrok é estável, por exemplo `nome-atribuido.ngrok-free.app`. Não use um endereço aleatório. O authtoken fica apenas no ambiente local e nunca no Git. A inspeção/replay de tráfego do agente fica desabilitada para que o authorization code do callback não seja capturado pelo inspetor.

## Ambientes

Local, sem túnel:

```env
WEB_ORIGIN=http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
MERCADOLIVRE_REDIRECT_URI=http://127.0.0.1:3001/api/integrations/mercadolivre/callback
OAUTH_PUBLIC_HOST=
```

OAuth real:

```env
WEB_ORIGIN=https://casapratica-web.vercel.app
NEXT_PUBLIC_API_URL=https://SEU-DOMINIO-ATRIBUIDO.ngrok-free.app
MERCADOLIVRE_REDIRECT_URI=https://SEU-DOMINIO-ATRIBUIDO.ngrok-free.app/api/integrations/mercadolivre/callback
OAUTH_PUBLIC_HOST=SEU-DOMINIO-ATRIBUIDO.ngrok-free.app
NGROK_DOMAIN=SEU-DOMINIO-ATRIBUIDO.ngrok-free.app
NGROK_AUTHTOKEN=defina-fora-do-git
ENABLE_MERCADOLIVRE_INTEGRATION=true
```

`MERCADOLIVRE_CLIENT_ID`, `MERCADOLIVRE_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `DATABASE_URL` e `DEFAULT_WORKSPACE_ID` continuam exclusivos do processo da API.

## Inicialização e validação

1. Inicie Postgres, Redis e a API normalmente.
2. Somente se quiser testar OAuth futuro, use o arquivo totalmente separado: `docker compose -f infra/docker-compose.oauth.yml --profile oauth-tunnel up -d oauth-tunnel`.
3. Confirme `https://SEU-DOMINIO-ATRIBUIDO.ngrok-free.app/health`; deve retornar `{"status":"ok"}`.
4. Confirme que `/api/products/review` no mesmo hostname retorna 404.
5. Abra `/integrations` na Vercel e confirme que conectar redireciona ao domínio oficial `auth.mercadolivre.com.br` com a redirect URI HTTPS exata.
6. Não conclua a autorização até a janela de teste real planejada.

O cookie de vínculo OAuth recebe `Secure` porque a redirect URI é HTTPS. `HttpOnly`, `SameSite=Lax`, state de uso único, PKCE e proteção de Origin permanecem ativos.

## Mercado Livre Developers

Cadastre exatamente a mesma `MERCADOLIVRE_REDIRECT_URI` no aplicativo, sem barra final adicional. Salve as alterações, confira Client ID/Secret somente no servidor e não execute OAuth antes de a API, o banco e o túnel estarem ativos.
