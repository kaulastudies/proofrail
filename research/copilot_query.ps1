param([string]$InputFile)
$ErrorActionPreference = 'Stop'
$apiBase = if ($env:COLOSSEUM_COPILOT_API_BASE) { $env:COLOSSEUM_COPILOT_API_BASE } else { 'https://copilot.colosseum.com/api/v1' }
$items = Get-Content -LiteralPath $InputFile -Raw | ConvertFrom-Json
foreach ($item in $items) {
  try {
    $uri = if ($item.path.StartsWith('https://')) { $item.path } else { "$apiBase$($item.path)" }
    $headers = @{}
    if (-not $item.path.StartsWith('https://')) { $headers.Authorization = "Bearer $env:COLOSSEUM_COPILOT_PAT" }
    if ($null -ne $item.body) {
      $result = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json' -Body ($item.body | ConvertTo-Json -Depth 40 -Compress) -TimeoutSec 60
    } else {
      $result = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 60
    }
    if ($item.path -eq '/search/projects') {
      $result = @{ totalFound=$result.totalFound; results=@($result.results | ForEach-Object { @{name=$_.name;slug=$_.slug;oneLiner=$_.oneLiner;hackathon=$_.hackathon;prize=$_.prize;accelerator=$_.accelerator;tags=$_.tags;cluster=$_.cluster} }) }
    }
    if ($item.path -eq '/search/archives') { $result = @{results=$result.results;searchTier=$result.searchTier} }
    if ($item.path -eq '/filters') { $result = @{hackathons=$result.hackathons} }
    @{ label=$item.label; data=$result } | ConvertTo-Json -Depth 40 -Compress
  } catch { @{label=$item.label;error=$_.Exception.Message} | ConvertTo-Json -Compress }
}
