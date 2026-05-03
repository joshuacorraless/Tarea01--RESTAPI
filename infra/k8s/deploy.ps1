#requires -Version 5.1
<#
.SYNOPSIS
    Despliega el stack de Fase 7 en Docker Desktop Kubernetes con un solo motor de negocio.

.DESCRIPTION
    Kubernetes no decide en runtime que motor de base de datos levantar. La variable
    DB_ENGINE define el comportamiento de la API; este script usa ese mismo valor
    para aplicar selectivamente solo los manifiestos del motor elegido.

      DB_ENGINE=mongo    -> Mongo sharded existe; Postgres app NO.
      DB_ENGINE=postgres -> Postgres app existe; Mongo NO.
      Keycloak y su Postgres dedicado siempre existen (no son motor de negocio).

.PARAMETER DbEngine
    Motor de negocio a desplegar. Valores validos: mongo, postgres.

.EXAMPLE
    .\infra\k8s\deploy.ps1 -DbEngine mongo
    .\infra\k8s\deploy.ps1 -DbEngine postgres
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('mongo', 'postgres')]
    [string]$DbEngine
)

$ErrorActionPreference = 'Stop'

# ─── Constantes y paths ──────────────────────────────────────────────────────
$Namespace  = 'proyecto01-restaurante'
$ScriptDir  = $PSScriptRoot
$RepoRoot   = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path
$CommonDir  = Join-Path $ScriptDir 'common'
$MongoDir   = Join-Path $ScriptDir 'mongo'
$PgDir      = Join-Path $ScriptDir 'postgres'
$DatabaseDir = Join-Path $RepoRoot 'database'
$InitScript  = Join-Path $RepoRoot 'infra\mongo\init.ps1'   # nativo PS1, no depende de bash
$ImageTag    = (Get-Date).ToString('yyyyMMddHHmmss')
$ApiImage    = "restaurant/api:$ImageTag"
$SearchImage = "restaurant/search:$ImageTag"

function Write-Step {
    param([int]$Num, [int]$Total, [string]$Message)
    Write-Host ""
    Write-Host ("[{0}/{1}] {2}" -f $Num, $Total, $Message) -ForegroundColor Cyan
}

function Assert-Tool {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name no esta en el PATH. $Hint"
    }
}

function Assert-LocalManifest {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        $example = $Path -replace '\.yaml$', '.example.yaml'
        throw "Falta manifiesto local no versionado: $Path. Copia $example en esa ruta y rellena los valores antes de desplegar."
    }
}

# Devuelve $true si el recurso existe en el namespace.
function Test-K8sResource {
    param([string]$Kind, [string]$Name, [string]$Ns)
    $local:ErrorActionPreference = 'Continue'
    $result = kubectl get $Kind $Name -n $Ns 2>&1
    return ($LASTEXITCODE -eq 0)
}

# Aborta si encuentra recursos del motor contrario al solicitado.
# Regla del proyecto: nunca conviven Mongo y Postgres app en el mismo cluster.
function Assert-NoConflictingEngine {
    param([string]$Engine, [string]$Ns)

    if ($Engine -eq 'mongo') {
        if (Test-K8sResource 'statefulset' 'postgres' $Ns) {
            Write-Host ""
            Write-Host "ERROR: ya existe Postgres app en el namespace ${Ns}." -ForegroundColor Red
            Write-Host "Para cambiar a DB_ENGINE=mongo, ejecuta primero:" -ForegroundColor Yellow
            Write-Host "    .\infra\k8s\destroy.ps1" -ForegroundColor Yellow
            Write-Host "Esto borra el namespace completo (incluyendo PVCs) antes de redeploy." -ForegroundColor Yellow
            throw "Conflicto de motores: Postgres app activo, no se puede aplicar Mongo encima."
        }
    }
    else {
        $mongoConflicts = @()
        if (Test-K8sResource 'statefulset' 'configsvr' $Ns) { $mongoConflicts += 'configsvr' }
        if (Test-K8sResource 'statefulset' 'shard1'    $Ns) { $mongoConflicts += 'shard1' }
        if (Test-K8sResource 'statefulset' 'shard2'    $Ns) { $mongoConflicts += 'shard2' }
        if (Test-K8sResource 'deployment'  'mongos'    $Ns) { $mongoConflicts += 'mongos' }
        if ($mongoConflicts.Count -gt 0) {
            Write-Host ""
            Write-Host "ERROR: ya existen recursos de Mongo en el namespace ${Ns}:" -ForegroundColor Red
            $mongoConflicts | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
            Write-Host "Para cambiar a DB_ENGINE=postgres, ejecuta primero:" -ForegroundColor Yellow
            Write-Host "    .\infra\k8s\destroy.ps1" -ForegroundColor Yellow
            Write-Host "Esto borra el namespace completo (incluyendo PVCs) antes de redeploy." -ForegroundColor Yellow
            throw "Conflicto de motores: Mongo activo, no se puede aplicar Postgres encima."
        }
    }
}

