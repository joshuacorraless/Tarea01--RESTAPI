# ADR-002: Patrón DAO con separación por motor de base de datos

## Contexto

La API debe poder ejecutarse contra **PostgreSQL** o **MongoDB sharded** sin
modificar la lógica de negocio. La selección del motor se hace en tiempo de
arranque mediante la variable de entorno `DB_ENGINE`. Sin un patrón explícito
de acceso a datos, los servicios terminan acoplados al driver concreto (`pg`
o `mongoose`) y cambiar de motor implica reescribir cada caso de uso.

## Decisión tomada

Implementar el patrón **DAO** (*Data Access Object*: capa que aísla el
acceso a la base de datos detrás de una interfaz) bajo
`apps/api/src/dao/` con tres niveles:

1. **Interfaces** (`dao/interfaces/`): contrato puro en TypeScript por cada
   entidad — `IUserDao`, `IRestaurantDao`, `IMenuDao`, `IMenuItemDao`,
   `IReservationDao`, `IOrderDao`.
2. **Implementaciones**:
   - `dao/postgres/` — invoca *stored procedures* mediante `pool.query()`.
   - `dao/mongo/` — usa modelos Mongoose definidos en `dao/mongo/models/`.
3. **Factory** (`dao/DaoFactory.ts`): `require` dinámico que selecciona la
   implementación según `env.DB_ENGINE` y expone un `dao` singleton al resto
   de la aplicación.

```
services/  →  dao (interfaz)  →  postgres  ──► PostgreSQL (sp_*)
                              └► mongo     ──► MongoDB (Mongoose)
```

Los servicios consumen exclusivamente `dao.users.create(...)` o
`dao.restaurants.list()`. No conocen `pool.query` ni `Model.find`.

## Justificación

- **Desacople**: la lógica de negocio depende de una abstracción, no de un
  driver concreto. Cambiar de motor es modificar el factory, no los servicios.
- **Coexistencia coherente**: ambas implementaciones cumplen la misma
  interfaz, así que los tests de servicio se pueden mockear con un único
  contrato.
- **Carga selectiva**: el `require` dentro del factory evita que el código
  importe `mongoose` si la app corre con `DB_ENGINE=postgres` (y viceversa);
  esto reduce el tamaño efectivo y previene errores por dependencias no
  inicializadas.

## Alternativas consideradas

- **Llamar al driver directamente desde los servicios**: simple pero acopla
  la lógica al motor; cambiar de base obliga a tocar todos los casos de uso.
- **ORM único (TypeORM, Prisma) con múltiples adaptadores**: requiere
  unificar el modelo de datos y agrega capas de abstracción que el curso no
  exige. Además, los stored procedures de Postgres no encajan naturalmente
  con un ORM relacional típico.
- **Microservicio por motor**: sobre-ingeniería para un proyecto académico;
  duplicaría la API entera.

## Principios aplicados

- **Inversión de dependencias** (la D de SOLID, tb aplica el resto de SOLID): los servicios dependen de
  `IUserDao`, no de `pg.Pool` ni de `mongoose.Model`.
- **Separación de responsabilidades**: el DAO sabe *cómo* persistir; el
  servicio sabe *qué* persistir y por qué.
- **Bajo acoplamiento, alta cohesión**: cada DAO concreto encapsula su motor.
- **Open/Closed**: agregar un tercer motor (por ejemplo, una caché L2) no
  obliga a modificar interfaces existentes, solo a crear una nueva
  implementación y registrarla en el factory.

## Consecuencias

**Ventajas**
- Tests unitarios se escriben contra la interfaz, mockear es trivial.
- El servicio `auth.service.ts`, `restaurant.service.ts`, etc. no contienen
  ni un solo `pool.query` ni `MyModel.findOne`.
- Migrar entre Postgres y Mongo en demo es simplemente
  `kubectl edit configmap api-config` + rollout.

**Compromisos**
- Mantener dos implementaciones equivalentes implica trabajo doble cada vez
  que se agrega un método al DAO.
- La interfaz `MenuItemRecord` lleva un campo `restaurantId?` opcional
  porque el JOIN solo aplica en `findAll()`; es una concesión menor.

**Riesgos**
- Si una implementación se desincroniza (ej. Mongo soporta un campo nuevo
  que Postgres no), los tests de la otra no detectan el problema. Hay que
  asegurarse de que ambos cumplen el contrato completo.
