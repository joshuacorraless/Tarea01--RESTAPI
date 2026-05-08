# ADR-010: Pipeline CI/CD con GitHub Actions

## Contexto

El repositorio necesita una automatización mínima que ejecute las
pruebas en cada Pull Request y publique imágenes Docker reproducibles
cuando se mergea a `main`. Sin esto, dependemos de que cada
desarrollador corra los tests localmente antes de subir cambios y de
que las imágenes que se despliegan a Kubernetes sean construidas a
mano por quien tenga Docker en su máquina.

## Decisión tomada

Usar **GitHub Actions** con dos workflows independientes:

| Workflow                | Disparador                            | Propósito                                                |
|-------------------------|---------------------------------------|----------------------------------------------------------|
| `.github/workflows/ci.yml` | `pull_request` a `develop` o `main`   | Validar tests y cobertura del API antes del merge        |
| `.github/workflows/cd.yml` | `push` a `main`                        | Construir y publicar imágenes Docker en GHCR             |

### `ci.yml` — Continuous Integration

```text
checkout
   ↓
setup-node@v4 (Node 20, cache npm via apps/api/package-lock.json)
   ↓
npm ci          (working-directory: apps/api)
   ↓
npm run lint
   ↓
npm run test:coverage
   ↓
Verifica coverage/coverage-summary.json: total.lines.pct ≥ 90
   ↓
Si < 90 → exit 1 → falla el job → bloquea el merge
```

### `cd.yml` — Continuous Deployment (publicación de imágenes)

```text
push a main
   ↓
checkout
   ↓
docker/login-action@v3 → ghcr.io con github.actor + GITHUB_TOKEN
   ↓
docker/build-push-action@v5 (context apps/api)    → ghcr.io/<repo>/api:latest
                                                   ghcr.io/<repo>/api:<sha>
   ↓
docker/build-push-action@v5 (context apps/search) → ghcr.io/<repo>/search:latest
                                                   ghcr.io/<repo>/search:<sha>
```

El tag `:<sha>` da trazabilidad (qué commit corresponde a qué imagen);
`:latest` da un alias móvil para despliegues sin commit explícito.

## Justificación

- **GitHub Actions viene integrado**: no requiere infraestructura
  externa (Jenkins, CircleCI) ni configuración fuera del repositorio.
- **GHCR (GitHub Container Registry)** es gratis para repos públicos y
  se autentica con el `GITHUB_TOKEN` automáticamente provisto.
- **Separación CI/CD**: el CI valida calidad en PRs sin construir
  imágenes innecesarias. El CD solo corre cuando algo realmente se
  mergeó a `main`.
- **Umbral de cobertura como gate**: 90% de líneas es un mínimo
  defendible. Si baja, el PR no puede mergearse — la cobertura no
  decae con el tiempo por descuido.

## Alternativas consideradas

- **Solo CI sin CD**: válido para un proyecto académico, pero no
  demuestra automatización del despliegue.
- **CD que despliegue a un cluster real** (kubectl apply desde el
  workflow): requiere kubeconfig en secrets y un cluster accesible
  desde GitHub. Fuera de alcance del curso, donde el cluster es Docker
  Desktop local.
- **CircleCI / GitLab CI / Jenkins**: aportan más features pero
  requieren tooling adicional. Actions es suficiente y reduce fricción.
- **Docker Hub** en lugar de GHCR: posible, pero implica gestionar
  credenciales aparte; con GHCR el token ya viene del propio repo.

## Principios aplicados

- **Automatización**: cada PR pasa por la misma puerta de calidad sin
  intervención humana.
- **Trazabilidad**: cada imagen lleva el SHA del commit que la generó.
- **Configuración externa**: el pipeline vive en YAML versionado, no
  en una UI externa.
- **Fail-fast**: si lint o tests fallan, no se gasta tiempo
  construyendo imágenes.
- **Reutilización de cache**: `setup-node` cachea `node_modules` por
  `package-lock.json`, acelerando corridas sucesivas.

## Consecuencias

**Ventajas**
- Imposible mergear código que rompa los tests o baje la cobertura.
- Las imágenes en GHCR son reproducibles: cada SHA tiene una imagen
  asociada inmutable.
- Cero costo de infraestructura — todo dentro del plan gratuito.
- El historial de runs en la pestaña "Actions" sirve como auditoría.

**Compromisos**
- El CI solo cubre `apps/api/`; `apps/search/` no tiene job de tests
  porque hoy no existen pruebas unitarias para ese servicio.
- No hay despliegue automático a un cluster: las imágenes se publican,
  pero el `kubectl apply` queda manual (ejecutado por `deploy.ps1`
  contra Docker Desktop).
- `cd.yml` no corre los tests antes de publicar; confía en que el CI
  ya los pasó al mergear el PR. Si alguien hace push directo a `main`
  sin PR, la imagen se publica sin validar.

**Pendiente / no implementado**
- **Inconsistencia con el linter**: `ci.yml` ejecuta `npm run lint`,
  pero el script en `apps/api/package.json` actualmente solo imprime
  `"linter no configurado aun"` y termina con exit 0. El paso pasa
  vacío; conviene configurar ESLint o eliminar el step para ser
  honestos sobre qué valida el CI.
- **Sin tests para `apps/search/`**: el job CI ignora ese servicio.
- **Sin escaneo de vulnerabilidades** en las imágenes (`trivy`,
  `docker scout`) ni en las dependencias (`npm audit --omit=dev`).
- **Sin firmado de imágenes** (cosign, sigstore): aceptable para demo
  académica.
- **Sin promoción a un entorno**: las imágenes se publican pero no se
  despliegan automáticamente a ningún cluster.
