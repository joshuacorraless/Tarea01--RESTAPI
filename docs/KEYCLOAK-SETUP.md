# guia de configuracion de keycloak

## que es keycloak

keycloak es un servicio de autenticacion y autorizacion de codigo abierto (hecho por red hat). funciona como un "servidor de identidad". en vez de que tu api maneje passwords, login, sesiones y tokens manualmente, keycloak se encarga de todo eso. tu api solo le pide a keycloak "crea este usuario", "autentica este usuario", y despues valida los tokens jwt que keycloak emite.

## como funciona en este proyecto

```
usuario -> POST /api/auth/register -> tu api -> keycloak admin api (crea usuario)
                                             -> postgresql (crea registro local)

usuario -> POST /api/auth/login -> tu api -> keycloak token endpoint
                                          <- access_token + refresh_token
         <- tokens al usuario

usuario -> GET /api/users/me (con access_token) -> tu api valida el jwt contra keycloak jwks
                                                 -> si es valido, ejecuta la logica
```

---

## paso 1: levantar los contenedores

```bash
docker compose up -d
```

esto levanta 3 servicios:
- **postgres** en `localhost:5432` (con las tablas ya creadas automaticamente)
- **keycloak** en `localhost:8080` (admin console)
- **api** en `localhost:3000` (tu rest api)

esperamos unos 30-60 segundos a que keycloak termine de arrancar. se puede verificar abriendo `http://localhost:8080` en el navegador.

---

## paso 2: entrar al admin console de keycloak

1. abrir `http://localhost:8080` en el navegador
2. click en **Administration Console**
3. login con:
   - username: `admin`
   - password: `admin`

---

## paso 3: crear el realm

un "realm" en keycloak es como un espacio aislado que contiene sus propios usuarios, roles y configuraciones. no vamos a usar el realm "master" (ese es solo para admin).

1. en la esquina superior izquierda, donde dice **master**, hacer click
2. click en **Create realm**
3. en **Realm name** escribir: `restaurant-realm`
4. click en **Create**

ahora estamos dentro del realm `restaurant-realm`.

---

## paso 4: crear los roles del realm

los roles definen que puede hacer cada usuario. necesitamos dos: `client` y `restaurant_admin`.

1. en el menu lateral izquierdo, click en **Realm roles**
2. click en **Create role**
3. en **Role name** escribir: `client`
4. click en **Save**
5. volver a **Realm roles**
6. click en **Create role** otra vez
7. en **Role name** escribir: `restaurant_admin`
8. click en **Save**

---

## paso 5: crear el client `restaurant-api`

un "client" en keycloak representa una aplicacion que se conecta al realm. nuestra api es un client.

1. en el menu lateral, click en **Clients**
2. click en **Create client**
3. configuracion general:
   - **Client type**: `OpenID Connect`
   - **Client ID**: `restaurant-api`
   - click en **Next**
4. capability config:
   - **Client authentication**: `ON` (esto lo convierte en un client confidencial, necesario para tener un secret)
   - **Authorization**: dejalo en `OFF`
   - **Authentication flow**: marcar estas casillas:
     - [x] Standard flow (para login por navegador, no lo usamos pero no estorba)
     - [x] Direct access grants (** esto es obligatorio para que funcione el login por password desde la api)
   - click en **Next**
5. login settings:
   - **Valid redirect URIs**: `*` (para desarrollo local, en produccion pondrias la url real)
   - click en **Save**

### obtener el client secret:

6. despues de guardar, vas a la pestana **Credentials**
7. ahi ves el **Client secret** - copia ese valor
8. ese es tu `KEYCLOAK_CLIENT_SECRET` para el `.env`

---

## paso 6: configurar admin-cli para la api admin

nuestra api necesita poder crear usuarios en keycloak (cuando alguien se registra). para eso usa el client `admin-cli` con service account.

1. en el menu lateral, click en **Clients**
2. busca y click en **admin-cli**
3. en la pestana **Settings**:
   - **Client authentication**: `ON`
   - **Service accounts roles**: `ON` (esto permite que admin-cli tenga un token propio sin necesidad de un usuario humano)
   - click en **Save**
4. ve a la pestana **Credentials**
5. copia el **Client secret** - ese es tu `KEYCLOAK_ADMIN_CLIENT_SECRET`

### asignar permisos al service account:

el service account de admin-cli necesita permisos para crear usuarios y asignar roles.

6. ve a la pestana **Service account roles**
7. click en **Assign role**
8. en el dropdown de filtro, cambiar de "Filter by realm roles" a **"Filter by clients"**
9. buscar `realm-management`
10. marcar los siguientes roles:
    - [x] `manage-users` (para crear y eliminar usuarios)
    - [x] `view-users` (para buscar usuarios)
    - [x] `manage-realm` (para acceder a roles del realm)
    - [x] `view-realm` (para leer roles del realm)
11. click en **Assign**

---

## paso 7: actualizar el .env con los secrets

