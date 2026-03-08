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

-- indice para buscar restaurantes por admin
CREATE INDEX IF NOT EXISTS idx_restaurants_admin_user_id ON restaurants(admin_user_id);

-- indice para buscar usuario por external_auth_id (sera el filtro mas comun)
CREATE INDEX IF NOT EXISTS idx_users_external_auth_id ON users(external_auth_id);
