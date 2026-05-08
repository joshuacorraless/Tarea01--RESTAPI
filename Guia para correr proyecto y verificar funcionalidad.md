# Guía de despliegue — Tarea01 REST API

Esta guía cubre el ciclo completo: levantar el cluster, cargar datos, verificar que todo funciona y bajarlo cuando termines.

---

## Prerrequisitos

- Docker Desktop con Kubernetes habilitado
- Node.js 20+
- Nginx Ingress Controller instalado en el cluster
- Los archivos secretos locales completados (`secret.yaml` de api, keycloak y postgres y los .env)

Si no tenés el Ingress Controller, instalalo una sola vez:

```powershell
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=Ready pod --selector=app.kubernetes.io/component=controller --timeout=180s
```

---

## 1. Levantar el cluster

Elegí el motor de base de datos con el que vas a trabajar. Ambos comandos se corren desde la raíz del proyecto.

**Con MongoDB (sharded cluster):**
```powershell
.\infra\k8s\deploy.ps1 -DbEngine mongo
```

**Con PostgreSQL:**
```powershell
.\infra\k8s\deploy.ps1 -DbEngine postgres
```

El script construye las imágenes locales, aplica todos los manifests y espera a que los pods estén listos. Tarda entre 2 y 5 minutos la primera vez.

> **Importante:** no mezcles motores sin destruir el cluster primero. Si ya tenés Mongo corriendo y querés cambiar a Postgres (o viceversa), corré `destroy.ps1` antes.

---

## 2. Verificar que los pods están vivos

Una vez que el script termina, confirmá que todo está corriendo:

```powershell
kubectl get pods -n proyecto01-restaurante
```

Deberías ver algo similar a esto:

```
NAME                       READY   STATUS    RESTARTS   AGE
api-xxxxxxxxxx-xxxxx       1/1     Running   0          3m
elasticsearch-0            1/1     Running   0          3m
keycloak-xxxxxxxxxx-xxxxx  1/1     Running   0          3m
keycloak-postgres-0        1/1     Running   0          3m
kibana-xxxxxxxxxx-xxxxx    1/1     Running   0          3m
redis-xxxxxxxxxx-xxxxx     1/1     Running   0          3m
search-xxxxxxxxxx-xxxxx    1/1     Running   0          3m
```

Si usaste **MongoDB**, también verás los pods del sharded cluster:
```
configsvr-0                1/1     Running   0          3m
shard1-0                   1/1     Running   0          3m
shard2-0                   1/1     Running   0          3m
mongos-xxxxxxxxxx-xxxxx    1/1     Running   0          3m
```

Si algún pod tiene `0/1` en READY, esperá un minuto más — Kibana y Keycloak tardan más en arrancar. Podés volver a correr el comando hasta que todos digan `1/1`.

También podés revisar los services:
```powershell
kubectl get svc -n proyecto01-restaurante
```

---

## 3. Cargar datos con el seed

El seed genera datos de restaurantes costarricenses usando Gemini y los inserta directamente en el pod correcto vía `kubectl exec`. Corré este paso con el **mismo motor** que usaste al levantar el cluster.

```powershell
node database/seeds/generate-seeds.js
```

El script se conecta al pod correspondiente (`mongos` para Mongo, `postgres-0` para Postgres) y carga 4 restaurantes con sus menús e ítems.

---

## 4. Reindexar en Elasticsearch

Para que los datos del motor de negocio aparezcan en las búsquedas, hay que indexarlos en Elasticsearch:

```powershell
curl.exe -X POST http://localhost/search/reindex
```

Respuesta esperada:
```json
{"message":"Reindex completado","indexed":40}
```

Este paso es obligatorio si querés probar búsquedas o ver datos en Kibana.

---

## 5. Verificar endpoints con curl

Comprobá que la API y el servicio de búsqueda responden correctamente.

**Listar restaurantes (endpoint público):**
```powershell
curl.exe http://localhost/api/restaurants
```

**Búsqueda por texto en Elasticsearch:**
```powershell
curl.exe "http://localhost/search/products?q=casado"
```

**Búsqueda por categoría:**
```powershell
curl.exe "http://localhost/search/products/category/Postres"
```

**Health check de Elasticsearch (directo al pod — requiere port-forward activo, ver sección 6):**
```powershell
curl.exe http://localhost:9200/_cluster/health
```

**Ver índices en Elasticsearch:**
```powershell
curl.exe http://localhost:9200/_cat/indices?v
```

---

## 6. Ver datos en las GUIs (opcional)

Cada herramienta requiere tener el port-forward activo en una terminal separada mientras la usás. Cerrá la terminal cuando termines.

### Kibana — `http://localhost:5601`

```powershell
kubectl port-forward svc/kibana-service 5601:5601 -n proyecto01-restaurante
```

Abrí `http://localhost:5601` en el navegador. Para ver los datos:

1. Menú ☰ → **Management** → **Stack Management** → **Kibana** → **Data Views**
2. Creá un Data View con nombre `products` e index pattern `products`
3. En el campo de timestamp seleccioná **I don't want to use the time filter**
4. Guardá y andá a ☰ → **Analytics** → **Discover**

### Redis Insight

```powershell
kubectl port-forward svc/redis-service 6379:6379 -n proyecto01-restaurante
```

Conectá Redis Insight a `localhost:6379` sin contraseña.

### pgAdmin 4 (solo con `DB_ENGINE=postgres`)

```powershell
kubectl port-forward svc/postgres-service 5432:5432 -n proyecto01-restaurante
```

Conectá pgAdmin con estos datos:

| Campo    | Valor          |
|----------|----------------|
| Host     | localhost      |
| Port     | 5432           |
| Database | restaurant_db  |
| Username | postgres       |
| Password | postgres       |

### MongoDB Compass (solo con `DB_ENGINE=mongo`)

```powershell
kubectl port-forward svc/mongos-service 27017:27017 -n proyecto01-restaurante
```

Conectá Compass con la URI: `mongodb://localhost:27017`

La base de datos es `restaurant_db`.

---

## 7. Bajar el cluster

Cuando termines, destruí el namespace completo (pods, PVCs y datos):

```powershell
.\infra\k8s\destroy.ps1
```

El script pide confirmación antes de borrar. Si querés saltearla:

```powershell
.\infra\k8s\destroy.ps1 -Force
```

> El Ingress Controller (`ingress-nginx`) no se toca — queda instalado para el próximo deploy.