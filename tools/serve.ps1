# discover.me — Server local minimal (PowerShell, fără nimic de instalat). Pornit de porneste.bat.
# Aplicația trebuie deschisă prin http://localhost, nu direct din folder (file://): browserul nu lasă paginile să citească modelele locale.
param([int]$Port = 8080, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.wasm' = 'application/wasm'; '.onnx' = 'application/octet-stream'; '.bin' = 'application/octet-stream'; '.txt' = 'text/plain; charset=utf-8'
}
$listener = $null
foreach ($p in $Port..($Port + 9)) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $Port = $p; break } catch { $l.Close() }
}
if (-not $listener) { Write-Host "Nu am gasit un port liber ($Port...$($Port + 9))." -ForegroundColor Red; exit 1 }
$url = "http://localhost:$Port/"
Write-Host "discover.me ruleaza la $url" -ForegroundColor Green
Write-Host "Lasa aceasta fereastra deschisa cat folosesti aplicatia. Inchide-o (sau Ctrl+C) ca sa opresti serverul."
if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  $ctx = $listener.GetContext(); $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    # nimic în afara folderului aplicației
    if (-not $file.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar) -and $file -ne $root) { $res.StatusCode = 403 }
    elseif (Test-Path -LiteralPath $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else { $res.StatusCode = 404 }
  } catch { try { $res.StatusCode = 500 } catch { } }
  finally { try { $res.Close() } catch { } }
}
