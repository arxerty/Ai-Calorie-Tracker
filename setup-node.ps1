$nodeDir = "d:\wow\.node"
if (Test-Path $nodeDir) {
    Remove-Item -Path $nodeDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
Write-Host "Downloading Node.js v22.12.0..."
$zipPath = "d:\wow\node.zip"
$nodeUrl = "https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip"
Invoke-WebRequest -Uri $nodeUrl -OutFile $zipPath
Write-Host "Extracting Node.js..."
$tempExtract = "d:\wow\.node_temp"
Expand-Archive -Path $zipPath -DestinationPath $tempExtract
Move-Item -Path "$tempExtract\node-v22.12.0-win-x64\*" -Destination $nodeDir -Force
Remove-Item -Path $zipPath -Force
Remove-Item -Path $tempExtract -Recurse -Force
Write-Host "Node.js successfully installed."
& "$nodeDir\node.exe" -v
