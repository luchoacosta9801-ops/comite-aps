# Servidor local mínimo para abrir la app en http://localhost:8080
# (necesario para instalarla como aplicación y usarla sin internet).
# Uso: clic derecho > "Ejecutar con PowerShell", o:  powershell -ExecutionPolicy Bypass -File servidor.ps1
param([int]$Puerto = 8080)

$raiz = $PSScriptRoot
$tipos = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml'; '.png'='image/png'
}
$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:$Puerto/")
$http.Start()
Write-Host "Comité APS disponible en http://localhost:$Puerto  (Ctrl+C para detener)"
if (-not $env:NO_ABRIR) { Start-Process "http://localhost:$Puerto/" }

while ($http.IsListening) {
  $ctx = $http.GetContext()
  $ruta = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if (-not $ruta) { $ruta = 'index.html' }
  $archivo = [IO.Path]::GetFullPath((Join-Path $raiz $ruta))
  $res = $ctx.Response
  if ($archivo.StartsWith($raiz) -and (Test-Path $archivo -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($archivo)
    $ext = [IO.Path]::GetExtension($archivo).ToLower()
    $res.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
    $res.Headers.Add('Cache-Control', 'no-cache')
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $res.StatusCode = 404
  }
  $res.Close()
}
