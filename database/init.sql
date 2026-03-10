-- =============================================
-- script de inicializacion de la base de datos
-- ejecutar en orden: primero init.sql, luego stored-procedures.sql
-- =============================================

-- crear la base de datos (ejecutar desde psql conectado a postgres)
-- CREATE DATABASE restaurant_db;

-- conectarse a restaurant_db antes de ejecutar lo siguiente

-- =============================================
-- tipos enum
-- =============================================
CREATE TYPE user_role AS ENUM ('client', 'restaurant_admin');
CREATE TYPE estado_reserva AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');
CREATE TYPE estado_orden       AS ENUM ('pendiente', 'confirmada', 'en-preparacion', 'lista', 'entregada', 'cancelada');
CREATE TYPE tipo_orden         AS ENUM ('en-restaurante', 'para-llevar');

-- =============================================
-- tabla: users
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        VARCHAR(100)  NOT NULL,
  email            VARCHAR(255)  NOT NULL UNIQUE,
  external_auth_id VARCHAR(255)  NOT NULL UNIQUE,
  role             user_role     NOT NULL DEFAULT 'client',
  phone            VARCHAR(50),
  created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMP     DEFAULT NULL
);

-- =============================================
-- tabla: restaurants
-- =============================================
CREATE TABLE IF NOT EXISTS restaurants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(200)  NOT NULL,
  description    VARCHAR(1000),
  address        VARCHAR(500)  NOT NULL,
  phone          VARCHAR(50),
  opening_hours  VARCHAR(200),
  admin_user_id  UUID          NOT NULL REFERENCES users(id),
  created_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMP     DEFAULT NULL
);

-- =============================================
-- tabla: menus
-- =============================================
CREATE TABLE IF NOT EXISTS menus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idRestaurante UUID          NOT NULL REFERENCES restaurants(id),
  nombre          VARCHAR(200)  NOT NULL,
  detalles   VARCHAR(1000) NOT NULL,
  activo     BOOLEAN       NOT NULL DEFAULT TRUE,
  creadoEn    TIMESTAMP     NOT NULL DEFAULT NOW(),
  ultimaActualizacion    TIMESTAMP     NOT NULL DEFAULT NOW(),
  eliminadoEn    TIMESTAMP     DEFAULT NULL
);

-- =============================================
-- tabla: items de menu
-- =============================================
CREATE TABLE IF NOT EXISTS itemsDelMenu (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idMenu     UUID            NOT NULL REFERENCES menus(id),
  nombre        VARCHAR(200)    NOT NULL,
  detalles   VARCHAR(1000)   NOT NULL,
  precio       NUMERIC(10, 2)  NOT NULL CHECK (precio >= 0),
  imagen   VARCHAR(500) NULL,
  disponible BOOLEAN        NOT NULL DEFAULT TRUE,
  creadoEn  TIMESTAMP       NOT NULL DEFAULT NOW(),
  ultimaActualizacion    TIMESTAMP       NOT NULL DEFAULT NOW(),
  eliminadoEn    TIMESTAMP     DEFAULT NULL
);

-- =============================================
-- tabla: mesas
-- =============================================
CREATE TABLE IF NOT EXISTS mesas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idRestaurante UUID         NOT NULL REFERENCES restaurants(id),
  numeroMesa  VARCHAR(20)  NOT NULL,
  capacidad      INT          NOT NULL CHECK (capacidad > 0),
  disponible     BOOLEAN      NOT NULL DEFAULT TRUE,
  creadoEn    TIMESTAMP    NOT NULL DEFAULT NOW(),
  ultimaActualizacion  TIMESTAMP    NOT NULL DEFAULT NOW(),
  eliminadoEn  TIMESTAMP    DEFAULT NULL,
  UNIQUE (idRestaurante, numeroMesa)
);
  
