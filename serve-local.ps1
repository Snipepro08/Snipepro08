$root = (Get-Location).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://127.0.0.1:8000/')
$listener.Start()

function Get-ContentType([string]$path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.js' { 'application/javascript; charset=utf-8' }
    '.css' { 'text/css; charset=utf-8' }
    '.png' { 'image/png' }
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.gif' { 'image/gif' }
    '.svg' { 'image/svg+xml' }
    default { 'application/octet-stream' }
  }
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = $ctx.Request.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }
    $full = Join-Path $root $path

    if (Test-Path $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ctx.Response.StatusCode = 200
      $ctx.Response.ContentType = Get-ContentType $full
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $ctx.Response.ContentType = 'text/plain; charset=utf-8'
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }

    $ctx.Response.OutputStream.Close()
  }
}
finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
