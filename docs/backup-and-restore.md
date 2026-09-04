# Backup e restore local

Com Docker ativo, execute `powershell -File scripts/backup-dev.ps1`. O dump não deve ser commitado. Para validar uma restauração isolada: `powershell -File scripts/restore-dev.ps1 -Input backup-dev.dump`. O destino padrão é `casapratica_restore_test`; confirme a leitura com `DATABASE_URL=postgresql://casapratica:change-me-local-only@localhost:5432/casapratica_restore_test npx pnpm@latest --filter @casapratica/database exec prisma migrate status`.

Os scripts são deliberadamente apenas para desenvolvimento e nunca sobrescrevem `casapratica` no restore padrão.
