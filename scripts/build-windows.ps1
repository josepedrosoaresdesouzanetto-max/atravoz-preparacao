$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$buildRoot = Join-Path $projectRoot 'runtime/windows-build'
Push-Location $projectRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Build da interface falhou' }
  & .venv/Scripts/python.exe -m PyInstaller --noconfirm --onedir --windowed --name ATRAVOZ-Central --paths services/api --paths services/intelligence/src --collect-submodules app --collect-submodules intelligence --collect-submodules uvicorn --collect-submodules jwcrypto --add-data "$projectRoot/dist;dist" --add-data "$projectRoot/scripts/transcribe_local.py;scripts" --distpath "$buildRoot/dist" --workpath "$buildRoot/build" --specpath "$buildRoot" scripts/central_desktop.py
  if ($LASTEXITCODE -ne 0) { throw 'Empacotamento Windows falhou' }
  Write-Output "$buildRoot/dist/ATRAVOZ-Central/ATRAVOZ-Central.exe"
} finally { Pop-Location }
