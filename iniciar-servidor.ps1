# Arranca servidor.ps1 en segundo plano y lo vigila (lo usa el acceso "Servidor Comite APS" de la carpeta Inicio).
# Cada 20 s pregunta /api/estado: si el servidor se cerro, o si sigue abierto pero no responde 3 veces seguidas
# (se trabo), lo cierra y lo vuelve a abrir. Antes solo se reabria si se cerraba, y un servidor trabado dejaba la
# pagina sin poder traer los Excel (paso el 16 nov 2026).
# Registro: %TEMP%\comite-servidor.log (arranques y reinicios) y %TEMP%\comite-servidor-salida.log (pedidos).
$env:NO_ABRIR = '1'
$log = Join-Path $env:TEMP 'comite-servidor.log'
$salida = Join-Path $env:TEMP 'comite-servidor-salida.log'
$servidor = Join-Path $PSScriptRoot 'servidor.ps1'
function Anotar($t) { "$(Get-Date -Format s) $t" | Out-File $log -Append -Encoding utf8 }
function Vivo { try { (Invoke-WebRequest -UseBasicParsing 'http://localhost:8080/api/estado' -TimeoutSec 8).StatusCode -eq 200 } catch { $false } }
# Cada ~2 min trae lo que otros publicaron con el publicador en línea (solo avance rápido, sin tocar cambios
# locales: si js/datos.js tiene cambios sin publicar o algo choca, no hace nada y lo resuelve publicar.ps1)
$env:GIT_TERMINAL_PROMPT = '0'
function Traer {
  try {
    Push-Location $PSScriptRoot
    git fetch -q origin 2>$null
    if ($LASTEXITCODE -eq 0 -and [int](git rev-list --count HEAD..origin/main) -gt 0 -and -not (git status --porcelain -- js/datos.js)) {
      git merge -q --ff-only origin/main 2>$null
      if ($LASTEXITCODE -eq 0) { Anotar 'trajo publicaciones de otros equipos' }
    }
  } catch {} finally { Pop-Location }
}
$proc = $null; $fallas = 0; $vuelta = 0
while ($true) {
  if (($vuelta++ % 6) -eq 0) { Traer }
  if (Vivo) { $fallas = 0 }
  else {
    $fallas++
    $cerrado = (-not $proc) -or $proc.HasExited
    if (($cerrado -and $fallas -ge 1) -or $fallas -ge 3) {
      if ($proc -and -not $proc.HasExited) { Anotar 'el servidor no responde: se cierra y se reinicia' }
      # Cierra cualquier servidor.ps1 trabado (tambien uno abierto antes que este vigilante)
      Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
        Where-Object { $_.CommandLine -match 'servidor\.ps1' -and $_.CommandLine -notmatch 'iniciar-servidor' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      Start-Sleep 2
      Anotar 'iniciando servidor'
      $proc = Start-Process powershell -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$servidor`"" `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $salida -RedirectStandardError "$salida.err"
      $fallas = 0
      Start-Sleep 8
    }
  }
  Start-Sleep 20
}
