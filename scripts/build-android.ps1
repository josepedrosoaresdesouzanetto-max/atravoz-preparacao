$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Configure JAVA_HOME (JDK 21) e ANDROID_HOME (SDK com plataformas/build-tools 36 e 35).' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.local/android-debug.keystore'))) { throw 'Prepare ou restaure a chave de desenvolvimento conforme docs/INSTALLATION_PHASE.md.' }
Push-Location $projectRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Build web falhou' }
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw 'Sincronização Android falhou' }
  & ./android/gradlew.bat -p android --no-daemon assembleDebug testDebugUnitTest
  if ($LASTEXITCODE -ne 0) { throw 'Compilação ou testes nativos falharam' }
  & "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --verbose --print-certs android/app/build/outputs/apk/debug/app-debug.apk
  if ($LASTEXITCODE -ne 0) { throw 'Assinatura APK inválida' }
} finally { Pop-Location }
