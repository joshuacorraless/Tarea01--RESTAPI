# ADR-005: Microservicio dedicado para búsqueda

## Contexto

La búsqueda full-text se apoya en Elasticsearch (ADR-004), pero la API
principal no debería tener que conocer el cliente `@elastic/elasticsearch`,
ni gestionar el reindex, ni depender del estado del cluster ES para servir
sus rutas habituales. Mezclar las responsabilidades acopla dos componentes
que cambian a distintas velocidades y, si ES cae, arrastra a toda la API.

## Decisión tomada

Crear un **microservicio independiente** en `apps/search/`, con su propio
ciclo de vida, dependencias, contenedor y deployment.

**Características**

| Aspecto              | Valor                                                            |
|----------------------|------------------------------------------------------------------|
| Stack                | Node.js + Express + TypeScript                                   |
| Dependencias clave   | `@elastic/elasticsearch`                                         |
| Puerto interno       | `3001`                                                           |
| Service en K8s       | `search-service` (`port 80 → targetPort 3001`)                  |
| Endpoints expuestos  | `GET /search/products?q=...`, `GET /search/products/category/:c`, `POST /search/reindex` |
| Health probe         | `GET /health` (HTTP 200)                                         |

**Comunicación**
- El microservicio **lee** Elasticsearch para servir consultas.
- Para `reindex`, **llama HTTP a la API principal** (`API_INTERNAL_URL` →
  `http://api-service` en K8s) usando `fetch` para obtener la lista plana
  de ítems vía `GET /api/menus/items/all`. Convierte los registros al
  formato ES y los carga en bulk.
- El cliente externo accede a ambos servicios por el mismo Ingress (ver
  ADR-008) bajo prefijos distintos: `/api/...` y `/search/...`.

**Acceso público**
```
   curl http://localhost/api/restaurants
   curl "http://localhost/search/products?q=casado"
```

## Justificación

- **Aislamiento de fallos**: si ES está caído, solo las rutas de búsqueda
  fallan. La API principal sigue sirviendo restaurantes, reservas, pedidos.
- **Despliegue y escalado independientes**: `kubectl scale deployment
  search --replicas=N` no toca a la API.
- **Ownership cognitivo**: cualquier desarrollador que mire `apps/search/`
  entiende todo el dominio de búsqueda en un solo árbol.
- **Reutilización de la API como fuente de verdad**: el microservicio no
  habla directo con la BD; pide los datos por HTTP, así no necesita
  conocer `DB_ENGINE` ni los DAO.

## Alternativas consideradas

- **Implementar las rutas `/search` dentro de la API principal**: simple,
  pero acopla dos servicios que cambian a ritmos distintos y obliga a
  cargar el SDK de ES aunque la app corra en modo `DB_ENGINE=postgres` sin
  necesidad de búsqueda.
- **Microservicio que lea directo de la BD**: tendría que conocer ambos
  motores (postgres/mongo) y se duplicaría el DAO. Descartado.
- **Lambda / serverless**: fuera del alcance del curso (todo debe correr
  en el cluster local).

## Principios aplicados

- **Separación de responsabilidades**: búsqueda y CRUD son dominios
  distintos.
- **Bajo acoplamiento**: comunicación por HTTP con contrato explícito.
- **Servicios stateless**: el microservicio no guarda estado entre
  requests; puede escalar horizontalmente sin afinidad.
- **Tolerancia a fallos parcial**: la caída de un servicio no propaga.

## Consecuencias

**Ventajas**
- API de búsqueda independiente con su propio versionado.
- Permite escalar `search` y `api` con réplicas distintas según carga.
- El Ingress unifica el acceso público bajo un solo dominio sin acoplar
  los servicios.

**Compromisos**
- Hay dos `package.json`, dos Dockerfiles y dos imágenes que mantener.
- El reindex es síncrono y bajo demanda — no hay invalidación automática
  cuando la API crea/actualiza un ítem.
- La autenticación de búsqueda es laxa (no exige JWT en `/search/*`); en
  un escenario productivo conviene revisar.

**Pendiente / no implementado**
- Sincronización automática entre la API principal y el índice ES (CDC,
  eventos, outbox). Hoy depende de invocar `POST /search/reindex` a mano.
- Rate limiting más estricto: existe un `searchLimiter` básico, pero no
  está documentado el límite efectivo.
