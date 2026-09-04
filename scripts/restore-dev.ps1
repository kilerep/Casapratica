param(
  [Parameter(Mandatory=$true)][Alias("Input")][string]$BackupPath,
  [string]$Database="casapratica_restore_test"
)
$ErrorActionPreference="Stop"
if(-not (Test-Path -LiteralPath $BackupPath)){throw "Backup não encontrado"}
docker compose -f infra/docker-compose.yml exec -T postgres dropdb -U casapratica --if-exists $Database
docker compose -f infra/docker-compose.yml exec -T postgres createdb -U casapratica $Database
docker compose -f infra/docker-compose.yml cp $BackupPath postgres:/tmp/casapratica-restore.dump
docker compose -f infra/docker-compose.yml exec -T postgres pg_restore -U casapratica -d $Database --no-owner /tmp/casapratica-restore.dump
Write-Output "Restore concluído em $Database"
