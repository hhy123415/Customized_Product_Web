$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$difyDockerDir = Join-Path $root "dify_official\docker"
$difyCompose = Join-Path $difyDockerDir "docker-compose.yaml"
$difyOverride = Join-Path $difyDockerDir "docker-compose.override.yaml"
$mywebCompose = Join-Path $root "docker-compose.yml"

$difyComposeArgs = @("-f", $difyCompose)
if (Test-Path $difyOverride) {
  $difyComposeArgs += @("-f", $difyOverride)
}

docker compose -f $mywebCompose down
docker compose @difyComposeArgs down
