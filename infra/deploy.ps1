# Despliegue completo: compila, aplica la infraestructura, sube el SPA e invalida la caché.
#
#   .\deploy.ps1              despliegue completo
#   .\deploy.ps1 -SkipInfra   solo recompila y sube el SPA

param(
    [switch]$SkipInfra
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$infra = $PSScriptRoot

Write-Host "`n[1/5] Compilando la API para Lambda..." -ForegroundColor Cyan
Push-Location (Join-Path $root 'apps\api')
npm run build:lambda
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Falló el build de la API' }
Pop-Location

Write-Host "`n[2/5] Compilando el SPA..." -ForegroundColor Cyan
Push-Location $root
npm run build:web
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Falló el build del SPA' }
Pop-Location

if (-not $SkipInfra) {
    Write-Host "`n[3/5] Aplicando la infraestructura..." -ForegroundColor Cyan
    Push-Location $infra
    terraform init -input=false
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Falló terraform init' }
    terraform apply -auto-approve -input=false
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Falló terraform apply' }
    Pop-Location
} else {
    Write-Host "`n[3/5] Infraestructura omitida (-SkipInfra)" -ForegroundColor DarkGray
}

Push-Location $infra
$bucket = terraform output -raw spa_bucket
$distribution = terraform output -raw distribution_id
$appUrl = terraform output -raw app_url
Pop-Location

$dist = Join-Path $root 'apps\web\dist'

Write-Host "`n[4/5] Subiendo el SPA a s3://$bucket ..." -ForegroundColor Cyan

# Los assets con hash en el nombre se cachean para siempre; index.html nunca,
# para que un despliegue nuevo se vea de inmediato.
aws s3 sync "$dist" "s3://$bucket" --delete --exclude 'index.html' `
    --cache-control 'public,max-age=31536000,immutable'
if ($LASTEXITCODE -ne 0) { throw 'Falló la subida de assets' }

aws s3 cp "$dist\index.html" "s3://$bucket/index.html" `
    --cache-control 'no-cache,no-store,must-revalidate' --content-type 'text/html'
if ($LASTEXITCODE -ne 0) { throw 'Falló la subida de index.html' }

# La interfaz de Swagger se publica como el objeto "docs" (sin extensión) para
# que la URL quede limpia: https://.../docs
aws s3 cp "$dist\swagger\ui.html" "s3://$bucket/docs" `
    --cache-control 'no-cache' --content-type 'text/html'
if ($LASTEXITCODE -ne 0) { throw 'Falló la subida de la documentación' }

Write-Host "`n[5/5] Invalidando la caché de CloudFront..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $distribution --paths '/*' --output text | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Falló la invalidación' }

Write-Host "`nDespliegue completo." -ForegroundColor Green
Write-Host "  App     : $appUrl"
Write-Host "  API     : $appUrl/api/v1"
Write-Host "  Swagger : $appUrl/docs"
Write-Host "`nLa propagación de CloudFront puede tardar unos minutos la primera vez.`n"
