#requires -Version 5.1
<#
.SYNOPSIS
    Limpia el deploy de Fase 7 borrando el namespace completo.

.DESCRIPTION
    Borrar el namespace elimina TODO en cascada: pods, services, configmaps,
    secrets, statefulsets, deployments, PVCs y PV asociados. El Ingress
    Controller (en namespace ingress-nginx) NO se toca: pertenece al cluster,
    no a este proyecto.

.PARAMETER Force
    Saltea la confirmacion interactiva.

.EXAMPLE
    .\infra\k8s\destroy.ps1
    .\infra\k8s\destroy.ps1 -Force
#>
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$Namespace = 'proyecto01-restaurante'

if (-not $Force) {
    $reply = Read-Host "Vas a borrar el namespace '$Namespace' (esto elimina pods, PVCs y datos persistentes). Confirmar? (y/N)"
    if ($reply.Trim().ToLower() -notin @('y','yes','s','si')) {
        Write-Host "Cancelado." -ForegroundColor Yellow
        return
    }
}

Write-Host "Borrando namespace $Namespace ..." -ForegroundColor Yellow
kubectl delete namespace $Namespace --ignore-not-found=true

Write-Host "Listo." -ForegroundColor Green
Write-Host ""
Write-Host "Nota: el Ingress Controller (ns ingress-nginx) sigue activo." -ForegroundColor Cyan
Write-Host "      Para borrarlo tambien:"
Write-Host "        kubectl delete -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml"
