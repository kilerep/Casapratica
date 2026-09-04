# Storage audit

Medição local em 2026-09-04. Os números incluem artefatos gerados dentro de `apps` e `packages`.

| Categoria | Tamanho aproximado | Classe |
|---|---:|---|
| `apps` | 84,51 MiB | SOURCE + REGENERABLE (`.next`) |
| `packages` | 39,14 MiB | SOURCE + REGENERABLE (`dist`) |
| `node_modules` | 2.368,78 MiB | REGENERABLE / SHOULD_NOT_BE_COMMITTED |
| `.turbo` | 3,22 MiB | CACHE / SHOULD_NOT_BE_COMMITTED |
| `.git` | 0,71 MiB | REPOSITORY_METADATA |
| `var` | 0,16 MiB | RUNTIME_DATA / SHOULD_NOT_BE_COMMITTED |
| `coverage` | 0 MiB | REGENERABLE |

`node_modules`, `.next`, `dist`, coverage, logs, `.turbo`, `.vitest-temp`, `*.tsbuildinfo`, dumps e criativos renderizados estão ignorados. Fixtures pequenas e determinísticas permanecem versionadas. Nada foi apagado automaticamente.
