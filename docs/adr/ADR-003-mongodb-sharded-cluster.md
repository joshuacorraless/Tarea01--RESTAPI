# ADR-003: MongoDB sharded cluster con replica sets

## Contexto

El curso requiere demostrar **replicación** y **sharding** sobre una base de
datos NoSQL. Un MongoDB *standalone* en Docker Compose es suficiente para
desarrollo local, pero no demuestra ni replicación (alta disponibilidad) ni
particionamiento horizontal (escalado de almacenamiento). Necesitamos una
topología que sea defendible como entorno productivo dentro del cluster
Kubernetes del proyecto.

## Decisión tomada

Desplegar un **sharded cluster** completo en Kubernetes con tres replica
sets (*replica set*: grupo de réplicas con un primario y secundarios para
tolerancia a fallos):

| Componente              | Replica set | Pods | Rol                                          |
|-------------------------|-------------|------|----------------------------------------------|
| Config Server           | `csrs`      | 3    | Guarda metadatos del cluster (qué chunk vive en qué shard) |
| Shard 1                 | `rs0`       | 3    | Datos del primary shard de `restaurant_db` |
| Shard 2                 | `rs1`       | 3    | Datos sharded distribuidos por hash         |
| `mongos`                | —           | 1    | *Query router*: punto de entrada único       |

Total: **10 pods** (9 `mongod` + 1 `mongos`). La API se conecta solo al
servicio `mongos-service:27017`.

**Distribución de colecciones**

| Colección       | Estrategia    | Shard key            |
|-----------------|---------------|----------------------|
| `menuitems`     | Sharded       | `{ menuId: 'hashed' }` |
| `reservations`  | Sharded       | `{ idRestaurante: 'hashed' }` |
| `users`, `restaurants`, `menus`, `orders`, `mesas` | No sharded | — (viven en `rs0`) |

La inicialización (replica sets, registro de shards, habilitación de
sharding) la ejecuta `infra/mongo/init.ps1` invocado por `deploy.ps1`. El
script es **idempotente**: detecta si los replica sets ya están iniciados o
las colecciones ya tienen sharding habilitado y skippea esas operaciones.

## Justificación

- **Replicación real**: cada shard es un replica set de 3 nodos. Si el
  primario cae, MongoDB elige automáticamente uno de los secundarios.
- **Sharding hash-based**: la *shard key* hash distribuye datos uniformemente
  sin riesgo de hot spots por valores secuenciales.
- **Punto de entrada único** (`mongos`): la API no necesita conocer la
  topología — solo conoce el `Service` `mongos-service`.
- **`StatefulSet` para los `mongod`**: garantiza nombres DNS estables
  (`shard1-0.shard1`, etc.) que los replica sets necesitan en su miembro
  list.
- **Headless Services con `publishNotReadyAddresses: true`**: necesario
  durante `rs.initiate()` cuando los pods aún no están *Ready* pero ya
  necesitan resolverse entre sí.

## Alternativas consideradas

- **MongoDB standalone**: descartado, no demuestra replicación ni sharding.
- **Replica set único sin sharding**: cumple replicación pero no
  particionamiento — no satisface la consigna del curso.
- **Sharding con un solo shard**: configurable, pero técnicamente
  equivalente a no shardear — descartado por defendibilidad.
- **MongoDB Atlas u otro servicio gestionado**: fuera del alcance del
  curso (debe correr en Docker Desktop).

## Principios aplicados

- **Escalabilidad horizontal**: el sharding permite agregar más nodos para
  almacenar más datos sin rediseñar la aplicación.
- **Tolerancia a fallos**: la replicación dentro de cada shard mantiene el
  servicio si un pod cae.
- **Idempotencia operacional**: `init.ps1` puede correrse N veces sin
  romper el cluster.
- **Infraestructura como código**: toda la topología está en
  `infra/k8s/mongo/*.yaml` y `infra/mongo/init.ps1`.
- **Aislamiento del cliente**: la app no conoce los shards, solo el router.

## Consecuencias

**Ventajas**
- Demostración clara y defendible de replica sets + sharding.
- `init.ps1` es *self-healing*: re-correr el deploy no daña el estado.
- La API funciona idéntico contra esta topología o contra Postgres simple,
  porque el DAO esconde la diferencia.

**Compromisos**
- 10 pods consumen recursos significativos en Docker Desktop (RAM, disco).
- El primer arranque tarda más que un standalone porque hay que esperar
  elección de primarios y propagación de DNS.
- La complejidad operacional crece: cualquier cambio futuro en topología
  obliga a actualizar `init.ps1` para que siga siendo idempotente.

**Riesgos**
- Si los headless services pierden `publishNotReadyAddresses: true`,
  `rs.initiate()` falla con `No host... maps to this node`. La función
  `Wait-DnsMesh` del script de init mitiga esta carrera.
