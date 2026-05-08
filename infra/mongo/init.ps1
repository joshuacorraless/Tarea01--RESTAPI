#requires -Version 5.1

[CmdletBinding()]
param(
    [string]$Namespace = $(if ($env:NAMESPACE) { $env:NAMESPACE } else { 'proyecto01-restaurante' })
)

$ErrorActionPreference = 'Stop'

function Wait-Pod {
    param([string]$Pod)
    Write-Host "  Esperando $Pod..."
    while ($true) {
        kubectl exec -n $Namespace $Pod -- mongosh --port 27017 --quiet --eval "db.adminCommand('ping').ok" *>$null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 3
    }
    Write-Host "  OK $Pod listo"
}

# Verifica que el pod $From pueda resolver via DNS y conectar a todos los $Targets.
# Esto previene el error "No host... maps to this node" durante rs.initiate, que
# ocurre cuando el DNS del headless Service todavia no propaga las entradas.
function Wait-DnsMesh {
    param([string]$From, [string[]]$Targets)
    foreach ($t in $Targets) {
        Write-Host "  -> $From puede llegar a $t ?"
        while ($true) {
            kubectl exec -n $Namespace $From -- mongosh --host $t --port 27017 --quiet --eval "db.adminCommand('ping').ok" *>$null
            if ($LASTEXITCODE -eq 0) { break }
            Start-Sleep -Seconds 2
        }
    }
    Write-Host "  OK malla DNS lista desde $From"
}

function Wait-Primary {
    param([string]$Pod, [string]$Rs)
    Write-Host "-> Esperando primario de $Rs (en $Pod)..."
    while ($true) {
        $out = kubectl exec -n $Namespace $Pod -- mongosh --port 27017 --quiet --eval "rs.status().members.some(m => m.stateStr === 'PRIMARY')" 2>$null
        if ($out -match 'true') { break }
        Start-Sleep -Seconds 3
    }
    Write-Host "  OK $Rs tiene primario"
}

function Invoke-Mongo {
    param([string]$Pod, [string]$Script)
    kubectl exec -n $Namespace $Pod -- mongosh --port 27017 admin --quiet --eval $Script
    if ($LASTEXITCODE -ne 0) { throw "mongosh fallo en $Pod (exit $LASTEXITCODE)" }
}

# [1/5] Esperar que todos los pods de mongod respondan
Write-Host ""
Write-Host "=== [1/5] Esperando que los 9 pods de mongod respondan ==="
$mongodPods = @(
    'configsvr-0','configsvr-1','configsvr-2',
    'shard1-0','shard1-1','shard1-2',
    'shard2-0','shard2-1','shard2-2'
)
foreach ($p in $mongodPods) { Wait-Pod $p }

# [2/5] Inicializar los 3 replica sets 
Write-Host ""
Write-Host "=== [2/5] Inicializando replica sets ==="

$initCsrs = @'
try {
  rs.initiate({
    _id: 'csrs',
    configsvr: true,
    members: [
      { _id: 0, host: 'configsvr-0.configsvr:27017', priority: 2 },
      { _id: 1, host: 'configsvr-1.configsvr:27017', priority: 1 },
      { _id: 2, host: 'configsvr-2.configsvr:27017', priority: 1 }
    ]
  });
} catch (e) {
  if (e.codeName === 'AlreadyInitialized') print('  csrs ya estaba inicializado, continuando');
  else throw e;
}
'@

$initRs0 = @'
try {
  rs.initiate({
    _id: 'rs0',
    members: [
      { _id: 0, host: 'shard1-0.shard1:27017', priority: 2 },
      { _id: 1, host: 'shard1-1.shard1:27017', priority: 1 },
      { _id: 2, host: 'shard1-2.shard1:27017', priority: 1 }
    ]
  });
} catch (e) {
  if (e.codeName === 'AlreadyInitialized') print('  rs0 ya estaba inicializado, continuando');
  else throw e;
}
'@

$initRs1 = @'
try {
  rs.initiate({
    _id: 'rs1',
    members: [
      { _id: 0, host: 'shard2-0.shard2:27017', priority: 2 },
      { _id: 1, host: 'shard2-1.shard2:27017', priority: 1 },
      { _id: 2, host: 'shard2-2.shard2:27017', priority: 1 }
    ]
  });
} catch (e) {
  if (e.codeName === 'AlreadyInitialized') print('  rs1 ya estaba inicializado, continuando');
  else throw e;
}
'@

Write-Host "-> csrs (config server) - verificando malla DNS antes de initiate"
Wait-DnsMesh -From 'configsvr-0' -Targets @('configsvr-0.configsvr:27017','configsvr-1.configsvr:27017','configsvr-2.configsvr:27017')
Invoke-Mongo -Pod 'configsvr-0' -Script $initCsrs

