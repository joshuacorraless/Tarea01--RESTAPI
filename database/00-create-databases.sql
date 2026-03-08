-- =============================================
-- script de inicializacion para docker
-- crea las bases de datos necesarias
-- se ejecuta automaticamente al iniciar el contenedor de postgres
-- =============================================

-- base de datos para keycloak (el servicio de autenticacion)
CREATE DATABASE keycloak_db;
