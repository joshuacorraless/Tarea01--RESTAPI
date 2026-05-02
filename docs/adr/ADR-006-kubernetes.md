# ADR-006: Kubernetes como plataforma de orquestación

## Contexto

El proyecto debe demostrar orquestación de varios servicios (API, search,
Mongo sharded, Redis, Elasticsearch, Keycloak) con escalado horizontal y
exposición unificada por un único punto de entrada. Docker Compose alcanza
para desarrollo local, pero no permite simular topologías productivas como
*replica sets*, *Ingress*, *probes* ni `kubectl scale`.

## Decisión tomada

Usar **Kubernetes** corriendo en **Docker Desktop** como plataforma para la
demo. Todos los recursos viven bajo un único *namespace* (espacio lógico
para agrupar recursos): `proyecto01-restaurante`.

**Reparto de tipos de recursos**

| Recurso              | Tipo de workload     | Razón                                        |
|----------------------|----------------------|----------------------------------------------|
| API                  | `Deployment`         | Stateless, escalable                         |
| `search`             | `Deployment`         | Stateless, escalable                         |
| Redis                | `Deployment`         | Caché efímera (sin PVC)                     |
| Keycloak             | `Deployment` (Recreate) | Una sola réplica por las migrations       |
| Postgres (app)       | `StatefulSet`        | Identidad estable + PVC                     |
| Postgres (Keycloak)  | `StatefulSet`        | PVC dedicado al motor de auth               |
| Mongo `csrs`/shards  | `StatefulSet`        | DNS por pod necesario para replica sets     |
| Mongo `mongos`       | `Deployment`         | Stateless (router)                          |
| Elasticsearch        | `StatefulSet`        | PVC para los datos del índice               |

**Acceso externo**: un único `Ingress` (ADR-008) enruta `/api` a
`api-service` y `/search` a `search-service`.

**Selección de motor**: `DB_ENGINE` decide qué motor de negocio se aplica.
El script `deploy.ps1 -DbEngine mongo|postgres` aplica selectivamente solo
los manifiestos del motor elegido. Nunca conviven Mongo y Postgres app en
el mismo namespace.

## Justificación

- **Demuestra orquestación real**: probes (readiness/liveness), pull
  policies, secrets, configmaps, namespaces, ingress, escalado por
  comando.
- **Docker Desktop K8s** evita depender de un cloud, manteniendo la demo
  reproducible en cualquier máquina con Docker.
- **`StatefulSet` para datos** asegura nombres de pod estables
  (`shard1-0`, `shard1-1`, ...) imprescindibles para los replica sets de
  Mongo.
- **Probes**: cada servicio tiene `readinessProbe` y `livenessProbe`
  ajustadas a sus tiempos de arranque (Keycloak corre migrations, Mongo
  espera elección de primario, ES carga heap).

## Alternativas consideradas

- **Solo Docker Compose**: descartado, no demuestra escalado horizontal ni
  Ingress.
- **K3s / Kind / Minikube**: alternativas válidas, pero Docker Desktop ya
  está instalado en las máquinas del curso y trae K8s integrado.
- **Cloud gestionado (GKE, EKS, AKS)**: fuera de alcance — la demo debe ser
  reproducible localmente.

## Principios aplicados

- **Infraestructura como código**: todo manifiesto está en
  `infra/k8s/**/*.yaml`.
- **Servicios stateless donde se pueda**: la API y search escalan a N
  réplicas sin sesión pegajosa.
- **Configuración externa**: `ConfigMap` para parámetros, `Secret` para
  credenciales — el código no carga literales sensibles.
- **Tolerancia a fallos**: probes detectan pods enfermos y los reinician.
- **Simplicidad operacional**: dos scripts (`deploy.ps1` / `destroy.ps1`)
  son la interfaz completa.

## Consecuencias

**Ventajas**
- Permite demos contundentes: `kubectl scale deployment api --replicas=3`
  + tráfico al Ingress muestra balanceo y escalado en vivo.
- Aísla los componentes en pods independientes con sus propios límites de
  CPU y memoria.
- El namespace dedicado deja un espacio limpio: `destroy.ps1` borra todo
  sin riesgo de tocar otros proyectos del cluster.

**Compromisos**
- Levantar todo el stack con Mongo sharded consume ~2-3 GiB de RAM en
  Docker Desktop.
- El Ingress Controller hay que instalarlo una vez por máquina; no es
  parte de los manifiestos del proyecto.
- Las imágenes locales se construyen fuera del cluster con `docker build`
  y K8s las consume vía `imagePullPolicy: IfNotPresent`. Funciona en
  Docker Desktop porque comparten el daemon, pero no es portable a otros
  runtimes (containerd puro, CRI-O).