Write-Host "-> rs0 (shard1) - verificando malla DNS antes de initiate"
Wait-DnsMesh -From 'shard1-0' -Targets @('shard1-0.shard1:27017','shard1-1.shard1:27017','shard1-2.shard1:27017')
Invoke-Mongo -Pod 'shard1-0' -Script $initRs0

Write-Host "-> rs1 (shard2) - verificando malla DNS antes de initiate"
Wait-DnsMesh -From 'shard2-0' -Targets @('shard2-0.shard2:27017','shard2-1.shard2:27017','shard2-2.shard2:27017')
Invoke-Mongo -Pod 'shard2-0' -Script $initRs1

# [3/5] Esperar eleccion de primarios y mongos listo 
Write-Host ""
Write-Host "=== [3/5] Esperando eleccion de primarios ==="

Wait-Primary -Pod 'configsvr-0' -Rs 'csrs'
Wait-Primary -Pod 'shard1-0'    -Rs 'rs0'
Wait-Primary -Pod 'shard2-0'    -Rs 'rs1'

$mongosPod = (kubectl get pod -n $Namespace -l app=mongos -o jsonpath='{.items[0].metadata.name}').Trim()
if ([string]::IsNullOrWhiteSpace($mongosPod)) { throw "No se encontro pod con label app=mongos en namespace $Namespace." }
Write-Host "Mongos pod: $mongosPod"
Wait-Pod $mongosPod

# [4/5] Registrar shards y habilitar sharding (idempotente)
Write-Host ""
Write-Host "=== [4/5] Registrando shards y habilitando sharding (idempotente) ==="

$shardingScript = @'
function shardExists(name) {
  try { return db.adminCommand({listShards:1}).shards.some(s => s._id === name); } catch(e) { return false; }
}
function shardingEnabled(dbName) {
  return db.getSiblingDB('config').databases.findOne({_id: dbName}) != null;
}
function collectionSharded(coll) {
  return db.getSiblingDB('config').collections.findOne({_id: coll, dropped: {$ne: true}}) != null;
}

if (shardExists('rs0')) {
  print('  rs0 ya estaba registrado, skip');
} else {
  print('-> Registrando rs0 como shard1');
  sh.addShard('rs0/shard1-0.shard1:27017,shard1-1.shard1:27017,shard1-2.shard1:27017');
}

if (shardExists('rs1')) {
  print('  rs1 ya estaba registrado, skip');
} else {
  print('-> Registrando rs1 como shard2');
  sh.addShard('rs1/shard2-0.shard2:27017,shard2-1.shard2:27017,shard2-2.shard2:27017');
}

if (shardingEnabled('restaurant_db')) {
  print('  restaurant_db ya tenia sharding habilitado, skip');
} else {
  print('-> Habilitando sharding en restaurant_db (primary shard: rs0)');
  sh.enableSharding('restaurant_db', 'rs0');
}

if (collectionSharded('restaurant_db.menuitems')) {
  print('  menuitems ya estaba sharded, skip');
} else {
  print('-> Sharding menuitems (shard key: idMenu hashed)');
  sh.shardCollection('restaurant_db.menuitems', { idMenu: 'hashed' });
}

if (collectionSharded('restaurant_db.reservations')) {
  print('  reservations ya estaba sharded, skip');
} else {
  print('-> Sharding reservations (shard key: idRestaurante hashed)');
  sh.shardCollection('restaurant_db.reservations', { idRestaurante: 'hashed' });
}
'@

Invoke-Mongo -Pod $mongosPod -Script $shardingScript

# [5/5] Reporte final
Write-Host ""
Write-Host "=== [5/5] Estado final del sharded cluster ==="

$reportScript = @'
print('--- Shards registrados ---');
db.adminCommand({ listShards: 1 }).shards.forEach(s => print('  ' + s._id + '  ->  ' + s.host));
print('');
print('--- Bases con sharding habilitado ---');
db.getSiblingDB('config').databases.find({ partitioned: true }).forEach(d => print('  ' + d._id + '  (primary: ' + d.primary + ')'));
print('');
print('--- Colecciones sharded ---');
db.getSiblingDB('config').collections.find({ dropped: { $ne: true } }).forEach(c => print('  ' + c._id + '  key=' + JSON.stringify(c.key)));
'@

Invoke-Mongo -Pod $mongosPod -Script $reportScript

Write-Host ""
Write-Host "================================================================="
Write-Host "  Sharded cluster MongoDB listo." -ForegroundColor Green
Write-Host ""
Write-Host "  Topologia final:"
Write-Host "    csrs                 -> configsvr-0 (P), configsvr-1 (S), configsvr-2 (S)"
Write-Host "    rs0  (shard1)        -> shard1-0    (P), shard1-1    (S), shard1-2    (S)"
Write-Host "    rs1  (shard2)        -> shard2-0    (P), shard2-1    (S), shard2-2    (S)"
Write-Host "    mongos               -> punto de entrada del cluster"
Write-Host ""
Write-Host "  La API se conecta a: mongos-service:27017"
Write-Host "================================================================="
