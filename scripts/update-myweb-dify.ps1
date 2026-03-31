$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$networkName = "myweb-dify-net"
$difyDockerDir = Join-Path $root "dify_official\docker"
$difyCompose = Join-Path $difyDockerDir "docker-compose.yaml"
$difyOverride = Join-Path $difyDockerDir "docker-compose.override.yaml"
$difyEnv = Join-Path $difyDockerDir ".env"
$difyEnvExample = Join-Path $difyDockerDir ".env.example"
$mywebCompose = Join-Path $root "docker-compose.yml"

$networkExists = docker network ls --format "{{.Name}}" | Select-String -Pattern "^$networkName$" -Quiet
if (-not $networkExists) {
  docker network create $networkName | Out-Null
}

if (-not (Test-Path $difyEnv)) {
  if (-not (Test-Path $difyEnvExample)) {
    throw "Dify .env.example not found: $difyEnvExample"
  }

  Copy-Item $difyEnvExample $difyEnv
  Write-Host "Created Dify env file from template: $difyEnv"
}

$difyComposeArgs = @("-f", $difyCompose)
if (Test-Path $difyOverride) {
  $difyComposeArgs += @("-f", $difyOverride)
}

docker compose @difyComposeArgs pull
docker compose @difyComposeArgs up -d

docker compose -f $mywebCompose pull postgres
docker compose -f $mywebCompose up -d --build
