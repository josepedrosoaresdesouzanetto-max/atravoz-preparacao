$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  & .venv/Scripts/python.exe -m pytest -q
  if ($LASTEXITCODE -ne 0) { throw 'Testes Python falharam' }
  & .venv/Scripts/python.exe -m ruff check services tests scripts experiments
  if ($LASTEXITCODE -ne 0) { throw 'Ruff falhou' }
  & .venv/Scripts/python.exe scripts/check_contracts.py
  if ($LASTEXITCODE -ne 0) { throw 'Contratos divergentes' }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Testes TypeScript falharam' }
  & npm.cmd run lint
  if ($LASTEXITCODE -ne 0) { throw 'Lint falhou' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Build falhou' }
  & npm.cmd run test:e2e
  if ($LASTEXITCODE -ne 0) { throw 'Testes de navegador falharam' }
  & .venv/Scripts/python.exe scripts/evaluate.py
  if ($LASTEXITCODE -ne 0) { throw 'Avaliação falhou' }
} finally { Pop-Location }
