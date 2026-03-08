# guia de pruebas - todas las requests disponibles

esta guia contiene todas las requests que podes hacer con postman (o cualquier cliente http) para probar la api.

**base url:** `http://localhost:3000/api`

---

## 0. health check

verifica que la api esta corriendo.

```
GET http://localhost:3000/health
```

**respuesta esperada (200):**
```json
{
  "status": "ok"
}
```

---

## 1. auth - registro y login

### 1.1 registrar usuario con rol `client`

```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "fullName": "Juan Perez",
  "email": "juan@example.com",
  "password": "password123",
  "phone": "+506 8888-8888",
  "role": "client"
}
```

**respuesta esperada (201):**
```json
{
  "success": true,
  "message": "user registered successfully",
  "data": {
    "id": "uuid-generado",
    "fullName": "Juan Perez",
    "email": "juan@example.com",
    "role": "client",
    "phone": "+506 8888-8888"
  }
}
```

### 1.2 registrar usuario con rol `restaurant_admin`

```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "fullName": "Maria Rodriguez",
  "email": "maria@example.com",
  "password": "password123",
  "phone": "+506 7777-7777",
  "role": "restaurant_admin"
}
```

**respuesta esperada (201):** misma estructura que 1.1 pero con `"role": "restaurant_admin"`

### 1.3 registrar usuario sin telefono (campo opcional)

```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "fullName": "Carlos Mora",
  "email": "carlos@example.com",
  "password": "password123"
}
```

**respuesta esperada (201):** el campo `phone` sera `null`, el `role` sera `"client"` por defecto.

### 1.4 registrar usuario con email duplicado (error esperado)

```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "fullName": "Juan Duplicado",
  "email": "juan@example.com",
  "password": "password123"
}
```

**respuesta esperada (409):**
```json
{
  "success": false,
  "message": "user with this email already exists",
  "data": null
}
```

### 1.5 registrar con datos invalidos (error de validacion)

```
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "fullName": "J",
  "email": "no-es-email",
  "password": "123"
}
```

**respuesta esperada (400):** error de validacion de zod indicando los campos invalidos.

### 1.6 login con credenciales correctas

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "juan@example.com",
  "password": "password123"
}
```

**respuesta esperada (200):**
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

**importante:** copia el `accessToken` — lo necesitas para todas las requests protegidas.

### 1.7 login con credenciales incorrectas (error esperado)

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "juan@example.com",
  "password": "password-incorrecto"
}
```

**respuesta esperada (401):**
```json
{
  "success": false,
  "message": "invalid email or password",
  "data": null
}
```

### 1.8 login con email que no existe (error esperado)

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "noexiste@example.com",
  "password": "password123"
}
```

**respuesta esperada (401):** mismo error que 1.7.

### 1.9 login sin body (error de validacion)

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{}
```

**respuesta esperada (400):** error de validacion indicando campos requeridos.

---

## 2. users - perfil del usuario

> todas las requests de esta seccion requieren el header:
> `Authorization: Bearer <accessToken>`

### 2.1 obtener mi perfil (como client)

primero hace login con juan@example.com (paso 1.6) y usa ese token.

```
GET http://localhost:3000/api/users/me
Authorization: Bearer <accessToken-de-juan>
```

**respuesta esperada (200):**
```json
{
  "success": true,
  "message": "user profile retrieved",
  "data": {
    "id": "uuid-de-juan",
    "fullName": "Juan Perez",
    "email": "juan@example.com",
    "role": "client",
    "phone": "+506 8888-8888",
    "createdAt": "2026-03-07T...",
    "updatedAt": "2026-03-07T..."
  }
}
```

### 2.2 obtener mi perfil (como restaurant_admin)

hace login con maria@example.com y usa ese token.

```
GET http://localhost:3000/api/users/me
Authorization: Bearer <accessToken-de-maria>
```

**respuesta esperada (200):** misma estructura con los datos de maria y `"role": "restaurant_admin"`.

### 2.3 obtener perfil sin token (error esperado)

```
GET http://localhost:3000/api/users/me
```

**respuesta esperada (401):**
```json
{
  "success": false,
  "message": "access token is required",
  "data": null
}
```

### 2.4 obtener perfil con token invalido (error esperado)

```
GET http://localhost:3000/api/users/me
Authorization: Bearer token-falso-inventado
```

**respuesta esperada (401):**
```json
{
  "success": false,
  "message": "invalid or expired token",
  "data": null
}
```

### 2.5 actualizar mi perfil (nombre y telefono)

usa el token de juan y su `id` (obtenido en 2.1).

