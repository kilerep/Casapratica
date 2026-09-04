param([string]$Output="backup-dev.dump")
$ErrorActionPreference="Stop"
docker compose -f infra/docker-compose.yml exec -T postgres pg_dump -U casapratica -d casapratica -Fc --file=/tmp/casapratica.dump
docker compose -f infra/docker-compose.yml cp postgres:/tmp/casapratica.dump $Output
Write-Output "Backup criado em $Output"
