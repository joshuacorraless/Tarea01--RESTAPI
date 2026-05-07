# Guion de demo — Tarea01 REST API

Script para grabar la demo siguiendo la guía oficial.
Pensado para dos presentadores: **Joshua (J)** y **Felipe (F)**.

> Convención: **J** habla / **F** ejecuta, y vamos rotando en algunas secciones para que se sienta dinámico. Lo que está entre paréntesis son indicaciones de cámara o acción.

---

## 0. Intro (≈ 30 s)

**J:** *(hola a cámara)*
> "Buenas, profe. Somos Joshua Corrales y Felipe Lepiz, y le vamos a presentar la **Tarea 01 de Bases de Datos 2**: una **REST API distribuida** para gestión de restaurantes, reservas, menús y pedidos."

**F:**
> "La gracia del proyecto es que **toda la capa de persistencia es intercambiable**: la misma API puede correr sobre **PostgreSQL con stored procedures** o sobre un **cluster sharded de MongoDB**, sin tocar una sola línea del código de negocio. Solo cambia una variable de entorno."

**J:**
> "Encima de eso montamos **Redis** para cache, **Elasticsearch** como microservicio de búsqueda, **Keycloak** para autenticación con JWT, y todo desplegado sobre **Kubernetes** con NGINX como Ingress."

---

## 1. Arquitectura rápida (≈ 45 s)

*(F abre el README.md o un diagrama si lo tienen)*

**F:**
> "Antes de levantar el cluster, un vistazo rápido a la arquitectura. La API expone los endpoints REST y, según el valor de `DB_ENGINE`, decide a qué motor pegarle a través de un **DAO Factory**. Las dos implementaciones — Postgres y Mongo — viven detrás de la misma interfaz."

**J:**
> "El microservicio de búsqueda es independiente: tiene su propio pod, indexa contra Elasticsearch y se expone también por el Ingress de NGINX. Y todo el tráfico entra por un solo punto: `http://localhost`."

---

## 2. Levantar el cluster (≈ 1 min)

*(J ejecuta, F narra)*

**F:**
> "Vamos a levantar todo el stack con un solo script. Elegimos **MongoDB sharded** para mostrar la parte interesante del proyecto."

*(J corre desde la raíz del repo)*
```powershell
.\infra\k8s\deploy.ps1 -DbEngine mongo
```

**F:** *(mientras corre)*
> "Este script construye las imágenes locales de la API y del search, aplica todos los manifests de Kubernetes, y espera a que los pods estén `Ready`. La primera vez tarda entre 2 y 5 minutos; ahora va a ir más rápido porque las imágenes ya están en caché."

**J:** *(cuando termina)*
> "Listo, el script terminó sin errores."

---

## 3. Verificar pods (≈ 45 s)

*(F ejecuta)*
```powershell
kubectl get pods -n proyecto01-restaurante
```

**J:** *(señala los pods en pantalla)*
> "Acá vemos todo lo que está corriendo: la **API**, el microservicio de **search**, **Keycloak** con su Postgres dedicado, **Redis**, **Elasticsearch** y **Kibana**."

**F:**
> "Y como elegimos Mongo, también vemos los pods del **sharded cluster**: el **config server**, dos **shards** y el **mongos** que actúa como router. Todos en `1/1 Running`."

*(opcional, si quieren mostrarlo)*
```powershell
kubectl get svc -n proyecto01-restaurante
```

**F:**
> "Y ahí están los services correspondientes."

---

## 4. Cargar datos con el seed (≈ 1 min)

*(J ejecuta)*

**F:**
> "Ahora cargamos datos de prueba. El seed los **genera con Gemini** — son restaurantes costarricenses realistas, con menús, ítems y precios — y los inserta directamente en el pod correcto vía `kubectl exec`."

```powershell
node database/seeds/generate-seeds.js
```

**J:** *(mientras corre)*
> "Como estamos en modo Mongo, el script se conecta al pod **mongos** y carga 4 restaurantes con sus menús e ítems. Si estuviéramos en Postgres, se conectaría al pod **postgres-0** — el script detecta el motor automáticamente."

---

## 5. Reindexar en Elasticsearch (≈ 30 s)

*(F ejecuta)*

**J:**
> "Los datos ya están en Mongo, pero el microservicio de búsqueda usa **Elasticsearch**, así que tenemos que reindexar."

```powershell
curl.exe -X POST http://localhost/search/reindex
```

**F:** *(señala la respuesta)*
> "Y ahí está la respuesta: `indexed: 40`. Todos los ítems de menú quedaron indexados en Elasticsearch y listos para búsqueda full-text."

---

## 6. Probar endpoints con curl (≈ 1 min 30 s)

*(alternan J y F en cada curl)*

### 6.1. Listar restaurantes (endpoint público de la API)

**J:**
> "Primero, un endpoint del CRUD principal — listar restaurantes. Esto pega contra MongoDB:"

```powershell
curl.exe http://localhost/api/restaurants
```

**F:** *(mientras se ve la respuesta JSON)*
> "Ahí están los 4 restaurantes que cargamos, con su dirección, teléfono y horario."

### 6.2. Búsqueda full-text en Elasticsearch

**F:**
> "Ahora algo más interesante — búsqueda full-text por palabra clave. Esto **no** pega contra Mongo: va al microservicio de search → Elasticsearch."

```powershell
curl.exe "http://localhost/search/products?q=casado"
```

**J:**
> "Vemos todos los ítems que matchean con 'casado', con su score de relevancia."

### 6.3. Búsqueda por categoría

