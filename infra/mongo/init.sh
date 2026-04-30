#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# Inicialización del Sharded Cluster MongoDB
# ════════════════════════════════════════════════════════════════════
#
# Topología que arma este script:
#
#   ┌────────────────────────────────────────────────────────────┐
#   │                  Docker Desktop K8s                         │
#   │                                                              │
#   │   [mongos]  ──────────────► [csrs] (config server RS)       │
#   │      │                       configsvr-0 (P), -1, -2         │
#   │      │                                                       │
#   │      ├──► [rs0 / shard1]  shard1-0 (P), shard1-1, shard1-2  │
#   │      │                                                       │
#   │      └──► [rs1 / shard2]  shard2-0 (P), shard2-1, shard2-2  │
#   │                                                              │
#   │   Total: 10 pods (3 csrs + 3 rs0 + 3 rs1 + 1 mongos)         │
#   └────────────────────────────────────────────────────────────┘
#
# Distribución de datos:
#   • menuitems     → SHARDED entre rs0 y rs1 (shard key: menuId hashed)
#   • reservations  → SHARDED entre rs0 y rs1 (shard key: idRestaurante hashed)
#   • users, restaurants, menus, orders, mesas → solo en rs0 (primary shard)
#
# Requisitos previos:
#   1. Aplicar manifests:
#        kubectl apply -f infra/k8s/mongo/configsvr.yaml
#        kubectl apply -f infra/k8s/mongo/shards.yaml
#        kubectl apply -f infra/k8s/mongo/mongos.yaml
#   2. Esperar a que los 10 pods de Mongo (9 mongod + 1 mongos) estén Running:
#        kubectl get pods -w
#
# Uso (desde la raíz del repo):
#   bash infra/mongo/init.sh
#
# Variante para Windows + Docker Desktop (sin dependencia de bash):
#   .\infra\mongo\init.ps1
#   (la usa deploy.ps1 internamente)
# ════════════════════════════════════════════════════════════════════

set -e

# Namespace donde viven los pods del cluster Mongo. Se puede sobreescribir con
#   NAMESPACE=otro bash infra/mongo/init.sh
NAMESPACE="${NAMESPACE:-proyecto01-restaurante}"

wait_for_pod() {
  local pod=$1
  echo "  Esperando $pod..."
  until kubectl exec -n "$NAMESPACE" "$pod" -- mongosh --port 27017 --quiet --eval "db.adminCommand('ping').ok" > /dev/null 2>&1; do
    sleep 3
  done
  echo "  ✓ $pod listo"
}

# Verifica que el pod $1 pueda resolver via DNS y conectar a todos los hosts $2..$N.
# Esto previene el error "No host... maps to this node" durante rs.initiate, que
# ocurre cuando el DNS del headless Service todavía no propaga las entradas de los pods.
verify_mesh() {
  local from=$1
  shift
  for target in "$@"; do
    echo "  → $from puede llegar a $target ?"
    until kubectl exec -n "$NAMESPACE" "$from" -- mongosh --host "$target" --port 27017 --quiet --eval "db.adminCommand('ping').ok" > /dev/null 2>&1; do
      sleep 2
    done
  done
  echo "  ✓ malla DNS lista desde $from"
}

# ────────────────────────────────────────────────────────────────────
# 1. Esperar que todos los pods respondan a ping
# ────────────────────────────────────────────────────────────────────
echo "═══ [1/5] Esperando que los 9 pods de mongod respondan ═══"
for pod in configsvr-0 configsvr-1 configsvr-2 shard1-0 shard1-1 shard1-2 shard2-0 shard2-1 shard2-2; do
  wait_for_pod "$pod"
done

# ────────────────────────────────────────────────────────────────────
# 2. Inicializar los 3 replica sets en paralelo conceptual
# ────────────────────────────────────────────────────────────────────
echo ""
echo "═══ [2/5] Inicializando replica sets ═══"

echo "→ csrs (config server) — verificando malla DNS antes de initiate"
verify_mesh configsvr-0 configsvr-0.configsvr:27017 configsvr-1.configsvr:27017 configsvr-2.configsvr:27017
kubectl exec -n "$NAMESPACE" configsvr-0 -- mongosh --port 27017 admin --quiet --eval "
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
"

echo "→ rs0 (shard1) — verificando malla DNS antes de initiate"
verify_mesh shard1-0 shard1-0.shard1:27017 shard1-1.shard1:27017 shard1-2.shard1:27017
kubectl exec -n "$NAMESPACE" shard1-0 -- mongosh --port 27017 admin --quiet --eval "
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
"

echo "→ rs1 (shard2) — verificando malla DNS antes de initiate"
verify_mesh shard2-0 shard2-0.shard2:27017 shard2-1.shard2:27017 shard2-2.shard2:27017
kubectl exec -n "$NAMESPACE" shard2-0 -- mongosh --port 27017 admin --quiet --eval "
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
"

