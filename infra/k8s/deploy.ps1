#requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('mongo', 'postgres')]
    [string]$DbEngine
)

$ErrorActionPreference = 'Stop'

# Constantes y paths
$Namespace   = 'proyecto01-restaurante'
$ScriptDir   = $PSScriptRoot
$RepoRoot    = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path
$CommonDir   = Join-Path $ScriptDir 'common'
$MongoDir    = Join-Path $ScriptDir 'mongo'
$PgDir       = Join-Path $ScriptDir 'postgres'
$DatabaseDir = Join-Path $RepoRoot 'database'
$InitScript  = Join-Path $RepoRoot 'infra\mongo\init.ps1'
$ImageTag    = (Get-Date).ToString('yyyyMMddHHmmss')
$ApiImage    = "restaurant/api:$ImageTag"
$SearchImage = "restaurant/search:$ImageTag"

# Helpers de output
$Separator = '-' * 50

function Write-Step {
    param([int]$Num, [int]$Total, [string]$Message)
    Write-Host ''
    Write-Host $Separator -ForegroundColor DarkGray
    Write-Host ("  [{0}/{1}] {2}" -f $Num, $Total, $Message) -ForegroundColor Cyan
}

function Write-Info  { param([string]$Msg) Write-Host "        $Msg" -ForegroundColor DarkGray }
function Write-Ok    { param([string]$Msg) Write-Host "  [ok]  $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "  [!]   $Msg" -ForegroundColor Yellow }
function Write-Fail  { param([string]$Msg) Write-Host "  [err] $Msg" -ForegroundColor Red }

function Assert-Tool {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name no esta en el PATH. $Hint"
    }
    Write-Ok "$Name encontrado"
}

function Assert-LocalManifest {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        $example = $Path -replace '\.yaml$', '.example.yaml'
        throw "Falta manifiesto local: $Path`n        Copia $example en esa ruta y rellena los valores."
    }
    Write-Ok "Manifiesto presente: $(Split-Path $Path -Leaf)"
}

