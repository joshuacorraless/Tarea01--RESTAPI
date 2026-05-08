FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app

# copiar archivos de dependencias primero (para cachear la capa de npm install)
COPY package.json package-lock.json ./

# instalar todas las dependencias (incluyendo dev para compilar typescript)
RUN npm ci

# copiar el resto del codigo fuente
COPY . .

# compilar typescript a javascript
RUN npm run build

# eliminar dependencias de desarrollo despues de compilar
RUN npm prune --production

EXPOSE 3000

# ejecutar la version compilada
CMD ["node", "dist/server.js"]
