$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$networkName = "myweb-dify-net"

$networkExists = docker network ls --format "{{.Name}}" | Select-String -Pattern "^$networkName$" -Quiet
if (-not $networkExists) {
  docker network create $networkName | Out-Null
}

docker compose -f "$root\dify_official\docker\docker-compose.yaml" -f "$root\dify_official\docker\docker-compose.override.yaml" up -d
docker compose -f "$root\docker-compose.yml" up -d --build
