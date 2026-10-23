# Servidor local del Comité APS en http://localhost:8080
# Desde aquí (y solo aquí) se editan los datos y se publican para todos en GitHub Pages.
# Uso: clic derecho > "Ejecutar con PowerShell", o:  powershell -ExecutionPolicy Bypass -File servidor.ps1
param([int]$Puerto = 8080)

$raiz = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$tipos = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'; '.mp4'='video/mp4'
}

function Responder($res, [int]$codigo, $obj) {
  $res.StatusCode = $codigo
  $res.ContentType = 'application/json; charset=utf-8'
  $bytes = $utf8.GetBytes(($obj | ConvertTo-Json -Compress))
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# Solo la propia app puede usar la API: la local y la publicada en GitHub Pages
# (donde el administrador activó el editor). Ninguna otra página del navegador.
$permitidos = @("http://localhost:$Puerto", 'https://luchoacosta9801-ops.github.io')

function Cors($ctx) {
  $origen = $ctx.Request.Headers['Origin']
  if ($origen -and $permitidos -contains $origen) {
    $h = $ctx.Response.Headers
    $h.Add('Access-Control-Allow-Origin', $origen)
    $h.Add('Vary', 'Origin')
    $h.Add('Access-Control-Allow-Methods', 'GET, POST')
    $h.Add('Access-Control-Allow-Headers', 'Content-Type, X-Comite')
    $h.Add('Access-Control-Allow-Private-Network', 'true')   # Chrome: página pública -> localhost
    $h.Add('Access-Control-Max-Age', '600')
  }
}

# POST /api/publicar  { contenido: "<js/datos.js>", mensaje: "...", publicar: true|false }
# Exige la cabecera X-Comite (fuerza la verificación CORS del navegador) y un origen permitido.
function Publicar($ctx) {
  $req = $ctx.Request
  $origen = $req.Headers['Origin']
  if ($req.Headers['X-Comite'] -ne '1' -or ($origen -and $permitidos -notcontains $origen)) {
    return Responder $ctx.Response 403 @{ ok = $false; error = 'Origen no permitido' }
  }
  $lector = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
  $datos = $lector.ReadToEnd() | ConvertFrom-Json
  $contenido = [string]$datos.contenido
  if (-not $contenido.Contains('const SEED = {') -or $contenido.Length -lt 200) {
    return Responder $ctx.Response 400 @{ ok = $false; error = 'Contenido de datos no válido' }
  }
  [IO.File]::WriteAllText((Join-Path $raiz 'js\datos.js'), $contenido, $utf8)
  if (-not $datos.publicar) { return Responder $ctx.Response 200 @{ ok = $true; salida = 'Guardado en js/datos.js' } }

  $mensaje = if ($datos.mensaje) { [string]$datos.mensaje } else { 'Actualizar datos' }
  # publicar.ps1 en un proceso aparte con límite de tiempo: si git se queda esperando (red, credenciales),
  # se corta y el servidor sigue atendiendo (antes se quedaba trabado).
  $psi = New-Object Diagnostics.ProcessStartInfo 'powershell.exe'
  $psi.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $raiz 'publicar.ps1') + '" "' + $mensaje.Replace('"', "'") + '"'
  $psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.CreateNoWindow = $true
  $psi.WorkingDirectory = $raiz
  $psi.EnvironmentVariables['GIT_TERMINAL_PROMPT'] = '0'
  $p = [Diagnostics.Process]::Start($psi)
  $out = $p.StandardOutput.ReadToEndAsync(); $err = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit(150000)) {
    & taskkill /T /F /PID $p.Id 2>$null | Out-Null
    return Responder $ctx.Response 504 @{ ok = $false; error = 'GitHub no respondió a tiempo (¿sin internet?). Los datos quedaron guardados en tu PC; vuelve a intentar Publicar en un momento.' }
  }
  $salida = $out.Result + $err.Result
  $ok = $p.ExitCode -eq 0
  Responder $ctx.Response ($(if ($ok) { 200 } else { 500 })) @{ ok = $ok; salida = $salida }
}

