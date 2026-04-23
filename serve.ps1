param(
  [int]$Port = 4173
)

<#
  Tiny static file server for this dashboard.
  Why it exists:
  - lets you run the app locally on Windows without installing Python
  - serves over HTTP so the manifest and service worker can work
  - binds to your local network so you can open it on your iPhone

  Usage:
  powershell -ExecutionPolicy Bypass -File .\serve.ps1
#>

$root = (Get-Location).Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)

function Get-ContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".svg" { "image/svg+xml" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".ico" { "image/x-icon" }
    default { "application/octet-stream" }
  }
}

function Write-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [byte[]]$BodyBytes,
    [string]$ContentType
  )

  $headers = @(
    "HTTP/1.1 $StatusCode $StatusText",
    "Content-Type: $ContentType",
    "Content-Length: $($BodyBytes.Length)",
    "Cache-Control: no-cache",
    "Connection: close",
    ""
    ""
  ) -join "`r`n"

  $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
}

function Resolve-RequestPath {
  param([string]$RawUrl)

  $cleanUrl = ($RawUrl.Split("?")[0]).TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($cleanUrl)) {
    return Join-Path $root "index.html"
  }

  $relativePath = [Uri]::UnescapeDataString($cleanUrl).Replace("/", "\")
  $candidate = Join-Path $root $relativePath

  if (Test-Path -LiteralPath $candidate -PathType Container) {
    return Join-Path $candidate "index.html"
  }

  return $candidate
}

function Get-LocalIPv4Addresses {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*"
    } |
    Select-Object -ExpandProperty IPAddress -Unique
}

$listener.Start()

Write-Host ""
Write-Host "Serving files from: $root" -ForegroundColor Green
Write-Host "Open on this computer: http://localhost:$Port/" -ForegroundColor Cyan

$localIps = Get-LocalIPv4Addresses
foreach ($ip in $localIps) {
  Write-Host "Open on iPhone (same Wi-Fi): http://${ip}:$Port/" -ForegroundColor Yellow
}

Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        $reader.Dispose()
        $stream.Dispose()
        $client.Close()
        continue
      }

      while (($headerLine = $reader.ReadLine()) -ne "") {
        if ($null -eq $headerLine) {
          break
        }
      }

      $parts = $requestLine.Split(" ")
      $method = if ($parts.Length -gt 0) { $parts[0] } else { "GET" }
      $rawUrl = if ($parts.Length -gt 1) { $parts[1] } else { "/" }

      if ($method -ne "GET") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method not allowed.")
        Write-Response -Stream $stream -StatusCode 405 -StatusText "Method Not Allowed" -BodyBytes $body -ContentType "text/plain; charset=utf-8"
      }
      else {
        $fullPath = Resolve-RequestPath -RawUrl $rawUrl
        $resolvedPath = Resolve-Path -LiteralPath $fullPath -ErrorAction SilentlyContinue

        if (-not $resolvedPath) {
          $body = [System.Text.Encoding]::UTF8.GetBytes("File not found.")
          Write-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -BodyBytes $body -ContentType "text/plain; charset=utf-8"
        }
        else {
          $bytes = [System.IO.File]::ReadAllBytes($resolvedPath.Path)
          $contentType = Get-ContentType -Path $resolvedPath.Path
          Write-Response -Stream $stream -StatusCode 200 -StatusText "OK" -BodyBytes $bytes -ContentType $contentType
        }
      }

      $reader.Dispose()
      $stream.Dispose()
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