function Test-K8sResource {
    param([string]$Kind, [string]$Name, [string]$Ns)
    $local:ErrorActionPreference = 'Continue'
    kubectl get $Kind $Name -n $Ns 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Assert-NoConflictingEngine {
    param([string]$Engine, [string]$Ns)

    if ($Engine -eq 'mongo') {
        if (Test-K8sResource 'statefulset' 'postgres' $Ns) {
            Write-Fail "Ya existe Postgres app en el namespace ${Ns}."
            Write-Warn "Para cambiar a DB_ENGINE=mongo, ejecuta primero: .\infra\k8s\destroy.ps1"
            throw "Conflicto de motores: Postgres activo, no se puede aplicar Mongo encima."
        }
    }
    else {
        $conflicts = @()
        if (Test-K8sResource 'statefulset' 'configsvr' $Ns) { $conflicts += 'configsvr' }
        if (Test-K8sResource 'statefulset' 'shard1'    $Ns) { $conflicts += 'shard1' }
        if (Test-K8sResource 'statefulset' 'shard2'    $Ns) { $conflicts += 'shard2' }
        if (Test-K8sResource 'deployment'  'mongos'    $Ns) { $conflicts += 'mongos' }
        if ($conflicts.Count -gt 0) {
            Write-Fail "Ya existen recursos de Mongo en ${Ns}: $($conflicts -join ', ')"
            Write-Warn "Para cambiar a DB_ENGINE=postgres, ejecuta primero: .\infra\k8s\destroy.ps1"
            throw "Conflicto de motores: Mongo activo, no se puede aplicar Postgres encima."
        }
    }
}

# Banner
Write-Host ''
Write-Host $Separator -ForegroundColor DarkGray
Write-Host "  Despliegue Fase 7 - Restaurantes" -ForegroundColor Green
Write-Host ("  Namespace  : {0}" -f $Namespace)  -ForegroundColor DarkGray
Write-Host ("  DB Engine  : {0}" -f $DbEngine)   -ForegroundColor DarkGray
Write-Host $Separator -ForegroundColor DarkGray

# [1/8] Prerrequisitos
Write-Step 1 8 "Verificando prerrequisitos"
Assert-Tool 'kubectl' 'Instala kubectl o activa Kubernetes en Docker Desktop.'
Assert-Tool 'docker'  'Docker Desktop debe estar corriendo.'

Assert-LocalManifest (Join-Path $CommonDir 'api\secret.yaml')
Assert-LocalManifest (Join-Path $CommonDir 'keycloak\secret.yaml')
Assert-LocalManifest (Join-Path $CommonDir 'keycloak\realm-configmap.yaml')
if ($DbEngine -eq 'postgres') {
    Assert-LocalManifest (Join-Path $PgDir 'secret.yaml')
}

$ctx = (kubectl config current-context).Trim()
Write-Info "kubectl context: $ctx"
if ($ctx -ne 'docker-desktop') {
    Write-Warn "El contexto activo no es 'docker-desktop'."
    Write-Warn "Si no es intencional: kubectl config use-context docker-desktop"
}

$ingressPods = kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller --no-headers 2>$null
if ([string]::IsNullOrWhiteSpace($ingressPods)) {
    Write-Fail "Nginx Ingress Controller no detectado en 'ingress-nginx'."
    Write-Warn "Instalalo con:"
    Write-Info "  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml"
    Write-Info "  kubectl wait --namespace ingress-nginx --for=condition=Ready pod --selector=app.kubernetes.io/component=controller --timeout=180s"
    throw "Falta el Ingress Controller. Instalalo y vuelve a ejecutar el script."
}
Write-Ok "Ingress Controller detectado"

Assert-NoConflictingEngine -Engine $DbEngine -Ns $Namespace
Write-Ok "Sin conflicto de motores"

# [2/8] Namespace
Write-Step 2 8 "Aplicando namespace $Namespace"
kubectl apply -f (Join-Path $CommonDir 'namespace.yaml')

# [3/8] Build de imagenes
Write-Step 3 8 "Construyendo imagenes locales"
Write-Info $ApiImage
Write-Info $SearchImage
docker build -t $ApiImage    -t restaurant/api:dev    (Join-Path $RepoRoot 'apps\api')
docker build -t $SearchImage -t restaurant/search:dev (Join-Path $RepoRoot 'apps\search')

# [4/8] Recursos comunes
Write-Step 4 8 "Aplicando recursos comunes (api, search, redis, elasticsearch, keycloak, ingress)"

$configMapPath = Join-Path $CommonDir 'api\configmap.yaml'
$configMapContent = Get-Content $configMapPath -Raw
if ($DbEngine -eq 'mongo') {
    $configMapContent = $configMapContent -replace 'DB_ENGINE: "postgres"', 'DB_ENGINE: "mongo"'
} else {
    $configMapContent = $configMapContent -replace 'DB_ENGINE: "mongo"', 'DB_ENGINE: "postgres"'
}
$configMapContent | Set-Content $configMapPath -NoNewline
Write-Ok "DB_ENGINE=$DbEngine aplicado en configmap.yaml"

kubectl apply -f $CommonDir -R
kubectl set image deployment/api    api=$ApiImage    -n $Namespace
kubectl set image deployment/search search=$SearchImage -n $Namespace

# [5-7/8] Motor de base de datos
if ($DbEngine -eq 'mongo') {

    Write-Step 5 8 "DB_ENGINE=mongo: aplicando Mongo sharded cluster (10 pods)"
    kubectl apply -f $MongoDir -R

    Write-Step 6 8 "Esperando StatefulSets de mongod (csrs, shard1, shard2)"
    kubectl rollout status statefulset/configsvr -n $Namespace --timeout=300s
    Write-Ok "configsvr listo"
    kubectl rollout status statefulset/shard1 -n $Namespace --timeout=300s
    Write-Ok "shard1 listo"
    kubectl rollout status statefulset/shard2 -n $Namespace --timeout=300s
    Write-Ok "shard2 listo"

    Write-Step 7 8 "Inicializando replica sets y sharding (idempotente)"
    & $InitScript -Namespace $Namespace

}
else {

    Write-Step 5 8 "DB_ENGINE=postgres: generando ConfigMap desde database/*.sql"
    $initSql  = Join-Path $DatabaseDir 'init.sql'
    $spSql    = Join-Path $DatabaseDir 'stored-procedures.sql'
    $mesasSql = Join-Path $DatabaseDir 'crearMesas.sql'
    foreach ($f in @($initSql, $spSql, $mesasSql)) {
        if (-not (Test-Path $f)) { throw "Archivo SQL no encontrado: $f" }
        Write-Ok "SQL encontrado: $(Split-Path $f -Leaf)"
    }

    $cmYaml = kubectl create configmap postgres-init-scripts `
        --from-file="00-init.sql=$initSql" `
        --from-file="01-stored-procedures.sql=$spSql" `
        --from-file="02-mesas.sql=$mesasSql" `
        -n $Namespace `
        --dry-run=client -o yaml
    $cmYaml | kubectl apply -f -

    Write-Info "Aplicando StatefulSet, Service y Secret de Postgres"
    kubectl apply -f $PgDir -R

    Write-Step 6 8 "Esperando StatefulSet postgres"
    kubectl rollout status statefulset/postgres -n $Namespace --timeout=300s
    Write-Ok "postgres listo"

    Write-Step 7 8 "Verificando schema y stored procedures"
    Start-Sleep -Seconds 3

    $minTables = 5
    $minSps    = 5
    $expectedTables = @('users', 'restaurants', 'menus')

    $tablesCount = (kubectl exec -n $Namespace postgres-0 -- psql -U postgres -d restaurant_db -tAc `
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'").Trim()
    $spsCount = (kubectl exec -n $Namespace postgres-0 -- psql -U postgres -d restaurant_db -tAc `
        "SELECT count(*) FROM information_schema.routines WHERE routine_schema='public' AND routine_name LIKE 'sp\_%' ESCAPE '\'").Trim()

    Write-Info "Tablas detectadas          : $tablesCount"
    Write-Info "Stored procedures (sp_*)   : $spsCount"

    if ([int]$tablesCount -lt $minTables) {
        throw "Schema incompleto: $tablesCount tablas en public (minimo esperado: $minTables). Revisa el ConfigMap postgres-init-scripts."
    }
    if ([int]$spsCount -lt $minSps) {
        throw "Schema incompleto: $spsCount stored procedures sp_* (minimo esperado: $minSps). Verifica database/stored-procedures.sql."
    }

    foreach ($t in $expectedTables) {
        $exists = (kubectl exec -n $Namespace postgres-0 -- psql -U postgres -d restaurant_db -tAc `
            "SELECT to_regclass('public.$t') IS NOT NULL").Trim()
        if ($exists -ne 't') {
            throw "Tabla 'public.$t' no existe en restaurant_db. El init script fallo o el ConfigMap quedo vacio."
        }
    }
    Write-Ok "Tablas clave verificadas: $($expectedTables -join ', ')"
}