# ─── Banner ──────────────────────────────────────────────────────────────────
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  Despliegue Fase 7 — Restaurantes e2"                                -ForegroundColor Green
Write-Host "  DB_ENGINE seleccionado: $DbEngine"                                  -ForegroundColor Green
Write-Host "  Namespace: $Namespace"                                              -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

# ─── [1/8] Prerrequisitos ────────────────────────────────────────────────────
Write-Step 1 8 "Verificando prerrequisitos"
Assert-Tool 'kubectl' 'Instala kubectl o activa Kubernetes en Docker Desktop.'
Assert-Tool 'docker'  'Docker Desktop debe estar corriendo.'
# (no se necesita bash: init.ps1 hace todo en PowerShell nativo)

Assert-LocalManifest (Join-Path $CommonDir 'api\secret.yaml')
Assert-LocalManifest (Join-Path $CommonDir 'keycloak\secret.yaml')
Assert-LocalManifest (Join-Path $CommonDir 'keycloak\realm-configmap.yaml')
if ($DbEngine -eq 'postgres') {
    Assert-LocalManifest (Join-Path $PgDir 'secret.yaml')
}

$ctx = (kubectl config current-context).Trim()
Write-Host "  kubectl context: $ctx"
if ($ctx -ne 'docker-desktop') {
    Write-Warning "El contexto actual no es 'docker-desktop'. Si esto no es intencional, ejecuta: kubectl config use-context docker-desktop"
}

$ingressPods = kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller --no-headers 2>$null
if ([string]::IsNullOrWhiteSpace($ingressPods)) {
    Write-Warning "Nginx Ingress Controller no detectado en el namespace 'ingress-nginx'."
    Write-Host "  Instalalo con:" -ForegroundColor Yellow
    Write-Host "    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml" -ForegroundColor Yellow
    Write-Host "    kubectl wait --namespace ingress-nginx --for=condition=Ready pod --selector=app.kubernetes.io/component=controller --timeout=180s" -ForegroundColor Yellow
    throw "Falta el Ingress Controller. Instalalo y volve a correr el script."
}

# Valida que no haya recursos del motor contrario antes de aplicar nada.
# Si los hay, hay que correr destroy.ps1 primero (regla: jamas conviven motores).
Assert-NoConflictingEngine -Engine $DbEngine -Ns $Namespace

# ─── [2/8] Namespace ─────────────────────────────────────────────────────────
Write-Step 2 8 "Aplicando namespace $Namespace"
kubectl apply -f (Join-Path $CommonDir 'namespace.yaml')

# ─── [3/8] Build de imagenes locales ─────────────────────────────────────────
Write-Step 3 8 "Construyendo imagenes locales ($ApiImage, $SearchImage)"
docker build -t $ApiImage -t restaurant/api:dev       (Join-Path $RepoRoot 'apps\api')
docker build -t $SearchImage -t restaurant/search:dev (Join-Path $RepoRoot 'apps\search')

# ─── [4/8] Recursos comunes ──────────────────────────────────────────────────
Write-Step 4 8 "Aplicando recursos comunes (api, search, redis, elasticsearch, keycloak, ingress)"

# Ajustar DB_ENGINE en el configmap.yaml ANTES de aplicarlo
$configMapPath = Join-Path $CommonDir 'api\configmap.yaml'
$configMapContent = Get-Content $configMapPath -Raw
if ($DbEngine -eq 'mongo') {
    $configMapContent = $configMapContent -replace 'DB_ENGINE: "postgres"', 'DB_ENGINE: "mongo"'
} else {
    $configMapContent = $configMapContent -replace 'DB_ENGINE: "mongo"', 'DB_ENGINE: "postgres"'
}
$configMapContent | Set-Content $configMapPath -NoNewline
Write-Host "  DB_ENGINE ajustado a $DbEngine en configmap.yaml"

kubectl apply -f $CommonDir -R
kubectl set image deployment/api api=$ApiImage -n $Namespace
kubectl set image deployment/search search=$SearchImage -n $Namespace

