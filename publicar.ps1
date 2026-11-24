# Publica la app en GitHub Pages y hace que todas las pestañas abiertas se actualicen.
# Sube el número de versión (index.html, sw.js, version.json), hace commit y push a main y gh-pages.
# Uso:  powershell -ExecutionPolicy Bypass -File publicar.ps1 "Datos semana 41"
#       agrega -Prueba para ver qué cambiaría sin tocar nada.
param([string]$Mensaje = "Actualizar Comité APS", [switch]$Prueba)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$env:GIT_TERMINAL_PROMPT = '0'

# Con el publicador en línea (publicador/worker.js) otros usuarios publican directo en GitHub: antes de subir la
# versión se traen esos commits. js/datos.js (que servidor.ps1 acaba de escribir ya mezclado con lo publicado) se
# conserva tal cual; si hay otros cambios sin commit se guardan aparte (stash) y se vuelven a poner.
if (-not $Prueba) {
  git fetch -q origin
  if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar GitHub (git fetch)." }
  $atras = [int](git rev-list --count HEAD..origin/main)
  if ($atras -gt 0) {
    Write-Host "Trayendo $atras publicación(es) hechas desde otros equipos"
    $datos = Join-Path $PSScriptRoot 'js\datos.js'; $tmp = [IO.Path]::GetTempFileName()
    $conDatos = [bool](git status --porcelain -- js/datos.js)
    if ($conDatos) { Copy-Item $datos $tmp -Force; git checkout -q -- js/datos.js }
    $marca = "publicar-auto-$(Get-Date -Format yyyyMMddHHmmss)"
    git stash push -q --include-untracked -m $marca
    $guardado = [bool]((git stash list) -match $marca)
    $ErrorActionPreference = 'Continue'
    git rebase -q origin/main
    $okRebase = $LASTEXITCODE -eq 0
    if (-not $okRebase) { git rebase --abort }
    if ($guardado) { git stash pop -q; if ($LASTEXITCODE -ne 0) { $ErrorActionPreference = 'Stop'; throw "Conflicto al reponer cambios locales (quedan en git stash: $marca)." } }
    $ErrorActionPreference = 'Stop'
    if ($conDatos) { Copy-Item $tmp $datos -Force }
    Remove-Item $tmp -ErrorAction SilentlyContinue
    if (-not $okRebase) { throw "No se pudo traer lo publicado desde otros equipos (git rebase)." }
  }
}

$actual = [int]((Get-Content version.json -Raw | ConvertFrom-Json).version)
$nueva = $actual + 1
Write-Host "Versión $actual -> $nueva"

$cambios = @{
  'index.html' = @(@("\?v=$actual`"", "?v=$nueva`""), @("name=`"app-version`" content=`"$actual`"", "name=`"app-version`" content=`"$nueva`""))
  'sw.js'      = @(@("\?v=$actual'", "?v=$nueva'"), @("comite-aps-v$actual'", "comite-aps-v$nueva'"))
}
foreach ($archivo in $cambios.Keys) {
  $texto = [IO.File]::ReadAllText((Join-Path $PSScriptRoot $archivo))
  foreach ($par in $cambios[$archivo]) {
    if ($texto -notmatch $par[0]) { throw "No se encontró '$($par[0])' en $archivo; revisa la versión." }
    $texto = $texto -replace $par[0], $par[1]
  }
  if ($Prueba) { Write-Host "  $archivo se actualizaría" } else { [IO.File]::WriteAllText((Join-Path $PSScriptRoot $archivo), $texto, $utf8) }
}
if ($Prueba) { Write-Host "  version.json -> $nueva"; exit 0 }
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'version.json'), "{ `"version`": `"$nueva`" }`n", $utf8)

git add -A
git commit -m "$Mensaje (v$nueva)"
if ($LASTEXITCODE -ne 0) { throw "El commit falló." }
git push origin main main:gh-pages
if ($LASTEXITCODE -ne 0) { throw "El push falló." }
Write-Host "Publicado v$nueva. GitHub Pages tarda 1-2 minutos; las pestañas abiertas se actualizan solas."
