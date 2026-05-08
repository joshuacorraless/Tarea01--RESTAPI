# ADR-009: Validación del balanceo de carga del Ingress

## Contexto

Tener Ingress + varias réplicas no garantiza que el tráfico esté siendo
distribuido entre todos los pods. Para defender la solución frente al
profesor necesitamos un procedimiento concreto y reproducible que **mida
empíricamente** que las peticiones HTTP a `localhost/api/...` se reparten
entre los pods de la API, y lo mismo para `search`. Sin un procedimiento
acordado, "funciona" no es defendible.

## Decisión tomada

Validar el balanceo siguiendo cuatro pasos verificables, todos ejecutables
desde PowerShell y sin herramientas adicionales:

### 1. Escalar la API a varias réplicas

```powershell
kubectl scale deployment api    --replicas=3 -n proyecto01-restaurante
kubectl scale deployment search --replicas=2 -n proyecto01-restaurante
kubectl get pods -n proyecto01-restaurante -l app=api
```

Esperado: `kubectl get pods` lista 3 pods `Ready` con nombres distintos.

### 2. Generar carga sintética hacia el Ingress

```powershell
for ($i=1; $i -le 30; $i++) {
    curl.exe -s http://localhost/api/restaurants > $null
}
```

### 3. Observar la distribución por logs de pod

```powershell
kubectl logs -l app=api --all-containers=true --tail=200 -n proyecto01-restaurante `
  | Select-String "GET /api/restaurants"
```

Para ver pod por pod (espera ver tráfico en cada uno):

```powershell
kubectl get pods -n proyecto01-restaurante -l app=api -o name | ForEach-Object {
    $p = ($_ -replace 'pod/','')
    Write-Host "==== $p ===="
    kubectl logs $p -n proyecto01-restaurante --tail=20
}
```

Esperado: cada pod muestra al menos una entrada del request reciente. La
distribución por defecto del Ingress NGINX es **round-robin**, por lo que
con 30 requests y 3 réplicas se esperan ~10 por pod.

### 4. Confirmar que la caída de un pod no rompe el flujo

```powershell
$victim = kubectl get pods -n proyecto01-restaurante -l app=api -o jsonpath='{.items[0].metadata.name}'
kubectl delete pod $victim -n proyecto01-restaurante

# Mientras Kubernetes recrea el pod, generar más tráfico
for ($i=1; $i -le 10; $i++) { curl.exe -s http://localhost/api/restaurants > $null }
```

Esperado: las requests siguen respondiendo `200 OK` porque el Ingress
saca al pod del pool en cuanto deja de pasar el `readinessProbe`, y el
Deployment levanta un reemplazo.

### Verificación complementaria con Redis

Si quieres aislar el efecto del cache durante la prueba, agregá un
parámetro variable a la URL para forzar miss:

```powershell
1..30 | ForEach-Object { curl.exe -s "http://localhost/api/restaurants?nocache=$_" > $null }
```

El header `X-Cache: MISS` confirma que la request llegó al pod.

## Justificación

- **Defensible empíricamente**: los logs por pod son evidencia directa de
  que distintos pods están atendiendo requests.
- **Reproducible**: cuatro comandos en PowerShell, sin instalar `ab`,
  `wrk` ni `k6`.
- **Cubre falla en vivo**: el paso 4 muestra cómo el Ingress reacciona a
  un pod caído, no solo balancea estáticamente.
- **El paso opcional con `?nocache=`** evita confusión cuando el cache
  Redis está respondiendo y los pods no ven el tráfico real.

## Alternativas consideradas

- **Métricas con Prometheus / Grafana**: precisa pero requiere instalar y
  configurar más componentes; fuera de alcance.
- **Inyectar un header con el nombre del pod en la respuesta**: requiere
  tocar el código de la API (variable `HOSTNAME` del pod). Útil pero no
  era necesario porque los logs ya identifican el pod.
- **Herramientas de carga (k6, wrk, ab)**: dan estadísticas más finas pero
  agregan dependencias y no aportan información que `curl` + logs no
  tengan.

## Principios aplicados

- **Verificación basada en evidencia**: la afirmación "se balancea" la
  respaldan los logs.
- **Observabilidad**: usamos las herramientas estándar (`kubectl logs`)
  como sustituto de un sistema de métricas.
- **Tolerancia a fallos**: la prueba 4 demuestra el comportamiento ante
  caída de pod, no solo el feliz path.
- **Simplicidad operacional**: cualquiera con `kubectl` y `curl` puede
  reproducirla.

## Consecuencias

**Ventajas**
- Procedimiento corto y auditable durante la defensa oral.
- No agrega dependencias al stack (sin Prometheus, sin Grafana).
- La misma técnica vale para `search-service`.

**Compromisos**
- Sin métricas históricas: cada validación es una foto puntual.
- La distribución round-robin no garantiza partes exactas; con TTL del
  cache activo, la primera request a un pod genera MISS y las
  subsiguientes pueden devolver HIT desde Redis sin tocar otro pod.
  Por eso el paso con `?nocache=` aísla el balanceo del efecto cache.

**Pendiente / no implementado**
- Dashboard de métricas en tiempo real.
- Pruebas de carga que cuantifiquen latencia / throughput por réplica.
