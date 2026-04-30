# Handoff Fase 7 — Kubernetes

> Documento de traspaso de contexto. Pegarle este archivo a Claude en una próxima sesión equivale a recuperar todo el estado de la conversación previa, incluyendo memoria, estado del repo, decisiones tomadas y preguntas abiertas que faltaba contestar para arrancar la Fase 7.

---

## 1. Estado del repositorio (snapshot tomado al inicio de la conversación)

### Branch y commits

- **Branch actual:** `feature/kubernetes`
- **Working tree:** limpio, en sincronía con `origin/feature/kubernetes`
- **Branches existentes (locales y remotas):**
  - `main`, `develop`
  - `feature/DAO-layer`, `feature/cicd`, `feature/repo-restructure`
  - `feature/mongoDB`, `feature/redis-cache`, `feature/elastic-search`
  - `feature/kubernetes` (donde estamos)

### Últimos commits relevantes

```
6f878e0 Merge pull request #5 from joshuacorraless/feature/redis-cache
136f839 Merge branch 'develop' into feature/redis-cache
3b947f6 hotfix: agregado findAll a MongoMenuItemDao
433277a Merge pull request #4 from joshuacorraless/feature/elastic-search
c54f0b8 Merge branch 'develop' into feature/elastic-search
7260883 ES completado
6d56726 aqui ya implemente el cacheo con Redis en la API
05a2d0c Merge pull request #3 from joshuacorraless/feature/mongoDB
6ae27f9 prueba de infraestrucutra con k8s
39731ca Desarrollo de fase 04, fase 4.1 completada. DAO completado…
1a160e3 commit inicial de elastic search: cliente, service y controller
b2cecc0 Merge pull request #2 from joshuacorraless/feature/repo-restructure
032c0b2 Merge pull request #1 from joshuacorraless/feature/cicd
```

### Estructura `infra/` actual

```
infra/
├── elasticsearch/.gitkeep
├── nginx/.gitkeep
├── redis/redis.conf                     ← config de Redis (Fase 6)
├── mongo/init.sh                        ← script de inicialización del sharded cluster
└── k8s/
    ├── api/.gitkeep                     ← VACÍO — pendiente Fase 7
    ├── search/.gitkeep                  ← VACÍO — pendiente Fase 7
    ├── redis/.gitkeep                   ← VACÍO — pendiente Fase 7
    ├── elasticsearch/.gitkeep           ← VACÍO — pendiente Fase 7
    └── mongo/
        ├── configsvr.yaml               ← Config Server RS (csrs, 3 pods)
        ├── shards.yaml                  ← rs0 (3) + rs1 (3)
        └── mongos.yaml                  ← Query router + ClusterIP service
```

### Dockerfiles existentes

- `apps/api/Dockerfile` — multi‑stage no, build directo + `npm prune --production`. Expone 3000. CMD `node dist/server.js`.
- `apps/search/Dockerfile` — multi‑stage (builder + runtime). Expone 3001. CMD `node dist/server.js`.

### compose.yaml en raíz (dev local)

Servicios: `postgres` (5433), `keycloak` (8080), `mongo` standalone (27017), `redis` (6379), `api` (PORT del .env), `elasticsearch` (9200), `search` (3001).

---

## 2. Memoria persistente (resumen de fases anteriores)

### Fase 4 — MongoDB (completada 2026-04-24/25, branch `feature/mongoDB`, mergeada)

**Adapter (4.1):**
- `apps/api/src/config/database.mongo.ts` con conexión Mongoose y soporte opcional de replica set.
- 7 modelos Mongoose en `apps/api/src/dao/mongo/models/` con UUIDs como `_id` (compatibles con Postgres).
- 6 DAOs en `apps/api/src/dao/mongo/`: User, Restaurant, Menu, MenuItem, Reservation, Order.
- `DaoFactory.ts` actualizado: el motor `mongo` ya no lanza error.
- `server.ts` llama `connectMongo()` al arrancar si `DB_ENGINE=mongo`.
- `env.ts` agrega `MONGODB_URI` y `MONGO_REPLICA_SET` (ambas opcionales).
- Soft delete vía `deletedAt: Date | null`.
- `getAvailableTables` con `$expr` + `$add` para solapamiento de intervalos.
- `RestaurantModel.aggregate` con `$lookup` (equivalente al JOIN de Postgres).
- 41 tests unitarios nuevos → 191 totales, 98.43% líneas.