```
PUT http://localhost:3000/api/users/<id-de-juan>
Authorization: Bearer <accessToken-de-juan>
Content-Type: application/json

{
  "fullName": "Juan Perez Actualizado",
  "phone": "+506 9999-9999"
}
```

**respuesta esperada (200):**
```json
{
  "success": true,
  "message": "user updated successfully",
  "data": {
    "id": "uuid-de-juan",
    "fullName": "Juan Perez Actualizado",
    "email": "juan@example.com",
    "role": "client",
    "phone": "+506 9999-9999",
    "updatedAt": "2026-03-07T..."
  }
}
```

### 2.6 actualizar solo el nombre

```
PUT http://localhost:3000/api/users/<id-de-juan>
Authorization: Bearer <accessToken-de-juan>
Content-Type: application/json

{
  "fullName": "Juan Nombre Nuevo"
}
```

**respuesta esperada (200):** el nombre cambia, el telefono se queda como estaba.

### 2.7 actualizar solo el telefono

```
PUT http://localhost:3000/api/users/<id-de-juan>
Authorization: Bearer <accessToken-de-juan>
Content-Type: application/json

{
  "phone": "+506 1111-1111"
}
```

**respuesta esperada (200):** el telefono cambia, el nombre se queda como estaba.

### 2.8 intentar actualizar el perfil de otro usuario (error esperado)

usa el token de juan pero el id de maria.

```
PUT http://localhost:3000/api/users/<id-de-maria>
Authorization: Bearer <accessToken-de-juan>
Content-Type: application/json

{
  "fullName": "Hackeado"
}
```

**respuesta esperada (403):**
```json
{
  "success": false,
  "message": "forbidden: you can only update your own profile",
  "data": null
}
```

### 2.9 actualizar con id que no existe (error esperado)

```
PUT http://localhost:3000/api/users/00000000-0000-0000-0000-000000000000
Authorization: Bearer <accessToken-de-juan>
Content-Type: application/json

{
  "fullName": "Nadie"
}
```

**respuesta esperada (404):**
```json
{
  "success": false,
  "message": "user not found",
  "data": null
}
```

### 2.10 eliminar mi cuenta (soft delete)

**nota:** esta operacion marca al usuario como eliminado, no lo borra fisicamente. usa un usuario de prueba que no necesites (por ejemplo carlos@example.com del paso 1.3).

```
DELETE http://localhost:3000/api/users/<id-de-carlos>
Authorization: Bearer <accessToken-de-carlos>
```

**respuesta esperada (200):**
```json
{
  "success": true,
  "message": "user deleted successfully",
  "data": null
}
```

### 2.11 intentar eliminar la cuenta de otro usuario (error esperado)

```
DELETE http://localhost:3000/api/users/<id-de-maria>
Authorization: Bearer <accessToken-de-juan>
```

**respuesta esperada (403):**
```json
{
  "success": false,
  "message": "forbidden: you can only delete your own account",
  "data": null
}
```

---

## 3. restaurants - gestion de restaurantes

### 3.1 listar restaurantes (endpoint publico)

no requiere autenticacion.

```
GET http://localhost:3000/api/restaurants
```

**respuesta esperada (200):**
```json
{
  "success": true,
  "message": "restaurants retrieved",
  "data": []
}
```

si ya creaste restaurantes, el array tendra objetos con la info de cada restaurante.

### 3.2 crear restaurante (como restaurant_admin)

primero hace login con maria@example.com (rol `restaurant_admin`) y usa ese token.

```
POST http://localhost:3000/api/restaurants
Authorization: Bearer <accessToken-de-maria>
Content-Type: application/json

{
  "name": "La Casona",
  "description": "Restaurante de comida tipica costarricense",
  "address": "San Jose, Costa Rica",
  "phone": "+506 2222-2222",
  "openingHours": "Lun-Vie 8:00-22:00"
}
```

**respuesta esperada (201):**
```json
{
  "success": true,
  "message": "restaurant created successfully",
  "data": {
    "id": "uuid-generado",
    "name": "La Casona",
    "description": "Restaurante de comida tipica costarricense",
    "address": "San Jose, Costa Rica",
    "phone": "+506 2222-2222",
    "openingHours": "Lun-Vie 8:00-22:00",
    "adminUserId": "uuid-de-maria",
    "createdAt": "2026-03-07T..."
  }
}
```

### 3.3 crear restaurante con campos minimos

```
POST http://localhost:3000/api/restaurants
Authorization: Bearer <accessToken-de-maria>
Content-Type: application/json

{
  "name": "Soda El Pueblo",
  "address": "Cartago, Costa Rica"
}
```