-- =============================================
-- tabla: reservas
-- =============================================
CREATE TABLE IF NOT EXISTS reservas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idRestaurante   UUID                NOT NULL REFERENCES restaurants(id),
  mesaId        UUID                NOT NULL REFERENCES mesas(id),
  idClienteUsuario  UUID                NOT NULL REFERENCES users(id),
  tamannoReserva  INT                 NOT NULL CHECK (tamannoReserva > 0),
  reservadoPara     TIMESTAMP           NOT NULL,  -- fecha/hora de la reserva
  duracionReserva INT                NOT NULL DEFAULT 90,
  estado          estado_reserva  NOT NULL DEFAULT 'pendiente',
  notas           VARCHAR(500),
  creadoEn      TIMESTAMP           NOT NULL DEFAULT NOW(),
  ultimaActualizacion      TIMESTAMP           NOT NULL DEFAULT NOW(),
  eliminadoEn      TIMESTAMP           DEFAULT NULL
);

-- =============================================
-- tabla: pedidos
-- =============================================
CREATE TABLE IF NOT EXISTS pedidos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idRestaurante   UUID          NOT NULL REFERENCES restaurants(id),
  idClienteUsuario  UUID          NOT NULL REFERENCES users(id),
  idReserva  UUID          REFERENCES reservas(id),
  tipoOrden      tipo_orden    NOT NULL DEFAULT 'en-restaurante',
  estado          estado_orden  NOT NULL DEFAULT 'pendiente',
  total    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notas           VARCHAR(500),
  creadoEn      TIMESTAMP     NOT NULL DEFAULT NOW(),
  ultimaActualizacion      TIMESTAMP     NOT NULL DEFAULT NOW(),
  eliminadoEn      TIMESTAMP     DEFAULT NULL
);

-- =============================================
-- tabla: detalles de pedidos
-- =============================================
CREATE TABLE IF NOT EXISTS detallesPedidos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idPedido     UUID            NOT NULL REFERENCES pedidos(id),
  idItemsDelMenu  UUID            NOT NULL REFERENCES itemsDelMenu(id),
  cantidad     INT             NOT NULL CHECK (cantidad > 0),
  precioUnidad   NUMERIC(10, 2)  NOT NULL CHECK (precioUnidad >= 0),  -- precio al momento del pedido
  subtotal     NUMERIC(10, 2)  GENERATED ALWAYS AS (cantidad * precioUnidad) STORED,
  notas        VARCHAR(300),
  creadoEn   TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- indice para buscar restaurantes por admin
CREATE INDEX IF NOT EXISTS idx_restaurants_admin_user_id ON restaurants(admin_user_id);

-- indice para buscar usuario por external_auth_id (sera el filtro mas comun)
CREATE INDEX IF NOT EXISTS idx_users_external_auth_id ON users(external_auth_id);

-- para buscar menus por restaurante
CREATE INDEX IF NOT EXISTS idx_menus_idRestaurante ON menus(idRestaurante);

-- para buscar items de menu por menu
CREATE INDEX IF NOT EXISTS idx_itemsDelMenu_idMenu ON itemsDelMenu(idMenu);

-- para buscar mesas por restaurante
CREATE INDEX IF NOT EXISTS idx_mesas_idRestaurante ON mesas(idRestaurante);

-- para buscar reservas por restaurante
CREATE INDEX IF NOT EXISTS idx_reservas_idRestaurante ON reservas(idRestaurante);

-- para buscar reservas por cliente
CREATE INDEX IF NOT EXISTS idx_reservas_idClienteUsuario ON reservas(idClienteUsuario);

-- para buscar reservas por mesa
CREATE INDEX IF NOT EXISTS idx_reservas_mesaId ON reservas(mesaId);

-- para buscar pedidos por restaurante
CREATE INDEX IF NOT EXISTS idx_pedidos_idRestaurante   ON pedidos(idRestaurante);

-- para buscar pedidos por cliente
CREATE INDEX IF NOT EXISTS idx_pedidos_idClienteUsuario  ON pedidos(idClienteUsuario);

-- para buscar pedidos por reserva
CREATE INDEX IF NOT EXISTS idx_pedidos_idReserva  ON pedidos(idReserva);

-- para buscar items de pedido por pedido
CREATE INDEX IF NOT EXISTS idx_detallesPedidos_idPedido ON detallesPedidos(idPedido);