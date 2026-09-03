# Segurança

- Secrets são fornecidos pelo ambiente e nunca versionados ou registrados.
- Senhas de plataformas não são coletadas nem armazenadas.
- OAuth oficial será usado quando disponível.
- Tokens serão criptografados em repouso, com chaves fora do banco.
- Logs estruturados usam listas de campos permitidos e redaction de credenciais.
- Ações externas precisam de confirmação do provider; publicação exige approval engine.
- Acesso ao banco ocorre somente por repositories.