# [8/8] Reiniciar API
Write-Step 8 8 "Reiniciando deployment/api y verificando estado final"
kubectl rollout restart deployment/api -n $Namespace
kubectl rollout status  deployment/api -n $Namespace --timeout=300s
Start-Sleep -Seconds 5

# Resumen
Write-Host ''
Write-Host $Separator -ForegroundColor DarkGray
Write-Ok "Listo. DB_ENGINE=$DbEngine activo en $Namespace"
Write-Host $Separator -ForegroundColor DarkGray
Write-Host ''
Write-Host '  Estado del namespace:' -ForegroundColor DarkGray
Write-Info "kubectl get pods    -n $Namespace"
Write-Info "kubectl get svc     -n $Namespace"
Write-Info "kubectl get ingress -n $Namespace"
Write-Host ''
Write-Host '  Escalado horizontal:' -ForegroundColor DarkGray
Write-Info "kubectl scale deployment api    --replicas=3 -n $Namespace"
Write-Info "kubectl scale deployment search --replicas=2 -n $Namespace"
Write-Host ''
Write-Host '  Acceso:' -ForegroundColor DarkGray
Write-Info 'curl http://localhost/api/restaurants'
Write-Info 'curl "http://localhost/search/products?q=casado"'
Write-Host ''
Write-Host '  Teardown:' -ForegroundColor DarkGray
Write-Info '.\infra\k8s\destroy.ps1'
Write-Host ''