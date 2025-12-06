# Script para crear el archivo .env vacío si no existe
# Esto es necesario porque Docker no puede montar un archivo que no existe

$envPath = Join-Path $PSScriptRoot "server\.env"

if (-not (Test-Path $envPath)) {
    Write-Host "📝 Creando archivo .env vacío en server\.env"
    New-Item -ItemType File -Path $envPath -Force | Out-Null
    Write-Host "✅ Archivo .env creado"
} else {
    Write-Host "✅ Archivo .env ya existe"
}

