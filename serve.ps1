$root = $PSScriptRoot
$port = 4176

# try to listen on all interfaces (phones on the same Wi-Fi can connect);
# falls back to localhost-only if the urlacl reservation is missing
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$port/")
try {
  $listener.Start()
  Write-Host "Serving $root on ALL interfaces, port $port"
} catch {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$port/")
  $listener.Prefixes.Add("http://127.0.0.1:$port/")
  $listener.Start()
  Write-Host "Serving $root at http://localhost:$port/ (localhost only)"
}

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".mjs"  = "text/javascript; charset=utf-8"
  ".json" = "application/json"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".ico"  = "image/x-icon"
  ".woff" = "font/woff"
  ".woff2" = "font/woff2"
  ".stl"  = "application/octet-stream"
  ".gz"   = "application/gzip"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    # dev-хук: приём снапшотов сцены (POST /__snap?name=xxx, тело — dataURL jpeg)
    if ($ctx.Request.HttpMethod -eq "POST" -and $path -eq "/__snap") {
      $name = $ctx.Request.QueryString["name"]
      if (-not $name) { $name = "snap" }
      $name = ($name -replace "[^a-zA-Z0-9_\-]", "")
      $reader = New-Object System.IO.StreamReader($ctx.Request.InputStream, $ctx.Request.ContentEncoding)
      $body = $reader.ReadToEnd()
      $b64 = $body -replace "^data:image/\w+;base64,", ""
      $dir = Join-Path $root "_snaps"
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
      [System.IO.File]::WriteAllBytes((Join-Path $dir "$name.jpg"), [Convert]::FromBase64String($b64))
      $ok = [System.Text.Encoding]::UTF8.GetBytes("saved")
      $ctx.Response.ContentLength64 = $ok.Length
      $ctx.Response.OutputStream.Write($ok, 0, $ok.Length)
      try { $ctx.Response.OutputStream.Close() } catch {}
      continue
    }
    $file = Join-Path $root ($path.TrimStart("/") -replace "/", "\")
    $full = [System.IO.Path]::GetFullPath($file)
    if ($full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $full -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] } else { $ctx.Response.ContentType = "application/octet-stream" }
      $ctx.Response.Headers.Add("Cache-Control", "no-cache, must-revalidate")
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
  } catch {
    try { $ctx.Response.StatusCode = 500 } catch {}
  }
  try { $ctx.Response.OutputStream.Close() } catch {}
}
