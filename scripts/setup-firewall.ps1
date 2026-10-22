# Run elevated by start.bat on the first run. Lets phones on the same Wi-Fi reach the server.
param([int]$Port = 3000)

$ruleName = "Quiz Games $Port"

if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
  Write-Host "Added firewall rule '$ruleName' (inbound TCP $Port)."
}

# Windows creates a Block rule for Node.js when someone clicks Cancel on its firewall popup.
# A Block rule overrides Allow rules and silently stops phones from connecting.
$blocks = Get-NetFirewallRule -DisplayName "Node.js JavaScript Runtime" -ErrorAction SilentlyContinue |
  Where-Object { $_.Action -eq "Block" -and $_.Direction -eq "Inbound" }
if ($blocks) {
  $blocks | Remove-NetFirewallRule
  Write-Host "Removed $(@($blocks).Count) Windows rule(s) that blocked Node.js."
}

Start-Sleep -Seconds 2