ahora que tenes los dos secrets, actualiza tu `.env`:

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
KEYCLOAK_CLIENT_SECRET=<el-secret-del-paso-5>
KEYCLOAK_ADMIN_CLIENT_ID=admin-cli
KEYCLOAK_ADMIN_CLIENT_SECRET=<el-secret-del-paso-6>
```

**importante:** los secrets se pasan como variables de entorno via el archivo `.env` en la raiz del proyecto. docker compose lo lee automaticamente gracias a la sintaxis `${VARIABLE}` en `compose.yaml`.

---

## paso 8: reiniciar la api con los secrets correctos

si ya corriste `docker compose up -d` antes de configurar keycloak, necesitas reiniciar la api:

```bash
# poner los secrets en el .env y reiniciar
docker compose down
docker compose up -d
```

---

## paso 9: probar que funciona

### registrar un usuario:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Juan Perez",
    "email": "juan@example.com",
    "password": "password123",
    "phone": "+506 8888-8888",
    "role": "client"
  }'
```

respuesta esperada:
```json
{
  "success": true,
  "message": "user registered successfully",
  "data": {
    "id": "un-uuid",
    "fullName": "Juan Perez",
    "email": "juan@example.com",
    "role": "client",
    "phone": "+506 8888-8888"
  }
}
```

### login:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "password123"
  }'
```

respuesta esperada:
```json
{
  "success": true,
  "message": "login successful",
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzUxMiIs...",
    "expiresIn": 300,
    "tokenType": "Bearer"
  }
}
```

### usar el token para acceder a un endpoint protegido:

```bash
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <el-accessToken-del-login>"
```

---

## paso 10: verificar en keycloak que el usuario se creo

1. ir a keycloak admin console: `http://localhost:8080`
2. asegurarte de estar en el realm `restaurant-realm`
3. en el menu lateral, click en **Users**
4. deberias ver el usuario `juan@example.com` en la lista
5. si haces click en el usuario y vas a **Role mappings**, deberia tener el rol `client` asignado

---

## resumen de urls

| servicio | url | proposito |
|----------|-----|-----------|
| keycloak admin console | http://localhost:8080 | configurar keycloak manualmente |
| keycloak token endpoint | http://keycloak:8080/realms/restaurant-realm/protocol/openid-connect/token | la api llama aqui para login |
| keycloak jwks | http://keycloak:8080/realms/restaurant-realm/protocol/openid-connect/certs | la api valida tokens contra esto |
| keycloak admin api | http://keycloak:8080/admin/realms/restaurant-realm | la api crea usuarios aqui |
| api | http://localhost:3000 | tu rest api |
| swagger | http://localhost:3000/api-docs | documentacion interactiva |
| postgresql | localhost:5432 | base de datos |

**nota**: las urls con `keycloak:8080` son internas (dentro de docker network). desde tu navegador usas `localhost:8080`. la api usa `keycloak:8080` porque esta dentro del mismo docker network.

---

## troubleshooting comun

### "connection refused" al registrar usuario
- keycloak no termino de arrancar. espera 30-60 segundos y reintenta.
- verifica con: `docker logs restaurant-keycloak`

### "401 unauthorized" en admin api
- el `KEYCLOAK_ADMIN_CLIENT_SECRET` es incorrecto.
- el `admin-cli` no tiene service account habilitado.
- el service account no tiene los roles `manage-users`, `view-users`, etc.

### "invalid grant" al hacer login
- direct access grants no esta habilitado en el client `restaurant-api`.
- el `KEYCLOAK_CLIENT_SECRET` es incorrecto.
- el usuario no existe en keycloak.

### "invalid or expired token" en endpoints protegidos
- el token expiro (por defecto dura 5 minutos en keycloak).
- el `KEYCLOAK_BASE_URL` de la api no coincide con el issuer del token.
  - dentro de docker: `http://keycloak:8080`
  - el token dice issuer `http://localhost:8080` si te logueaste desde fuera de docker
  - solucion: asegurate de que login y validacion usen la misma url base

### scripts sql no se ejecutaron
- solo se ejecutan la PRIMERA vez que el volumen se crea.
- si necesitas reiniciar desde cero: `docker compose down -v` (borra volumenes) y luego `docker compose up -d`

---

## claims del jwt de keycloak utilizados

cuando keycloak emite un access token, el payload contiene:

```json
{
  "sub": "uuid-del-usuario-en-keycloak",
  "email": "juan@example.com",
  "realm_access": {
    "roles": ["client", "default-roles-restaurant-realm"]
  },
  "iss": "http://keycloak:8080/realms/restaurant-realm",
  ...
}
```

la api usa:
- **`sub`** → se guarda como `external_auth_id` en la tabla `users`. es el vinculo entre keycloak y la bd local.
- **`email`** → se adjunta a `req.user` para referencia.
- **`realm_access.roles`** → se usa para verificar si el usuario es `client` o `restaurant_admin`.
- **`iss`** → se valida para asegurar que el token fue emitido por nuestro keycloak.
