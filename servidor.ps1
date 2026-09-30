# Servidor local del Comité APS en http://localhost:8080
# Desde aquí (y solo aquí) se editan los datos y se publican para todos en GitHub Pages.
# Uso: clic derecho > "Ejecutar con PowerShell", o:  powershell -ExecutionPolicy Bypass -File servidor.ps1
param([int]$Puerto = 8080)

$raiz = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$tipos = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml'; '.png'='image/png'
}

function Responder($res, [int]$codigo, $obj) {
  $res.StatusCode = $codigo
  $res.ContentType = 'application/json; charset=utf-8'
  $bytes = $utf8.GetBytes(($obj | ConvertTo-Json -Compress))
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

# POST /api/publicar  { contenido: "<js/datos.js>", mensaje: "...", publicar: true|false }
# Solo acepta peticiones de la propia app (mismo origen + cabecera X-Comite),
# así ninguna otra página abierta en el navegador puede usarlo.
function Publicar($ctx) {
  $req = $ctx.Request
  $origen = $req.Headers['Origin']
  if ($req.Headers['X-Comite'] -ne '1' -or ($origen -and $origen -ne "http://localhost:$Puerto")) {
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
  $salida = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $raiz 'publicar.ps1') $mensaje 2>&1 | Out-String
  $ok = $LASTEXITCODE -eq 0
  Responder $ctx.Response ($(if ($ok) { 200 } else { 500 })) @{ ok = $ok; salida = $salida }
}

$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:$Puerto/")
$http.Start()
Write-Host "Comité APS disponible en http://localhost:$Puerto  (Ctrl+C para detener)"
if (-not $env:NO_ABRIR) { Start-Process "http://localhost:$Puerto/" }

while ($http.IsListening) {
  $ctx = $http.GetContext()
  $res = $ctx.Response
  try {
    $ruta = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($ruta -eq 'api/estado') {
      Responder $res 200 @{ ok = $true; edicion = $true }
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
