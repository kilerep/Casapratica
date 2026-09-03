# CasaPrática OS — regras permanentes

- Agentes não acessam Prisma nem qualquer banco diretamente.
- Agentes não acessam APIs externas diretamente.
- O fluxo obrigatório é `agents → tools → services → repositories/providers`.
- Regras de domínio não dependem de plataformas externas.
- Não criar, completar ou inferir dados externos ausentes.
- Não armazenar senhas de Pinterest, Facebook ou Mercado Livre.
- Secrets nunca entram no Git, em mensagens ou em logs.
- Tokens devem ser obtidos por OAuth oficial quando disponível e criptografados em repouso.
- Ações externas exigem confirmação real; sucesso nunca pode ser presumido.
- Toda publicação passa pelo approval engine antes do provider do canal.
- Não usar scraping frágil quando houver API oficial adequada.
- Executar lint, typecheck, testes e build antes de concluir uma fase e relatar resultados reais.
- Preservar código funcional e evitar abstrações ou serviços distribuídos prematuros.
