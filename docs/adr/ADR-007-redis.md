# ADR-007: Redis como caché Cache-Aside

## Contexto

Los endpoints `GET /api/restaurants`, `GET /api/menus/:id` y similares se
sirven con frecuencia y rara vez cambian. Pegarle a la BD primaria
(Postgres o Mongo) en cada request es desperdicio: agrega latencia y
trabajo a un dato que no varió. Necesitamos una capa de caché que
intercepte requests repetitivos sin acoplar la lógica de cacheo a cada
controlador.

## Decisión tomada

Usar **Redis 7** con la estrategia **Cache-Aside** (la app consulta caché
primero, en miss va a la BD y guarda el resultado), implementada como
**middleware Express** en `apps/api/src/middlewares/cache.middleware.ts`.

**Diseño del middleware**

```text
GET request → cacheMiddleware(ttl)
                │
                ├── Redis.get("cache:" + req.originalUrl)
                │      ├── hit  → res.setHeader('X-Cache','HIT'); res.json(cached)
                │      └── miss → next()
                │                  ↓
                │                Controller → res.json(body)
                │                  ↓
                └── Antes de enviar: Redis.setEx(key, ttl, body) y X-Cache: MISS
```

**Configuración de Redis**

| Parámetro          | Valor                | Razón                                    |
|--------------------|----------------------|------------------------------------------|
| `maxmemory`        | `128mb`              | Límite acotado para no agotar memoria   |
| `maxmemory-policy` | `allkeys-lru`        | Evicción de claves menos usadas          |
| `save ""`          | sin RDB              | Caché sin persistencia                   |
| `appendonly no`    | sin AOF              | Misma razón                              |

**TTLs aplicados** (en `routes/*.ts`)

| Ruta                                | TTL       |
|-------------------------------------|-----------|
| `GET /api/restaurants`              | 120 s     |
| `GET /api/menus/restaurant/:id`     | 120 s     |
| `GET /api/menus/:id`                | 120 s     |
| `GET /api/menus/:menuId/items`      | 60 s      |

**Invalidación**: la utilidad `invalidateCache(...patterns)` borra claves
con wildcards después de POST/PUT/DELETE; los servicios la llaman tras
mutaciones.

**Tolerancia a fallos**: si Redis está caído o la conexión falla, el
middleware deja pasar la request al controlador (`return next()`); la API
sigue funcionando, solo pierde la aceleración.

## Justificación

- **Cache-Aside** es el patrón clásico cuando la BD primaria es la fuente
  de verdad y se quiere que la app controle qué cachear.
- **Middleware Express**: cero código adicional en los controladores.
  Se aplica con `router.get('/', cacheMiddleware(120) as any, list)`.
- **`X-Cache: HIT/MISS`**: header diagnóstico explícito para verificar el
  comportamiento desde un cliente HTTP.
- **Sin persistencia**: la caché es efímera por diseño; reiniciar Redis
  vacía las claves y la API repuebla con las primeras requests.

## Alternativas consideradas

- **Cache en memoria del proceso (Map, lru-cache)**: rápido pero no
  comparte entre réplicas. Si la API tiene 3 réplicas, cada una mantiene
  su propia caché y se desincronizan tras escrituras.
- **Memcached**: similar a Redis pero más limitado (sin TTL granular en
  comandos atómicos, sin tipos complejos). Redis es la referencia más
  común y tiene mejor soporte en Node.
- **Materialización en la BD (vistas materializadas, índices de búsqueda)**:
  válido para consultas costosas, pero no resuelve la latencia por request
  repetitivo.

## Principios aplicados

- **Cache-Aside / lazy loading**: la app controla la caché.
- **Aislamiento de fallos**: si Redis muere, la API responde igual
  (degraded performance, no degraded service).
- **TTL conservador + invalidación explícita**: combinación que evita
  servir datos rancios tras escrituras.
- **Servicios stateless**: la caché vive fuera de la API; cualquier
  réplica accede al mismo Redis.
- **Simplicidad operacional**: una sola instancia, sin clustering.

## Consecuencias

**Ventajas**
- Reduce drásticamente latencia y carga a la BD primaria en endpoints
  hot.
- El middleware encapsula toda la lógica; agregar caché a una nueva ruta
  GET es una sola línea.
- Compatible con cualquier `DB_ENGINE` — el caché es transparente al
  motor.

**Compromisos**
- Hay que recordar invalidar tras cada mutación; un olvido sirve datos
  rancios hasta que expire el TTL.
- Sin persistencia: si el pod reinicia, hay un breve período de cache
  vacío (intencional, aceptable).
- Una sola réplica de Redis: si cae, todos los GETs sirven desde la BD
  hasta que se reponga (la API no se cae, pero pierde aceleración).

**Pendiente / no implementado**
- Redis Cluster o Sentinel para alta disponibilidad: queda como mejora
  futura.
- Métricas de hit ratio expuestas en Prometheus o similar.
