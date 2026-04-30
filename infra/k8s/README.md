# Despliegue en Kubernetes (Docker Desktop)

Esta carpeta contiene los manifiestos y scripts para correr el sistema en
Kubernetes: API principal, microservicio de búsqueda, MongoDB sharded **o**
PostgreSQL (según `DB_ENGINE`), Redis, ElasticSearch, Keycloak con su
Postgres dedicado, y un Ingress NGINX que actúa como API Gateway.

> **Para qué sirve**: demostrar orquestación, replicación + sharding (Mongo),
> escalado horizontal (`kubectl scale`) y enrutado por path. Para desarrollo
> diario seguí usando `docker compose up` desde la raíz — es más rápido y
> liviano.

---

## Idea clave: `DB_ENGINE` decide qué motor de negocio existe

> Kubernetes **no** decide dinámicamente qué base levantar leyendo una
> variable de entorno. La variable `DB_ENGINE` define el comportamiento de la
> API; el script de despliegue (`deploy.ps1`) usa ese **mismo valor** para
> aplicar selectivamente solo los manifiestos del motor elegido. Así
> mantenemos coherencia: si `DB_ENGINE=mongo`, solo existe Mongo como motor
> de negocio; si `DB_ENGINE=postgres`, solo existe Postgres como motor de
> negocio. Keycloak siempre existe con su Postgres dedicado, pero ese Postgres
> es de auth, no es motor de la aplicación.

| `DB_ENGINE` | Motor de negocio activo                | Motor de negocio NO desplegado |
|-------------|----------------------------------------|--------------------------------|
| `mongo`     | Mongo sharded (10 pods)                | Postgres app                   |
| `postgres`  | Postgres app (1 pod, sin replicación)  | Mongo sharded                  |

Keycloak (Deployment) y el Postgres dedicado de Keycloak (StatefulSet)
**siempre** se despliegan, independientemente del valor de `DB_ENGINE`.

---

## Estructura de la carpeta

```
infra/k8s/
├── README.md
├── deploy.ps1          ← orquestador: aplica common + (mongo | postgres)
├── destroy.ps1         ← borra el namespace completo
│
├── common/             ← se aplica SIEMPRE
│   ├── namespace.yaml
│   ├── ingress.yaml
│   ├── api/{configmap,secret,deployment}.yaml
│   ├── search/deployment.yaml
│   ├── redis/{configmap,deployment}.yaml
│   ├── elasticsearch/statefulset.yaml
│   └── keycloak/{secret,postgres-statefulset,realm-configmap,deployment}.yaml
│
├── mongo/              ← solo si DB_ENGINE=mongo
│   ├── configsvr.yaml  ← csrs (3 pods)
│   ├── shards.yaml     ← rs0 (3 pods) + rs1 (3 pods)
│   └── mongos.yaml     ← router (1 pod)
│
└── postgres/           ← solo si DB_ENGINE=postgres
    ├── secret.yaml
    └── statefulset.yaml
    # (el ConfigMap de scripts SQL lo genera deploy.ps1 desde database/*.sql)
```

> **Nginx**: solo aparece como `infra/k8s/common/ingress.yaml` (un recurso
> Ingress). No hay imagen propia ni `Deployment` de Nginx en este repo.
> El **Nginx Ingress Controller** que ejecuta el Ingress lo aporta el cluster
> (lo instalás una sola vez en el namespace `ingress-nginx`, ver más abajo).

---

## Topología

```
                       ┌──────────────────────┐
                       │  NGINX Ingress       │
                       │  (localhost:80)      │
                       └──────────┬───────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                                   ▼
          /api/**                              /search/**
        ┌──────────────────┐         ┌──────────────────┐
        │  api-service     │         │  search-service  │
        │  (Deployment ×N) │         │  (Deployment ×N) │
        └────────┬─────────┘         └────────┬─────────┘
                 │                            │
   ┌─────────────┼──────────┬───────┐         │
   ▼             ▼          ▼       ▼         ▼
┌───────┐  ┌──────────────┐ ┌────┐  ┌──────────────┐
│Redis  │  │ Mongo |  PG  │ │KC  │  │ElasticSearch │
│       │  │ (uno solo)   │ │+PG │  │              │
└───────┘  └──────────────┘ └────┘  └──────────────┘
```

Todo vive bajo el namespace **`proyecto01-restaurante`**.

---

## Despliegue rápido (camino para la demo)

> Pre-requisito una sola vez: activar Kubernetes en Docker Desktop e instalar
> el Ingress Controller. Ver sección **Setup inicial** abajo si no lo
> hiciste todavía.

