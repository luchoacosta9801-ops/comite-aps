# Publica la app en GitHub Pages y hace que todas las pestañas abiertas se actualicen.
# Sube el número de versión (index.html, sw.js, version.json), hace commit y push a main y gh-pages.
# Uso:  powershell -ExecutionPolicy Bypass -File publicar.ps1 "Datos semana 41"
#       agrega -Prueba para ver qué cambiaría sin tocar nada.
param([string]$Mensaje = "Actualizar Comité APS", [switch]$Prueba)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

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