# ────────────────────────────────────────────────────────────────────
# 3. Esperar elección de primarios y que mongos esté listo
# ────────────────────────────────────────────────────────────────────
echo ""
echo "═══ [3/5] Esperando elección de primarios ═══"

wait_for_primary() {
  local pod=$1
  local rs=$2
  echo "→ Esperando primario de $rs (en $pod)..."
  until kubectl exec -n "$NAMESPACE" "$pod" -- mongosh --port 27017 --quiet --eval \
    "rs.status().members.some(m => m.stateStr === 'PRIMARY')" 2>/dev/null | grep -q "true"; do
    sleep 3
  done
  echo "  ✓ $rs tiene primario"
}

wait_for_primary configsvr-0 csrs
wait_for_primary shard1-0 rs0
wait_for_primary shard2-0 rs1

MONGOS_POD=$(kubectl get pod -n "$NAMESPACE" -l app=mongos -o jsonpath='{.items[0].metadata.name}')
echo "Mongos pod: $MONGOS_POD"
wait_for_pod "$MONGOS_POD"

# ────────────────────────────────────────────────────────────────────
# 4. Registrar shards y habilitar sharding (vía mongos)
# ────────────────────────────────────────────────────────────────────
echo ""
echo "═══ [4/5] Registrando shards y habilitando sharding (idempotente) ═══"
# Cada operacion verifica el estado actual antes de ejecutar. Re-correr el script
# es seguro: las operaciones ya completadas se saltean en lugar de fallar con
# "shard already exists" / "sharding already enabled" / "collection already sharded".
kubectl exec -n "$NAMESPACE" "$MONGOS_POD" -- mongosh --port 27017 admin --quiet --eval "
function shardExists(name) {
  try { return db.adminCommand({listShards:1}).shards.some(s => s._id === name); } catch(e) { return false; }
}
function shardingEnabled(dbName) {
  return db.getSiblingDB('config').databases.findOne({_id: dbName}) != null;
}
function collectionSharded(coll) {
  return db.getSiblingDB('config').collections.findOne({_id: coll, dropped: {\$ne: true}}) != null;
}

if (shardExists('rs0')) {
  print('  rs0 ya estaba registrado, skip');
} else {
  print('→ Registrando rs0 como shard1');
  sh.addShard('rs0/shard1-0.shard1:27017,shard1-1.shard1:27017,shard1-2.shard1:27017');
}

if (shardExists('rs1')) {
  print('  rs1 ya estaba registrado, skip');
} else {
  print('→ Registrando rs1 como shard2');
  sh.addShard('rs1/shard2-0.shard2:27017,shard2-1.shard2:27017,shard2-2.shard2:27017');
}

if (shardingEnabled('restaurant_db')) {
  print('  restaurant_db ya tenia sharding habilitado, skip');
} else {
  print('→ Habilitando sharding en restaurant_db (primary shard: rs0)');
  sh.enableSharding('restaurant_db', 'rs0');
}

if (collectionSharded('restaurant_db.menuitems')) {
  print('  menuitems ya estaba sharded, skip');
} else {
  print('→ Sharding menuitems (shard key: menuId hashed)');
  sh.shardCollection('restaurant_db.menuitems', { menuId: 'hashed' });
}

if (collectionSharded('restaurant_db.reservations')) {
  print('  reservations ya estaba sharded, skip');
} else {
  print('→ Sharding reservations (shard key: idRestaurante hashed)');
  sh.shardCollection('restaurant_db.reservations', { idRestaurante: 'hashed' });
}
"

# ────────────────────────────────────────────────────────────────────
# 5. Reporte final
# ────────────────────────────────────────────────────────────────────
echo ""
echo "═══ [5/5] Estado final del sharded cluster ═══"
kubectl exec -n "$NAMESPACE" "$MONGOS_POD" -- mongosh --port 27017 admin --quiet --eval "
print('--- Shards registrados ---');
db.adminCommand({ listShards: 1 }).shards.forEach(s => print('  ' + s._id + '  →  ' + s.host));
print('');
print('--- Bases con sharding habilitado ---');
db.getSiblingDB('config').databases.find({ partitioned: true }).forEach(d => print('  ' + d._id + '  (primary: ' + d.primary + ')'));
print('');
print('--- Colecciones sharded ---');
db.getSiblingDB('config').collections.find({ dropped: { \$ne: true } }).forEach(c => print('  ' + c._id + '  key=' + JSON.stringify(c.key)));
"

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "✓ Sharded cluster MongoDB listo."
echo ""
echo "Topología final:"
echo "  csrs                 → configsvr-0 (P), configsvr-1 (S), configsvr-2 (S)"
echo "  rs0  (shard1)        → shard1-0 (P), shard1-1 (S), shard1-2 (S)"
echo "  rs1  (shard2)        → shard2-0 (P), shard2-1 (S), shard2-2 (S)"
echo "  mongos               → punto de entrada del cluster"
echo ""
echo "La API debe conectarse a: mongos-service:27017"
echo "════════════════════════════════════════════════════════════════════"