# ─── [5/8] Motor de negocio ──────────────────────────────────────────────────
if ($DbEngine -eq 'mongo') {
    Write-Step 5 8 "DB_ENGINE=mongo: aplicando Mongo sharded cluster (10 pods)"
    kubectl apply -f $MongoDir -R

    # ─── [6/8] Esperar pods Mongo (mongod) listos ────────────────────────────
    # Importante: NO esperamos readiness de mongos aca. El readiness probe de
    # mongos ejecuta db.adminCommand('ping'), que no responde hasta que el
    # config server (csrs) tenga rs.initiate corrido. Y ese rs.initiate lo
    # hace init.sh. Esperar a mongos antes de init.sh es un deadlock.
    # init.sh tiene su propio wait_for_pod para mongos AL FINAL, despues de
    # haber inicializado los 3 replica sets.
    Write-Step 6 8 "Esperando StatefulSets de mongod (csrs, shard1, shard2) listos"
    kubectl rollout status statefulset/configsvr -n $Namespace --timeout=300s
    kubectl rollout status statefulset/shard1    -n $Namespace --timeout=300s
    kubectl rollout status statefulset/shard2    -n $Namespace --timeout=300s

    # ─── [7/8] Inicializar replica sets + sharding ───────────────────────────
    Write-Step 7 8 "Inicializando replica sets y sharding (idempotente)"
    & $InitScript -Namespace $Namespace
}
else {
    Write-Step 5 8 "DB_ENGINE=postgres: generando ConfigMap real desde database/*.sql"
    $initSql   = Join-Path $DatabaseDir 'init.sql'
    $spSql     = Join-Path $DatabaseDir 'stored-procedures.sql'
    $mesasSql  = Join-Path $DatabaseDir 'crearMesas.sql'
    foreach ($f in @($initSql, $spSql, $mesasSql)) {
        if (-not (Test-Path $f)) { throw "Archivo SQL no encontrado: $f" }
    }
    $cmYaml = kubectl create configmap postgres-init-scripts `
        --from-file="00-init.sql=$initSql" `
        --from-file="01-stored-procedures.sql=$spSql" `
        --from-file="02-mesas.sql=$mesasSql" `
        -n $Namespace `
        --dry-run=client -o yaml
    $cmYaml | kubectl apply -f -

    Write-Host "  Aplicando StatefulSet + Service + Secret de Postgres app"
    kubectl apply -f $PgDir -R

    # ─── [6/8] Esperar Postgres ──────────────────────────────────────────────
    Write-Step 6 8 "Esperando StatefulSet postgres listo"
    kubectl rollout status statefulset/postgres -n $Namespace --timeout=300s

    # ─── [7/8] Verificar schema cargado (con assertions) ─────────────────────
    Write-Step 7 8 "Verificando que el schema y stored procedures se cargaron"
    Start-Sleep -Seconds 3   # margen para que init scripts terminen

    # Mininos esperados: la suite real define ~7 tablas y ~30 stored procedures.
    # Si quedaron muy por debajo, el ConfigMap no se aplico o los SQL fallaron.
    $minTables = 5
    $minSps    = 5

    $expectedTables = @('users','restaurants','menus')

    $tablesCount = (kubectl exec -n $Namespace postgres-0 -- psql -U postgres -d restaurant_db -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'").Trim()
    $spsCount    = (kubectl exec -n $Namespace postgres-0 -- psql -U postgres -d restaurant_db -tAc "SELECT count(*) FROM information_schema.routines WHERE routine_schema='public' AND routine_name LIKE 'sp\_%' ESCAPE '\'").Trim()

    Write-Host ("  Tablas detectadas:           {0}" -f $tablesCount)
    Write-Host ("  Stored procedures (sp_*):    {0}" -f $spsCount)

    if ([int]$tablesCount -lt $minTables) {
        throw "Schema incompleto: solo $tablesCount tablas en public (esperaba >= $minTables). Revisa que el ConfigMap postgres-init-scripts se haya generado correctamente desde database/*.sql."
    }
    if ([int]$spsCount -lt $minSps) {
        throw "Schema incompleto: solo $spsCount stored procedures sp_* (esperaba >= $minSps). El archivo database/stored-procedures.sql no se cargo."
    }

    foreach ($t in $expectedTables) {
        $exists = (kubectl exec -n $Namespace postgres-0 -- psql -U postgres -d restaurant_db -tAc "SELECT to_regclass('public.$t') IS NOT NULL").Trim()
        if ($exists -ne 't') {
            throw "Tabla esperada 'public.$t' no existe en restaurant_db. El init script fallo o el ConfigMap quedo vacio."
        }
    }
    Write-Host "  Tablas clave verificadas:    $($expectedTables -join ', ')" -ForegroundColor Green
}

# ─── [8/8] Reiniciar API y reportar ──────────────────────────────────────────
Write-Step 8 8 "Reiniciando deployment/api para tomar la configuracion ($DbEngine) y verificando"
kubectl rollout restart deployment/api -n $Namespace
kubectl rollout status deployment/api -n $Namespace --timeout=300s
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  Listo. DB_ENGINE=$DbEngine activo en namespace $Namespace"        -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Estado:" -ForegroundColor Cyan
Write-Host "    kubectl get pods    -n $Namespace"
Write-Host "    kubectl get svc     -n $Namespace"
Write-Host "    kubectl get ingress -n $Namespace"
Write-Host ""
Write-Host "  Demo de escalado horizontal:" -ForegroundColor Cyan
Write-Host "    kubectl scale deployment api    --replicas=3 -n $Namespace"
Write-Host "    kubectl scale deployment search --replicas=2 -n $Namespace"
Write-Host ""
Write-Host "  Acceso:" -ForegroundColor Cyan
Write-Host "    curl http://localhost/api/restaurants"
Write-Host "    curl `"http://localhost/search/products?q=casado`""
Write-Host ""
Write-Host "  Para limpiar todo:  .\infra\k8s\destroy.ps1" -ForegroundColor Cyan
