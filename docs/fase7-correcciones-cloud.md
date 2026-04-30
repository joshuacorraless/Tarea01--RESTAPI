# Correccion Fase 7 Kubernetes: Despliegue Condicional por `DB_ENGINE`

## Contexto

La Fase 7 ya tiene una base avanzada de manifiestos Kubernetes, pero hay un punto conceptual critico que debe corregirse:

`DB_ENGINE` no debe ser solo una variable que cambia la conexion de la API. Para esta entrega, `DB_ENGINE` tambien debe determinar que motor de base de datos de negocio existe dentro del cluster.

## Regla Esperada

```text
DB_ENGINE=mongo
  -> Se despliega MongoDB sharded con replica sets.
  -> NO se despliega Postgres de aplicacion.

DB_ENGINE=postgres
  -> Se despliega Postgres de aplicacion.
  -> NO se despliega MongoDB.

Keycloak
  -> Siempre se despliega.
  -> Su Postgres dedicado siempre se despliega.
  -> Ese Postgres NO cuenta como motor de negocio de la API.
```

Kubernetes no decide esto automaticamente leyendo una variable de entorno. Kubernetes aplica manifiestos. Por eso hace falta una capa de despliegue que seleccione que manifiestos aplicar.

---

## Solucion Esperada

No quiero Helm ni una solucion demasiado empresarial. El proyecto corre localmente en Docker Desktop y debe ser facil de demostrar en video o en revision presencial.

La solucion recomendada es:

```powershell
.\infra\k8s\deploy.ps1 -DbEngine mongo
```

o:

```powershell
.\infra\k8s\deploy.ps1 -DbEngine postgres
```

Y opcionalmente:

```powershell
.\infra\k8s\destroy.ps1
```

o documentar:

```powershell
kubectl delete namespace proyecto01-restaurante
```

El README debe conservar los pasos manuales como explicacion, pero para la demo debe existir un comando principal reproducible.

---

## Comportamiento Esperado del Script

El script `infra/k8s/deploy.ps1` debe:

1. Validar que `DbEngine` sea `mongo` o `postgres`.
2. Crear/aplicar el namespace `proyecto01-restaurante`.
3. Construir imagenes locales:

```powershell
docker build -t restaurant/api:dev apps/api
docker build -t restaurant/search:dev apps/search
```

4. Aplicar recursos comunes:
   - API
   - Redis
   - Search
   - Elasticsearch
   - Keycloak
   - Postgres dedicado de Keycloak
   - Ingress
5. Si `DbEngine=mongo`:
   - aplicar unicamente manifiestos de Mongo sharded;
   - NO aplicar Postgres de aplicacion;
   - configurar `api-config` con `DB_ENGINE=mongo`;
   - correr `infra/mongo/init.sh` cuando los pods de Mongo esten listos.
6. Si `DbEngine=postgres`:
   - aplicar unicamente Postgres de aplicacion;
   - NO aplicar Mongo;
   - configurar `api-config` con `DB_ENGINE=postgres`;
   - generar correctamente el ConfigMap real de SQL desde `database/*.sql`.
7. Reiniciar/esperar la API para que tome la configuracion.
8. Imprimir pasos claros para demo.

Ejemplo de salida deseada:

```text
[1/8] Creando namespace proyecto01-restaurante
[2/8] Construyendo imagenes locales
[3/8] Aplicando servicios comunes
[4/8] Aplicando Keycloak + Postgres dedicado
[5/8] DB_ENGINE=mongo detectado: aplicando Mongo sharded
[6/8] Inicializando replica sets y sharding
[7/8] Aplicando API con DB_ENGINE=mongo
[8/8] Verificando pods
```

---

## Estructura Recomendada

Separar conceptual o fisicamente los recursos asi:

```text
infra/k8s/
  common/
    namespace
    api
    redis
    search
    elasticsearch
    keycloak
    ingress

  mongo/
    configsvr
    shards
    mongos

  postgres/
    postgres app
    postgres secret
    postgres init scripts
```

Si no se quiere mover todo fisicamente, el script debe aplicar explicitamente los archivos correctos y evitar `kubectl apply -f infra/k8s/ -R` de forma indiscriminada.

---

## Findings a Resolver

### Finding 1 - [P1] `DB_ENGINE` debe decidir que motor de negocio se despliega

La implementacion actual siempre despliega Mongo sharded y Postgres de aplicacion. Eso no cumple la intencion del proyecto.

Regla esperada:

```text
DB_ENGINE=mongo
  -> Mongo sharded existe.
  -> Postgres app NO existe.

DB_ENGINE=postgres
  -> Postgres app existe.
  -> Mongo NO existe.
```

Keycloak y su Postgres dedicado siempre existen y no cuentan como motor de negocio.

Solucion recomendada:

