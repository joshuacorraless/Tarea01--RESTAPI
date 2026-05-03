# Seeds — Generación de datos con LLM

Este directorio contiene el script que genera datos de prueba realistas
usando la API de Gemini (Google) e inserta los datos en PostgreSQL o MongoDB.

El script corre en tu máquina local y se comunica con los pods del cluster
de Kubernetes a través de `kubectl exec`. **No necesita `psql` ni `mongosh`
instalados localmente** — esos binarios ya existen dentro de los pods
(`postgres:16-alpine` incluye `psql`; `mongo:7` incluye `mongosh`).

## Archivos

| Archivo | Descripción |
|---|---|
| `generate-seeds.js` | Script principal — llama a Gemini, genera los archivos intermedios y los ejecuta dentro del pod correcto vía `kubectl exec` |
| `data.json` | JSON generado por Gemini (se crea al correr el script) |
| `seed.sql` | SQL generado a partir del JSON, para PostgreSQL (se crea al correr el script) |
| `seed.mongo.js` | Script mongosh generado a partir del JSON, para MongoDB (se crea al correr el script) |

## Requisitos previos

- Node.js 20+
- `kubectl` instalado y en el PATH, apuntando al cluster correcto
- El namespace `proyecto01-restaurante` con los pods corriendo
- El stack desplegado con `deploy.ps1` antes de correr el seed
- API key de Gemini (gratis en https://aistudio.google.com/apikey)

Verificá que el cluster responde antes de correr el script:
```bash
kubectl get pods -n proyecto01-restaurante
```

## Uso

```bash
# MongoDB (default — usa el sharded cluster vía mongos)
GEMINI_API_KEY=AIza... node database/seeds/generate-seeds.js

# PostgreSQL
DB_ENGINE=postgres GEMINI_API_KEY=AIza... node database/seeds/generate-seeds.js
```

En Windows (PowerShell):
```powershell
# MongoDB
$env:GEMINI_API_KEY = "AIza..."
node database/seeds/generate-seeds.js

# PostgreSQL
$env:GEMINI_API_KEY = "AIza..."
$env:DB_ENGINE = "postgres"
node database/seeds/generate-seeds.js
```

Namespace personalizado (si desplegaste en uno distinto al default):
```bash
K8S_NAMESPACE=otro-ns GEMINI_API_KEY=AIza... node database/seeds/generate-seeds.js
```

## Qué hace el script paso a paso

1. **Verifica** que `kubectl` esté disponible y el cluster responda.
2. **Llama a Gemini** con un prompt que pide datos de restaurantes costarricenses en JSON.
3. **Guarda** el JSON generado en `data.json` como evidencia del uso del LLM.
4. **Genera** el archivo de inserción correspondiente al engine (`seed.sql` o `seed.mongo.js`).
5. **Ejecuta** el archivo dentro del pod correcto enviando el contenido por stdin con `kubectl exec -i`.

## Qué pod usa cada engine

| Engine | Pod | Cómo se ejecuta |
|---|---|---|
| `mongo` | `mongos` (label `app=mongos`) | stdin → `mongosh mongodb://localhost:27017/restaurant_db` |
| `postgres` | `postgres-0` | stdin → `psql -U postgres -d restaurant_db` |

Para MongoDB se conecta al pod **mongos** (el query router del sharded cluster),
no directamente a un shard. Esto es importante porque mongos es quien conoce
la distribución de datos y rutea cada documento al shard correcto según la
shard key (`idMenu` hashed para `menuitems`, `idRestaurante` hashed para
`reservations`).

## Qué genera Gemini

- **4 restaurantes** costarricenses (soda, marisquería, pizzería, fusión)
- **2 menús** por restaurante
- **5 ítems de menú** por menú con categorías: Entradas, Platos Fuertes, Postres, Bebidas, Sopas, Desayunos
- **4 mesas** por restaurante con capacidades distintas (2, 4, 6, 8 personas)

Los datos generados se guardan en `data.json` como evidencia del uso del LLM.

## Después de correr el script

Para que los datos aparezcan en las búsquedas, indexarlos en ElasticSearch:

```bash
curl -X POST http://localhost/search/reindex
```

## Ejecución manual (si el script falla)

Si `kubectl exec` falla por algún motivo, podés ejecutar los pasos manualmente
una vez que los archivos intermedios ya fueron generados:

**MongoDB:**
```bash
kubectl exec -i -n proyecto01-restaurante <mongos-pod> -- \
  mongosh mongodb://localhost:27017/restaurant_db < database/seeds/seed.mongo.js
```

**PostgreSQL:**
```bash
kubectl exec -i -n proyecto01-restaurante postgres-0 -- \
  psql -U postgres -d restaurant_db < database/seeds/seed.sql
```