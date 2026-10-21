# Arranca servidor.ps1 en segundo plano y lo vuelve a abrir si se cierra o se cae.
# Lo usa el acceso directo "Servidor Comite APS" de la carpeta Inicio de Windows.
$env:NO_ABRIR = '1'
$log = Join-Path $env:TEMP 'comite-servidor.log'
while ($true) {
  # Si ya hay uno respondiendo (abierto a mano), no se abre otro
  $vivo = $false
  try { $vivo = (Invoke-WebRequest -UseBasicParsing 'http://localhost:8080/api/estado' -TimeoutSec 5).StatusCode -eq 200 } catch {}
  if (-not $vivo) {
    "$(Get-Date -Format s) iniciando servidor" | Out-File $log -Append -Encoding utf8
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'servidor.ps1') *>> $log
    "$(Get-Date -Format s) el servidor se cerrÃ³; se reinicia en 10 s" | Out-File $log -Append -Encoding utf8
  }
  Start-Sleep 10
}