- Agregar `infra/k8s/deploy.ps1 -DbEngine mongo|postgres`.
- El script debe aplicar recursos comunes + solo el motor seleccionado.
- Evitar aplicar todos los manifiestos recursivamente si eso levanta ambos motores.

---

### Finding 2 - [P1] El ConfigMap real de SQL se sobrescribe con el placeholder

El README indica crear primero un ConfigMap real desde `database/*.sql` y luego ejecutar:

```powershell
kubectl apply -f infra/k8s/ -R
```

Pero ese segundo comando vuelve a aplicar `infra/k8s/postgres/configmap.yaml`, que contiene solo un placeholder con el mismo nombre:

```text
postgres-init-scripts
```

Resultado: Postgres puede quedar `Running`, pero sin tablas ni stored procedures. Entonces `DB_ENGINE=postgres` fallaria.

Solucion recomendada:

- eliminar el placeholder,
- o no aplicar ese archivo directamente,
- o generar siempre el ConfigMap real dentro de `deploy.ps1` cuando `DbEngine=postgres`.

El ConfigMap real debe salir de:

```powershell
kubectl create configmap postgres-init-scripts `
  --from-file=00-init.sql=database/init.sql `
  --from-file=01-stored-procedures.sql=database/stored-procedures.sql `
  --from-file=02-mesas.sql=database/crearMesas.sql `
  -n proyecto01-restaurante `
  --dry-run=client -o yaml | kubectl apply -f -
```

---

### Finding 3 - [P2] El flujo documentado no es apto para demo reproducible

El README actual pide muchos pasos manuales:

- instalar Ingress,
- crear namespace,
- construir imagenes,
- generar ConfigMap SQL,
- aplicar manifiestos,
- esperar pods,
- correr `init.sh`.

Eso sirve como documentacion, pero para video/revision presencial debe existir un comando principal reproducible:

```powershell
.\infra\k8s\deploy.ps1 -DbEngine mongo
```

y:

```powershell
.\infra\k8s\deploy.ps1 -DbEngine postgres
```

El README debe explicar que hace el script paso a paso.

---

### Finding 4 - [P2] `init.sh` de Mongo dice ser idempotente pero puede fallar al re-ejecutarse

El script maneja `AlreadyInitialized` para los replica sets, pero no protege estas operaciones:

```javascript
sh.addShard(...)
sh.enableSharding(...)
sh.shardCollection(...)
```

Si se corre una segunda vez, puede fallar porque los shards o colecciones ya existen.

Solucion recomendada:

- verificar si el shard ya existe antes de hacer `sh.addShard`,
- verificar si la DB ya tiene sharding habilitado,
- verificar si la coleccion ya esta sharded antes de llamar `sh.shardCollection`,
- o capturar esos errores especificos y continuar.

---

### Finding 5 - [P2] Falta separar recursos comunes y recursos por motor

Para que `DB_ENGINE` controle realmente que se levanta, hay que separar:

```text
common:
  namespace
  api
  redis
  search
  elasticsearch
  keycloak
  keycloak-postgres
  ingress

mongo:
  configsvr
  shards
  mongos

postgres:
  postgres app
  postgres secret
  postgres init scripts
```

El script debe aplicar:

```text
common + mongo
```

o:

```text
common + postgres
```

Nunca ambos motores de negocio al mismo tiempo.

---

### Finding 6 - [P3] Documentacion inconsistente sobre cantidad de pods Mongo

El README menciona 8, 9 y 10 pods de Mongo en diferentes partes.

La topologia real es:

```text
3 config servers
3 shard1
3 shard2
1 mongos
= 10 pods Mongo
```

Corregir el README para evitar confusion en la demo.

---

### Finding 7 - [P3] Nginx esta bien como Ingress, no necesita carpeta propia

No es un problema que la carpeta de Nginx tenga solo `.gitkeep` o no tenga configuracion propia.

En esta fase, Nginx se usa como Ingress Controller instalado en el cluster. El repo solo necesita:

```text
infra/k8s/ingress.yaml
```

El README debe explicar claramente que Nginx no es un contenedor propio del proyecto, sino un controlador del cluster.

---

## Criterio Final Esperado

La solucion debe quedar simple, local y demostrable:

```text
Un comando para demo.
README con explicacion paso a paso.
Solo un motor de negocio activo segun DB_ENGINE.
Keycloak siempre activo con su Postgres dedicado.
Mongo sharded solo cuando DB_ENGINE=mongo.
Postgres app solo cuando DB_ENGINE=postgres.
```

Frase clave para defender la arquitectura:

```text
Kubernetes no decide dinamicamente que base levantar por una variable de entorno. La variable define el comportamiento de la API; el script de despliegue usa ese mismo valor para aplicar solo los manifiestos del motor seleccionado. Asi mantenemos coherencia: si DB_ENGINE=mongo, solo existe Mongo como motor de negocio; si DB_ENGINE=postgres, solo existe Postgres como motor de negocio.
```