**Cluster sharded (4.2, rehecho 2026-04-25):**
- Topología final (8 pods):
  - `csrs` (config server RS): `configsvr-0`
  - `rs0` (shard1): `shard1-0` (PRIMARY p=2), `shard1-1`, `shard1-2`
  - `rs1` (shard2): `shard2-0` (PRIMARY p=2), `shard2-1`, `shard2-2`
  - `mongos` (router) → `--configdb csrs/configsvr-0.configsvr:27017`
- Manifiestos: `infra/k8s/mongo/configsvr.yaml`, `shards.yaml`, `mongos.yaml`.
- Init: `infra/mongo/init.sh` ejecuta `rs.initiate()`, espera elecciones, `sh.addShard()`, `sh.enableSharding('restaurant_db', 'rs0')`, `sh.shardCollection()`.
- Distribución: `menuitems` y `reservations` sharded por hash; `users`, `restaurants`, `menus`, `orders`, `mesas` no sharded (viven solo en rs0).
- La API se conecta a `mongos-service:27017` desde dentro del cluster.

### Fase 6 — Redis Cache (completada 2026-04-26, branch `feature/redis-cache`, mergeada)

- `apps/api/src/config/redis.ts` — singleton client, `connectRedis()` + `getRedisClient()`.
- `apps/api/src/middlewares/cache.middleware.ts` — `cacheMiddleware(ttlSeconds)` + `invalidateCache(...patterns)`.
- `infra/redis/redis.conf` — `maxmemory 128mb`, `allkeys-lru`, sin persistencia.
- 10 tests nuevos → 201 totales, 97.93% cobertura.
- Patrón Cache‑Aside. TTLs: restaurantes 120s, menús 120s, items 60s.
- Invalidación: clave exacta en creates; wildcard en puts/deletes.
- Degradación segura: si Redis no responde, `getRedisClient()` retorna `null` y el middleware llama `next()` sin fallar.
- `compose.yaml` ya incluye servicio `redis:7-alpine` con healthcheck.
- Variables: `REDIS_URL` opcional en `env.ts`.

### Fase 5 — ElasticSearch (completada, branch `feature/elastic-search`, mergeada)

- Microservicio en `apps/search/` (Express + TypeScript).
- Endpoints: `/search/products` (text), `/search/products/category/:categoria`, `/search/reindex`.
- Client de ES en `apps/search/src/config/elasticsearch.ts`.
- Health en `apps/search/src/app.ts:9` → `GET /health`.
- Config (`apps/search/src/config/env.ts`): `PORT` (3001 default), `ELASTICSEARCH_URL`, `API_INTERNAL_URL`.
- Las rutas se montan internamente bajo `/search/...` (`apps/search/src/routes/index.ts:6`: `router.use('/search', searchRoutes)`).
- Compose ya incluye el servicio `search` y el `elasticsearch:8.13.0` (single-node, xpack disabled).

---

## 3. Lo que dice CLAUDE.md (instrucciones del proyecto)

```
apps/api/      ← Express + TypeScript service
apps/search/   ← microservicio ElasticSearch
infra/         ← k8s manifests + nginx/mongo/redis/elasticsearch configs
database/      ← SQL init scripts mounted by compose into Postgres
docs/          ← ADRs, diagrams, Keycloak setup, Postman collection
compose.yaml   ← orchestrates Postgres + Keycloak + API for local dev
```

**Layer:** Routes → Middleware → Controllers → Services → DAO → DB.

**Persistencia:** los services NUNCA llaman `pool.query()` directo — pasan por DAO.
- `apps/api/src/dao/interfaces/` — contratos
- `apps/api/src/dao/postgres/` — implementación Postgres (stored procedures `sp_*`)
- `apps/api/src/dao/mongo/` — implementación Mongo (Fase 4 ✅)
- `apps/api/src/dao/DaoFactory.ts` — selecciona engine vía `DB_ENGINE`

**Auth:** Keycloak 26 con JWKS RS256. Roles: `client` o `restaurant_admin`.

**Tests:** unit con full mocking (no DB ni Keycloak reales). `apps/api/src/__tests__/setup.ts` mockea `env`, `database`, `keycloak`. Threshold: ≥90% líneas.

**Variables de entorno requeridas (Zod en `apps/api/src/config/env.ts`):**
- `PORT` (default 3000)
- `DATABASE_URL` (requerida; URL Postgres)
- `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` — TODAS requeridas, falla con `process.exit(1)` si falta alguna
- `DB_ENGINE` (`postgres` | `mongo`, default `postgres`) — opcional
- `MONGODB_URI`, `MONGO_REPLICA_SET`, `REDIS_URL` — opcionales

---

## 4. La guía oficial (FASE 7) — resumen de lo que pide

**Branch:** `feature/kubernetes` (ya estamos en ella).