**respuesta esperada (201):** los campos opcionales (`description`, `phone`, `openingHours`) seran `null`.

### 3.4 crear restaurante como client (error esperado)

usa el token de juan (que tiene rol `client`).

```
POST http://localhost:3000/api/restaurants
Authorization: Bearer <accessToken-de-juan>
Content-Type: application/json

{
  "name": "Restaurante No Autorizado",
  "address": "En ningun lado"
}
```

**respuesta esperada (403):**
```json
{
  "success": false,
  "message": "insufficient permissions",
  "data": null
}
```

### 3.5 crear restaurante sin autenticacion (error esperado)

```
POST http://localhost:3000/api/restaurants
Content-Type: application/json

{
  "name": "Restaurante Sin Token",
  "address": "No va a funcionar"
}
```

**respuesta esperada (401):**
```json
{
  "success": false,
  "message": "access token is required",
  "data": null
}
```

### 3.6 crear restaurante con datos invalidos (error de validacion)

```
POST http://localhost:3000/api/restaurants
Authorization: Bearer <accessToken-de-maria>
Content-Type: application/json

{
  "name": "",
  "address": ""
}
```

**respuesta esperada (400):** error de validacion de zod indicando que `name` y `address` requieren al menos 1 caracter.

### 3.7 listar restaurantes despues de crear varios

despues de ejecutar 3.2 y 3.3:

```
GET http://localhost:3000/api/restaurants
```

**respuesta esperada (200):**
```json
{
  "success": true,
  "message": "restaurants retrieved",
  "data": [
    {
      "id": "uuid-1",
      "name": "La Casona",
      "description": "Restaurante de comida tipica costarricense",
      "address": "San Jose, Costa Rica",
      "phone": "+506 2222-2222",
      "openingHours": "Lun-Vie 8:00-22:00",
      "adminUserId": "uuid-de-maria",
      "createdAt": "...",
      "updatedAt": "...",
      "adminUser": {
        "fullName": "Maria Rodriguez",
        "email": "maria@example.com"
      }
    },
    {
      "id": "uuid-2",
      "name": "Soda El Pueblo",
      "description": null,
      "address": "Cartago, Costa Rica",
      "phone": null,
      "openingHours": null,
      "adminUserId": "uuid-de-maria",
      "createdAt": "...",
      "updatedAt": "...",
      "adminUser": {
        "fullName": "Maria Rodriguez",
        "email": "maria@example.com"
      }
    }
  ]
}
```

---

## 4. swagger - documentacion interactiva

la documentacion swagger esta disponible en el navegador:

```
http://localhost:3000/api-docs
```

desde ahi podes probar todos los endpoints directamente sin necesidad de postman.

---

## orden recomendado para probar

1. `GET /health` — verificar que la api esta arriba
2. `POST /api/auth/register` — crear usuario client (juan)
3. `POST /api/auth/register` — crear usuario restaurant_admin (maria)
4. `POST /api/auth/register` — crear usuario de prueba para eliminar (carlos)
5. `POST /api/auth/login` — login con juan → guardar token
6. `POST /api/auth/login` — login con maria → guardar token
7. `POST /api/auth/login` — login con carlos → guardar token
8. `GET /api/users/me` — verificar perfil de juan
9. `GET /api/users/me` — verificar perfil de maria (cambiar token)
10. `PUT /api/users/:id` — actualizar perfil de juan
11. `PUT /api/users/:id` — intentar actualizar perfil ajeno (debe fallar 403)
12. `GET /api/restaurants` — listar restaurantes (vacio)
13. `POST /api/restaurants` — crear restaurante con maria
14. `POST /api/restaurants` — intentar crear con juan (debe fallar 403)
15. `GET /api/restaurants` — listar restaurantes (ya aparece el creado)
16. `DELETE /api/users/:id` — eliminar cuenta de carlos
17. `DELETE /api/users/:id` — intentar eliminar cuenta ajena (debe fallar 403)

---

## tips para postman

- crea una **variable de coleccion** llamada `baseUrl` con valor `http://localhost:3000/api`
- crea variables `clientToken`, `adminToken` para no tener que copiar tokens manualmente
- en la request de login, agrega un script de **post-response** para guardar el token automaticamente:

```javascript
if (pm.response.code === 200) {
    const data = pm.response.json().data;
    pm.collectionVariables.set("clientToken", data.accessToken);
}
```

- en las requests protegidas, en la pestana **Authorization**, selecciona `Bearer Token` y pon `{{clientToken}}` o `{{adminToken}}`
