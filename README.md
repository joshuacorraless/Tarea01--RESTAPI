# Pruebas Unitarias – Reserva Inteligente de Restaurantes

## 1. Instalar dependencias de Jest

```bash
npm install --save-dev jest ts-jest @types/jest
```

## 2. Agregar scripts al package.json

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

## 3. Correr las pruebas

```bash
# Todas las pruebas
npm test

# Con reporte de cobertura
npm run test:coverage
```

## 5. Cómo agregar pruebas para un controller nuevo

1. Crea `src/__tests__/<nombre>.controller.test.ts`
2. Copia el bloque del template en `reservation.controller.test.ts`
3. Reemplaza los imports y las llamadas a servicio
4. Descomenta las líneas que invocan el controller real

## 6. Patrón de mocking

Todos los tests siguen el mismo patrón:

```typescript
jest.mock("../../services/tu.service"); // mockea el servicio
jest.mock("../../utils/response"); // mockea sendSuccess/sendError

// caso feliz
(tuService.tuFuncion as jest.Mock).mockResolvedValue(fakeDato);

// caso de error
(tuService.tuFuncion as jest.Mock).mockRejectedValue(new Error("msg"));
```

## Cobertura mínima requerida

El `jest.config.ts` ya incluye `coverageThreshold: { global: { lines: 90 } }`,
por lo que Jest fallará si la cobertura cae por debajo del 90%.
