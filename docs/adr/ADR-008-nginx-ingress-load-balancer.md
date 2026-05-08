# ADR-008: Nginx como Ingress Controller y Load Balancer

## Contexto

Dentro del cluster conviven dos servicios HTTP públicos: la API principal
(`api-service`, puerto 80 → 3000) y el microservicio de búsqueda
(`search-service`, puerto 80 → 3001). Necesitamos un único punto de entrada
que reciba el tráfico externo, enrute por path al backend correcto y
**balancee entre las réplicas** cuando la API se escala horizontalmente con
`kubectl scale`. Sin esto, el cliente debería conocer puertos distintos por
servicio y manejar manualmente la lista de pods detrás.

## Decisión tomada

Usar **NGINX Ingress Controller** (instalado una vez por máquina en el
namespace `ingress-nginx`) y declarar un único recurso `Ingress`
(`infra/k8s/common/ingress.yaml`) que enruta por prefijo de path:

```yaml
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /api      → service: api-service:80
          - path: /search   → service: search-service:80
```

**Características de la decisión**

| Aspecto                | Valor                                                          |
|------------------------|----------------------------------------------------------------|
| Sin `host`             | Matchea cualquier hostname (incluido `localhost`)              |
| Sin `rewrite-target`   | El path completo se reenvía al backend (Express ya espera `/api/...` y `/search/...`) |
| `pathType: Prefix`     | Match por prefijo, suficiente para los dos dominios             |
| `proxy-body-size: 10m` | Permite uploads moderados sin truncar                          |

**Balanceo de carga**: NGINX Ingress, al delegar a un `Service`, recibe la
lista de endpoints (los pods detrás del selector). Cuando la API tiene N
réplicas, el balanceo por defecto es **round-robin** entre los pods
*Ready*. Escalar es:

```powershell
kubectl scale deployment api    --replicas=3 -n proyecto01-restaurante
kubectl scale deployment search --replicas=2 -n proyecto01-restaurante
```

## Justificación

- **Punto de entrada único**: `http://localhost/api/...` y
  `http://localhost/search/...` exponen toda la app sin port-forwards
  manuales.
- **Balanceo automático**: el controller observa los endpoints del Service
  y los actualiza en caliente cuando se escala o un pod muere.
- **Sin host header**: facilita la demo en `localhost` puro, sin tocar
  `C:\Windows\System32\drivers\etc\hosts`.
- **Sin rewrite**: los routers Express ya esperan los prefijos completos
  (`app.use('/api', ...)`, `router.use('/search', ...)`). Quitar el
  prefijo con rewrite rompería el matching.
- **NGINX** es la implementación de Ingress más documentada y la que viene
  recomendada en la guía oficial de Kubernetes para Docker Desktop.

## Alternativas consideradas

- **`Service` tipo `LoadBalancer`** por servicio: en Docker Desktop sí
  funciona pero requiere un puerto distinto por servicio y no soporta
  ruteo por path.
- **Otro Ingress Controller** (Traefik, HAProxy, Contour): equivalentes en
  lo funcional. NGINX gana por familiaridad y soporte en el ecosistema
  Kubernetes.
- **API Gateway dedicado** (Kong, Ambassador): aporta features que el
  proyecto no necesita (auth distribuida, rate limit centralizado, etc.) y
  agrega complejidad operacional.

## Principios aplicados

- **Separación de responsabilidades**: las apps no saben de balanceo ni
  enrutado público.
- **Bajo acoplamiento**: cambiar el path de entrada (`/v2/api`) no obliga
  a tocar las apps, solo el Ingress.
- **Escalabilidad horizontal**: agregar réplicas escala el throughput sin
  reconfigurar nada.
- **Configuración externa**: la regla de ruteo vive en YAML versionado.
- **Simplicidad operacional**: un solo recurso `Ingress`, un solo punto
  de entrada.

## Consecuencias

**Ventajas**
- Demo de balanceo es trivial: `kubectl scale ... --replicas=3` + tráfico
  al Ingress = peticiones distribuidas entre los pods.
- El cliente externo no conoce la topología interna.
- `kubectl logs -l app=api --tail=50 --follow` muestra cómo las réplicas
  reciben tráfico.

**Compromisos**
- El Ingress Controller es responsabilidad del cluster, no del repo.
  Hay que instalarlo una vez (documentado en `infra/k8s/README.md`).
- Sin `host` se asume entorno local — en producción se usaría hostname
  explícito (`api.midominio.com`) y TLS.

**Pendiente / no implementado**
- TLS / cert-manager: el Ingress sirve solo HTTP.
- Canary o blue/green deploys: el Ingress NGINX los soporta pero no se
  configuraron.