**Objetivo:** Definir manifiestos K8s para todos los servicios, configurar Nginx Ingress y demostrar escalado horizontal con `kubectl`.

**Arquitectura objetivo:**

```
Exterior
   ▼
[Nginx Ingress Controller]
   │
   ├─► /api/**   ──►  [Service: api-service]   ──►  [Pod api ×N]
   └─► /search/** ──► [Service: search-service] ──►  [Pod search ×N]

Internos (ClusterIP):
  [Service: redis]         ──► [Pod redis]
  [Service: mongo]         ──► [Pods mongo StatefulSet]   ✅ ya hecho
  [Service: elasticsearch] ──► [Pod elasticsearch]
```

**Manifiestos que pide la guía:**
- `infra/k8s/api/{deployment.yaml, service.yaml, configmap.yaml}` — Deployment con `readinessProbe` + `livenessProbe` apuntando a `/health`, ConfigMap con `DB_ENGINE`, `REDIS_URL`, `MONGODB_URI`.
- `infra/k8s/search/{deployment.yaml, service.yaml}` — análogo, con `ELASTICSEARCH_URL` por env, probe en `/health`.
- `infra/k8s/redis/{deployment.yaml, service.yaml}` (la guía no lo detalla, pero está en el diagrama).
- `infra/k8s/elasticsearch/{statefulset.yaml, service.yaml}` (idem).
- `infra/k8s/ingress.yaml` — Nginx Ingress con `nginx.ingress.kubernetes.io/rewrite-target: /$2`, paths `/api(/|$)(.*)` y `/search(/|$)(.*)`.

**Defensas orales preparadas (transcritas literal de la guía):**
- *"Docker Compose orquesta contenedores en una sola máquina y no tiene primitivas nativas de escalado, self‑healing ni rolling updates. Kubernetes gestiona el ciclo de vida completo de los pods…"*
- *"Un Deployment gestiona pods intercambiables y sin estado —correcto para la API. MongoDB necesita identidad estable: el pod mongo‑0 siempre debe ser el primario… StatefulSet provee exactamente esas garantías."*
- *"Un Service LoadBalancer expone un solo servicio… El Ingress Controller actúa como API Gateway: un único punto de entrada que enruta por path."*

**Comando de demo final:**
```bash
kubectl apply -f infra/k8s/
kubectl scale deployment api --replicas=3
kubectl scale deployment search --replicas=2
kubectl get pods -l app=api
kubectl logs -l app=api --tail=20 --follow
```

---

## 5. Decisiones de plataforma confirmadas por el usuario

- **Plataforma de Kubernetes:** Docker Desktop Kubernetes (no minikube, no kind). Implicaciones:
  - El daemon de Docker es compartido → imágenes locales construidas con `docker build` son visibles para el cluster sin push a registry. Usar `imagePullPolicy: IfNotPresent` o `Never`.
  - PVCs funcionan out‑of‑the‑box con `hostpath-provisioner`.
  - **El Ingress Controller NO viene incluido**; hay que instalarlo aparte (ver `kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml`).
- **Mantener:** todo lo que ya se montó queda intacto (compose para dev, sharded cluster Mongo en K8s, CI/CD).

---

## 6. Las 5 preguntas abiertas que el usuario va a responder después de consultar

> El usuario explícitamente pidió pausar la implementación hasta tener veredicto completo. Estas son las decisiones que faltan; cada una tiene mi recomendación, pero esperar respuesta del usuario antes de tocar manifiestos.

### Pregunta 1 — Keycloak en K8s (la más crítica)

La API valida JWT contra el JWKS de Keycloak en cada request autenticado. El env Zod aborta si faltan las vars de Keycloak. La guía no lo incluye en el diagrama de K8s.

- **A) Desplegar Keycloak en K8s** — Deployment de Keycloak + StatefulSet de Postgres dedicado (con PVC) para su DB. Cluster auto‑contenido. **Más trabajo (~2 manifiestos extra).**
- **B) Apuntar al Keycloak del compose** vía `host.docker.internal:8080`. Simple pero acopla K8s a compose corriendo en paralelo.
- **C) Keycloak en K8s con H2 dev** — sin Postgres separado. Pierde persistencia entre restarts.

**Mi recomendación: A.**

### Pregunta 2 — Motor de DB para la demo en K8s

- **A) Solo Mongo en K8s** (`DB_ENGINE=mongo` fijo en ConfigMap). Aprovecha el sharded cluster ya armado.
- **B) Postgres también en K8s** (StatefulSet + montaje de SQL de `database/`). Permite alternar `DB_ENGINE` con edit del ConfigMap. Suma 2 manifiestos.