**J:**
> "Y también tenemos búsqueda por categoría:"

```powershell
curl.exe "http://localhost/search/products/category/Postres"
```

**F:**
> "Ahí están todos los postres del catálogo."

### 6.4. (Opcional) Swagger

*(si quieren mostrar Swagger, abrir `http://localhost/api-docs` en el navegador)*

**J:**
> "Y todos los endpoints están documentados en Swagger, en `localhost/api-docs`."

---

## 7. GUIs — ver los datos (≈ 2 min)

> Tip: dejen los port-forwards corriendo en terminales separadas **antes** de empezar a grabar esta sección, para no perder tiempo abriéndolas en cámara.

### 7.1. MongoDB Compass — ver el cluster sharded

*(F abre Compass)*

**J:**
> "Vamos a ver los datos directamente en MongoDB. Ya tengo un port-forward corriendo contra el `mongos`."

*(comando que YA debería estar corriendo en otra terminal)*
```powershell
kubectl port-forward svc/mongos-service 27017:27017 -n proyecto01-restaurante
```

**F:** *(en Compass, conectado a `mongodb://localhost:27017`)*
> "Acá vemos la base `restaurant_db` con sus colecciones: `restaurants`, `menus`, `menu_items`, `mesas`, `reservations`, `orders`. Y si vemos la **shard distribution**, los datos están repartidos entre `shard1` y `shard2` por la shard key correspondiente."

### 7.2. Kibana — ver los datos indexados

*(J abre Kibana en `http://localhost:5601`)*

**F:**
> "Y ahora Kibana, para ver lo que indexó Elasticsearch."

**J:** *(navegando)*
> "Tengo creado el Data View `products`. En **Discover** vemos los 40 documentos indexados, con sus campos `nombre`, `descripcion`, `categoria`, `precio` y el `restaurantId` al que pertenecen."

### 7.3. (Opcional) Redis Insight

**F:**
> "Y si abrimos Redis Insight, vemos las claves cacheadas — la API usa el patrón Cache-Aside para los GETs frecuentes."

---

## 8. (Opcional) Demostrar el switch de motor

> Solo si les sobra tiempo. Es la parte más impresionante del proyecto.

**J:**
> "Para cerrar, queremos enseñar lo que dijimos al principio: cambiar de motor sin tocar código."

*(F ejecuta)*
```powershell
.\infra\k8s\destroy.ps1 -Force
.\infra\k8s\deploy.ps1 -DbEngine postgres
```

**F:** *(mientras se levanta)*
> "Mismo código, misma API, mismos endpoints — pero ahora todas las queries van contra Postgres a través de **stored procedures**."

*(cuando termine, repetir un curl rápido para mostrar)*
```powershell
node database/seeds/generate-seeds.js
curl.exe http://localhost/api/restaurants
```

**J:**
> "Misma respuesta, distinto motor. Eso es lo que da el patrón DAO + Factory."

---

## 9. Tests y cobertura (≈ 30 s)

*(opcional, si quieren mostrarlo en otra ventana)*

**F:**
> "Por último, el proyecto tiene **201 tests** unitarios y de integración, con cobertura por encima del **90 %**, y un pipeline de CI/CD en GitHub Actions que corre en cada push."

```bash
cd apps/api
npm run test:coverage
```

---

## 10. Bajar el cluster (≈ 20 s)

*(J ejecuta)*

**J:**
> "Y para terminar, bajamos todo con un solo comando:"

```powershell
.\infra\k8s\destroy.ps1
```

*(confirma con `y` cuando pida confirmación)*

**F:**
> "El script borra todo el namespace, los pods, los volúmenes y los datos. El Ingress de NGINX se queda instalado para el próximo deploy."

---

## 11. Cierre (≈ 20 s)

**J:**
> "Eso fue la demo, profe. Muchas gracias."

**F:**
> "Cualquier consulta queda en el repositorio, con la guía paso a paso, los ADRs y la documentación técnica."

---

## Checklist antes de empezar a grabar

- [ ] Docker Desktop arrancado, Kubernetes habilitado
- [ ] Ingress Controller instalado (`kubectl get pods -n ingress-nginx`)
- [ ] `.env` y `secret.yaml` completos
- [ ] Cluster **bajado** antes de empezar (la demo lo levanta en cámara)
- [ ] Imágenes ya buildeadas al menos una vez (para que el deploy en cámara no tarde 5 min)
- [ ] Terminales abiertas y posicionadas:
  - [ ] Una en raíz del repo (para `deploy.ps1`, `destroy.ps1`, `seed`)
  - [ ] Una libre para los `kubectl get pods` y `curl`
  - [ ] Una con `port-forward` de **mongos** corriendo
  - [ ] Una con `port-forward` de **kibana** corriendo
- [ ] Compass ya conectado a `mongodb://localhost:27017`
- [ ] Kibana abierto en el navegador con el Data View `products` ya creado
- [ ] Redis Insight conectado (si lo van a mostrar)
- [ ] Letra de la terminal grande (cómodo para que se lea en el video)
- [ ] Notificaciones del sistema apagadas

---

## Tiempos estimados

| Sección | Tiempo |
|---|---|
| Intro + arquitectura | 1 min 15 s |
| Levantar cluster + verificar pods | 1 min 45 s |
| Seed + reindex | 1 min 30 s |
| Endpoints | 1 min 30 s |
| GUIs | 2 min |
| Switch de motor (opcional) | 2 min |
| Tests + cierre + bajar cluster | 1 min |
| **Total sin switch** | **≈ 9 min** |
| **Total con switch** | **≈ 11 min** |