# GET /api/maestro: el maestro de suertes más reciente de Documents\COMITE APS\MAESTRO (para autocompletar
# al agregar suertes). Solo para la app (X-Comite + origen permitido); el archivo nunca se sube a GitHub.
$carpetaMaestro = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'COMITE APS\MAESTRO'
function Maestro($ctx) {
  $req = $ctx.Request; $res = $ctx.Response
  $origen = $req.Headers['Origin']
  if ($req.Headers['X-Comite'] -ne '1' -or ($origen -and $permitidos -notcontains $origen)) {
    return Responder $res 403 @{ ok = $false; error = 'Origen no permitido' }
  }
  $f = Get-ChildItem -Path $carpetaMaestro -Filter '*.xls*' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '~$*' -and $_.Name -match 'maestro' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $f) { $f = Get-Item (Join-Path $raiz '_privado\maestro.xlsx') -ErrorAction SilentlyContinue }
  if (-not $f) { return Responder $res 404 @{ ok = $false; error = 'No encontré el maestro' } }
  # ?info=1: solo nombre y fecha (para no descargar 4 MB si ya se tiene ese mismo archivo)
  if ($req.QueryString['info']) { return Responder $res 200 @{ ok = $true; archivo = $f.Name; fecha = $f.LastWriteTime.ToString('s') } }
  # Copia temporal por si el Excel está abierto
  $tmp = [IO.Path]::GetTempFileName(); Copy-Item $f.FullName $tmp -Force
  $bytes = [IO.File]::ReadAllBytes($tmp); Remove-Item $tmp -ErrorAction SilentlyContinue
  $res.ContentType = 'application/octet-stream'
  $res.Headers.Add('X-Archivo', [Uri]::EscapeDataString($f.Name))
  $res.Headers.Add('X-Fecha', $f.LastWriteTime.ToString('s'))
  $res.Headers.Add('Access-Control-Expose-Headers', 'X-Archivo, X-Fecha')
  $res.Headers.Add('Cache-Control', 'no-store')
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# GET /api/freatico: lecturas de los pozos de observación desde el Excel más reciente de
# Documents\SIG\LECTURA NIVEL FREATICO (lo resume freatico.ps1; copia en _privado\freatico.json).
# ?info=1: solo nombre y fecha del archivo.
$carpetaFreatico = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'SIG\LECTURA NIVEL FREATICO'
function Freatico($ctx) {
  $req = $ctx.Request; $res = $ctx.Response
  $origen = $req.Headers['Origin']
  if ($req.Headers['X-Comite'] -ne '1' -or ($origen -and $permitidos -notcontains $origen)) {
    return Responder $res 403 @{ ok = $false; error = 'Origen no permitido' }
  }
  $f = Get-ChildItem -Path $carpetaFreatico -Filter '*.xls*' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike '~$*' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $f) { return Responder $res 404 @{ ok = $false; error = "No hay Excel en $carpetaFreatico" } }
  if ($req.QueryString['info']) { return Responder $res 200 @{ ok = $true; archivo = $f.Name; fecha = $f.LastWriteTime.ToString('s') } }
  $cache = Join-Path $raiz '_privado\freatico.json'
  $marca = "$cache.origen"
  $firma = "$($f.FullName)|$($f.LastWriteTime.Ticks)|$($f.Length)"
  if (-not (Test-Path $cache) -or -not (Test-Path $marca) -or (Get-Content $marca -Raw).Trim() -ne $firma) {
    $null = New-Item -ItemType Directory -Force (Split-Path $cache)
    $psi = New-Object Diagnostics.ProcessStartInfo 'powershell.exe'
    $psi.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $raiz 'freatico.ps1') + '" -Archivo "' + $f.FullName + '" -Salida "' + $cache + '"'
    $psi.UseShellExecute = $false; $psi.RedirectStandardError = $true; $psi.RedirectStandardOutput = $true; $psi.CreateNoWindow = $true
    $p = [Diagnostics.Process]::Start($psi)
    $err = $p.StandardError.ReadToEndAsync(); $null = $p.StandardOutput.ReadToEndAsync()
    if (-not $p.WaitForExit(120000)) { & taskkill /T /F /PID $p.Id 2>$null | Out-Null; return Responder $res 504 @{ ok = $false; error = 'Leer el Excel tardó demasiado' } }
    if ($p.ExitCode -ne 0 -or -not (Test-Path $cache)) { return Responder $res 500 @{ ok = $false; error = "No se pudo leer el Excel: $($err.Result)" } }
    [IO.File]::WriteAllText($marca, $firma, $utf8)
  }
  $bytes = [IO.File]::ReadAllBytes($cache)
  $res.ContentType = 'application/json; charset=utf-8'
  $res.Headers.Add('Cache-Control', 'no-store')
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:$Puerto/")
$http.Start()
# Que una conexión detenida (pestaña que no termina de recibir) no deje trabado el servidor
try {
  $http.TimeoutManager.IdleConnection = [TimeSpan]::FromSeconds(30)
  $http.TimeoutManager.EntityBody = [TimeSpan]::FromSeconds(30)
  $http.TimeoutManager.MinSendBytesPerSecond = 20000
} catch {}
Write-Host "Comité APS disponible en http://localhost:$Puerto  (Ctrl+C para detener)"
if (-not $env:NO_ABRIR) { Start-Process "http://localhost:$Puerto/" }

while ($http.IsListening) {
  $ctx = $http.GetContext()
  $res = $ctx.Response
  try {
    $ruta = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($ruta.StartsWith('api/')) { Cors $ctx }
    if ($ruta.StartsWith('api/') -and $ctx.Request.HttpMethod -eq 'OPTIONS') {
      $res.StatusCode = 204
    } elseif ($ruta -eq 'api/estado') {
      Responder $res 200 @{ ok = $true; edicion = $true }
    } elseif ($ruta -eq 'api/maestro') {
      Maestro $ctx
    } elseif ($ruta -eq 'api/freatico') {
      Freatico $ctx
    } elseif ($ruta -eq 'api/publicar' -and $ctx.Request.HttpMethod -eq 'POST') {
      Publicar $ctx
    } else {
      if (-not $ruta) { $ruta = 'index.html' }
      $archivo = [IO.Path]::GetFullPath((Join-Path $raiz $ruta))
      if ($archivo.StartsWith($raiz) -and (Test-Path $archivo -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($archivo)
        $ext = [IO.Path]::GetExtension($archivo).ToLower()
        $res.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
      }
    }
  } catch {
    try { Responder $res 500 @{ ok = $false; error = $_.Exception.Message } } catch {}
  }
  $res.Close()
}