**Mi recomendación: A.**

### Pregunta 3 — Estrategia de imágenes

- **A) Imágenes locales** con tags `restaurant/api:dev` y `restaurant/search:dev` + `imagePullPolicy: IfNotPresent`. Cero registry. Demo en 1 minuto.
- **B) Imágenes desde GHCR** que ya publica el CI/CD. Más realista pero requiere `imagePullSecrets`.

**Mi recomendación: A** para la demo local; el CI/CD sigue intacto en background.

### Pregunta 4 — Namespace

- **A) `restaurant`** dedicado (best practice).
- **B) `default`** (más simple).

**Mi recomendación: A.**

### Pregunta 5 — Hostname del Ingress

- **A) `restaurant.local`** mapeado en `C:\Windows\System32\drivers\etc\hosts`.
- **B) Sin hostname** — el Ingress matchea cualquier host; acceso vía `http://localhost/api/...`.

**Mi recomendación: B** (no requiere editar hosts).

---

## 7. Plan que se ejecutará una vez confirmadas las preguntas

Asumiendo respuestas `A, A, A, A, B` (recomendaciones por defecto), el plan es:

### Estructura de archivos a crear

```
infra/k8s/
├── namespace.yaml                ← namespace restaurant
├── api/
│   ├── deployment.yaml           ← image: restaurant/api:dev, probes a /health, envFrom configmap+secret, IfNotPresent
│   ├── service.yaml              ← ClusterIP api-service:80 → 3000
│   ├── configmap.yaml            ← PORT=3000, DB_ENGINE=mongo, REDIS_URL=redis://redis-service:6379,
│   │                                MONGODB_URI=mongodb://mongos-service:27017/restaurant_db,
│   │                                KEYCLOAK_BASE_URL=http://keycloak-service:8080, KEYCLOAK_REALM=...
│   └── secret.yaml               ← KEYCLOAK_*_SECRET, DATABASE_URL (placeholder porque Mongo)
├── search/
│   ├── deployment.yaml           ← image: restaurant/search:dev, probe /health
│   └── service.yaml              ← ClusterIP search-service:80 → 3001
├── redis/
│   ├── configmap.yaml            ← redis.conf montado
│   ├── deployment.yaml           ← redis:7-alpine, command apunta al configmap montado
│   └── service.yaml              ← redis-service:6379
├── elasticsearch/
│   ├── statefulset.yaml          ← elasticsearch:8.13.0, single-node, xpack.security.enabled=false,
│   │                                ES_JAVA_OPTS=-Xms512m -Xmx512m, PVC 2Gi
│   └── service.yaml              ← elasticsearch-service:9200
├── keycloak/                     ← solo si A en pregunta 1
│   ├── postgres-statefulset.yaml ← postgres:16-alpine dedicado, PVC, DB keycloak_db
│   ├── postgres-service.yaml     ← keycloak-postgres:5432
│   ├── deployment.yaml           ← quay.io/keycloak/keycloak:26.0, start-dev,
│   │                                KC_DB=postgres, KC_DB_URL apuntando al StatefulSet
│   └── service.yaml              ← keycloak-service:8080
├── mongo/                        ← YA EXISTE, no se toca
│   ├── configsvr.yaml
│   ├── shards.yaml
│   └── mongos.yaml
└── ingress.yaml                  ← nginx ingress: /api → api-service, /search → search-service
```

### Detalles de los manifiestos clave

- **api/deployment.yaml**:
  - `replicas: 1` (se sube con `kubectl scale` en demo).
  - `readinessProbe` GET `/health` puerto 3000, `initialDelaySeconds: 5`, `periodSeconds: 10`.
  - `livenessProbe` GET `/health`, `initialDelaySeconds: 15`, `periodSeconds: 20`.
  - `envFrom: [configMapRef: api-config, secretRef: api-secrets]`.
  - `imagePullPolicy: IfNotPresent`.
  - `resources.requests`: 100m CPU, 256Mi memoria; `limits`: 500m, 512Mi.

- **search/deployment.yaml**:
  - Mismas probes con puerto 3001 y path `/health`.
  - Env: `PORT=3001`, `ELASTICSEARCH_URL=http://elasticsearch-service:9200`, `API_INTERNAL_URL=http://api-service` (puerto 80 internamente porque el Service expone 80).