Antes del primer deploy en una máquina nueva, creá los secrets locales desde
las plantillas. Los `secret.yaml` reales están ignorados por git. El
`realm-configmap.yaml` local también está ignorado porque contiene los client
secrets usados por Keycloak al importar el realm:

```powershell
Copy-Item infra\k8s\common\api\secret.example.yaml infra\k8s\common\api\secret.yaml
Copy-Item infra\k8s\common\keycloak\secret.example.yaml infra\k8s\common\keycloak\secret.yaml
Copy-Item infra\k8s\common\keycloak\realm-configmap.example.yaml infra\k8s\common\keycloak\realm-configmap.yaml
Copy-Item infra\k8s\postgres\secret.example.yaml infra\k8s\postgres\secret.yaml
```

```powershell
# Modo MongoDB sharded
.\infra\k8s\deploy.ps1 -DbEngine mongo

# Modo PostgreSQL simple
.\infra\k8s\deploy.ps1 -DbEngine postgres

# Limpiar todo
.\infra\k8s\destroy.ps1
```

Cada llamada a `deploy.ps1` es idempotente: si los recursos ya existen los
actualiza; si los pods de Mongo ya iniciaron sus replica sets, el `init.ps1`
detecta el estado y skippea las operaciones ya hechas.

> **Cambio de motor**: `deploy.ps1` aborta con un mensaje claro si detecta
> recursos del motor contrario en el namespace (ej. correr `-DbEngine postgres`
> con Mongo todavía vivo). Para alternar:
>
> ```powershell
> .\infra\k8s\destroy.ps1                 # borra el namespace completo
> .\infra\k8s\deploy.ps1 -DbEngine postgres
> ```
>
> Esto preserva la regla del proyecto: nunca conviven Mongo y Postgres app
> como motores de negocio.

---

## Setup inicial (una vez por máquina)

### 1. Activar Kubernetes en Docker Desktop

`Settings → Kubernetes → Enable Kubernetes → Apply & Restart`. Esperá a que
el ícono de K8s en la barra de Docker quede verde.

```powershell
kubectl config current-context     # debe decir: docker-desktop
kubectl get nodes                  # debe listar 1 nodo Ready
```

### 2. Instalar el NGINX Ingress Controller

Docker Desktop **no** trae Ingress por defecto.

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml

kubectl wait --namespace ingress-nginx `
  --for=condition=Ready pod `
  --selector=app.kubernetes.io/component=controller `
  --timeout=180s
```

> Esto instala el Nginx Ingress Controller en el namespace `ingress-nginx`.
> Ese controller lee los recursos `Ingress` que vos crees en cualquier
> namespace y los expone en `localhost:80`. **No es** parte de los manifiestos
> del proyecto — es infraestructura del cluster.

---

## Qué hace `deploy.ps1` paso a paso

```text
[1/8] Verificando prerrequisitos
       - kubectl y docker en PATH
       - contexto = docker-desktop
       - Ingress Controller corriendo en ns ingress-nginx
       - bloqueo si ya existe el motor contrario en el namespace
[2/8] Aplicando namespace proyecto01-restaurante
[3/8] Construyendo imágenes locales
       - crea tags únicos por corrida: restaurant/api:<timestamp>, restaurant/search:<timestamp>
       - también actualiza restaurant/api:dev y restaurant/search:dev como alias local
[4/8] Aplicando recursos comunes (common/)
       - api, search, redis, elasticsearch, keycloak, ingress
       - kubectl set image apunta api/search a los tags únicos recién construidos
       - patch DB_ENGINE en api-config si es distinto al default 'mongo'
[5/8] DB_ENGINE=mongo:    aplicando Mongo sharded (mongo/)
      DB_ENGINE=postgres: generando ConfigMap real de SQL desde database/*.sql
                          + aplicando Postgres app (postgres/)
[6/8] mongo:    rollout status de configsvr, shard1, shard2  (mongod)
                — NO esperamos a mongos: su readiness depende de rs.initiate
                  del config server, que lo hace init.ps1 en el siguiente paso.
      postgres: rollout status de statefulset postgres
[7/8] mongo:    infra/mongo/init.ps1 (rs.initiate + addShard + sharding;
                idempotente — usa shardExists, shardingEnabled, collectionSharded)
      postgres: assertion del schema (>= 5 tablas, >= 5 stored procedures sp_*,
                tablas users/restaurants/menus existen). Si falla, deploy aborta.
[8/8] kubectl rollout restart deployment/api  (la API toma DB_ENGINE actualizado)
```

