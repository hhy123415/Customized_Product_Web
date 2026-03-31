$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

docker compose -f "$root\docker-compose.yml" down
docker compose -f "$root\dify_official\docker\docker-compose.yaml" -f "$root\dify_official\docker\docker-compose.override.yaml" down
