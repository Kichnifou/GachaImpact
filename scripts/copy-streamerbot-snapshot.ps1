param(
  [string]$Source = 'C:\Users\axeld\Documents\Kichnifou\Twitch\Streambot\Data',
  [string]$DestinationRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'local-data\streamerbot-snapshots')
)

$ErrorActionPreference = 'Stop'
$expected = @(
  'banner_votes.json', 'c6_characters.json', 'combat_config.json', 'combat_data.json',
  'contests_data.json', 'element_passives.json', 'friendships_data.json',
  'genshin_characters.json', 'gift_codes.json', 'giveaway.json', 'long_missions.json',
  'missions_pool.json', 'monthly_boss.json', 'monthly_events.json',
  'monthly_events_data.json', 'shop_items.json', 'viewers_data.json'
)
$sourcePath = (Resolve-Path -LiteralPath $Source -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) { throw 'Source directory not found.' }
$actual = @(Get-ChildItem -LiteralPath $sourcePath -File | Select-Object -ExpandProperty Name | Sort-Object)
$missing = @($expected | Where-Object { $_ -notin $actual })
$unexpected = @($actual | Where-Object { $_ -notin $expected })
if ($missing.Count -or $unexpected.Count) {
  throw "Snapshot file list mismatch. Missing: $($missing -join ', '); unexpected: $($unexpected -join ', ')"
}
$repository = (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
$root = [System.IO.Path]::GetFullPath($DestinationRoot)
$ignoredRoot = [System.IO.Path]::GetFullPath((Join-Path $repository 'local-data\streamerbot-snapshots'))
if (-not ($root -eq $ignoredRoot -or $root.StartsWith($ignoredRoot + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase))) {
  throw 'Destination must remain inside the ignored snapshot directory.'
}
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$destination = Join-Path $root $stamp
New-Item -ItemType Directory -Path $destination -ErrorAction Stop | Out-Null
$manifest = foreach ($name in $expected) {
  $original = Join-Path $sourcePath $name
  $copy = Join-Path $destination $name
  $before = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant()
  Copy-Item -LiteralPath $original -Destination $copy -ErrorAction Stop
  $afterSource = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant()
  $afterCopy = (Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($before -ne $afterSource -or $before -ne $afterCopy) { throw "Hash mismatch: $name" }
  $file = Get-Item -LiteralPath $original
  [pscustomobject]@{ name = $name; size = $file.Length; sourceModifiedUtc = $file.LastWriteTimeUtc.ToString('o'); sha256 = $before }
}
@{ capturedAtUtc = (Get-Date).ToUniversalTime().ToString('o'); files = @($manifest) } |
  ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $destination 'manifest.json') -Encoding utf8
Write-Output "Snapshot copied and source/copy hashes verified: $destination"
Write-Output "Files: $($manifest.Count)"
