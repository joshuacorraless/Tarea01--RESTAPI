# ADR-001: Estructura de carpetas del proyecto

## Contexto

El proyecto combina varias piezas: una API REST en TypeScript, un microservicio
de búsqueda, scripts de inicialización para una base SQL, manifiestos de
Kubernetes y configuración para varios motores de almacenamiento (PostgreSQL,
MongoDB sharded, Redis, Elasticsearch). Necesitamos un layout que separe
claramente el código de las aplicaciones, la infraestructura y la
documentación, sin mezclar responsabilidades en una sola carpeta gigante.

## Decisión tomada

Adoptar un layout tipo *monorepo liviano* dividido en cuatro raíces:

```
apps/         → código de los servicios (API, search)
infra/        → manifiestos K8s, configuración Redis y scripts de bootstrap
database/    → SQL de inicialización (schema, stored procedures, seeds)
docs/         → ADRs, diagramas, colección Postman, guía de Keycloak
compose.yaml → orquestación de Docker Compose para desarrollo local
```

| Carpeta             | Contiene                                                                 |
|---------------------|--------------------------------------------------------------------------|
| `apps/api/`         | API principal: Express + TypeScript + Zod + DAO postgres/mongo           |
| `apps/search/`      | Microservicio de búsqueda Elasticsearch (Express + cliente `@elastic`)   |
| `infra/k8s/`        | Manifiestos para Docker Desktop + scripts `deploy.ps1` / `destroy.ps1`   |
| `infra/mongo/`      | `init.ps1` que arma replica sets y habilita sharding                     |
| `infra/redis/`      | `redis.conf` (espejo del ConfigMap de K8s)                               |
| `database/`         | `init.sql`, `stored-procedures.sql`, `crearMesas.sql`                    |
| `docs/adr/`         | Decisiones arquitectónicas (este archivo y los siguientes)               |

## Justificación

- **Separación clara**: cada raíz tiene un único motivo para cambiar (código,
  infra, datos, docs). Modificar manifiestos no obliga a tocar el código.
- **Escalabilidad del repo**: cuando se agregó el microservicio de búsqueda
  (`apps/search/`) no hubo que reorganizar nada — encajó como otra carpeta
  hermana de `apps/api/`.
- **Reusabilidad del SQL**: `database/*.sql` se usa tanto desde
  `compose.yaml` (montado como volumen) como desde `deploy.ps1` (cargado a
  un ConfigMap), sin duplicación.
- **Docs versionadas con el código**: tener los ADRs dentro del repo asegura
  que la documentación evolucione junto con la implementación.

## Alternativas consideradas

- **Layout plano con todo en `src/`**: descartado, no escala cuando hay más
  de un servicio y mezcla TypeScript con YAML.
- **Repos separados por servicio**: descartado para el alcance del curso —
  añade overhead de coordinación (versionado, CI, sincronización) que no
  aporta valor a una entrega académica.
- **Monorepo con herramienta dedicada (Nx, Turborepo)**: descartado porque
  agrega complejidad innecesaria para dos aplicaciones con dependencias
  independientes.

## Principios aplicados

- **Separación de responsabilidades**: aplicación, infraestructura y datos
  viven en raíces distintas.
- **Convención sobre configuración**: cualquier persona que entra al repo
  encuentra inmediatamente dónde buscar.
- **Infraestructura como código**: `infra/` versiona todo lo que define el
  entorno de ejecución.
- **Configuración externa**: el código no contiene secretos ni hostnames;
  todo viene por variables de entorno definidas en `compose.yaml` o en
  ConfigMaps/Secrets de Kubernetes.

## Consecuencias

**Ventajas**
- Onboarding rápido: la estructura es predecible.
- Cambios de infra no obligan a recompilar las apps.
- El SQL de inicialización se reutiliza entre Compose y K8s desde un solo
  origen de verdad.

**Compromisos**
- Hay un ligero overhead al tener dos `package.json` (`apps/api/` y
  `apps/search/`); cada servicio gestiona sus dependencias por separado.
- El pipeline de build necesita conocer ambos proyectos; lo resuelve
  `deploy.ps1` ejecutando dos `docker build`.