> Kubernetes no construye imágenes. El build lo hace `deploy.ps1` como
> comodidad para Docker Desktop: construye las imágenes con Docker local y
> luego Kubernetes solo las ejecuta. En un flujo con registry/CI, este paso
> estaría fuera del script y los manifiestos apuntarían a imágenes ya
> publicadas.

---

## Demo de escalado horizontal

```powershell
# Después de un deploy.ps1 exitoso:
kubectl scale deployment api    --replicas=3 -n proyecto01-restaurante
kubectl scale deployment search --replicas=2 -n proyecto01-restaurante

# Generar tráfico para ver el load-balancing del Ingress entre pods
for ($i=1; $i -le 20; $i++) { curl -s http://localhost/api/restaurants > $null }

# Logs en vivo de las 3 réplicas
kubectl logs -l app=api --tail=50 --follow -n proyecto01-restaurante
```

---

## Probar registro y login por Ingress

En PowerShell usá `curl.exe` y mandá el JSON entre comillas simples. No
escapés las comillas dobles con `\`, porque Express recibe esos backslashes
como texto literal y responde `Unexpected token`.

```powershell
curl.exe -X POST "http://localhost/api/auth/register" `
  -H "Content-Type: application/json" `
  -d '{"fullName":"Test User","email":"test@test.com","password":"Pass123!","phone":"+506 1234-5678","role":"client"}'

curl.exe -X POST "http://localhost/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"test@test.com","password":"Pass123!"}'
```

El login debe responder con `accessToken`, `refreshToken`, `expiresIn` y
`tokenType`.

---

## Acceder a Keycloak admin console

El Service interno no se expone al exterior por el Ingress (a propósito —
Keycloak admin no debe ser público). Para abrirlo en el navegador, usá
port-forward:

```powershell
kubectl port-forward -n proyecto01-restaurante svc/keycloak-service 8080:8080
# Luego abrir:  http://localhost:8080
# Usuario: admin   Pass: admin
```

El realm `restaurant-realm`, los clients (`restaurant-api`, `admin-cli`) y
los roles (`client`, `restaurant_admin`) ya quedan creados al primer arranque
gracias al `keycloak-realm-import` ConfigMap (montado en
`/opt/keycloak/data/import/` y cargado vía `start-dev --import-realm`).

> El service account de `admin-cli` viene con los roles de
> `realm-management` ya asignados (`manage-users`, `view-users`,
> `manage-realm`, `view-realm`, `query-users`, `query-realms`). Mismos roles
> que pide el setup manual de `docs/KEYCLOAK-SETUP.md`.

---

## Flujo manual (referencia / debugging)

Si querés entender qué hace `deploy.ps1` por debajo, o intervenir manualmente:

### Modo MongoDB
```powershell
kubectl apply -f infra/k8s/common/namespace.yaml
docker build -t restaurant/api:manual    apps/api
docker build -t restaurant/search:manual apps/search
kubectl apply -f infra/k8s/common -R
kubectl set image deployment/api api=restaurant/api:manual -n proyecto01-restaurante
kubectl set image deployment/search search=restaurant/search:manual -n proyecto01-restaurante
kubectl apply -f infra/k8s/mongo  -R
# Esperar a que los 9 pods de mongod estén Running:
kubectl get pods -n proyecto01-restaurante -w
# Inicializar replica sets + sharding (PowerShell nativo, sin dependencia de bash):
.\infra\mongo\init.ps1
kubectl rollout restart deployment/api -n proyecto01-restaurante
```

> En Linux/macOS o WSL podés usar el equivalente bash:
> `NAMESPACE=proyecto01-restaurante bash infra/mongo/init.sh`. En Windows
> `init.ps1` es lo recomendado (deploy.ps1 lo invoca automáticamente).

### Modo PostgreSQL
```powershell
kubectl apply -f infra/k8s/common/namespace.yaml
docker build -t restaurant/api:manual    apps/api
docker build -t restaurant/search:manual apps/search
kubectl apply -f infra/k8s/common -R
kubectl set image deployment/api api=restaurant/api:manual -n proyecto01-restaurante
kubectl set image deployment/search search=restaurant/search:manual -n proyecto01-restaurante
# Generar el ConfigMap real desde los SQL:
kubectl create configmap postgres-init-scripts `
  --from-file="00-init.sql=database/init.sql" `
  --from-file="01-stored-procedures.sql=database/stored-procedures.sql" `
  --from-file="02-mesas.sql=database/crearMesas.sql" `
  -n proyecto01-restaurante --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f infra/k8s/postgres -R
