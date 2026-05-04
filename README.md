<div align="center">

# **PROYECTO 01 — RESTAURANTES E2**

**REST API distribuida para la gestión de restaurantes, reservas, menús y pedidos**                                                                           
*Curso de Bases de Datos 2 — Tecnológico de Costa Rica*

![Node](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8-005571?style=for-the-badge&logo=elasticsearch&logoColor=white)
![Keycloak](https://img.shields.io/badge/Keycloak-26-4D4D4D?style=for-the-badge&logo=keycloak&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-1.30-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-blue?style=for-the-badge&logo=docker&logoColor=white)

![Coverage](https://img.shields.io/badge/coverage-≥90%25-brightgreen?style=flat-square)
![Tests](https://img.shields.io/badge/tests-201%20unit%20%2B%20integración-success?style=flat-square)

</div>

---

## Sobre el proyecto

**Restaurantes E2** es un **sistema backend completo** para administrar restaurantes con su catálogo de menús, mesas, reservas y pedidos. La gracia del proyecto está en que **toda la capa de persistencia es intercambiable**: la misma API puede correr sobre **PostgreSQL** (con stored procedures) o sobre un **cluster sharded de MongoDB** según el valor de la variable `DB_ENGINE`, sin tocar una línea de código de negocio.

Por encima de eso, el sistema agrega:

- **Microservicio de búsqueda** independiente, indexando datos en **Elasticsearch** y visualizables en **Kibana**.
- **Cache-Aside con Redis** para acelerar lecturas frecuentes.
- **Autenticación delegada a Keycloak** vía JWT con roles (`client` / `restaurant_admin`).
- **Despliegue completo en Kubernetes** (Docker Desktop) con NGINX como Ingress y API Gateway.
- **Pipeline de CI/CD** con GitHub Actions y cobertura mínima del **90 %**.

> El objetivo académico es demostrar **abstracción del motor de base de datos**, **sharding + replicación**, **balanceo de carga** y **separación de microservicios** en un mismo dominio de negocio.

---

## Integrantes

| Nombre | Carné |
|---|---|
| **Joshua Corrales Retana** | `2024073529` |
| **Felipe Lepiz Retana** | `2024800990` |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| **Runtime** | Node.js 20 + TypeScript |
| **Framework HTTP** | Express 5 |
| **Persistencia** | PostgreSQL 16 **o** MongoDB 7 sharded — seleccionable con `DB_ENGINE` |
| **Cache** | Redis (patrón Cache-Aside) |
| **Búsqueda** | Elasticsearch + Kibana (microservicio dedicado) |
| **Autenticación** | Keycloak 26 (JWT con JWKS) |
| **Orquestación** | Kubernetes (Docker Desktop) + NGINX Ingress |
| **CI/CD** | GitHub Actions |

---

## Cómo levantar el proyecto

> **Guía oficial paso a paso** en
> [`Guia para correr proyecto y verificar funcionalidad.md`](./Guia%20para%20correr%20proyecto%20y%20verificar%20funcionalidad.md).
> Cubre el ciclo completo: levantar el cluster, cargar datos con el seed,
> indexar en Elasticsearch, probar endpoints y bajar todo.

**Resumen rápido** (desde la raíz del repo):

```powershell
# 1. Levantar el cluster con MongoDB sharded
.\infra\k8s\deploy.ps1 -DbEngine mongo

# 2. Cargar datos generados por LLM (Gemini)
node database/seeds/generate-seeds.js

# 3. Indexar en Elasticsearch
curl.exe -X POST http://localhost/search/reindex

# 4. Probar
curl.exe http://localhost/api/restaurants
```

Para **bajar el cluster**: `.\infra\k8s\destroy.ps1`

---


## Endpoints

**Documentación interactiva en Swagger:**

- **Kubernetes:** `http://localhost/api-docs`
- **Docker Compose:** `http://localhost:3000/api-docs`

### Tabla resumen

| Método | Ruta | Rol requerido | Descripción |
|:------:|------|:------:|-------------|
| `GET`    | `/health` | — | Health check |
| `POST`   | `/api/auth/register` | — | **Registrar usuario** |
| `POST`   | `/api/auth/login` | — | **Login** (devuelve tokens) |
| `GET`    | `/api/users/me` | autenticado | Mi perfil |
| `PUT`    | `/api/users/:id` | propio | Actualizar perfil |
| `DELETE` | `/api/users/:id` | propio | Eliminar mi cuenta |
| `GET`    | `/api/restaurants` | — | Listar restaurantes |
| `POST`   | `/api/restaurants` | `restaurant_admin` | Crear restaurante |
| `GET`    | `/api/menus/:id` | — | Ver menú |
| `POST`   | `/api/menus` | `restaurant_admin` | Crear menú |
| `PUT`    | `/api/menus/:id` | `restaurant_admin` | Actualizar menú |
| `DELETE` | `/api/menus/:id` | `restaurant_admin` | Eliminar menú |
| `GET`    | `/api/menus/:id/items` | — | Ítems del menú |
| `POST`   | `/api/menus/:id/items` | `restaurant_admin` | Crear ítem |
| `GET`    | `/api/reservations/available-tables` | — | Mesas disponibles |
| `POST`   | `/api/reservations` | `client` | Crear reserva |
| `GET`    | `/api/reservations/me` | `client` | Mis reservas |
| `DELETE` | `/api/reservations/:id` | `client` | Cancelar reserva |
| `POST`   | `/api/orders` | `client` | Crear pedido |
| `GET`    | `/api/orders/:id` | autenticado | Ver pedido |
| `POST`   | `/api/orders/:id/items` | `client` | Agregar ítem al pedido |
| `PATCH`  | `/api/orders/:id/status` | `restaurant_admin` | Cambiar estado |
| `GET`    | `/search/products?q=...` | — | **Búsqueda full-text** |
| `GET`    | `/search/products/category/:categoria` | — | Búsqueda por categoría |
| `POST`   | `/search/reindex` | — | Reindexar Elasticsearch |

---

## Pruebas

```bash
cd apps/api
npm test                 # unitarias + integración
npm run test:coverage    # con reporte de cobertura
```

> **Cobertura mínima exigida:** `90 %` de líneas.
> Reporte HTML en [`apps/api/coverage/lcov-report/index.html`](./apps/api/coverage/lcov-report/index.html).

---

## Documentación adicional

| Documento | Descripción |
|---|---|
| [**Guía oficial paso a paso**](./Guia%20para%20correr%20proyecto%20y%20verificar%20funcionalidad.md) | Flujo completo de levantamiento y verificación |
| [**Despliegue en Kubernetes**](./infra/k8s/README.md) | Manifiestos, topología y scripts de deploy |
| [**Seeds con Gemini**](./database/seeds/README.md) | Generación de datos de prueba con LLM |
| [**Architecture Decision Records**](./docs/adr/README.md) | Decisiones técnicas documentadas |

---

<div align="center">

**Tecnológico de Costa Rica** — *Bases de Datos 2* — *2026*

</div>
