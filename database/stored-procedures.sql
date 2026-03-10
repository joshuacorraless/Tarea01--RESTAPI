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


-- LEPIZ LAPIZIN:
-- =============================================
-- sp_create_menu
-- =============================================
CREATE OR REPLACE FUNCTION sp_create_menu(
  p_id_restaurante UUID,
  p_nombre         VARCHAR(200),
  p_detalles       VARCHAR(1000),
  p_activo         BOOLEAN DEFAULT TRUE
)
RETURNS SETOF menus
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  INSERT INTO menus (idRestaurante, nombre, detalles, activo)
  VALUES (p_id_restaurante, p_nombre, p_detalles, p_activo)
  RETURNING *;
END;
$$;

-- =============================================
-- sp_get_menu_by_id
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_menu_by_id(p_id UUID)
RETURNS TABLE (
  id                  UUID,
  idRestaurante       UUID,
  nombre              VARCHAR(200),
  detalles            VARCHAR(1000),
  activo              BOOLEAN,
  creadoEn             TIMESTAMP,
  ultimaActualizacion TIMESTAMP
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.idRestaurante, m.nombre, m.detalles, m.activo,
         m.creadoEn, m.ultimaActualizacion
  FROM menus m
  WHERE m.id = p_id AND m.eliminadoEn IS NULL;
END;
$$;

-- =============================================
-- sp_get_menus_by_restaurant
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_menus_by_restaurant(p_id_restaurante UUID)
RETURNS TABLE (
  id                  UUID,
  idRestaurante       UUID,
  nombre              VARCHAR(200),
  detalles            VARCHAR(1000),
  activo              BOOLEAN,
  creadoEn             TIMESTAMP,
  ultimaActualizacion TIMESTAMP
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.idRestaurante, m.nombre, m.detalles, m.activo,
         m.creadoEn, m.ultimaActualizacion
  FROM menus m
  WHERE m.idRestaurante = p_id_restaurante AND m.eliminadoEn IS NULL
  ORDER BY m.creadoEn DESC;
END;
$$;

-- =============================================
-- sp_update_menu
-- =============================================
CREATE OR REPLACE FUNCTION sp_update_menu(
  p_id       UUID,
  p_nombre   VARCHAR(200)  DEFAULT NULL,
  p_detalles VARCHAR(1000) DEFAULT NULL,
  p_activo   BOOLEAN       DEFAULT NULL
)
RETURNS SETOF menus
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE menus SET
    nombre              = COALESCE(p_nombre,   nombre),
    detalles            = COALESCE(p_detalles, detalles),
    activo              = COALESCE(p_activo,   activo),
    ultimaActualizacion = NOW()
  WHERE id = p_id AND eliminadoEn IS NULL
  RETURNING *;
END;
$$;

-- =============================================
-- sp_delete_menu (soft delete)
-- =============================================
CREATE OR REPLACE FUNCTION sp_delete_menu(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE menus SET eliminadoEn = NOW() WHERE id = p_id AND eliminadoEn IS NULL;
  -- soft-delete de items asociados
  UPDATE itemsDelMenu SET eliminadoEn = NOW() WHERE idMenu = p_id AND eliminadoEn IS NULL;
END;
$$;


-- =============================================
-- sp_create_menu_item
-- =============================================
CREATE OR REPLACE FUNCTION sp_create_menu_item(
  p_id_menu    UUID,
  p_nombre     VARCHAR(200),
  p_detalles   VARCHAR(1000),
  p_precio     NUMERIC(10,2),
  p_imagen     VARCHAR(500) DEFAULT NULL,
  p_disponible BOOLEAN      DEFAULT TRUE
)
RETURNS SETOF itemsDelMenu
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  INSERT INTO itemsDelMenu (idMenu, nombre, detalles, precio, imagen, disponible)
  VALUES (p_id_menu, p_nombre, p_detalles, p_precio, p_imagen, p_disponible)
  RETURNING *;
END;
$$;

-- =============================================
-- sp_get_menu_items
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_menu_items(p_id_menu UUID)
RETURNS SETOF itemsDelMenu
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM itemsDelMenu
  WHERE idMenu = p_id_menu AND eliminadoEn IS NULL
  ORDER BY creadoEn DESC;
END;
$$;

-- =============================================
-- sp_get_menu_item_by_id
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_menu_item_by_id(p_id UUID)
RETURNS SETOF itemsDelMenu
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM itemsDelMenu WHERE id = p_id AND eliminadoEn IS NULL;
END;
$$;

-- =============================================
-- sp_update_menu_item
-- =============================================
CREATE OR REPLACE FUNCTION sp_update_menu_item(
  p_id         UUID,
  p_nombre     VARCHAR(200)   DEFAULT NULL,
  p_detalles   VARCHAR(1000)  DEFAULT NULL,
  p_precio     NUMERIC(10,2)  DEFAULT NULL,
  p_imagen     VARCHAR(500)   DEFAULT NULL,
  p_disponible BOOLEAN        DEFAULT NULL
)
RETURNS SETOF itemsDelMenu
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE itemsDelMenu SET
    nombre              = COALESCE(p_nombre,     nombre),
    detalles            = COALESCE(p_detalles,   detalles),
    precio              = COALESCE(p_precio,     precio),
    imagen              = COALESCE(p_imagen,     imagen),
    disponible          = COALESCE(p_disponible, disponible),
    ultimaActualizacion = NOW()
  WHERE id = p_id AND eliminadoEn IS NULL
  RETURNING *;
END;
$$;

-- =============================================
-- sp_delete_menu_item (soft delete)
-- =============================================
CREATE OR REPLACE FUNCTION sp_delete_menu_item(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE itemsDelMenu SET eliminadoEn = NOW() WHERE id = p_id AND eliminadoEn IS NULL;
END;
$$;


-- =============================================
-- sp_get_available_tables
-- verifica disponibilidad considerando reservas activas en ese horario
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_available_tables(
  p_id_restaurante UUID,
  p_reservado_para TIMESTAMP,
  p_duracion_min   INT DEFAULT 90
)
RETURNS SETOF mesas
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM mesas m
  WHERE m.idRestaurante = p_id_restaurante
    AND m.disponible    = TRUE
    AND m.eliminadoEn   IS NULL
    AND m.id NOT IN (
      SELECT r.mesaId
      FROM reservas r
      WHERE r.idRestaurante = p_id_restaurante
        AND r.estado NOT IN ('cancelada', 'completada')
        AND r.eliminadoEn IS NULL
        -- solapamiento de intervalos
        AND r.reservadoPara < (p_reservado_para + (p_duracion_min || ' minutes')::INTERVAL)
        AND (r.reservadoPara + (r.duracionReserva || ' minutes')::INTERVAL) > p_reservado_para
    );
END;
$$;


-- =============================================
-- sp_create_reservation
-- =============================================
CREATE OR REPLACE FUNCTION sp_create_reservation(
  p_id_restaurante    UUID,
  p_mesa_id           UUID,
  p_id_cliente        UUID,
  p_tamanno_reserva   INT,
  p_reservado_para    TIMESTAMP,
  p_duracion_reserva  INT     DEFAULT 90,
  p_notas             VARCHAR DEFAULT NULL
)
RETURNS SETOF reservas
LANGUAGE plpgsql AS $$
DECLARE
  v_conflicts INT;
BEGIN
  -- verificar que no haya conflicto con otra reserva en esa mesa
  SELECT COUNT(*) INTO v_conflicts
  FROM reservas
  WHERE mesaId       = p_mesa_id
    AND estado       NOT IN ('cancelada', 'completada')
    AND eliminadoEn  IS NULL
    AND reservadoPara < (p_reservado_para + (p_duracion_reserva || ' minutes')::INTERVAL)
    AND (reservadoPara + (duracionReserva || ' minutes')::INTERVAL) > p_reservado_para;

  IF v_conflicts > 0 THEN
    RAISE EXCEPTION 'mesa no disponible para el horario solicitado';
  END IF;

  RETURN QUERY
  INSERT INTO reservas (
    idRestaurante, mesaId, idClienteUsuario, tamannoReserva,
    reservadoPara, duracionReserva, notas
  ) VALUES (
    p_id_restaurante, p_mesa_id, p_id_cliente, p_tamanno_reserva,
    p_reservado_para, p_duracion_reserva, p_notas
  ) RETURNING *;
END;
$$;

-- =============================================
-- sp_get_reservation_by_id
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_reservation_by_id(p_id UUID)
RETURNS SETOF reservas
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM reservas WHERE id = p_id AND eliminadoEn IS NULL;
END;
$$;

-- =============================================
-- sp_get_reservations_by_client
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_reservations_by_client(p_id_cliente UUID)
RETURNS SETOF reservas
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM reservas
  WHERE idClienteUsuario = p_id_cliente AND eliminadoEn IS NULL
  ORDER BY reservadoPara DESC;
END;
$$;

-- =============================================
-- sp_get_reservations_by_restaurant
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_reservations_by_restaurant(p_id_restaurante UUID)
RETURNS SETOF reservas
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM reservas
  WHERE idRestaurante = p_id_restaurante AND eliminadoEn IS NULL
  ORDER BY reservadoPara DESC;
END;
$$;

-- =============================================
-- sp_cancel_reservation
-- =============================================
CREATE OR REPLACE FUNCTION sp_cancel_reservation(
  p_id        UUID,
  p_id_cliente UUID
)
RETURNS SETOF reservas
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE reservas SET
    estado              = 'cancelada',
    ultimaActualizacion = NOW()
  WHERE id                = p_id
    AND idClienteUsuario  = p_id_cliente
    AND estado            NOT IN ('cancelada', 'completada')
    AND eliminadoEn       IS NULL
  RETURNING *;
END;
$$;


-- =============================================
-- sp_create_order
-- =============================================
CREATE OR REPLACE FUNCTION sp_create_order(
  p_id_restaurante UUID,
  p_id_cliente     UUID,
  p_id_reserva     UUID            DEFAULT NULL,
  p_tipo_orden     tipo_orden      DEFAULT 'en-restaurante',
  p_notas          VARCHAR         DEFAULT NULL
)
RETURNS SETOF pedidos
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  INSERT INTO pedidos (idRestaurante, idClienteUsuario, idReserva, tipoOrden, notas)
  VALUES (p_id_restaurante, p_id_cliente, p_id_reserva, p_tipo_orden, p_notas)
  RETURNING *;
END;
$$;

-- =============================================
-- sp_add_order_item
-- =============================================
CREATE OR REPLACE FUNCTION sp_add_order_item(
  p_id_pedido       UUID,
  p_id_item_menu    UUID,
  p_cantidad        INT,
  p_notas           VARCHAR DEFAULT NULL
)
RETURNS SETOF detallesPedidos
LANGUAGE plpgsql AS $$
DECLARE
  v_precio NUMERIC(10,2);
BEGIN
  -- capturar precio actual del item
  SELECT precio INTO v_precio FROM itemsDelMenu WHERE id = p_id_item_menu AND eliminadoEn IS NULL;

  IF v_precio IS NULL THEN
    RAISE EXCEPTION 'item del menu no disponible';
  END IF;

  RETURN QUERY
  INSERT INTO detallesPedidos (idPedido, idItemsDelMenu, cantidad, precioUnidad, notas)
  VALUES (p_id_pedido, p_id_item_menu, p_cantidad, v_precio, p_notas)
  RETURNING *;
END;
$$;

-- =============================================
-- sp_recalculate_order_total
-- =============================================
CREATE OR REPLACE FUNCTION sp_recalculate_order_total(p_id_pedido UUID)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE pedidos SET
    total               = (
      SELECT COALESCE(SUM(subtotal), 0)
      FROM detallesPedidos
      WHERE idPedido = p_id_pedido
    ),
    ultimaActualizacion = NOW()
  WHERE id = p_id_pedido;
END;
$$;

-- =============================================
-- sp_get_order_by_id  (pedido + detalles)
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_order_by_id(p_id UUID)
RETURNS TABLE (
  id              UUID,
  idRestaurante   UUID,
  idClienteUsuario UUID,
  idReserva       UUID,
  tipoOrden       tipo_orden,
  estado          estado_orden,
  total           NUMERIC(10,2),
  notas           VARCHAR,
  creadoEn        TIMESTAMP,
  ultimaActualizacion TIMESTAMP,
  items           JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.idRestaurante,
    p.idClienteUsuario,
    p.idReserva,
    p.tipoOrden,
    p.estado,
    p.total,
    p.notas,
    p.creadoEn,
    p.ultimaActualizacion,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id',           dp.id,
          'idItemMenu',   dp.idItemsDelMenu,
          'cantidad',     dp.cantidad,
          'precioUnidad', dp.precioUnidad,
          'subtotal',     dp.subtotal,
          'notas',        dp.notas
        )
      ) FILTER (WHERE dp.id IS NOT NULL),
      '[]'::JSONB
    ) AS items
  FROM pedidos p
  LEFT JOIN detallesPedidos dp ON dp.idPedido = p.id
  WHERE p.id = p_id AND p.eliminadoEn IS NULL
  GROUP BY p.id;
END;
$$;

-- =============================================
-- sp_update_order_status
-- =============================================
CREATE OR REPLACE FUNCTION sp_update_order_status(
  p_id     UUID,
  p_estado estado_orden
)
RETURNS SETOF pedidos
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE pedidos SET
    estado              = p_estado,
    ultimaActualizacion = NOW()
  WHERE id = p_id AND eliminadoEn IS NULL
  RETURNING *;
END;
$$;

-- =============================================
-- sp_get_orders_by_client
-- =============================================
CREATE OR REPLACE FUNCTION sp_get_orders_by_client(p_id_cliente UUID)
RETURNS SETOF pedidos
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM pedidos
  WHERE idClienteUsuario = p_id_cliente AND eliminadoEn IS NULL
  ORDER BY creadoEn DESC;
END;
$$;