# Patchear DB_ENGINE en el ConfigMap de la API:
kubectl patch configmap api-config -n proyecto01-restaurante --type merge -p '{\"data\":{\"DB_ENGINE\":\"postgres\"}}'
kubectl rollout restart deployment/api -n proyecto01-restaurante
```

---

## Topología detallada de Mongo

```
csrs (config server RS, 3 pods):  configsvr-0 (P), configsvr-1, configsvr-2
rs0  (shard1, 3 pods):            shard1-0    (P), shard1-1,    shard1-2
rs1  (shard2, 3 pods):            shard2-0    (P), shard2-1,    shard2-2
mongos (router, 1 pod):           mongos-...

Total: 10 pods (9 mongod + 1 mongos)
```

Distribución de datos:
- `menuitems`    → SHARDED entre `rs0` y `rs1` (shard key: `menuId` hashed)
- `reservations` → SHARDED entre `rs0` y `rs1` (shard key: `idRestaurante` hashed)
- `users`, `restaurants`, `menus`, `orders`, `mesas` → no sharded (viven solo en `rs0`)

---

## Troubleshooting

### `restaurant/api:*` o `restaurant/search:*` no se encuentra (`ImagePullBackOff`)
La imagen no se construyó localmente o el deployment apunta a un tag que Docker
Desktop no tiene. Lo más simple es volver a correr `deploy.ps1`, que construye
tags únicos y actualiza los deployments con `kubectl set image`.

Si lo hacés manual:
```powershell
docker build -t restaurant/api:manual    apps/api
docker build -t restaurant/search:manual apps/search
kubectl set image deployment/api api=restaurant/api:manual -n proyecto01-restaurante
kubectl set image deployment/search search=restaurant/search:manual -n proyecto01-restaurante
```

### Los pods de Mongo se quedan en `CrashLoopBackOff`
Probable: el script de inicialización no corrió o falló a mitad. Revisá:
```powershell
kubectl logs <pod> -n proyecto01-restaurante
.\infra\mongo\init.ps1
```
Tanto `init.ps1` como `init.sh` son idempotentes: detectan shards/sharding/
colecciones ya configurados y los skippean.

### Keycloak demora en arrancar
Es normal — primera vez tarda 60–120 s porque corre migrations sobre su
Postgres y luego importa el realm. El `readinessProbe` está configurado para
tolerarlo (`failureThreshold: 30`).

### El Ingress responde 404
- Verificá que el controller esté Ready: `kubectl get pods -n ingress-nginx`.
- Verificá que el Ingress se creó: `kubectl describe ingress restaurant-ingress -n proyecto01-restaurante`.
- Pegale a la URL correcta: `/api/...` o `/search/...` (el path completo se reenvía al backend, sin rewrite).

### El JWT issuer no machea
Cuando la API obtiene el token, el `iss` queda como
`http://keycloak-service:8080/realms/restaurant-realm`. La validación JWKS
también va contra esa URL — coinciden, no debería haber problema.
Si hacés login directo en Keycloak vía port-forward (`localhost:8080`), los
tokens emitidos por ese login externo tendrán issuer `http://localhost:8080/...`
y la API los rechazará. Solución: hacé login a través de la API
(`POST /api/auth/login`), no directo en Keycloak.

### Postgres no tiene tablas (DB_ENGINE=postgres)
`deploy.ps1` ahora valida el schema y aborta con error si quedaron menos de
5 tablas o menos de 5 stored procedures. Si igualmente te quedaste con un
volumen vacío en Postgres (ej. lo aplicaste manualmente sin generar el
ConfigMap real), borralo y volvé a desplegar:
```powershell
kubectl delete pvc -l app=postgres -n proyecto01-restaurante
kubectl delete pod -l app=postgres -n proyecto01-restaurante
.\infra\k8s\deploy.ps1 -DbEngine postgres
```

### `deploy.ps1` aborta con "Conflicto de motores"
Por diseño: el namespace ya tiene el motor contrario al que pediste. La regla
del proyecto es que nunca conviven Mongo y Postgres app. Solución:
```powershell
.\infra\k8s\destroy.ps1
.\infra\k8s\deploy.ps1 -DbEngine <mongo|postgres>
```

---

## Referencias rápidas

| Recurso             | DNS interno                | Puerto    |
|---------------------|----------------------------|-----------|
| API                 | `api-service`              | 80 → 3000 |
| Search              | `search-service`           | 80 → 3001 |
| Postgres app        | `postgres-service`         | 5432      |
| Mongo (mongos)      | `mongos-service`           | 27017     |
| Redis               | `redis-service`            | 6379      |
| Elasticsearch       | `elasticsearch-service`    | 9200      |
| Keycloak            | `keycloak-service`         | 8080      |
| Postgres Keycloak   | `keycloak-postgres`        | 5432      |
