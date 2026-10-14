$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$frostNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$frostNode = if ($frostNodeCommand) { $frostNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $frostNode)) { throw 'Install Node.js 24 or newer first.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
  $frostPnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  $frostNpm = Get-Command npm -ErrorAction SilentlyContinue
  if ($frostPnpm) { & $frostPnpm.Source install --frozen-lockfile }
  elseif ($frostNpm) { & $frostNpm.Source install }
  else { throw 'Install dependencies with pnpm install, then run this script again.' }
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
Write-Host 'Open http://localhost:3000 (or the PORT in .env). Press Ctrl+C to stop.'
& $frostNode 'server/index.js'
