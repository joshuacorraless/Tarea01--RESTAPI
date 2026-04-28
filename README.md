# Reserva de Restaurantes — Tarea 01 REST API

Para el curso de Bases de Datos 2, desarollamos una API REST para la gestión de restaurantes, reservas, menús y pedidos. Construida con Node.js, TypeScript, PostgreSQL y Keycloak como servicio de autenticación.

---
## Integrantes:

- **Joshua Corrales Retana (2024073529)**
- **Felipe Lepiz Retana (2024800990)**
 ---
## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) corriendo
- Node.js 20+ (solo para correr las pruebas localmente)
- npm

---

## Levantar el proyecto

```bash
docker compose up -d
```

Esto levanta tres contenedores:

| Contenedor | URL | Descripción |
|------------|-----|-------------|
| API | `http://localhost:3000` | La REST API |
| Keycloak | `http://localhost:8080` | Servidor de autenticación |
| PostgreSQL | `localhost:5433` | Base de datos |

El esquema de la base de datos y los datos iniciales se crean automáticamente la primera vez.

> Espera 30-60 segundos después del `docker compose up` antes de hacer requests. Keycloak tarda en iniciar.

Para detener todo:

```bash
docker compose down
```

Para detener y borrar los volúmenes (reset completo de la base de datos):

```bash
docker compose down -v
```

---

## Configuración de Keycloak (primer uso)

Keycloak es el servicio que maneja autenticación y tokens JWT. La primera vez que se levante el proyecto hay que configurarlo manualmente. Solo se hace una vez.

### 1. Entrar al admin console

Abrir `http://localhost:8080`, click en **Administration Console** e ingresar con:
- **Usuario:** `admin`
- **Contraseña:** `admin`

### 2. Crear el realm

Un realm es el espacio de trabajo aislado de Keycloak para este proyecto.

1. En la esquina superior izquierda, donde dice **master**, click
2. Click en **Create realm**
3. **Realm name:** `restaurant-realm`
4. Click en **Create**

### 3. Crear los roles

1. En el menú lateral, click en **Realm roles**
2. Click en **Create role** → nombre: `client` → **Save**
3. Repetir y crear el rol `restaurant_admin`

### 4. Crear el client `restaurant-api`

1. Menú lateral → **Clients** → **Create client**
2. **Client type:** `OpenID Connect` | **Client ID:** `restaurant-api` → **Next**
3. Activar **Client authentication: ON**
4. En Authentication flow, marcar:
   - [x] Standard flow
   - [x] Direct access grants ← obligatorio para login por password
5. **Next** → **Valid redirect URIs:** `*` → **Save**
6. Ir a la pestaña **Credentials** y copiar el **Client secret**
7. Pegar ese valor en el `.env` como `KEYCLOAK_CLIENT_SECRET`

### 5. Configurar `admin-cli`

La API necesita poder crear usuarios en Keycloak cuando alguien se registra. Para eso usamos `admin-cli`.

1. **Clients** → buscar y abrir `admin-cli`
2. Pestaña **Settings:**
   - **Client authentication:** `ON`
   - **Service accounts roles:** `ON`
   - **Save**
3. Pestaña **Credentials** → copiar el **Client secret**
4. Pegar ese valor en el `.env` como `KEYCLOAK_ADMIN_CLIENT_SECRET`
5. Pestaña **Service account roles** → **Assign role**
6. En el filtro, cambiar a **"Filter by clients"** → buscar `realm-management`
7. Asignar estos 4 roles:
   - [x] `manage-users`
   - [x] `view-users`
   - [x] `manage-realm`
   - [x] `view-realm`
8. Click en **Assign**

### 6. Actualizar el `.env` y reiniciar

```env
PORT=3000
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=restaurant_db
KC_ADMIN_USERNAME=admin
KC_ADMIN_PASSWORD=admin
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/restaurant_db
KEYCLOAK_BASE_URL=http://keycloak:8080
KEYCLOAK_REALM=restaurant-realm
KEYCLOAK_CLIENT_ID=restaurant-api
KEYCLOAK_CLIENT_SECRET=<secret del paso 4>
KEYCLOAK_ADMIN_CLIENT_ID=admin-cli
KEYCLOAK_ADMIN_CLIENT_SECRET=<secret del paso 5>
```

Después de actualizar el `.env`:

```bash
docker compose down
docker compose up -d
```

---

## Cómo funciona la autenticación

```
Registro:
  POST /api/auth/register  →  API crea usuario en Keycloak  →  API guarda registro en PostgreSQL

Login:
  POST /api/auth/login  →  API pide token a Keycloak  →  devuelve accessToken + refreshToken al cliente

Requests protegidas:
  Authorization: Bearer <accessToken>  →  API valida el JWT contra Keycloak JWKS  →  ejecuta la lógica
```