- **ingress.yaml**:
  - `ingressClassName: nginx`.
  - Annotation `nginx.ingress.kubernetes.io/use-regex: "true"`.
  - Annotation `nginx.ingress.kubernetes.io/rewrite-target: /$2`.
  - **Atención al rewrite:** Express en la API monta sus rutas bajo `/api` (`apps/api/src/app.ts:18`: `app.use('/api', routes)`). Y el search monta bajo `/search` (`apps/search/src/routes/index.ts:6`: `router.use('/search', searchRoutes)`). Por lo tanto el Ingress **no debe** strippear el prefix — debe pasar el path tal cual al backend. Revisar y ajustar el rewrite‑target apropiado (probablemente `/$1$2` o sin rewrite, pasando el prefix completo). Confirmar al implementar.

- **README de operación** (`infra/k8s/README.md`):
  ```
  # 1. Activar Kubernetes en Docker Desktop (Settings → Kubernetes → Enable)
  # 2. Instalar Nginx Ingress Controller (una sola vez):
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml
  # 3. Crear namespace
  kubectl apply -f infra/k8s/namespace.yaml
  # 4. Build de imágenes locales
  docker build -t restaurant/api:dev apps/api
  docker build -t restaurant/search:dev apps/search
  # 5. Apply de todo
  kubectl apply -f infra/k8s/ -n restaurant
  # 6. Inicializar sharded cluster (si no se hizo antes)
  bash infra/mongo/init.sh
  # 7. Verificar
  kubectl get pods -n restaurant
  kubectl get svc -n restaurant
  kubectl get ingress -n restaurant
  # 8. Demo de escalado
  kubectl scale deployment api --replicas=3 -n restaurant
  kubectl scale deployment search --replicas=2 -n restaurant
  kubectl get pods -l app=api -n restaurant
  kubectl logs -l app=api --tail=20 --follow -n restaurant
  # 9. Acceso
  curl http://localhost/api/restaurants
  curl http://localhost/search/products?q=casado
  ```

---

## 8. Cosas a verificar al implementar (checklist mental)

- [ ] El path‑rewrite del Ingress respeta los prefixes que la API y search ya esperan internamente (`/api` y `/search`).
- [ ] Si voy con Keycloak en K8s (Opción A en pregunta 1), `KEYCLOAK_BASE_URL` en el ConfigMap apunta al Service interno `http://keycloak-service:8080`. El JWT issuer debe ser consistente con esa URL — validar si el JWT emitido lleva un issuer URL distinto y si eso rompe la validación JWKS. Posible necesidad de configurar el realm con `KC_HOSTNAME`.
- [ ] Las imágenes `restaurant/api:dev` y `restaurant/search:dev` deben existir localmente antes del `kubectl apply`. Documentar en README.
- [ ] El namespace `restaurant` debe crearse antes de aplicar otros manifiestos. Idealmente `kustomization.yaml` o que el README lo aplique en orden.
- [ ] El sharded cluster Mongo existente (`infra/k8s/mongo/`) NO declara namespace. Habría que decidir si añadir `metadata.namespace: restaurant` a esos archivos o aplicarlos con `-n restaurant` desde el comando.
- [ ] La API y el search necesitan su `PORT` correcto en envs (`3000` y `3001` respectivamente).
- [ ] `DATABASE_URL` sigue siendo requerida por el Zod aunque `DB_ENGINE=mongo`. Hay que pasarle un placeholder válido (formato URL Postgres) o flexibilizar el schema. **Decisión a confirmar al implementar.**
- [ ] Tests siguen pasando con la nueva configuración (no se tocan, pero validar que no se rompió nada por accidente).
- [ ] Health endpoint de la API responde aunque Mongo/Redis estén caídos (sino el livenessProbe va a matar pods en arranque).

---

## 9. Cómo retomar la conversación en una próxima sesión

Pegar este archivo como contexto y decirle a Claude:

> "Aquí tenés el handoff completo de la Fase 7 que dejamos pendiente. Mis respuestas a las 5 preguntas son: **[respuestas]**. Procede con el plan."

O bien, si las respuestas cambian respecto a las recomendaciones:

> "Respuestas: 1=B, 2=A, 3=A, 4=A, 5=B. El motivo del cambio en 1 es [...]. Empezá."

Claude debe:
1. Leer el archivo (Read tool).
2. Revalidar el estado con `git status`, `git log`, y verificación de los archivos clave (`apps/api/src/app.ts`, `apps/api/src/config/env.ts`, manifiestos existentes en `infra/k8s/mongo/`).
3. Proceder con el plan adaptado a las respuestas dadas.
4. Pausar de nuevo si encuentra cualquier ambigüedad nueva.

---

*Documento generado el 2026-04-29 al final de la conversación de planificación de Fase 7. Mantener vigente hasta que la fase quede mergeada.*
