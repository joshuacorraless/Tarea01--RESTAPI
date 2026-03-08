-- =============================================
-- stored procedures para la api
-- ejecutar despues de init.sql
-- =============================================

-- =============================================
-- sp: crear usuario
-- =============================================
CREATE OR REPLACE FUNCTION sp_create_user(
  p_full_name        VARCHAR,
  p_email            VARCHAR,
  p_external_auth_id VARCHAR,
  p_role             user_role,
  p_phone            VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  id               UUID,
  full_name        VARCHAR,
  email            VARCHAR,
  external_auth_id VARCHAR,
  role             user_role,
  phone            VARCHAR,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO users (full_name, email, external_auth_id, role, phone)
  VALUES (p_full_name, p_email, p_external_auth_id, p_role, p_phone)
  RETURNING
    users.id,
    users.full_name,
    users.email,
    users.external_auth_id,
    users.role,
    users.phone,
    users.created_at,
    users.updated_at;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- sp: obtener usuario por external_auth_id
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_user_by_external_id(
  p_external_auth_id VARCHAR
)
RETURNS TABLE(
  id               UUID,
  full_name        VARCHAR,
  email            VARCHAR,
  external_auth_id VARCHAR,
  role             user_role,
  phone            VARCHAR,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.full_name,
    u.email,
    u.external_auth_id,
    u.role,
    u.phone,
    u.created_at,
    u.updated_at
  FROM users u
  WHERE u.external_auth_id = p_external_auth_id
    AND u.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- sp: obtener usuario por id
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_user_by_id(
  p_id UUID
)
RETURNS TABLE(
  id               UUID,
  full_name        VARCHAR,
  email            VARCHAR,
  external_auth_id VARCHAR,
  role             user_role,
  phone            VARCHAR,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.full_name,
    u.email,
    u.external_auth_id,
    u.role,
    u.phone,
    u.created_at,
    u.updated_at
  FROM users u
  WHERE u.id = p_id
    AND u.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- sp: actualizar usuario
-- =============================================
CREATE OR REPLACE FUNCTION sp_update_user(
  p_id        UUID,
  p_full_name VARCHAR DEFAULT NULL,
  p_phone     VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  id               UUID,
  full_name        VARCHAR,
  email            VARCHAR,
  external_auth_id VARCHAR,
  role             user_role,
  phone            VARCHAR,
  created_at       TIMESTAMP,
  updated_at       TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  UPDATE users
  SET
    full_name  = COALESCE(p_full_name, users.full_name),
    phone      = COALESCE(p_phone, users.phone),
    updated_at = NOW()
  WHERE users.id = p_id
    AND users.deleted_at IS NULL
  RETURNING
    users.id,
    users.full_name,
    users.email,
    users.external_auth_id,
    users.role,
    users.phone,
    users.created_at,
    users.updated_at;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- sp: soft delete usuario
-- =============================================
CREATE OR REPLACE FUNCTION sp_soft_delete_user(
  p_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = p_id
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- sp: crear restaurante
-- =============================================
CREATE OR REPLACE FUNCTION sp_create_restaurant(
  p_name          VARCHAR,
  p_description   VARCHAR DEFAULT NULL,
  p_address       VARCHAR DEFAULT NULL,
  p_phone         VARCHAR DEFAULT NULL,
  p_opening_hours VARCHAR DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id             UUID,
  name           VARCHAR,
  description    VARCHAR,
  address        VARCHAR,
  phone          VARCHAR,
  opening_hours  VARCHAR,
  admin_user_id  UUID,
  created_at     TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO restaurants (name, description, address, phone, opening_hours, admin_user_id)
  VALUES (p_name, p_description, p_address, p_phone, p_opening_hours, p_admin_user_id)
  RETURNING
    restaurants.id,
    restaurants.name,
    restaurants.description,
    restaurants.address,
    restaurants.phone,
    restaurants.opening_hours,
    restaurants.admin_user_id,
    restaurants.created_at;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- sp: listar restaurantes activos
-- =============================================
CREATE OR REPLACE FUNCTION sp_list_restaurants()
RETURNS TABLE(
  id             UUID,
  name           VARCHAR,
  description    VARCHAR,
  address        VARCHAR,
  phone          VARCHAR,
  opening_hours  VARCHAR,
  admin_user_id  UUID,
  created_at     TIMESTAMP,
  updated_at     TIMESTAMP,
  admin_name     VARCHAR,
  admin_email    VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.description,
    r.address,
    r.phone,
    r.opening_hours,
    r.admin_user_id,
    r.created_at,
    r.updated_at,
    u.full_name AS admin_name,
    u.email     AS admin_email
  FROM restaurants r
  INNER JOIN users u ON u.id = r.admin_user_id
  WHERE r.deleted_at IS NULL
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql;