El `accessToken` tiene una duración de 5 minutos. Cada usuario tiene un rol: `client` o `restaurant_admin`, que determina a qué endpoints puede acceder.

---

## Endpoints disponibles

La documentación interactiva y completa de la API la podemos encontrar en Swagger:

```
http://localhost:3000/api-docs
```

Resumen de rutas:

| Método | Ruta | Rol requerido | Descripción |
|--------|------|---------------|-------------|
| GET | `/health` | — | Health check |
| POST | `/api/auth/register` | — | Registrar usuario |
| POST | `/api/auth/login` | — | Login, devuelve tokens |
| GET | `/api/users/me` | cualquiera | Ver mi perfil |
| PUT | `/api/users/:id` | propio | Actualizar mi perfil |
| DELETE | `/api/users/:id` | propio | Eliminar mi cuenta |
| GET | `/api/restaurants` | — | Listar restaurantes |
| POST | `/api/restaurants` | restaurant_admin | Crear restaurante |
| POST | `/api/menus` | restaurant_admin | Crear menú |
| GET | `/api/menus/:id` | cualquiera | Ver un menú |
| PUT | `/api/menus/:id` | restaurant_admin | Actualizar menú |
| DELETE | `/api/menus/:id` | restaurant_admin | Eliminar menú |
| POST | `/api/menus/:id/items` | restaurant_admin | Agregar ítem al menú |
| GET | `/api/menus/:id/items` | cualquiera | Ver ítems de un menú |
| GET | `/api/reservations/available-tables` | client | Consultar mesas disponibles |
| POST | `/api/reservations` | client | Crear reserva |
| GET | `/api/reservations/my` | client | Ver mis reservas |
| GET | `/api/reservations/:id` | client | Ver una reserva |
| PATCH | `/api/reservations/:id/cancel` | client | Cancelar reserva |
| POST | `/api/orders` | client | Crear pedido |
| GET | `/api/orders/:id` | client | Ver un pedido |
| GET | `/api/orders/my` | client | Ver mis pedidos |
| POST | `/api/orders/:id/items` | client | Agregar ítem al pedido |
| PATCH | `/api/orders/:id/status` | restaurant_admin | Actualizar estado del pedido |

---

## Flujo de uso típico

```
1. Registrar un cliente             POST /api/auth/register  { role: "client" }
2. Registrar un admin de restaurante POST /api/auth/register  { role: "restaurant_admin" }
3. Login con cada usuario           POST /api/auth/login
4. El admin crea un restaurante     POST /api/restaurants
5. El admin crea un menú            POST /api/menus
6. El admin agrega ítems al menú    POST /api/menus/:id/items
7. El cliente consulta mesas        GET  /api/reservations/available-tables?restaurantId=...&reservadoPara=...
8. El cliente crea una reserva      POST /api/reservations
9. El cliente crea un pedido        POST /api/orders  { idReserva: ... }
10. El cliente agrega ítems          POST /api/orders/:id/items
11. El admin actualiza el estado     PATCH /api/orders/:id/status
```

---

## Pruebas unitarias

Las pruebas cubren controladores, servicios y utilidades. Están en `src/__tests__/` y se ejecutan con Jest sin necesidad de Docker ni base de datos real (todo está simulado con mocks).

```bash
# Correr todas las pruebas unitarias
npm test

# Ver reporte de cobertura en la terminal
npm run test:coverage

# Modo watch (re-corre las pruebas al guardar archivos)
npm run test:watch
```

El proyecto exige mínimo **90% de cobertura de líneas**. Si algún archivo baja de ese umbral, el comando termina con error.

El reporte de cobertura en HTML se genera en `coverage/lcov-report/index.html` — se debe abrir en el navegador para ver qué líneas de cada archivo fueron o no ejecutadas por las pruebas.

---

## Estructura del proyecto

```
src/
├── config/          # Conexión a base de datos, variables de entorno, Keycloak
├── controllers/     # Reciben el request HTTP y delegan al servicio correspondiente
├── middlewares/     # Autenticación JWT, autorización por rol, validación de schemas
├── routes/          # Definición de rutas y qué middleware aplica a cada una
├── schemas/         # Validaciones de entrada con Zod
├── services/        # Lógica de negocio, llaman a los stored procedures de PostgreSQL
├── utils/           # Helpers de respuesta (sendSuccess / sendError)
└── __tests__/       # Pruebas unitarias de todas las capas

database/
├── init.sql              # Esquema completo de la base de datos
├── stored-procedures.sql # Todos los stored procedures
└── crearMesas.sql        # Seed: 10 mesas por restaurante

docs/
├── swagger.json          # Especificación OpenAPI
└── postman-collection.json
```
