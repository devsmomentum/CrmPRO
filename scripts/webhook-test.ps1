param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [Parameter(Mandatory=$true)][string]$Secret,
  [string]$BodyJson = '{"event":"message","data":{"text":"hola","from":"+584241234567"}}',
  [switch]$Subscribe,
  [string]$Challenge = '12345'
)

# Helper: compute HMAC SHA-256 signature of raw body
function Get-HmacSha256Hex([string]$secret, [string]$raw) {
  $hmac = New-Object System.Security.Cryptography.HMACSHA256([Text.Encoding]::UTF8.GetBytes($secret))
  $sigBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($raw))
  (-join ($sigBytes | ForEach-Object { $_.ToString("x2") }))
}

if ($Subscribe) {
  $subscribeUrl = "$BaseUrl/api/webhook-ferrer?hub.mode=subscribe&hub.verify_token=$Secret&hub.challenge=$Challenge"
  Write-Host "Testing GET subscribe: $subscribeUrl"
  try {
    $resp = Invoke-WebRequest -Uri $subscribeUrl -Method GET -Headers @{ 'Accept' = 'text/plain' }
    Write-Host "Status: $($resp.StatusCode)"; Write-Host "Body: $($resp.Content)"
  } catch {
    Write-Error $_
  }
  return
}

# POST event test
$signatureHex = Get-HmacSha256Hex -secret $Secret -raw $BodyJson
$headerSig = "sha256=$signatureHex"
$postUrl = "$BaseUrl/api/webhook-ferrer?secret=$Secret"

Write-Host "Testing POST webhook: $postUrl"
Write-Host "Signature: $headerSig"

try {
  $resp = Invoke-WebRequest -Uri $postUrl -Method POST -ContentType 'application/json' -Headers @{ 'x-hub-signature-256' = $headerSig } -Body $BodyJson
  Write-Host "Status: $($resp.StatusCode)"; Write-Host "Body: $($resp.Content)"
} catch {
  Write-Error $_
}
