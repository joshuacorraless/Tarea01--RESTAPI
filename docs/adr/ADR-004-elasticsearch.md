# ADR-004: Elasticsearch como motor de búsqueda full-text

## Contexto

La búsqueda de productos del menú por texto libre, categoría o relevancia no
es un caso de uso para SQL ni para MongoDB primario. Hacer `LIKE '%casado%'`
sobre Postgres o `$regex` sobre Mongo escala mal y no soporta análisis
lingüístico (stemming, sinónimos, scoring por relevancia). Necesitamos un
motor especializado que se integre con el resto del stack sin contaminar la
base de datos transaccional.

## Decisión tomada

Incorporar **Elasticsearch 8.13** como índice de búsqueda dedicado, con un
único índice `products` que contiene una proyección desnormalizada de los
ítems de menú.

**Topología**
- En **Docker Compose**: un contenedor `elasticsearch` en modo `single-node`,
  sin seguridad (`xpack.security.enabled=false`).
- En **Kubernetes**: `StatefulSet` con 1 réplica, headless Service
  (`elasticsearch-service`), `volumeClaimTemplate` de 2 GiB para la data.

**Mapping del índice** (definido en `apps/search/src/config/elasticsearch.ts`):

| Campo          | Tipo                                    | Notas                              |
|----------------|-----------------------------------------|------------------------------------|
| `id`           | `keyword`                               | Identificador exacto                |
| `restaurantId` | `keyword`                               | Para filtrar por restaurante       |
| `menuId`       | `keyword`                               | Para invalidar índices por menú     |
| `nombre`       | `text` (analyzer `spanish`)             | Buscable por relevancia             |
| `categoria`    | `text` + `keyword` multi-field          | Texto + agregaciones exactas        |
| `descripcion`  | `text` (analyzer `spanish`)             | Buscable                            |
| `precio`       | `float`                                 | Filtros numéricos                   |
| `disponible`   | `boolean`                               | Filtro                              |

La búsqueda principal usa `multi_match` con boosts:
`fields: ['nombre^3', 'categoria^2', 'descripcion']`.

El **reindex** se invoca como `POST /search/reindex`: el microservicio pide
todos los ítems a la API (`/api/menus/items/all`), los normaliza al
documento ES y hace `bulk` con `refresh: true`. No hay pipeline asíncrono
(CDC, eventos): el reindex se dispara manualmente.

## Justificación

- **Búsqueda full-text con scoring**: los `multi_match` con analyzer
  español permiten resultados ordenados por relevancia, sin esfuerzo extra
  en la aplicación.
- **No contamina la BD primaria**: la API sigue siendo el sistema de
  registro autoritativo; ES es solo un *read replica* especializado.
- **Trabajo aislado**: el microservicio de búsqueda (ADR-005) consume ES y
  expone HTTP — la API principal no necesita el SDK de Elasticsearch.

## Alternativas consideradas

- **Búsqueda en Postgres con `tsvector` + `tsquery`**: más simple, pero
  acopla la búsqueda al motor relacional y obliga a mantener triggers de
  indexación. Además, no escala con datasets grandes ni soporta el caso en
  que `DB_ENGINE=mongo`.
- **Búsqueda en Mongo con `$text`**: limitada en analyzers y scoring
  comparado con ES; además sería específica del motor Mongo.
- **Otro motor (Meilisearch, Typesense, OpenSearch)**: válidos, pero
  Elasticsearch es la referencia clásica del curso y tiene mayor base de
  documentación.

## Principios aplicados

- **CQRS aplicado en lo pequeño**: separamos el modelo de escritura (BD
  principal) del modelo de lectura especializado (ES).
- **Servicios stateless**: el microservicio que habla con ES no guarda
  estado propio.
- **Idempotencia**: el reindex borra el índice y lo recrea desde cero, así
  que repetir la operación es seguro.
- **Bajo acoplamiento**: si ES cae, las rutas `/search/*` fallan, pero las
  de `/api/*` siguen funcionando.

## Consecuencias

**Ventajas**
- Búsqueda potente con muy poco código.
- Análisis lingüístico en español incluido.
- Independiente del motor de la BD principal: funciona con
  `DB_ENGINE=postgres` o `=mongo`.

**Compromisos**
- ES consume RAM significativa (heap mínimo configurado en 512 MB) — el pod
  pide 768 MiB y limita a 1 GiB.
- El reindex es manual; no hay sincronización en tiempo real entre la BD
  primaria y ES. Si un ítem se crea o actualiza, ES queda desincronizado
  hasta el próximo `POST /search/reindex`.

**Pendiente / no implementado**
- Cluster ES con varios nodos: actualmente es `discovery.type=single-node`,
  apropiado para demo pero no para producción real.
- Autenticación: `xpack.security.enabled=false` solo es válido detrás del
  cluster privado.
