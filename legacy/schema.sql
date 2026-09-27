
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `laprotec_laprotectora` /*!40100 DEFAULT CHARACTER SET latin1 COLLATE latin1_spanish_ci */;

USE `laprotec_laprotectora`;
DROP TABLE IF EXISTS `acceso`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `acceso` (
  `id_acceso` int(11) NOT NULL AUTO_INCREMENT,
  `acceso` varchar(20) NOT NULL,
  PRIMARY KEY (`id_acceso`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `backupsprueba`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `backupsprueba` (
  `camp_id_inquilino` int(11) NOT NULL DEFAULT 0,
  `camp_identificacion` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_nombre` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_apellido_uno` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_apellido_dos` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_fk_nacionalidad` int(11) DEFAULT NULL,
  `camp_nacimiento` date DEFAULT NULL,
  `camp_apodo` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_fk_sexo` int(11) DEFAULT NULL,
  `camp_fk_genero` int(11) DEFAULT NULL,
  `camp_fk_discapacidad` int(11) DEFAULT NULL,
  `camp_drogas` int(11) DEFAULT NULL,
  `camp_fk_trabajo` int(11) DEFAULT NULL,
  `camp_fk_conducta` int(11) DEFAULT NULL,
  `camp_imagen` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_fk_provincia` int(11) DEFAULT NULL,
  `camp_fk_canton` int(11) DEFAULT NULL,
  `camp_fk_distrito` int(11) DEFAULT NULL,
  `camp_fk_barrio` int(11) DEFAULT NULL,
  `camp_fk_tipo_contrato` int(11) DEFAULT NULL,
  `camp_fk_tipo_alquiler` int(11) DEFAULT NULL,
  `camp_fk_tiempo_alquiler` int(11) DEFAULT NULL,
  `camp_fk_etiqueta_uno` int(11) DEFAULT NULL,
  `camp_fk_etiqueta_dos` int(11) DEFAULT NULL,
  `camp_fk_etiqueta_tres` int(11) DEFAULT NULL,
  `camp_fk_etiqueta_cuatro` int(11) DEFAULT NULL,
  `camp_fk_calificacion` int(11) DEFAULT NULL,
  `camp_fk_personas_con_inquilino` int(11) DEFAULT NULL,
  `camp_fk_proceso_judicial` int(11) DEFAULT NULL,
  `camp_fk_dano_vivienda` int(11) DEFAULT NULL,
  `camp_fk_recomienda_inquilino` int(11) DEFAULT NULL,
  `camp_comentario_adicional` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_fecha_registro` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `camp_fk_registrador` int(11) DEFAULT NULL,
  `camp_BD_seleccion` int(11) DEFAULT NULL,
  `user_bd_id_vieja` int(11) DEFAULT NULL,
  `camp_calificacion_text` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_calificacion_imagen` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camp_numero_dia` int(11) DEFAULT NULL,
  `camp_numero_mes` int(11) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `bitacora`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bitacora` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL DEFAULT 0,
  `nombre_completo` varchar(100) NOT NULL DEFAULT '0',
  `fecha` datetime NOT NULL,
  `hora_inicio` varchar(11) NOT NULL DEFAULT '',
  `hora_fin` varchar(13) NOT NULL DEFAULT '0',
  `year` int(11) NOT NULL DEFAULT 0,
  `foto` varchar(100) NOT NULL DEFAULT '0',
  `navegador` varchar(300) NOT NULL DEFAULT '0',
  `session` varchar(100) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3798 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `galeria`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `galeria` (
  `id_galeria` int(11) NOT NULL AUTO_INCREMENT,
  `imagen` varchar(250) NOT NULL,
  `observaciones` varchar(1000) NOT NULL,
  PRIMARY KEY (`id_galeria`)
) ENGINE=MyISAM AUTO_INCREMENT=267 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `padronelectoral`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `padronelectoral` (
  `idpadron` int(11) NOT NULL AUTO_INCREMENT,
  `cedula` int(11) DEFAULT NULL,
  `relleno` int(11) DEFAULT NULL,
  `fechacaducidad` int(11) DEFAULT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `apellido1` varchar(100) DEFAULT NULL,
  `apellido2` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`idpadron`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `perfil`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `perfil` (
  `id_perfil` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_empresa` varchar(150) NOT NULL,
  `direccion` varchar(255) NOT NULL,
  `ciudad` varchar(100) NOT NULL,
  `codigo_postal` varchar(100) NOT NULL,
  `estado` varchar(100) NOT NULL,
  `telefono` varchar(20) NOT NULL,
  `email` varchar(64) NOT NULL,
  `impuesto` int(11) NOT NULL,
  `moneda` varchar(6) NOT NULL,
  `logo_url` varchar(255) NOT NULL,
  PRIMARY KEY (`id_perfil`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_barrio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_barrio` (
  `camp_id` int(11) NOT NULL AUTO_INCREMENT,
  `camp_idDistrito` int(11) DEFAULT NULL,
  `camp_codigo` int(11) DEFAULT NULL,
  `camp_barrio` varchar(80) DEFAULT NULL,
  PRIMARY KEY (`camp_id`)
) ENGINE=MyISAM AUTO_INCREMENT=6607 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_canton`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_canton` (
  `camp_id` int(11) NOT NULL AUTO_INCREMENT,
  `camp_idProvincia` int(11) DEFAULT NULL,
  `camp_codigo` int(11) DEFAULT NULL,
  `camp_canton` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`camp_id`)
) ENGINE=MyISAM AUTO_INCREMENT=83 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_codigopostal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_codigopostal` (
  `camp_id_codigoPostal` int(11) NOT NULL AUTO_INCREMENT,
  `camp_codigoPostal` int(11) DEFAULT NULL,
  `camp_provincia` varchar(100) DEFAULT NULL,
  `camp_canton` varchar(100) DEFAULT NULL,
  `camp_distrito` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_codigoPostal`)
) ENGINE=MyISAM AUTO_INCREMENT=2083 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_conducta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_conducta` (
  `camp_id_conducta` int(11) NOT NULL AUTO_INCREMENT,
  `camp_conducta` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_conducta`)
) ENGINE=MyISAM AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_discapacidad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_discapacidad` (
  `camp_id_discapacidad` int(11) NOT NULL AUTO_INCREMENT,
  `cam_discapacidad` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_discapacidad`)
) ENGINE=MyISAM AUTO_INCREMENT=12 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_distrito`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_distrito` (
  `camp_id` int(11) NOT NULL AUTO_INCREMENT,
  `camp_idCanton` int(11) DEFAULT NULL,
  `camp_codigo` int(11) DEFAULT NULL,
  `camp_distrito` varchar(70) DEFAULT NULL,
  PRIMARY KEY (`camp_id`)
) ENGINE=MyISAM AUTO_INCREMENT=477 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_email`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_email` (
  `camp_id_email` int(11) NOT NULL AUTO_INCREMENT,
  `camp_id_persona` int(11) DEFAULT NULL,
  `camp_email` varchar(100) DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `camp_persona_registra` int(11) DEFAULT NULL,
  PRIMARY KEY (`camp_id_email`),
  UNIQUE KEY `camp_email_UNIQUE` (`camp_email`),
  KEY `tb_persona_idx` (`camp_id_persona`),
  CONSTRAINT `tb_persona4` FOREIGN KEY (`camp_id_persona`) REFERENCES `tb_persona` (`camp_id_persona`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_etiquetainquilino`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_etiquetainquilino` (
  `camp_id_etiquetaInquilino` int(11) NOT NULL AUTO_INCREMENT,
  `camp_etiquetaInquilino_nombre` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_etiquetaInquilino`)
) ENGINE=MyISAM AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_genero`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_genero` (
  `camp_id_genero` int(11) NOT NULL AUTO_INCREMENT,
  `cam_genero` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`camp_id_genero`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_idioma`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_idioma` (
  `camp_id_idioma` int(11) NOT NULL AUTO_INCREMENT,
  `cam_idioma` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_idioma`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_inquilino`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_inquilino` (
  `camp_id_inquilino` int(11) NOT NULL AUTO_INCREMENT,
  `camp_fk_persona` int(11) DEFAULT NULL,
  `camp_fechaIngreso` datetime DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `camp_persona_registra` int(11) DEFAULT NULL,
  `camp_estado` varchar(20) DEFAULT 'activo',
  PRIMARY KEY (`camp_id_inquilino`),
  KEY `tb_persona_idx` (`camp_fk_persona`),
  CONSTRAINT `tb_persona2` FOREIGN KEY (`camp_fk_persona`) REFERENCES `tb_persona` (`camp_id_persona`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_inquilinos_no_nacionales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_inquilinos_no_nacionales` (
  `camp_id_inquilino` int(11) NOT NULL AUTO_INCREMENT,
  `camp_identificacion` varchar(100) DEFAULT NULL,
  `camp_nombre` varchar(100) DEFAULT NULL,
  `camp_apellido_uno` varchar(100) DEFAULT NULL,
  `camp_apellido_dos` varchar(100) DEFAULT NULL,
  `camp_fk_nacionalidad` int(11) DEFAULT NULL,
  `camp_nacimiento` date DEFAULT NULL,
  `camp_apodo` varchar(100) DEFAULT NULL,
  `camp_fk_sexo` int(11) DEFAULT NULL,
  `camp_fk_genero` int(11) DEFAULT NULL,
  `camp_fk_discapacidad` int(11) DEFAULT NULL,
  `camp_drogas` int(11) DEFAULT NULL,
  `camp_fk_trabajo` int(11) DEFAULT NULL,
  `camp_fk_conducta` int(11) DEFAULT NULL,
  `camp_imagen` varchar(500) DEFAULT NULL,
  `camp_fk_provincia` int(11) DEFAULT NULL,
  `camp_fk_canton` int(11) DEFAULT NULL,
  `camp_fk_distrito` int(11) DEFAULT NULL,
  `camp_fk_barrio` int(11) DEFAULT NULL,
  `camp_fk_tipo_contrato` int(11) DEFAULT NULL,
  `camp_fk_tipo_alquiler` int(11) DEFAULT NULL,
  `camp_fk_tiempo_alquiler` int(11) DEFAULT NULL,
  `camp_fk_etiqueta_uno` int(11) DEFAULT NULL,
  `camp_fk_etiqueta_dos` int(11) DEFAULT NULL,
  `camp_fk_etiqueta_tres` int(11) DEFAULT NULL,
  `camp_fk_etiqueta_cuatro` int(11) DEFAULT NULL,
  `camp_fk_calificacion` int(11) DEFAULT NULL,
  `camp_fk_personas_con_inquilino` int(11) DEFAULT NULL,
  `camp_fk_proceso_judicial` int(11) DEFAULT NULL,
  `camp_fk_dano_vivienda` int(11) DEFAULT NULL,
  `camp_fk_recomienda_inquilino` int(11) DEFAULT NULL,
  `camp_comentario_adicional` text DEFAULT NULL,
  `camp_fecha_registro` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `camp_fk_registrador` int(11) DEFAULT NULL,
  `camp_BD_seleccion` int(11) DEFAULT NULL,
  `user_bd_id_vieja` int(11) DEFAULT NULL,
  `camp_calificacion_text` varchar(45) DEFAULT NULL,
  `camp_calificacion_imagen` varchar(45) DEFAULT NULL,
  `camp_numero_dia` int(11) DEFAULT NULL,
  `camp_numero_mes` int(11) DEFAULT NULL,
  `camp_estado` int(11) DEFAULT NULL,
  `camp_estadoText` text DEFAULT NULL,
  `camp_id_solicitud` int(11) DEFAULT NULL,
  PRIMARY KEY (`camp_id_inquilino`)
) ENGINE=MyISAM AUTO_INCREMENT=6581 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_issue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_issue` (
  `camp_id_issue` int(11) NOT NULL AUTO_INCREMENT,
  `camp_fk_persona_propietario` int(11) DEFAULT NULL,
  `camp_fk_persona_inquilina` int(11) DEFAULT NULL,
  `camp_fk_etiqueta` int(11) DEFAULT NULL,
  `camp_descripcion` text DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `camp_persona_registra` int(11) DEFAULT NULL,
  PRIMARY KEY (`camp_id_issue`),
  KEY `tb_persona_idx` (`camp_fk_persona_propietario`),
  KEY `tb_persona_inquilina_idx` (`camp_fk_persona_inquilina`),
  KEY `tb_persona_registra_idx` (`camp_persona_registra`),
  CONSTRAINT `tb_persona_inquilina` FOREIGN KEY (`camp_fk_persona_inquilina`) REFERENCES `tb_persona` (`camp_id_persona`),
  CONSTRAINT `tb_persona_propietario` FOREIGN KEY (`camp_fk_persona_propietario`) REFERENCES `tb_persona` (`camp_id_persona`),
  CONSTRAINT `tb_persona_registra2` FOREIGN KEY (`camp_persona_registra`) REFERENCES `tb_persona` (`camp_id_persona`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_login`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_login` (
  `camp_id_login` int(11) NOT NULL AUTO_INCREMENT,
  `camp_fk_persona` int(11) DEFAULT NULL,
  `camp_clave` text DEFAULT NULL,
  `camp_claveTemporal` varchar(100) DEFAULT NULL,
  `camp_fecha_ingreso` datetime DEFAULT current_timestamp(),
  `camp_ultimaSalida` varchar(100) DEFAULT NULL,
  `camp_activo` int(11) DEFAULT NULL,
  `camp_intentosRecordarClave` int(11) DEFAULT NULL,
  PRIMARY KEY (`camp_id_login`),
  UNIQUE KEY `camp_fk_persona_UNIQUE` (`camp_fk_persona`)
) ENGINE=InnoDB AUTO_INCREMENT=670 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_login_copy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_login_copy` (
  `camp_id_login` int(11) NOT NULL DEFAULT 0,
  `camp_fk_persona` int(11) DEFAULT NULL,
  `camp_clave` text CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_claveTemporal` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_fecha_ingreso` datetime DEFAULT current_timestamp(),
  `camp_ultimaSalida` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_activo` int(11) DEFAULT NULL,
  `camp_intentosRecordarClave` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_login_prueba`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_login_prueba` (
  `camp_id_login` int(11) NOT NULL DEFAULT 0,
  `camp_fk_persona` int(11) DEFAULT NULL,
  `camp_clave` text CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_claveTemporal` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_fecha_ingreso` datetime DEFAULT current_timestamp(),
  `camp_ultimaSalida` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_activo` int(11) DEFAULT NULL,
  `camp_intentosRecordarClave` int(11) DEFAULT NULL,
  `camp_cedula` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_paises`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_paises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `iso` char(2) DEFAULT NULL,
  `nombre` varchar(80) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=242 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_permiso`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_permiso` (
  `camp_id_permiso` int(11) NOT NULL AUTO_INCREMENT,
  `camp_fk_persona` int(11) DEFAULT NULL,
  `camp_nombre` varchar(45) DEFAULT NULL,
  `camp_descripcion` varchar(300) DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `camp_persona_registra` int(11) DEFAULT NULL,
  PRIMARY KEY (`camp_id_permiso`),
  UNIQUE KEY `camp_fk_persona_UNIQUE` (`camp_fk_persona`)
) ENGINE=InnoDB AUTO_INCREMENT=735 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_permiso_copy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_permiso_copy` (
  `camp_id_permiso` int(11) NOT NULL DEFAULT 0,
  `camp_fk_persona` int(11) DEFAULT NULL,
  `camp_nombre` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_descripcion` varchar(300) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `camp_persona_registra` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_permiso_prueba`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_permiso_prueba` (
  `camp_id_permiso` int(11) NOT NULL DEFAULT 0,
  `camp_fk_persona` int(11) DEFAULT NULL,
  `camp_nombre` varchar(45) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_descripcion` varchar(300) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `camp_persona_registra` int(11) DEFAULT NULL,
  `camp_cedula` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_persona`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_persona` (
  `camp_id_persona` int(11) NOT NULL AUTO_INCREMENT,
  `camp_identificacion` varchar(100) NOT NULL,
  `camp_nombreUno` varchar(100) NOT NULL,
  `camp_nombreDOs` varchar(100) DEFAULT NULL,
  `camp_apellidoUno` varchar(100) NOT NULL,
  `camp_apellidoDos` varchar(100) DEFAULT NULL,
  `camp_fk_nacionalidad` int(11) NOT NULL,
  `camp_fk_domicilio` int(11) DEFAULT NULL,
  `camp_fechaNacimiento` date DEFAULT NULL,
  `camp_fk_trabajoUno` int(11) DEFAULT NULL,
  `camp_fk_trabajoDos` int(11) DEFAULT NULL,
  `camp_fk_sexo` int(11) NOT NULL,
  `camp_fk_genero` int(11) DEFAULT NULL,
  `camp_fk_discapacidad` int(11) DEFAULT NULL,
  `camp_fk_idiomaComunica` int(11) DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `campo_persona_registro` int(11) DEFAULT NULL,
  `camp_idSolicitud` int(11) DEFAULT NULL,
  PRIMARY KEY (`camp_id_persona`),
  UNIQUE KEY `camp_identificacion_UNIQUE` (`camp_identificacion`)
) ENGINE=InnoDB AUTO_INCREMENT=677 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_persona_prueba`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_persona_prueba` (
  `camp_id_persona` int(11) NOT NULL DEFAULT 0,
  `camp_identificacion` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `camp_nombreUno` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `camp_nombreDOs` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_apellidoUno` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `camp_apellidoDos` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_fk_nacionalidad` int(11) NOT NULL,
  `camp_fk_domicilio` int(11) DEFAULT NULL,
  `camp_fechaNacimiento` date DEFAULT NULL,
  `camp_fk_trabajoUno` int(11) DEFAULT NULL,
  `camp_fk_trabajoDos` int(11) DEFAULT NULL,
  `camp_fk_sexo` int(11) NOT NULL,
  `camp_fk_genero` int(11) DEFAULT NULL,
  `camp_fk_discapacidad` int(11) DEFAULT NULL,
  `camp_fk_idiomaComunica` int(11) DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `campo_persona_registro` int(11) DEFAULT NULL,
  `camp_idSolicitud` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_profesion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_profesion` (
  `camp_id_profesion` int(11) NOT NULL AUTO_INCREMENT,
  `camp_profesional` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_profesion`)
) ENGINE=MyISAM AUTO_INCREMENT=87 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_provincia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_provincia` (
  `camp_id_provincia` int(11) NOT NULL,
  `camp_provincia` int(11) DEFAULT NULL,
  `camp_nombre_provincia` varchar(100) NOT NULL,
  PRIMARY KEY (`camp_id_provincia`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_resenador`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_resenador` (
  `camp_id_resenador` int(11) NOT NULL AUTO_INCREMENT,
  `camp_fk_personasSistema` int(11) DEFAULT NULL,
  `camp_identificacion_resenador` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_resenador`)
) ENGINE=MyISAM AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_sexo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_sexo` (
  `camp_id_sexo` int(11) NOT NULL AUTO_INCREMENT,
  `cam_sexo` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`camp_id_sexo`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_solicitante`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_solicitante` (
  `camp_id` int(11) NOT NULL AUTO_INCREMENT,
  `camp_codigo_solicitud` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_nombre` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_apellido_uno` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_apellido_dos` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_nacionalidad` int(11) DEFAULT NULL,
  `camp_nacimiento` date DEFAULT NULL,
  `camp_sexo` int(11) DEFAULT NULL,
  `camp_genero` int(11) DEFAULT NULL,
  `camp_discapacidad` int(11) DEFAULT NULL,
  `camp_trabajo` int(11) DEFAULT NULL,
  `camp_telefono_uno` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_telefono_dos` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_provincia` int(11) DEFAULT NULL,
  `camp_canton` int(11) DEFAULT NULL,
  `camp_distrito` int(11) DEFAULT NULL,
  `camp_barrio` int(11) DEFAULT NULL,
  `camp_tipo_alquiler` int(11) DEFAULT NULL,
  `camp_tipo_suscripcion` int(11) DEFAULT NULL,
  `camp_detalle_solicitud` text CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_ruta_cedula` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_fecha_solicitud` datetime DEFAULT current_timestamp(),
  `camp_status` int(11) DEFAULT NULL,
  `camp_detalle_status` text CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_recibe_pago` int(11) DEFAULT NULL,
  `camp_medio_pago` int(11) DEFAULT NULL,
  `camp_fecha_aprobacion` datetime DEFAULT NULL,
  `camp_aprobador` int(11) DEFAULT NULL,
  `camp_email` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_cedula` varchar(100) CHARACTER SET latin1 COLLATE latin1_swedish_ci DEFAULT NULL,
  `camp_perfil_facebook` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`camp_id`),
  UNIQUE KEY `camp_cedula_UNIQUE` (`camp_cedula`)
) ENGINE=InnoDB AUTO_INCREMENT=1687 DEFAULT CHARSET=utf8 COLLATE=utf8_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_telefono`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_telefono` (
  `camp_idTelefono` int(11) NOT NULL AUTO_INCREMENT,
  `camp_fk_idPersona` int(11) DEFAULT NULL,
  `camp_fk_codigoPais` int(11) DEFAULT NULL,
  `camp_telefono` int(11) DEFAULT NULL,
  `camp_fecha_registro` datetime DEFAULT current_timestamp(),
  `camp_persona_registra` int(11) DEFAULT NULL,
  PRIMARY KEY (`camp_idTelefono`),
  KEY `tb_persona_idx` (`camp_fk_idPersona`),
  KEY `tb_persona_registra_idx` (`camp_persona_registra`),
  CONSTRAINT `tb_persona` FOREIGN KEY (`camp_fk_idPersona`) REFERENCES `tb_persona` (`camp_id_persona`),
  CONSTRAINT `tb_persona_registra` FOREIGN KEY (`camp_persona_registra`) REFERENCES `tb_persona` (`camp_id_persona`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_tipo_suscripcion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_tipo_suscripcion` (
  `camp_id_suscripcion` int(11) NOT NULL AUTO_INCREMENT,
  `camp_detalle` varchar(100) DEFAULT NULL,
  `camp_periodo_text` varchar(45) DEFAULT NULL,
  `camp_periodo_numero` int(11) DEFAULT NULL,
  PRIMARY KEY (`camp_id_suscripcion`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_tipoalquiler`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_tipoalquiler` (
  `camp_id_tipoAlquiler` int(11) NOT NULL AUTO_INCREMENT,
  `camp_tipoAlquiler_nombre` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_tipoAlquiler`)
) ENGINE=MyISAM AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_ubicacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_ubicacion` (
  `camp_codi` int(11) DEFAULT NULL,
  `camp_Provincia` varchar(50) DEFAULT NULL,
  `camp_Canton` varchar(50) DEFAULT NULL,
  `camp_Distrito` varchar(50) DEFAULT NULL,
  `camp_Lat` varchar(50) DEFAULT NULL,
  `camp_Long` varchar(50) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `tb_usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tb_usuario` (
  `camp_id_usuario` int(11) NOT NULL AUTO_INCREMENT,
  `camp_id_solicitud` int(11) DEFAULT NULL,
  `camp_id_permiso` int(11) DEFAULT NULL,
  `camp_status` int(11) DEFAULT NULL,
  `camp_alta` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `camp_fecha_pago` datetime DEFAULT NULL,
  `camp_clave` text DEFAULT NULL,
  `camp_clave_temporal` text DEFAULT NULL,
  `camp_detalle` text DEFAULT NULL,
  `camp_permiso` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`camp_id_usuario`)
) ENGINE=MyISAM AUTO_INCREMENT=968 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `temporal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `temporal` (
  `enero` int(11) DEFAULT NULL,
  `febrero` int(11) DEFAULT NULL,
  `marzo` int(11) DEFAULT NULL,
  `abril` int(11) DEFAULT NULL,
  `mayo` int(11) DEFAULT NULL,
  `junio` int(11) DEFAULT NULL,
  `julio` int(11) DEFAULT NULL,
  `agosto` int(11) DEFAULT NULL,
  `setiembre` int(11) DEFAULT NULL,
  `octubre` int(11) DEFAULT NULL,
  `noviembre` int(11) DEFAULT NULL,
  `diciembre` int(11) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `upi_personas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `upi_personas` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) DEFAULT NULL,
  `apellido` varchar(100) DEFAULT NULL,
  `cedula` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `upi_table`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `upi_table` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'auto incrementing user_id of each user, unique index',
  `firstname` varchar(250) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `lastname` varchar(20) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `document` varchar(20) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `telephone` varchar(20) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `age` int(11) NOT NULL,
  `user_name` varchar(64) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'user''s name, unique',
  `user_password_hash` varchar(255) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'user''s password in salted and hashed format',
  `user_email` varchar(64) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'user''s email, unique',
  `status` varchar(20) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `date_added` datetime NOT NULL,
  `img_user` varchar(255) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `observaciones` varchar(10000) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `access` varchar(20) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `id_resenador` varchar(20) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `resenador` varchar(200) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `nombre_completo` varchar(100) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `date_end` datetime DEFAULT NULL,
  `registro` int(11) DEFAULT 0,
  `camp_calificacion` int(11) DEFAULT NULL,
  `camp_fecha_nacimiento` date DEFAULT NULL,
  `camp_nombreUno` varchar(30) DEFAULT NULL,
  `camp_nombreDOS` varchar(30) DEFAULT NULL,
  `camp_apellido1` varchar(30) DEFAULT NULL,
  `camp_apellido2` varchar(30) DEFAULT NULL,
  `camp_queda` int(11) DEFAULT NULL,
  `camp_nacionalidad` int(11) DEFAULT NULL,
  `camp_etiqueta1` int(11) DEFAULT NULL,
  `camp_etiqueta2` int(11) DEFAULT NULL,
  `camp_etiqueta3` int(11) DEFAULT NULL,
  `camp_nivel_peligro` int(11) DEFAULT NULL,
  `camp_drogas` int(11) DEFAULT NULL,
  `camp_sexo` int(11) DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=MyISAM AUTO_INCREMENT=5974 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci COMMENT='user data';
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `usersbackup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usersbackup` (
  `user_id` int(11) NOT NULL DEFAULT 0 COMMENT 'auto incrementing user_id of each user, unique index',
  `firstname` varchar(250) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `lastname` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `document` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '0',
  `telephone` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `age` int(11) NOT NULL,
  `user_name` varchar(64) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL COMMENT 'user''s name, unique',
  `user_password_hash` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL COMMENT 'user''s password in salted and hashed format',
  `user_email` varchar(64) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL COMMENT 'user''s email, unique',
  `status` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `date_added` datetime NOT NULL,
  `img_user` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `observaciones` varchar(10000) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `access` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `id_resenador` varchar(20) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `resenador` varchar(200) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `nombre_completo` varchar(100) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `date_end` datetime DEFAULT NULL,
  `registro` int(11) DEFAULT 0,
  `camp_calificacion` int(11) DEFAULT NULL,
  `camp_fecha_nacimiento` date DEFAULT NULL,
  `camp_nombreUno` varchar(30) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL,
  `camp_nombreDOS` varchar(30) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL,
  `camp_apellido1` varchar(30) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL,
  `camp_apellido2` varchar(30) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL,
  `camp_queda` int(11) DEFAULT NULL,
  `camp_nacionalidad` int(11) DEFAULT NULL,
  `camp_etiqueta1` int(11) DEFAULT NULL,
  `camp_etiqueta2` int(11) DEFAULT NULL,
  `camp_etiqueta3` int(11) DEFAULT NULL,
  `camp_nivel_peligro` int(11) DEFAULT NULL,
  `camp_drogas` int(11) DEFAULT NULL,
  `camp_sexo` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `view_bd_vieja_listar_resenas2`;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_resenas2`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_bd_vieja_listar_resenas2` AS SELECT
 1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `camp_identificacion`,
  1 AS `camp_fecha_registro`,
  1 AS `camp_fk_calificacion`,
  1 AS `camp_id_inquilino`,
  1 AS `camp_calificacion_text`,
  1 AS `camp_calificacion_imagen`,
  1 AS `camp_estado`,
  1 AS `camp_estadoText`,
  1 AS `nombreCompletoResenador`,
  1 AS `camp_fk_registrador` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_bd_vieja_listar_resenas_completa`;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_resenas_completa`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_bd_vieja_listar_resenas_completa` AS SELECT
 1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `camp_identificacion`,
  1 AS `camp_fecha_registro`,
  1 AS `camp_fk_calificacion`,
  1 AS `camp_id_inquilino`,
  1 AS `camp_calificacion_imagen`,
  1 AS `camp_estado`,
  1 AS `camp_estadoText`,
  1 AS `camp_comentario_adicional`,
  1 AS `camp_fk_registrador`,
  1 AS `camp_nombreResena` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_bd_vieja_listar_resenas_completa2`;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_resenas_completa2`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_bd_vieja_listar_resenas_completa2` AS SELECT
 1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `camp_identificacion`,
  1 AS `camp_fecha_registro`,
  1 AS `camp_fk_calificacion`,
  1 AS `camp_id_inquilino`,
  1 AS `camp_calificacion_imagen`,
  1 AS `camp_estado`,
  1 AS `camp_estadoText`,
  1 AS `camp_comentario_adicional`,
  1 AS `camp_fk_registrador`,
  1 AS `camp_nombreResena`,
  1 AS `camp_nombreSolicitante` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_bd_vieja_listar_resenas_vista_excel`;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_resenas_vista_excel`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_bd_vieja_listar_resenas_vista_excel` AS SELECT
 1 AS `camp_id_inquilino`,
  1 AS `camp_fecha_registro`,
  1 AS `Inquilino`,
  1 AS `identificacion_Inquilino`,
  1 AS `nacionalidad`,
  1 AS `camp_estadoText`,
  1 AS `resena`,
  1 AS `UsuarioResena`,
  1 AS `cedulaUsuario`,
  1 AS `FacebookUsuario` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_bd_vieja_listar_usuarios_vista_excel`;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_usuarios_vista_excel`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_bd_vieja_listar_usuarios_vista_excel` AS SELECT
 1 AS `camp_id_usuario`,
  1 AS `camp_codigo_solicitud`,
  1 AS `nombreCompleto`,
  1 AS `nombrePais`,
  1 AS `camp_nacimiento`,
  1 AS `Sexo`,
  1 AS `camp_telefono_uno`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_tipoAlquiler_nombre`,
  1 AS `camp_detalle_suscripcion`,
  1 AS `camp_detalle_solicitud`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_detalle_status`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_email`,
  1 AS `camp_cedula`,
  1 AS `Status`,
  1 AS `camp_alta`,
  1 AS `camp_fecha_pago`,
  1 AS `camp_detalle`,
  1 AS `camp_permiso` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_extraer_login`;
/*!50001 DROP VIEW IF EXISTS `view_extraer_login`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_extraer_login` AS SELECT
 1 AS `camp_fk_persona`,
  1 AS `camp_clave`,
  1 AS `camp_claveTemporal`,
  1 AS `camp_activo`,
  1 AS `tipoPermiso`,
  1 AS `aprobador`,
  1 AS `camp_codigo_solicitud`,
  1 AS `nombreCompleto`,
  1 AS `camp_sexo`,
  1 AS `camp_tipo_suscripcion`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_status`,
  1 AS `camp_email`,
  1 AS `identificacionUsuario`,
  1 AS `camp_fechaNacimiento` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_ficha_inquilino_extranjero`;
/*!50001 DROP VIEW IF EXISTS `view_ficha_inquilino_extranjero`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_ficha_inquilino_extranjero` AS SELECT
 1 AS `camp_id_inquilino`,
  1 AS `camp_identificacion`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `nacionalidad`,
  1 AS `camp_apodo`,
  1 AS `camp_imagen`,
  1 AS `camp_profesional`,
  1 AS `camp_conducta`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_tipoAlquiler_nombre`,
  1 AS `etiqueta_uno`,
  1 AS `etiqueta_dos`,
  1 AS `etiqueta_tres`,
  1 AS `etiqueta_cuatro`,
  1 AS `camp_comentario_adicional`,
  1 AS `camp_fk_calificacion`,
  1 AS `camp_fk_proceso_judicial`,
  1 AS `camp_fk_dano_vivienda`,
  1 AS `camp_fk_recomienda_inquilino`,
  1 AS `camp_fecha_registro`,
  1 AS `camp_identificacion_resenador`,
  1 AS `sexo`,
  1 AS `nacimiento`,
  1 AS `personas_con_inquilino`,
  1 AS `tiempo_alquiler`,
  1 AS `tipo_contrato`,
  1 AS `drogas` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_ficha_inquilino_extranjero2`;
/*!50001 DROP VIEW IF EXISTS `view_ficha_inquilino_extranjero2`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_ficha_inquilino_extranjero2` AS SELECT
 1 AS `camp_id_inquilino`,
  1 AS `camp_identificacion`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `nacionalidad`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_comentario_adicional`,
  1 AS `camp_fk_dano_vivienda`,
  1 AS `camp_fecha_registro`,
  1 AS `camp_identificacion_resenador`,
  1 AS `sexo`,
  1 AS `nacimiento`,
  1 AS `personas_con_inquilino`,
  1 AS `tiempo_alquiler`,
  1 AS `drogas`,
  1 AS `camp_imagen`,
  1 AS `camp_fk_proceso_judicial` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_resenas_por_usuario`;
/*!50001 DROP VIEW IF EXISTS `view_listar_resenas_por_usuario`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_resenas_por_usuario` AS SELECT
 1 AS `camp_id`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `camp_identificacion`,
  1 AS `camp_fecha_registro`,
  1 AS `camp_fk_calificacion`,
  1 AS `camp_id_inquilino`,
  1 AS `camp_calificacion_text`,
  1 AS `camp_calificacion_imagen`,
  1 AS `camp_estado`,
  1 AS `camp_estadoText`,
  1 AS `nombreCompletoResenador`,
  1 AS `camp_fk_registrador` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_solicitudes_usuarios`;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_solicitudes_usuarios` AS SELECT
 1 AS `camp_id`,
  1 AS `camp_codigo_solicitud`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `nombrePais`,
  1 AS `camp_nacimiento`,
  1 AS `camp_sexo`,
  1 AS `camp_telefono_uno`,
  1 AS `camp_telefono_dos`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_tipoAlquiler_nombre`,
  1 AS `camp_tipo_suscripcion`,
  1 AS `camp_detalle_solicitud`,
  1 AS `camp_ruta_cedula`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_status`,
  1 AS `camp_detalle_status`,
  1 AS `camp_recibe_pago`,
  1 AS `camp_medio_pago`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_aprobador`,
  1 AS `camp_email`,
  1 AS `camp_cedula`,
  1 AS `nombrePais2`,
  1 AS `perfil_facebook` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_solicitudes_usuarios2`;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios2`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_solicitudes_usuarios2` AS SELECT
 1 AS `camp_id`,
  1 AS `camp_codigo_solicitud`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `nombrePais`,
  1 AS `camp_nacimiento`,
  1 AS `camp_sexo`,
  1 AS `camp_telefono_uno`,
  1 AS `camp_telefono_dos`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_nombre_provincia2`,
  1 AS `camp_tipo_suscripcion`,
  1 AS `camp_detalle_solicitud`,
  1 AS `camp_ruta_cedula`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_status`,
  1 AS `camp_detalle_status`,
  1 AS `camp_recibe_pago`,
  1 AS `camp_medio_pago`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_aprobador`,
  1 AS `camp_email`,
  1 AS `camp_cedula`,
  1 AS `nombrePais2`,
  1 AS `perfil_facebook` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_solicitudes_usuarios3`;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios3`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_solicitudes_usuarios3` AS SELECT
 1 AS `camp_id`,
  1 AS `camp_codigo_solicitud`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_cedula`,
  1 AS `camp_nacimiento`,
  1 AS `camp_perfil_facebook`,
  1 AS `camp_status`,
  1 AS `nombreCompleto`,
  1 AS `camp_activo`,
  1 AS `camp_clave`,
  1 AS `camp_nombre`,
  1 AS `camp_detalle_solicitud`,
  1 AS `correo`,
  1 AS `camp_tipo_suscripcion`,
  1 AS `Name_exp_15` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_solicitudes_usuarios4`;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios4`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_solicitudes_usuarios4` AS SELECT
 1 AS `id_solicitud`,
  1 AS `codigo_solicitud`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_cedula`,
  1 AS `camp_nacimiento`,
  1 AS `camp_status`,
  1 AS `camp_activo`,
  1 AS `nombre`,
  1 AS `id_persona`,
  1 AS `camp_detalle_solicitud`,
  1 AS `camp_email` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_solicitudes_usuarios_pendientes`;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios_pendientes`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_solicitudes_usuarios_pendientes` AS SELECT
 1 AS `camp_id`,
  1 AS `camp_codigo_solicitud`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `nombrePais`,
  1 AS `camp_nacimiento`,
  1 AS `camp_sexo`,
  1 AS `camp_telefono_uno`,
  1 AS `camp_telefono_dos`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_tipoAlquiler_nombre`,
  1 AS `camp_tipo_suscripcion`,
  1 AS `camp_detalle_solicitud`,
  1 AS `camp_ruta_cedula`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_status`,
  1 AS `camp_detalle_status`,
  1 AS `camp_recibe_pago`,
  1 AS `camp_medio_pago`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_aprobador`,
  1 AS `camp_email`,
  1 AS `camp_cedula`,
  1 AS `nombrePais2`,
  1 AS `perfil_facebook`,
  1 AS `camp_id_inquilino` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_solicitudes_usuarios_pendientes2`;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios_pendientes2`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_solicitudes_usuarios_pendientes2` AS SELECT
 1 AS `camp_id`,
  1 AS `camp_codigo_solicitud`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `nombrePais`,
  1 AS `camp_nacimiento`,
  1 AS `camp_sexo`,
  1 AS `camp_telefono_uno`,
  1 AS `camp_telefono_dos`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_status3`,
  1 AS `camp_tipo_suscripcion`,
  1 AS `camp_detalle_solicitud`,
  1 AS `camp_status2`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_status`,
  1 AS `camp_detalle_status`,
  1 AS `camp_recibe_pago`,
  1 AS `camp_medio_pago`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_aprobador`,
  1 AS `camp_email`,
  1 AS `camp_cedula`,
  1 AS `nombrePais2`,
  1 AS `perfil_facebook`,
  1 AS `camp_id_inquilino` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_solicitudes_usuarios_pendientes3`;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios_pendientes3`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_solicitudes_usuarios_pendientes3` AS SELECT
 1 AS `camp_id`,
  1 AS `camp_codigo_solicitud`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `nombrePais`,
  1 AS `camp_nacimiento`,
  1 AS `camp_sexo`,
  1 AS `camp_telefono_uno`,
  1 AS `camp_telefono_dos`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_tipoAlquiler_nombre`,
  1 AS `camp_tipo_suscripcion`,
  1 AS `camp_detalle_solicitud`,
  1 AS `camp_ruta_cedula`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_status`,
  1 AS `camp_detalle_status`,
  1 AS `camp_recibe_pago`,
  1 AS `camp_medio_pago`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_aprobador`,
  1 AS `camp_email`,
  1 AS `camp_cedula`,
  1 AS `nombrePais2`,
  1 AS `perfil_facebook`,
  1 AS `camp_id_inquilino` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_listar_usuario`;
/*!50001 DROP VIEW IF EXISTS `view_listar_usuario`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_listar_usuario` AS SELECT
 1 AS `camp_id_usuario`,
  1 AS `camp_codigo_solicitud`,
  1 AS `camp_id_permiso`,
  1 AS `nombreCompleto`,
  1 AS `nombrePais`,
  1 AS `camp_nacimiento`,
  1 AS `camp_sexo`,
  1 AS `camp_telefono_uno`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_tipoAlquiler_nombre`,
  1 AS `camp_detalle_suscripcion`,
  1 AS `camp_detalle_solicitud`,
  1 AS `camp_ruta_cedula`,
  1 AS `camp_fecha_solicitud`,
  1 AS `camp_detalle_status`,
  1 AS `camp_recibe_pago`,
  1 AS `camp_medio_pago`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_aprobador`,
  1 AS `camp_email`,
  1 AS `camp_cedula`,
  1 AS `camp_status`,
  1 AS `camp_alta`,
  1 AS `camp_fecha_pago`,
  1 AS `camp_clave`,
  1 AS `camp_clave_temporal`,
  1 AS `camp_detalle`,
  1 AS `camp_nombre`,
  1 AS `camp_apellido_uno`,
  1 AS `camp_apellido_dos`,
  1 AS `camp_permiso` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_login_usuario`;
/*!50001 DROP VIEW IF EXISTS `view_login_usuario`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_login_usuario` AS SELECT
 1 AS `camp_id_persona`,
  1 AS `camp_identificacion`,
  1 AS `camp_nombreUno`,
  1 AS `camp_nombreDos`,
  1 AS `camp_apellidoUno`,
  1 AS `camp_apellidoDos`,
  1 AS `camp_fk_persona`,
  1 AS `camp_clave`,
  1 AS `camp_activo`,
  1 AS `camp_id_permiso`,
  1 AS `camp_nombre` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_resumen_solicitante_persona`;
/*!50001 DROP VIEW IF EXISTS `view_resumen_solicitante_persona`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_resumen_solicitante_persona` AS SELECT
 1 AS `camp_id`,
  1 AS `camp_cedula`,
  1 AS `camp_status`,
  1 AS `camp_id_persona`,
  1 AS `nombreCompleto`,
  1 AS `camp_identificacion`,
  1 AS `camp_fk_persona`,
  1 AS `camp_clave`,
  1 AS `camp_fecha_ingreso`,
  1 AS `camp_activo`,
  1 AS `camp_id_permiso`,
  1 AS `camp_fk_persona_login`,
  1 AS `camp_nombre`,
  1 AS `camp_descripcion`,
  1 AS `camp_fecha_registro`,
  1 AS `camp_persona_registra` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_ubicacion_global`;
/*!50001 DROP VIEW IF EXISTS `view_ubicacion_global`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_ubicacion_global` AS SELECT
 1 AS `camp_id_provincia`,
  1 AS `cam_id_canton`,
  1 AS `cam_id_distrito`,
  1 AS `cam_id_barrio`,
  1 AS `camp_nombre_provincia`,
  1 AS `camp_nombre_canton`,
  1 AS `camp_nombre_distrito`,
  1 AS `camp_nombre_barrio` */;
SET character_set_client = @saved_cs_client;
DROP TABLE IF EXISTS `view_verificar_login`;
/*!50001 DROP VIEW IF EXISTS `view_verificar_login`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `view_verificar_login` AS SELECT
 1 AS `camp_fk_persona`,
  1 AS `camp_clave`,
  1 AS `camp_claveTemporal`,
  1 AS `camp_activo`,
  1 AS `tipoPermiso`,
  1 AS `aprobador`,
  1 AS `camp_codigo_solicitud`,
  1 AS `nombreCompleto`,
  1 AS `camp_sexo`,
  1 AS `camp_tipo_suscripcion`,
  1 AS `camp_fecha_aprobacion`,
  1 AS `camp_status`,
  1 AS `camp_email`,
  1 AS `identificacionUsuario`,
  1 AS `camp_fechaNacimiento` */;
SET character_set_client = @saved_cs_client;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_actualizar_clave` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_actualizar_clave`(

 par_tipo int,

 par_id_usuario int, 

 par_identificacion varchar(100),

 par_claveActual varchar(100),

 par_claveNueva varchar(100) )
BEGIN

 IF par_tipo = 1 then /*Verificar usuario desde la plataforma*/

		SELECT count(*)  FROM laprotec_laprotectora.view_extraer_login

        where camp_fk_persona = par_id_usuario and camp_clave = CAST(par_claveActual AS CHAR CHARACTER SET utf8) and identificacionUsuario = CAST(par_identificacion AS CHAR CHARACTER SET utf8) limit 1;

 ELSEIF par_tipo = 2 then /*Extraer datos para actualizar desde la plataforma*/

		SELECT camp_fk_persona,camp_clave,identificacionUsuario  FROM laprotec_laprotectora.view_extraer_login

        where camp_fk_persona = par_id_usuario and camp_clave = CAST(par_claveActual AS CHAR CHARACTER SET utf8) and identificacionUsuario = CAST(par_identificacion AS CHAR CHARACTER SET utf8) limit 1;

ELSEIF par_tipo = 3 then /*Actualizar clave desde la plataforma*/

        update tb_login set camp_clave = CAST(par_claveNueva AS CHAR CHARACTER SET utf8) where camp_fk_persona = par_id_usuario;

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_actualizar_estado_resena_por_id` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_actualizar_estado_resena_por_id`(par_tipo int, par_id int,par_comentario text  )
BEGIN

/*0 pendiente, 1 Aceptada / 2 rechazada*/

	if par_tipo = 0 then 

    update tb_inquilinos_no_nacionales set camp_estado = 0, camp_estadoText = CAST(par_comentario AS CHAR CHARACTER SET utf8) where camp_id_inquilino = par_id;

	elseif par_tipo = 1 then 

    update tb_inquilinos_no_nacionales set camp_estado = 1, camp_estadoText = CAST(par_comentario AS CHAR CHARACTER SET utf8) where camp_id_inquilino = par_id;

	elseif par_tipo = 2 then 

    update tb_inquilinos_no_nacionales set camp_estado = 2, camp_estadoText = CAST(par_comentario AS CHAR CHARACTER SET utf8) where camp_id_inquilino = par_id;

   end if;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_actualizar_permiso` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_actualizar_permiso`(

par_opcion int,

par_camp_fk_persona int, 

par_camp_nombre varchar(100), 

par_camp_descripcion varchar(100), 

par_camp_persona_registra varchar(100)

)
BEGIN



IF par_opcion = 1 then /*Insert*/



insert into tb_permiso(

camp_fk_persona,

camp_nombre,

camp_descripcion,

camp_fecha_registro,

camp_persona_registra

)

values (

par_camp_fk_persona, 

CAST(par_camp_nombre AS CHAR CHARACTER SET utf8),

CAST(par_camp_descripcion AS CHAR CHARACTER SET utf8),

now(), 

par_camp_persona_registra

);

elseif par_opcion = 2 then  /*actualice*/

update tb_permiso set camp_nombre = CAST(par_camp_nombre AS CHAR CHARACTER SET utf8),

camp_descripcion = CAST(par_camp_descripcion AS CHAR CHARACTER SET utf8), 

camp_fecha_registro = now(),

camp_persona_registra =  par_camp_persona_registra

where camp_fk_persona = par_camp_fk_persona;



elseif par_opcion = 3 then  /*select*/

select * from tb_permiso where camp_fk_persona = par_camp_fk_persona;



END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_bd_vieja_listar_resenas` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_bd_vieja_listar_resenas`(btn varchar(100), par_filtro varchar(500) )
BEGIN



/*0 pendiente, 1 Aceptada / 2 rechazada*/

    IF btn = 1 then select * from view_bd_vieja_listar_resenas2 where REPLACE(camp_identificacion,' ', '') like TRIM(CONCAT('%',CAST(par_filtro AS CHAR CHARACTER SET utf8),'%'))

    and camp_identificacion!=0 and camp_estado = 1;

    ELSEIF btn = 2 then select * from view_bd_vieja_listar_resenas2 where observaciones like CONCAT('%', REPLACE(CAST(par_filtro AS CHAR CHARACTER SET utf8),' ','') , '%') and camp_estado = 1;

    ELSEIF btn = 3 then select * from view_bd_vieja_listar_resenas2 where REPLACE(camp_nombre,' ', '') like TRIM(CONCAT('%',CAST(par_filtro  AS CHAR CHARACTER SET utf8),'%')) or

REPLACE(camp_nombre,' ', '') like TRIM(CONCAT('%',CAST(par_filtro  AS CHAR CHARACTER SET utf8),'%')) or 

REPLACE(camp_apellido_uno,' ', '') like TRIM(CONCAT('%',CAST(par_filtro  AS CHAR CHARACTER SET utf8),'%')) or  

REPLACE(camp_apellido_dos,' ', '') like TRIM(CONCAT('%',CAST(par_filtro  AS CHAR CHARACTER SET utf8),'%'))   and camp_identificacion!=0 and camp_estado = 1;

   

    

    

    ELSEIF btn = 4 then select concat_ws(lastname,' ',firstname  ),document,img_user,date_end from view_bd_vieja_listar_resenas;

    

     ELSEIF btn = 5 then 

     SELECT * 

     FROM view_bd_vieja_listar_resenas2 

     WHERE 

      camp_nombre LIKE  CONCAT('%',CAST(par_filtro  AS CHAR CHARACTER SET utf8),'%') OR 

      camp_apellido_uno LIKE CONCAT('%',CAST(par_filtro  AS CHAR CHARACTER SET utf8),'%') OR 

      camp_apellido_dos LIKE CONCAT('%',CAST(par_filtro  AS CHAR CHARACTER SET utf8),'%') order by camp_nombre ;

      

    

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_bd_vieja_listar_resenas_especifica` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_bd_vieja_listar_resenas_especifica`(par_user_id int)
select concat_ws(lastname,' ',firstname) as nombreCompleto ,document,img_user,date_end,observaciones,user_id from view_bd_vieja_listar_resenas 

    where user_id = par_user_id ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_bd_vieja_listar_resenas_individual` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_bd_vieja_listar_resenas_individual`(

btn varchar(20),

par_cedula varchar(20), 

par_id_user int)
BEGIN

    IF btn = 1 then select * from view_bd_vieja_listar_resenas where document = par_cedula ;

	ELSEIF btn = 3  then select * from view_bd_vieja_listar_resenas where user_id = par_id_user;

    ELSEIF btn = 4 then select * from view_bd_vieja_listar_resenas;

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_bd_vieja_listar_resenas_por_estado` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_bd_vieja_listar_resenas_por_estado`(btn int)
BEGIN

    IF btn = 0 then select * from  view_bd_vieja_listar_resenas_completa  where  camp_estado = 0;

    ELSEIF btn = 1 then  select * from  view_bd_vieja_listar_resenas_completa where   camp_estado = 1;

    ELSEIF btn = 2 then select * from  view_bd_vieja_listar_resenas_completa where  camp_estado = 2;

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_bd_vieja_listar_resenas_por_estado2` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_bd_vieja_listar_resenas_por_estado2`(btn int)
BEGIN

    IF btn = 0 then select * from  view_bd_vieja_listar_resenas_completa2  where  camp_estado = 0;

    ELSEIF btn = 1 then  select * from  view_bd_vieja_listar_resenas_completa where   camp_estado = 1;

    ELSEIF btn = 2 then select * from  view_bd_vieja_listar_resenas_completa where  camp_estado = 2;

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_contar_login` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_contar_login`(

   IN par_camp_identificacion_persona int, 

   IN par_camp_clave varchar(100)

 )
select count(*) from view_login_usuario 

   where 

    camp_identificacion = par_camp_identificacion_persona

  and

	camp_clave = par_camp_clave ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_extraer_datos_cedula` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_extraer_datos_cedula`(par_opcion int, par_cedula int )
BEGIN

IF par_opcion = 1 then 

		SELECT count(*) FROM laprotec_laprotectora.view_listar_usuario where camp_cedula = par_cedula;

elseif par_opcion = 2 then 

		SELECT * FROM laprotec_laprotectora.view_listar_usuario where camp_cedula = par_cedula;

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_extraer_datos_usuarios_con_id` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_extraer_datos_usuarios_con_id`(par_id int)
BEGIN

SELECT * FROM laprotec_laprotectora.view_listar_solicitudes_usuarios where camp_id=par_id;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_insert_inquilino_no_nacional` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_insert_inquilino_no_nacional`(

    var_camp_identificacion varchar(100),

    var_camp_nombre varchar(100),

    var_camp_apellido_uno varchar(100),

    var_camp_apellido_dos varchar(100),

    var_camp_fk_nacionalidad int, 

    var_camp_imagen varchar(500),

    var_camp_fk_provincia int,

    var_camp_comentario_adicional text,

    var_camp_fk_registrador int,

    var_estadoResena int,

    var_estadoResenaText  varchar(45)

)
BEGIN



insert into tb_inquilinos_no_nacionales(

    camp_identificacion,

    camp_nombre,

    camp_apellido_uno,

    camp_apellido_dos,

    camp_fk_nacionalidad,

    camp_imagen,

    camp_fk_provincia,

    camp_comentario_adicional,

    camp_fk_registrador,

    camp_estado,/*0 pendiente, 1 Aceptada / 2 rechazada*/

    camp_estadoText /*Campo para que el reseñador diga motivo para rechazarla*/

)

values (

	var_camp_identificacion,

    var_camp_nombre,

    var_camp_apellido_uno,

    var_camp_apellido_dos,

    var_camp_fk_nacionalidad, 

    var_camp_imagen,

    var_camp_fk_provincia,

    var_camp_comentario_adicional,

    var_camp_fk_registrador,

	var_estadoResena,

    var_estadoResenaText

);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_insert_inquilino_no_nacional_en_solicitud` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_insert_inquilino_no_nacional_en_solicitud`(

    var_camp_identificacion varchar(100),

    var_camp_nombre varchar(100),

    var_camp_apellido_uno varchar(100),

    var_camp_apellido_dos varchar(100),

    var_camp_fk_nacionalidad int, 

    var_camp_nacimiento date,

    var_camp_apodo varchar(100),

    var_camp_fk_sexo int,

    var_camp_fk_genero int,

    var_camp_fk_discapacidad int,

    var_camp_drogas int,

    var_camp_fk_trabajo int,

    var_camp_fk_conducta int,

    var_camp_imagen varchar(500),

    var_camp_fk_provincia int,

    var_camp_fk_canton int,

    var_camp_fk_distrito int, 

    var_camp_fk_barrio int,

    var_camp_fk_tipo_contrato int,

    var_camp_fk_tipo_alquiler int,

    var_camp_fk_tiempo_alquiler int,

    var_camp_fk_etiqueta_uno int,

    var_camp_fk_etiqueta_dos int,

    var_camp_fk_etiqueta_tres int,

    var_camp_fk_etiqueta_cuatro int,

    var_camp_fk_calificacion int,

    var_camp_fk_personas_con_inquilino int,

    var_camp_fk_proceso_judicial int,

    var_camp_fk_dano_vivienda int,

    var_camp_fk_recomienda_inquilino int,

    var_camp_comentario_adicional text,

    var_camp_fk_registrador int,

    var_camp_calificacion_text varchar(45),

    var_camp_calificacion_imagen varchar(45),

    var_camp_id_solicitud int

)
BEGIN



insert into tb_inquilinos_no_nacionales(

    camp_identificacion,

    camp_nombre,

    camp_apellido_uno,

    camp_apellido_dos,

    camp_fk_nacionalidad,

    camp_nacimiento,

    camp_apodo,

    camp_fk_sexo,

    camp_fk_genero,

    camp_fk_discapacidad,

    camp_drogas,

    camp_fk_trabajo,

    camp_fk_conducta,

    camp_imagen,

    camp_fk_provincia,

    camp_fk_canton,

    camp_fk_distrito, 

    camp_fk_barrio,

    camp_fk_tipo_contrato,

    camp_fk_tipo_alquiler,

    camp_fk_tiempo_alquiler,

    camp_fk_etiqueta_uno,

    camp_fk_etiqueta_dos,

    camp_fk_etiqueta_tres,

    camp_fk_etiqueta_cuatro,

    camp_fk_calificacion,

    camp_fk_personas_con_inquilino,

    camp_fk_proceso_judicial,

    camp_fk_dano_vivienda,

    camp_fk_recomienda_inquilino,

    camp_comentario_adicional,

    camp_fk_registrador,

    camp_calificacion_text,

    camp_calificacion_imagen,

    camp_estado,/*0 pendiente, 1 Aceptada / 2 rechazada*/

    camp_estadoText /*Campo para que el reseñador diga motivo para rechazarla*/,

    camp_id_solicitud

)

values (

	var_camp_identificacion,

    var_camp_nombre,

    var_camp_apellido_uno,

    var_camp_apellido_dos,

    var_camp_fk_nacionalidad, 

    var_camp_nacimiento,

    var_camp_apodo,

    var_camp_fk_sexo,

    var_camp_fk_genero,

    var_camp_fk_discapacidad,

    var_camp_drogas,

    var_camp_fk_trabajo,

    var_camp_fk_conducta,

    var_camp_imagen,

    var_camp_fk_provincia,

    var_camp_fk_canton,

    var_camp_fk_distrito, 

    var_camp_fk_barrio,

    var_camp_fk_tipo_contrato,

    var_camp_fk_tipo_alquiler,

    var_camp_fk_tiempo_alquiler,

    var_camp_fk_etiqueta_uno,

    var_camp_fk_etiqueta_dos,

    var_camp_fk_etiqueta_tres,

    var_camp_fk_etiqueta_cuatro,

    var_camp_fk_calificacion,

    var_camp_fk_personas_con_inquilino,

    var_camp_fk_proceso_judicial,

    var_camp_fk_dano_vivienda,

    var_camp_fk_recomienda_inquilino,

    var_camp_comentario_adicional,

    var_camp_fk_registrador,

    var_camp_calificacion_text,

    var_camp_calificacion_imagen,

    0,

    'Pendiente',

    var_camp_id_solicitud

);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_listar_usuarios_sistema` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_listar_usuarios_sistema`(btn int,par_filtro varchar(100) )
BEGIN

    IF btn = 1 then select * from view_listar_usuario where camp_cedula like CONCAT('%', REPLACE(par_filtro,' ','') , '%');

    ELSEIF btn = 2 then select * from view_listar_usuario where camp_codigo_solicitud like CONCAT('%', REPLACE(par_filtro,' ','') , '%');

    ELSEIF btn = 3 then  select * from view_listar_usuario where 

    nombreCompleto like CONCAT('%',TRIM(par_filtro),'%') or 

    camp_apellido_uno like CONCAT('%', REPLACE(par_filtro,' ','') , '%') or 

    camp_apellido_dos like CONCAT('%', REPLACE(par_filtro,' ','') , '%') or 

    camp_nombre like CONCAT('%', REPLACE(par_filtro,' ','') , '%') or 

    nombreCompleto like REPLACE(par_filtro,' ','') or 

    concat(camp_nombre,' ',camp_apellido_uno) like REPLACE(par_filtro,' ','') or

    concat(camp_nombre,' ',camp_apellido_uno) like TRIM(par_filtro) or

    concat(camp_nombre,' ',camp_apellido_dos) like TRIM(par_filtro) or

    nombreCompleto like CONCAT('%', REPLACE(par_filtro,' ','') , '%') or 

    REPLACE(par_filtro,' ','')  like CONCAT('%', camp_nombre , '%') or

    TRIM(par_filtro)  like CONCAT('%', camp_nombre , '%');

    END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_listar_usuario_login_cedula` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_listar_usuario_login_cedula`(par_cedula varchar(100))
BEGIN

  select * from view_login_usuario where camp_identificacion = CAST(par_cedula AS CHAR CHARACTER SET utf8);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_listar_usuario_login_id` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_listar_usuario_login_id`(par_id int)
BEGIN

  select * from view_login_usuario where camp_id_persona = par_id ;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_lista_conducta` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_lista_conducta`()
BEGIN

select * from tb_conducta order by camp_conducta;



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_lista_discapacidad` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_lista_discapacidad`()
BEGIN

  select camp_id_discapacidad ,cam_discapacidad as camp_nombre_discapacidad from tb_discapacidad order by cam_discapacidad;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_lista_etiquetaInquilino` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_lista_etiquetaInquilino`()
BEGIN

  select camp_id_etiquetaInquilino as id ,camp_etiquetaInquilino_nombre as nombre from tb_etiquetaInquilino order by nombre;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_lista_nacionalidad` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_lista_nacionalidad`()
BEGIN

  select id as camp_id_nacionalidad,nombre as camp_nombre_nacionalidad from tb_paises order by nombre;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_lista_tipoAlquiler` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_lista_tipoAlquiler`()
BEGIN

  select camp_id_tipoAlquiler as id, camp_tipoAlquiler_nombre as nombre from tb_tipoAlquiler order by camp_tipoAlquiler_nombre;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_lista_trabajo` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_lista_trabajo`()
BEGIN

select * from tb_profesion order by camp_profesional;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_login_usuario` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_login_usuario`(

   IN par_camp_identificacion_persona int, 

   IN par_camp_clave varchar(100)

 )
BEGIN

select * from view_login_usuario where 

    camp_identificacion = par_camp_identificacion_persona and

	camp_clave = par_camp_clave;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_obtener_clave_usuario_con_cedula` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_obtener_clave_usuario_con_cedula`(par varchar(100))
BEGIN







/*SELECT * FROM tb_login a, tb_solicitante b where a.camp_fk_persona = b. camp_id and b.camp_cedula = CAST(par AS CHAR CHARACTER SET utf8);*/



select * 

from tb_solicitante a, tb_Persona b,  tb_login c 

where a.camp_cedula = b.camp_identificacion and c.camp_fk_persona = b.camp_id_persona 

and b.camp_identificacion = CAST(par AS CHAR CHARACTER SET utf8) order by c.camp_fecha_ingreso desc limit 1;









END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_obtener_id_resenador` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_obtener_id_resenador`(par int)
BEGIN

select * from view_resumen_solicitante_persona where camp_id_persona = par;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_recuperar_datos_inquilino` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_recuperar_datos_inquilino`(par_tipo_consulta int, par_cedula varchar(100))
BEGIN

     /*1= no nacionales, 2 = nacionales*/

    IF par_tipo_consulta = 1 then SELECT * FROM tb_inquilinos_no_nacionales where camp_identificacion =  par_cedula ORDER BY camp_id_inquilino DESC LIMIT 1;

    /*ELSEIF btn = 2 then select * from view_bd_vieja_listar_resenas where observaciones like CONCAT('%', par_filtro , '%');

    ELSEIF btn = 3 then select * from view_bd_vieja_listar_resenas where firstname like CONCAT('%', par_filtro , '%') or lastname like CONCAT('%', par_filtro , '%');

    ELSEIF btn = 4 then select concat_ws(lastname,' ',firstname  ),document,img_user,date_end from view_bd_vieja_listar_resenas;*/

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_recuperar_datos_inquilino_id` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_recuperar_datos_inquilino_id`(par_tipo_consulta int, par_id int)
BEGIN

     /*1= no nacionales, 2 = nacionales*/

    IF par_tipo_consulta = 1 then SELECT * FROM tb_inquilinos_no_nacionales where camp_id_inquilino =  par_id  LIMIT 1;

    /*ELSEIF btn = 2 then select * from view_bd_vieja_listar_resenas where observaciones like CONCAT('%', par_filtro , '%');

    ELSEIF btn = 3 then select * from view_bd_vieja_listar_resenas where firstname like CONCAT('%', par_filtro , '%') or lastname like CONCAT('%', par_filtro , '%');

    ELSEIF btn = 4 then select concat_ws(lastname,' ',firstname  ),document,img_user,date_end from view_bd_vieja_listar_resenas;*/

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_recuperar_datos_tabla_persona` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_recuperar_datos_tabla_persona`(par_tipo int, par_id_solicitud int)
BEGIN

	select * from tb_Persona where camp_idSolicitud = par_id_solicitud;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_registrar_login` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_registrar_login`(

	par__fk_persona int,

	par__clave  varchar(100),

	par__claveTemporal varchar(100),

	par__fecha_ingreso datetime,

	par_activo int)
BEGIN

	insert into tb_login(

	camp_fk_persona,

	camp_clave,

	camp_claveTemporal,

	camp_fecha_ingreso,

	camp_activo

	)values(

	par__fk_persona,

	CAST(par__clave AS CHAR CHARACTER SET utf8),

	CAST(par__claveTemporal AS CHAR CHARACTER SET utf8),

	par__fecha_ingreso,

	par_activo

	);

	END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_resenas_fecha_actual` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_resenas_fecha_actual`()
BEGIN

	SELECT 

	camp_id_inquilino,

    concat(camp_nombre,' ',camp_apellido_uno,' ',camp_apellido_dos) as nombre,

	camp_identificacion,

    camp_fk_calificacion,

    camp_fecha_registro

    FROM laprotec_laprotectora.view_ficha_inquilino_extranjero where 

    date_format(camp_fecha_registro, "%Y-%m-%d") =  date_format(NOW(), "%Y-%m-%d") order by date_format(camp_fecha_registro, "%Y-%m-%d") desc;

    END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_resenas_por_fechas` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_resenas_por_fechas`(par_tipo int, par_dia int, par_mes int, par_anio int)
BEGIN

/*

par_tipo = 1 (Cualitativa) con todos parametros

*/

IF par_tipo = 1 then select * from view_ficha_inquilino_extranjero 

where YEAR(camp_fecha_registro) = par_anio and

	  MONTH(camp_fecha_registro) =  par_mes and

      DAY(camp_fecha_registro) =  par_dia;

/*

par_tipo = 2 (Cuantitativa) con todos parametros

*/

ELSEIF par_tipo = 2 then select count(*) from view_ficha_inquilino_extranjero 

where YEAR(camp_fecha_registro) = par_anio and

	  MONTH(camp_fecha_registro) = par_mes and

      DAY(camp_fecha_registro) =  par_dia;

/*

par_tipo = 3  (Cualitativa) con fecha actual, dia,mes,año 

*/

ELSEIF par_tipo = 3 then select * from view_ficha_inquilino_extranjero 

where YEAR(camp_fecha_registro) = YEAR(CURRENT_DATE()) and

	  MONTH(camp_fecha_registro) =  MONTH(CURRENT_DATE()) and

      DAY(camp_fecha_registro) =  DAY(CURRENT_DATE());

/*

par_tipo = 4  (Cuantitativa) con fecha actual, día,mes,año

*/

ELSEIF par_tipo = 4 then select count(*) from view_ficha_inquilino_extranjero 

where YEAR(camp_fecha_registro) = YEAR(CURRENT_DATE()) and

	  MONTH(camp_fecha_registro) =  MONTH(CURRENT_DATE()) and

      DAY(camp_fecha_registro) =  DAY(CURRENT_DATE());

/*

par_tipo = 5  (Cualitativa) con parametro de mes

*/

ELSEIF par_tipo = 5 then select * from view_ficha_inquilino_extranjero

  where MONTH(camp_fecha_registro) = par_mes and YEAR(camp_fecha_registro) = par_anio;

/*

par_tipo = 6  (Cuantitativa) con parametro de mes

*/

ELSEIF par_tipo = 6 then select count(*) from view_ficha_inquilino_extranjero 

 where MONTH(camp_fecha_registro) = par_mes and YEAR(camp_fecha_registro) = par_anio;

/*

par_tipo = 7  (Cualitativa) con parametro número de día del mes

*/

ELSEIF par_tipo = 7 then select * from view_ficha_inquilino_extranjero 

 where DAY(camp_fecha_registro) = par_dia and YEAR(camp_fecha_registro) = par_anio;

/*

par_tipo = 8  (Cuantitativa) con parametro número de día del mes

*/

ELSEIF par_tipo = 8 then select count(*) from view_ficha_inquilino_extranjero

 where DAY(camp_fecha_registro) =  par_dia and YEAR(camp_fecha_registro) = par_anio;

/*

par_tipo = 9  (Cualitativa) con parametro de año

*/

ELSEIF par_tipo = 9 then select * from view_ficha_inquilino_extranjero  where 

YEAR(camp_fecha_registro) = par_anio;

/*

par_tipo = 10  (Cuantitativa) con parametro de año

*/

ELSEIF par_tipo = 10 then select * from view_ficha_inquilino_extranjero  

where YEAR(camp_fecha_registro) =  par_anio;

/*

par_tipo = 11  (Cualitativa) con parametro por número de día de la semana

0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday, 4 = Friday, 5 = Saturday, 6 = Sunday.

*/

ELSEIF par_tipo = 11 then select * from view_ficha_inquilino_extranjero 

 where WEEKDAY(camp_fecha_registro) =  par_dia and YEAR(camp_fecha_registro) = par_anio;

/*

par_tipo = 12  (Cuantitativa) con parametro por número de día de la semana

0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday, 4 = Friday, 5 = Saturday, 6 = Sunday.

*/

ELSEIF par_tipo = 12 then select count(*) from view_ficha_inquilino_extranjero 

 where WEEKDAY(camp_fecha_registro) = par_dia and YEAR(camp_fecha_registro) = par_anio;



end if;



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_solicitud_registro` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_solicitud_registro`(

par_codigo_solicitud varchar(50),

par_nombre varchar(100),

par_apellido_uno varchar(100),

par_apellido_dos varchar(100),

par_nacionalidad int,

par_nacimiento date,

par_sexo int,

par_genero int,

par_discapacidad int,

par_trabajo int,

par_telefono_uno varchar(100),

par_telefono_dos varchar(100),

par_provincia int,

par_canton int,

par_distrito int,

par_barrio int,

par_tipo_alquiler int,

par_tipo_suscripcion int,

par_detalle_solicitud text,

par_ruta_cedula varchar(100),

par_status int,

par_detalle_status text,

par_reibe_pago int,

par_medio_pago int,

par_email varchar(100),

par_cedula varchar(100),

par_perfil_facebook varchar(100)

)
BEGIN

insert into tb_solicitante(

camp_codigo_solicitud,

camp_nombre,

camp_apellido_uno,

camp_apellido_dos,

camp_nacionalidad,

camp_nacimiento,

camp_sexo,

camp_genero,

camp_discapacidad,

camp_trabajo,

camp_telefono_uno,

camp_telefono_dos,

camp_provincia,

camp_canton,

camp_distrito,

camp_barrio,

camp_tipo_alquiler,

camp_tipo_suscripcion,

camp_detalle_solicitud,

camp_ruta_cedula,

camp_status,

camp_detalle_status,

camp_recibe_pago,

camp_medio_pago,

camp_email,

camp_cedula,

camp_perfil_facebook

)

values (

par_codigo_solicitud,

par_nombre,

par_apellido_uno,

par_apellido_dos,

par_nacionalidad,

par_nacimiento,

par_sexo,

par_genero,

par_discapacidad,

par_trabajo,

par_telefono_uno,

par_telefono_dos,

par_provincia,

par_canton,

par_distrito,

par_barrio,

par_tipo_alquiler,

par_tipo_suscripcion,

par_detalle_solicitud,

par_ruta_cedula,

par_status,

par_detalle_status,

par_reibe_pago,

par_medio_pago,

par_email,

par_cedula,

par_perfil_facebook

);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_ultima_persona_creada` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_ultima_persona_creada`(par_identificacion varchar(100))
BEGIN

	select * from tb_Persona where camp_identificacion = CAST(par_identificacion AS CHAR CHARACTER SET utf8) order by camp_id_persona desc limit 1;

    /*select * from tb_Persona where camp_identificacion = CAST(par_identificacion AS CHAR CHARACTER SET utf8) order by camp_id_persona desc limit 1;*/

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_verificar_existe_persona_solicitud` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_verificar_existe_persona_solicitud`(par_id int)
BEGIN



 select count(*)

from tb_usuario a, tb_solicitante b

where a.camp_id_solicitud = par_id and b.camp_id = par_id;



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_verificar_existe_persona_solicitud_datos` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_verificar_existe_persona_solicitud_datos`(par_id int)
BEGIN

  select * from tb_solicitante where camp_id = par_id;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_verificar_login` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_verificar_login`(

    IN par_opcion INT, 

    IN par_usuario VARCHAR(100), 

    IN par_clave VARCHAR(100), 

    IN par_camp_fk_persona INT, 

    IN par_claveTemporal VARCHAR(100), 

    IN par_id_usuario INT

)
BEGIN

    IF par_opcion = 1 THEN /* Verificar si existe */

        SELECT count(*) 

        FROM view_extraer_login 

        WHERE camp_clave = CAST(par_clave AS CHAR CHARACTER SET utf8)  

        AND identificacionUsuario = CAST(par_usuario AS CHAR CHARACTER SET utf8);

    ELSEIF par_opcion = 2 THEN /* Extraer datos */

        SELECT * 

        FROM view_extraer_login 

        WHERE camp_clave = CAST(par_clave AS CHAR CHARACTER SET utf8)  

        AND identificacionUsuario = CAST(par_usuario AS CHAR CHARACTER SET utf8);

    ELSEIF par_opcion = 3 THEN /* Resetear contraseña */

        UPDATE tb_login 

        SET camp_clave = CAST(par_clave AS CHAR CHARACTER SET utf8), 

            camp_claveTemporal = CAST(par_claveTemporal AS CHAR CHARACTER SET utf8) 

        WHERE camp_fk_persona = par_id_usuario;

    ELSEIF par_opcion = 4 THEN /* Extraer datos de usuario para crear sesión */

        SELECT * 

        FROM view_extraer_login 

        WHERE camp_fk_persona = par_id_usuario;

    END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_verificar_solicitud_usuario` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_verificar_solicitud_usuario`(par_opcion int, par_codigo varchar(100))
BEGIN

IF par_opcion = 1 then select * from view_listar_solicitudes_usuarios;

ELSEIF par_opcion = 0 then select * from view_listar_solicitudes_usuarios  where  camp_cedula != "" and camp_status = 1 order by camp_fecha_solicitud desc;



ELSEIF par_opcion = 2 then select count(*) from view_listar_solicitudes_usuarios where camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 3 then select * from view_listar_solicitudes_usuarios where  camp_codigo_solicitud = par_codigo and camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 4 then select * from view_listar_solicitudes_usuarios where camp_cedula= CAST(par_codigo AS CHAR CHARACTER SET utf8) and camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 5 then select * from view_listar_solicitudes_usuarios /*where camp_status = 0;*/ where camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 6 then select * from view_listar_solicitudes_usuarios  where  camp_cedula != "" and camp_status = 0 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 7 then select * from view_listar_solicitudes_usuarios /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 2 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 8 then select * from view_listar_solicitudes_usuarios /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 3 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 9 then select * from view_listar_solicitudes_usuarios /*where camp_status = 0;*/ where camp_cedula !="" and  camp_status != 3 and camp_status != 2 and camp_status != 0 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 10 then select * from view_listar_solicitudes_usuarios /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 1 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 11 then select * from view_listar_solicitudes_usuarios3 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 1 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 12 then select * from view_listar_solicitudes_usuarios3 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 2 or camp_status=3 or camp_activo = 2  or camp_activo = 0 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 13 then select * from view_listar_solicitudes_usuarios3 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 0 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 14 then select * from view_listar_solicitudes_usuarios4 /*where camp_status = 0;*/ where camp_cedula !="" and camp_activo = 1 order by camp_fecha_solicitud desc;











END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_verificar_solicitud_usuario2` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_verificar_solicitud_usuario2`(par_opcion int, par_codigo varchar(100))
BEGIN

IF par_opcion = 1 then select * from view_listar_solicitudes_usuarios2;

ELSEIF par_opcion = 0 then select * from view_listar_solicitudes_usuarios2  where  camp_cedula != "" and camp_status = 1 order by camp_fecha_solicitud desc;



ELSEIF par_opcion = 2 then select count(*) from view_listar_solicitudes_usuarios2 where camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 3 then select * from view_listar_solicitudes_usuarios2 where  camp_codigo_solicitud = par_codigo and camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 4 then select * from view_listar_solicitudes_usuarios2 where camp_cedula= CAST(par_codigo AS CHAR CHARACTER SET utf8) and camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 5 then select * from view_listar_solicitudes_usuarios2 /*where camp_status = 0;*/ where camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 6 then select * from view_listar_solicitudes_usuarios2  where  camp_cedula != "" and camp_status = 0 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 7 then select * from view_listar_solicitudes_usuarios2 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 2 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 8 then select * from view_listar_solicitudes_usuarios2 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 3 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 9 then select * from view_listar_solicitudes_usuarios2 /*where camp_status = 0;*/ where camp_cedula !="" and  camp_status != 3 and camp_status != 2 and camp_status != 0 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 10 then select * from view_listar_solicitudes_usuarios2 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 1 order by camp_fecha_solicitud desc;



END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_verificar_solicitud_usuario_pendientes` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_verificar_solicitud_usuario_pendientes`(par_opcion int, par_codigo varchar(100))
BEGIN

IF par_opcion = 1 then select * from view_listar_solicitudes_usuarios_pendientes2;

ELSEIF par_opcion = 0 then select * from view_listar_solicitudes_usuarios_pendientes2  where  camp_cedula != "" and camp_status = 1 order by camp_fecha_solicitud desc;



ELSEIF par_opcion = 2 then select count(*) from view_listar_solicitudes_usuarios_pendientes2 where camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 3 then select * from view_listar_solicitudes_usuarios_pendientes2 where  camp_codigo_solicitud = par_codigo and camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 4 then select * from view_listar_solicitudes_usuarios_pendientes2 where camp_cedula= CAST(par_codigo AS CHAR CHARACTER SET utf8) and camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 5 then select * from view_listar_solicitudes_usuarios_pendientes2 /*where camp_status = 0;*/ where camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 6 then select * from view_listar_solicitudes_usuarios_pendientes2  where  camp_cedula != "" and camp_status = 0 order by camp_id desc;

ELSEIF par_opcion = 7 then select * from view_listar_solicitudes_usuarios_pendientes2 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 2 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 8 then select * from view_listar_solicitudes_usuarios_pendientes2 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 3 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 9 then select * from view_listar_solicitudes_usuarios_pendientes2 /*where camp_status = 0;*/ where camp_cedula !="" and  camp_status != 3 and camp_status != 2 and camp_status != 0 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 10 then select * from view_listar_solicitudes_usuarios_pendientes2 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 1 order by camp_fecha_solicitud desc;



END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_verificar_solicitud_usuario_pendientes2` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_verificar_solicitud_usuario_pendientes2`(par_opcion int, par_codigo varchar(100))
BEGIN

IF par_opcion = 1 then select * from view_listar_solicitudes_usuarios_pendientes2;

ELSEIF par_opcion = 0 then select * from view_listar_solicitudes_usuarios_pendientes2  where  camp_cedula != "" and camp_status = 1 order by camp_fecha_solicitud desc;



ELSEIF par_opcion = 2 then select count(*) from view_listar_solicitudes_usuarios_pendientes2 where camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 3 then select * from view_listar_solicitudes_usuarios_pendientes2 where  camp_codigo_solicitud = par_codigo and camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 4 then select * from view_listar_solicitudes_usuarios_pendientes2 where camp_cedula= CAST(par_codigo AS CHAR CHARACTER SET utf8) and camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 5 then select * from view_listar_solicitudes_usuarios_pendientes2 /*where camp_status = 0;*/ where camp_cedula!="" order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 6 then select * from view_listar_solicitudes_usuarios_pendientes2  where  camp_cedula != "" and camp_status = 0 order by camp_id desc;

ELSEIF par_opcion = 7 then select * from view_listar_solicitudes_usuarios_pendientes2 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 2 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 8 then select * from view_listar_solicitudes_usuarios_pendientes2 /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 3 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 9 then select * from view_listar_solicitudes_usuarios_pendientes /*where camp_status = 0;*/ where camp_cedula !="" and  camp_status != 3 and camp_status != 2 and camp_status != 0 order by camp_fecha_solicitud desc;

ELSEIF par_opcion = 10 then select * from view_listar_solicitudes_usuarios_pendientes /*where camp_status = 0;*/ where camp_cedula !="" and camp_status = 1 order by camp_fecha_solicitud desc;



END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_ver_clave_usuario` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_ver_clave_usuario`(par_id_persona int)
BEGIN

select camp_clave from tb_login where  camp_fk_persona = par_id_persona;



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_vista_ficha_inquilino` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_vista_ficha_inquilino`(par_id int, par_identificacion varchar(100), par_tipo int )
BEGIN

	if par_tipo = 1 then select * from view_ficha_inquilino_extranjero where camp_id_inquilino = par_id and camp_identificacion =  CAST(par_identificacion AS CHAR CHARACTER SET utf8);

    

   

    end if;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `proc_vista_ficha_inquilino2` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `proc_vista_ficha_inquilino2`(par_id int, par_identificacion varchar(100), par_tipo int )
BEGIN

	if par_tipo = 1 then select * from view_ficha_inquilino_extranjero2 where camp_id_inquilino = par_id and camp_identificacion =  CAST(par_identificacion AS CHAR CHARACTER SET utf8);

    

   

    end if;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_email` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_email`(par_email varchar(100), par_cedula varchar(100))
BEGIN

update tb_solicitante 

set camp_email =CAST(par_email AS CHAR CHARACTER SET utf8) 

 where camp_cedula = CAST(par_cedula AS CHAR CHARACTER SET utf8);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_login` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_login`(par_opcion int, par_fk_persona int, par_clave varchar(100), par_clave_temporal varchar(100))
BEGIN

IF par_opcion = 1 then /*activo persona*/

		update tb_login set camp_activo = 1, camp_fecha_ingreso = now()  where camp_fk_persona = par_fk_persona;

elseif par_opcion = 2 then /*Bloqueado*/

		update tb_login set camp_activo = 2, camp_fecha_ingreso = now() where camp_fk_persona = par_fk_persona;

elseif par_opcion = 3 then /*Bloquado*/

		update tb_login set camp_activo = 3, camp_fecha_ingreso = now() where camp_fk_persona = par_fk_persona;

elseif par_opcion = 4 then /*Reseteo*/

		update tb_login set camp_clave = par_clave , camp_claveTemporal = par_clave_temporal  where camp_fk_persona = par_fk_persona;

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_nombre_usuario` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_nombre_usuario`(

cedula varchar(100),

par_nombre1 varchar(100),

par_nombre2 varchar(100),

par_apellido1 varchar(100),

par_apellido2 varchar(100)

)
BEGIN

update tb_Persona set 

camp_nombreUno = CAST(par_nombre1 AS CHAR CHARACTER SET utf8), 

camp_nombreDOs  = CAST(par_nombre2 AS CHAR CHARACTER SET utf8), 

camp_apellidoUno  = CAST(par_apellido1 AS CHAR CHARACTER SET utf8), 

camp_apellidoDos = CAST(par_apellido2 AS CHAR CHARACTER SET utf8)

where camp_identificacion = CAST(cedula AS CHAR CHARACTER SET utf8);



update tb_solicitante set 

camp_nombre = concat(  CAST(par_nombre1 AS CHAR CHARACTER SET utf8),' ',CAST(par_nombre2 AS CHAR CHARACTER SET utf8)),

camp_apellido_uno = CAST(par_apellido1 AS CHAR CHARACTER SET utf8),

camp_apellido_dos = CAST(par_apellido2 AS CHAR CHARACTER SET utf8)

where camp_cedula = CAST(cedula AS CHAR CHARACTER SET utf8); 

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_perfil_facebook` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_perfil_facebook`(perfil varchar(45), par_cedula varchar(100))
BEGIN

update tb_solicitante set camp_perfil_facebook = CAST(perfil AS CHAR CHARACTER SET utf8)

where camp_cedula = CAST(par_cedula  AS CHAR CHARACTER SET utf8);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_resena` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_resena`(

par_opcion int,

par_resul_id_inquilino int,

par_input_nacionalidad int, 

par_input_identificacion varchar(100), 

par_input_nombre varchar(100), 

par_input_apellido_uno varchar(100),

par_input_apellido_dos varchar(100),

par_input_nacimiento date,

par_input_sexo int,

par_input_drogas int,

par_input_provincia int,

par_input_personas_con_inquilino int,

par_input_proceso_judicial int,

par_input_dano_vivienda int,

par_input_comentario text,

par_input_comentarioEdicion text

)
BEGIN



IF par_opcion = 1 then /*Insert*/

update tb_inquilinos_no_nacionales set camp_fk_nacionalidad = par_input_nacionalidad where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 2 then  /*actualice*/

update tb_inquilinos_no_nacionales set camp_identificacion = CAST(par_input_identificacion AS CHAR CHARACTER SET utf8)  where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 3 then  /*select*/

update tb_inquilinos_no_nacionales set camp_nombre = CAST(par_input_nombre AS CHAR CHARACTER SET utf8) where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 4 then  /*select*/

update tb_inquilinos_no_nacionales set camp_apellido_uno  = CAST(par_input_apellido_uno AS CHAR CHARACTER SET utf8) where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 5 then  /*select*/

update tb_inquilinos_no_nacionales set camp_apellido_dos  = CAST(par_input_apellido_dos AS CHAR CHARACTER SET utf8) where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 6 then  /*select*/

update tb_inquilinos_no_nacionales set  camp_nacimiento = par_input_nacimiento where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 7 then  /*select*/

update tb_inquilinos_no_nacionales set camp_fk_sexo = par_input_sexo where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 8 then  /*select*/

update tb_inquilinos_no_nacionales set camp_drogas = par_input_drogas where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 9 then  /*select*/

update tb_inquilinos_no_nacionales set camp_fk_provincia = par_input_provincia where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 10 then  /*select*/

update tb_inquilinos_no_nacionales set camp_fk_personas_con_inquilino = par_input_personas_con_inquilino where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 11 then  /*select*/

update tb_inquilinos_no_nacionales set camp_fk_proceso_judicial = par_input_proceso_judicial  where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 12 then  /*select*/

update tb_inquilinos_no_nacionales set camp_fk_dano_vivienda = par_input_dano_vivienda where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 13 then  /*select*/

update tb_inquilinos_no_nacionales set camp_comentario_adicional = par_input_comentario where camp_id_inquilino = par_resul_id_inquilino;

elseif par_opcion = 14 then  /*select*/

update tb_inquilinos_no_nacionales set camp_estadoText = par_input_comentarioEdicion where camp_id_inquilino = par_resul_id_inquilino;



END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_resenador_en_resena` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_resenador_en_resena`(id_persona int, idSolicitante int)
BEGIN

	update tb_inquilinos_no_nacionales set camp_fk_registrador = id_persona  where camp_id_solicitud = idSolicitante;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_solicitud_usuario` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_solicitud_usuario`(

par_id int,

par_cedula varchar(100),

par_suscripcion int,

par_recibe_pago int,

par_medio_pago int,

par_status int, 

par_detalle_status text,

par_aprobador int,

par_id_permiso int)
BEGIN

update laprotec_laprotectora.tb_solicitante set 

		camp_tipo_suscripcion = par_suscripcion,

		camp_recibe_pago = par_recibe_pago,

		camp_medio_pago = par_medio_pago,

		camp_status = par_status, 

		camp_detalle_status = CAST(par_detalle_status AS CHAR CHARACTER SET utf8),

        camp_aprobador = par_aprobador,

        camp_fecha_aprobacion = CURRENT_TIMESTAMP()

    where camp_id = par_id;

    

    delete from tb_usuario where camp_id_solicitud = par_id;

    

    insert tb_usuario (camp_id_solicitud,camp_id_permiso,camp_fecha_pago,camp_status,camp_detalle)

    values (

    par_id,

    par_id_permiso,

    CURRENT_TIMESTAMP(),

    par_status,

    par_detalle_status);

    update tb_usuario set camp_permiso = 'Consultor' where camp_id_permiso = 1;

    update tb_usuario set camp_permiso = 'Administrador' where camp_id_permiso = 2;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_solicitud_usuario_existente` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_solicitud_usuario_existente`(par_solicitud int, par_status int, par_id_permiso int, par_alta datetime, par_detalle text,par_permiso varchar(100)  )
BEGIN

update tb_usuario set camp_status = par_status, camp_id_permiso = par_id_permiso, camp_alta = now(), camp_detalle = par_detalle, camp_permiso = par_permiso where camp_id_solicitud = par_solicitud;

update tb_login set camp_activo = par_status where camp_fk_persona = par_solicitud;

update tb_solicitante set camp_status = par_status, camp_detalle_status = par_detalle, camp_fecha_aprobacion = now() where camp_id = par_solicitud;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_suscripcion` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_suscripcion`(par_tipo_suscripcion int, par_cedula varchar(100))
BEGIN

update tb_solicitante set camp_tipo_suscripcion =par_tipo_suscripcion  where camp_cedula = CAST(par_cedula AS CHAR CHARACTER SET utf8);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_actualizar_telefono` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_actualizar_telefono`(par_telefono varchar(100), par_cedula varchar(100))
BEGIN

update tb_solicitante 

set camp_telefono_uno =CAST(par_telefono AS CHAR CHARACTER SET utf8) 

 where camp_cedula = CAST(par_cedula AS CHAR CHARACTER SET utf8);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_cambiar_estado_login` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_cambiar_estado_login`(par_estado int,par_id_persona int)
BEGIN

update tb_login set camp_activo = par_estado, camp_fecha_ingreso = now() where camp_fk_persona = par_id_persona;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_crear_login` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_crear_login`(par_aprobador int, id_solicitud int)
BEGIN

	insert into tb_Persona

(

	camp_identificacion,

    camp_nombreUno,

    camp_apellidoUno,

    camp_apellidoDos,

    camp_fk_nacionalidad,

    camp_fechaNacimiento,

    camp_fk_trabajoUno,

    camp_fk_sexo,

    camp_fk_genero,

    camp_fk_discapacidad,

    campo_persona_registro,

    camp_idSolicitud

)

  select

	camp_cedula,

    camp_nombre,

    camp_apellido_uno,

    camp_apellido_dos,

    camp_nacionalidad,

    camp_nacimiento,

    camp_trabajo,

    camp_sexo,

    camp_genero,

    camp_discapacidad,

    camp_aprobador,

    camp_id

    from 

    tb_solicitante where camp_id = id_solicitud;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_filtra_barrios` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_filtra_barrios`(par_camp_id_distrito int)
BEGIN

  select cam_id_barrio, camp_nombre_barrio from view_ubicacion_global 

  where  cam_id_distrito = par_camp_id_distrito  order by camp_nombre_barrio;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_filtra_canton` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_filtra_canton`(par_camp_id_provincia int)
BEGIN

   select distinct cam_id_canton, camp_nombre_canton from view_ubicacion_global 

   where camp_id_provincia = par_camp_id_provincia  order by camp_nombre_canton;



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_filtra_distritos` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_filtra_distritos`(camp_id_Canton int)
BEGIN

  select distinct cam_id_distrito, camp_nombre_distrito from view_ubicacion_global 

  where  cam_id_canton = camp_id_Canton  order by camp_nombre_distrito;



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_listar_datos_usuario` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_listar_datos_usuario`(par_cedula varchar(100))
BEGIN

select 

/*Persona*/

   a.camp_identificacion,

  concat(d.camp_nombre,' ',d.camp_apellido_uno,' ',d.camp_apellido_dos) as nombreCompleto,

  /*Login*/

  b.camp_clave,

  b.camp_activo as activoLogin,

  /*permiso*/

  c.camp_nombre as Roll,

  c.camp_persona_registra,

  /*Solicitante*/

  d.camp_status as statusSolicitud,

  d.camp_fecha_aprobacion as fechaAprobacionSolicitud,

  d.camp_email,

  d.camp_perfil_facebook,

  d.camp_detalle_status,

  d.camp_telefono_uno,

  d.camp_nacimiento,

  d.camp_tipo_suscripcion

from tb_Persona a, tb_login b, tb_permiso c, tb_solicitante d

where 

   b.camp_fk_persona = c.camp_fk_persona and  a.camp_id_persona = c.camp_fk_persona and

   d.camp_cedula =  a.camp_identificacion and a.camp_identificacion = CAST(par_cedula AS CHAR CHARACTER SET utf8);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_listar_permiso_usuario_por_solicitud` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_listar_permiso_usuario_por_solicitud`(par_solicitud varchar(100))
BEGIN

select a.camp_permiso

 from view_listar_usuario a, view_listar_solicitudes_usuarios b



where a.camp_codigo_solicitud = b.camp_codigo_solicitud and a.camp_codigo_solicitud = CAST(par_solicitud AS CHAR CHARACTER SET utf8) and a.camp_status != 0;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_listar_persona_por_cedula` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_listar_persona_por_cedula`(par_tipo int,par varchar(100))
BEGIN

IF par_tipo = 1 then 

select count(*) from tb_Persona where camp_identificacion= CAST(par AS CHAR CHARACTER SET utf8);

elseif par_tipo = 2 then select * from tb_Persona where camp_identificacion= CAST(par AS CHAR CHARACTER SET utf8);

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_listar_provincias` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_listar_provincias`()
BEGIN

   select camp_id_provincia, camp_nombre_provincia from view_ubicacion_global order by camp_nombre_provincia;



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_listar_resenas_por_usuario` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_listar_resenas_por_usuario`()
BEGIN



select count(a.camp_fk_registrador) total, b.camp_identificacion, a.camp_fk_registrador, 

concat(c.camp_nombre,' ',c.camp_apellido_uno,' ',c.camp_apellido_dos) as resenador,

sum(case when camp_estado = 0 then 1 else 0 end) as Pendiente,

sum(case when camp_estado = 1 then 1 else 0 end) as Aprobado,

sum(case when camp_estado = 2 then 1 else 0 end) as Rechazado,



c.camp_perfil_facebook

from tb_inquilinos_no_nacionales a , tb_Persona b, tb_solicitante c

/*Aprobada = 1, Rechazada = 2, Pendiente = 0*/

where b.camp_id_persona = a.camp_fk_registrador and c.camp_cedula = b.camp_identificacion

and a.camp_id_solicitud != ""



group by a.camp_fk_registrador



having count(a.camp_id_inquilino)

order by count(a.camp_fk_registrador);



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_listar_resenas_por_usuario2` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_listar_resenas_por_usuario2`()
BEGIN



select count(a.camp_fk_registrador) total, b.camp_identificacion, a.camp_fk_registrador, 

concat(c.camp_nombre,' ',c.camp_apellido_uno,' ',c.camp_apellido_dos) as resenador,

sum(case when a.camp_estado = 0 then 1 else 0 end) as Pendiente,

sum(case when a.camp_estado = 1 then 1 else 0 end) as Aprobado,

sum(case when a.camp_estado = 2 then 1 else 0 end) as Rechazado,



c.camp_perfil_facebook

from tb_inquilinos_no_nacionales a , tb_Persona b, tb_solicitante c

/*Aprobada = 1, Rechazada = 2, Pendiente = 0*/

where b.camp_id_persona = a.camp_fk_registrador and c.camp_cedula = b.camp_identificacion

and a.camp_id_solicitud != ""



group by a.camp_fk_registrador



having count(a.camp_id_inquilino)

order by count(a.camp_fk_registrador);



END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_listar_solicitud_por_cedula` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_listar_solicitud_por_cedula`(par_tipo int,par varchar(100))
BEGIN

IF par_tipo = 1 then 

SELECT count(*) FROM laprotec_laprotectora.tb_solicitante where camp_cedula = CAST(par AS CHAR CHARACTER SET utf8);

elseif par_tipo = 2 then SELECT * FROM laprotec_laprotectora.tb_solicitante where camp_cedula = CAST(par AS CHAR CHARACTER SET utf8);

END IF;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_recuperar_datos_solicitud_con_id` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_recuperar_datos_solicitud_con_id`(par int)
BEGIN

		SELECT * FROM laprotec_laprotectora.tb_solicitante where camp_id = par;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_registrar_permiso` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_registrar_permiso`(

                par_fk_persona int,

				par_nombre varchar(100),

				par_descripcion varchar(100),

				par_persona_registra int)
BEGIN

	  insert into tb_permiso (

				camp_fk_persona,

				camp_nombre,

				camp_descripcion,

				camp_persona_registra

				)values(

				par_fk_persona,

				CAST(par_nombre AS CHAR CHARACTER SET utf8),

				CAST(par_descripcion AS CHAR CHARACTER SET utf8),

				par_persona_registra

	);

    

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_resenas_por_persona` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_resenas_por_persona`(par_cedula varchar(100))
BEGIN

select * from view_bd_vieja_listar_resenas_vista_excel where cedulaUsuario = CAST(par_cedula AS CHAR CHARACTER SET utf8);

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `pro_roll_persona_por_id` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `pro_roll_persona_por_id`(par_id int)
BEGIN

 select b.camp_nombre

 from view_login_usuario a, tb_permiso b where b.camp_id_permiso = a.camp_id_permiso and camp_id_persona = par_id;

END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

USE `laprotec_laprotectora`;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_resenas2`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_bd_vieja_listar_resenas2` AS select `a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`a`.`camp_identificacion` AS `camp_identificacion`,`a`.`camp_fecha_registro` AS `camp_fecha_registro`,`a`.`camp_fk_calificacion` AS `camp_fk_calificacion`,`a`.`camp_id_inquilino` AS `camp_id_inquilino`,`a`.`camp_calificacion_text` AS `camp_calificacion_text`,`a`.`camp_calificacion_imagen` AS `camp_calificacion_imagen`,`a`.`camp_estado` AS `camp_estado`,`a`.`camp_estadoText` AS `camp_estadoText`,concat(`b`.`camp_nombreUno`,' ',`b`.`camp_apellidoUno`,' ',`b`.`camp_apellidoDos`) AS `nombreCompletoResenador`,`a`.`camp_fk_registrador` AS `camp_fk_registrador` from (`tb_inquilinos_no_nacionales` `a` join `tb_persona` `b`) where `a`.`camp_identificacion` <> 0 and `b`.`camp_id_persona` = `a`.`camp_fk_registrador` order by `a`.`camp_nombre` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_resenas_completa`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_bd_vieja_listar_resenas_completa` AS select `a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`a`.`camp_identificacion` AS `camp_identificacion`,`a`.`camp_fecha_registro` AS `camp_fecha_registro`,`a`.`camp_fk_calificacion` AS `camp_fk_calificacion`,`a`.`camp_id_inquilino` AS `camp_id_inquilino`,`a`.`camp_calificacion_imagen` AS `camp_calificacion_imagen`,`a`.`camp_estado` AS `camp_estado`,`a`.`camp_estadoText` AS `camp_estadoText`,`a`.`camp_comentario_adicional` AS `camp_comentario_adicional`,`a`.`camp_fk_registrador` AS `camp_fk_registrador`,concat(`b`.`camp_nombreUno`,' ',`b`.`camp_apellidoUno`,' ',`b`.`camp_apellidoDos`) AS `camp_nombreResena` from (`tb_inquilinos_no_nacionales` `a` join `tb_persona` `b`) where `a`.`camp_identificacion` <> 0 and `b`.`camp_id_persona` = `a`.`camp_fk_registrador` order by `a`.`camp_fecha_registro` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_resenas_completa2`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`laprotec`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `view_bd_vieja_listar_resenas_completa2` AS select `a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`a`.`camp_identificacion` AS `camp_identificacion`,`a`.`camp_fecha_registro` AS `camp_fecha_registro`,`a`.`camp_fk_calificacion` AS `camp_fk_calificacion`,`a`.`camp_id_inquilino` AS `camp_id_inquilino`,`a`.`camp_calificacion_imagen` AS `camp_calificacion_imagen`,`a`.`camp_estado` AS `camp_estado`,`a`.`camp_estadoText` AS `camp_estadoText`,`a`.`camp_comentario_adicional` AS `camp_comentario_adicional`,`a`.`camp_fk_registrador` AS `camp_fk_registrador`,concat(`a`.`camp_nombre`,' ',`a`.`camp_apellido_uno`,' ',`a`.`camp_apellido_dos`) AS `camp_nombreResena`,concat(`c`.`camp_nombre`,' ',`c`.`camp_apellido_uno`,' ',`c`.`camp_apellido_dos`) AS `camp_nombreSolicitante` from ((`tb_inquilinos_no_nacionales` `a` join `tb_persona` `b`) join `tb_solicitante` `c`) where `a`.`camp_identificacion` <> 0 and `a`.`camp_id_solicitud` = `c`.`camp_id` and `b`.`camp_id_persona` = `a`.`camp_fk_registrador` order by `a`.`camp_fecha_registro` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_resenas_vista_excel`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_bd_vieja_listar_resenas_vista_excel` AS select `a`.`camp_id_inquilino` AS `camp_id_inquilino`,`a`.`camp_fecha_registro` AS `camp_fecha_registro`,concat(`a`.`camp_nombre`,' ',`a`.`camp_apellido_uno`,' ',`a`.`camp_apellido_dos`) AS `Inquilino`,`a`.`camp_identificacion` AS `identificacion_Inquilino`,`d`.`nombre` AS `nacionalidad`,`a`.`camp_estadoText` AS `camp_estadoText`,`a`.`camp_comentario_adicional` AS `resena`,concat(`c`.`camp_nombre`,' ',`c`.`camp_apellido_uno`,' ',`c`.`camp_apellido_dos`) AS `UsuarioResena`,`c`.`camp_cedula` AS `cedulaUsuario`,`c`.`camp_perfil_facebook` AS `FacebookUsuario` from (((`tb_inquilinos_no_nacionales` `a` join `tb_persona` `b`) join `tb_solicitante` `c`) join `tb_paises` `d`) where `a`.`camp_identificacion` <> 0 and `a`.`camp_id_solicitud` = `c`.`camp_id` and `a`.`camp_fk_registrador` = `b`.`camp_id_persona` and `b`.`camp_id_persona` = `a`.`camp_fk_registrador` and `a`.`camp_fk_nacionalidad` = `d`.`id` order by `a`.`camp_fecha_registro` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_bd_vieja_listar_usuarios_vista_excel`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_bd_vieja_listar_usuarios_vista_excel` AS select `a`.`camp_id_usuario` AS `camp_id_usuario`,`b`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,concat(`b`.`camp_nombre`,' ',`b`.`camp_apellido_uno`,' ',`b`.`camp_apellido_dos`) AS `nombreCompleto`,`b`.`nombrePais` AS `nombrePais`,`b`.`camp_nacimiento` AS `camp_nacimiento`,case `b`.`camp_sexo` when 0 then 'Hombre' when 1 then 'Mujer' end AS `Sexo`,`b`.`camp_telefono_uno` AS `camp_telefono_uno`,`b`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`b`.`camp_tipoAlquiler_nombre` AS `camp_tipoAlquiler_nombre`,`c`.`camp_detalle` AS `camp_detalle_suscripcion`,`b`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`b`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`b`.`camp_detalle_status` AS `camp_detalle_status`,`b`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`b`.`camp_email` AS `camp_email`,`b`.`camp_cedula` AS `camp_cedula`,case `b`.`camp_status` when 1 then 'Aprobado' when 2 then 'Rechazado' when 3 then 'Rechazado' end AS `Status`,`a`.`camp_alta` AS `camp_alta`,`a`.`camp_fecha_pago` AS `camp_fecha_pago`,`a`.`camp_detalle` AS `camp_detalle`,`a`.`camp_permiso` AS `camp_permiso` from ((`tb_usuario` `a` join `view_listar_solicitudes_usuarios` `b`) join `tb_tipo_suscripcion` `c`) where `b`.`camp_id` = `a`.`camp_id_solicitud` and `b`.`camp_tipo_suscripcion` = `c`.`camp_id_suscripcion` order by `b`.`camp_fecha_aprobacion` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_extraer_login`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_extraer_login` AS select `a`.`camp_fk_persona` AS `camp_fk_persona`,`a`.`camp_clave` AS `camp_clave`,`a`.`camp_claveTemporal` AS `camp_claveTemporal`,`a`.`camp_activo` AS `camp_activo`,`b`.`camp_nombre` AS `tipoPermiso`,`b`.`camp_persona_registra` AS `aprobador`,`c`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,concat(`c`.`camp_nombre`,' ',`c`.`camp_apellido_uno`,' ',`c`.`camp_apellido_dos`) AS `nombreCompleto`,`c`.`camp_sexo` AS `camp_sexo`,`c`.`camp_tipo_suscripcion` AS `camp_tipo_suscripcion`,`c`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`c`.`camp_status` AS `camp_status`,`c`.`camp_email` AS `camp_email`,`d`.`camp_identificacion` AS `identificacionUsuario`,`d`.`camp_fechaNacimiento` AS `camp_fechaNacimiento` from (((`tb_login` `a` join `tb_permiso` `b`) join `tb_solicitante` `c`) join `tb_persona` `d`) where `d`.`camp_id_persona` = `a`.`camp_fk_persona` and `a`.`camp_fk_persona` = `b`.`camp_fk_persona` and `c`.`camp_id` = `d`.`camp_idSolicitud` order by concat(`c`.`camp_nombre`,' ',`c`.`camp_apellido_uno`,' ',`c`.`camp_apellido_dos`) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_ficha_inquilino_extranjero`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_ficha_inquilino_extranjero` AS select `a`.`camp_id_inquilino` AS `camp_id_inquilino`,`a`.`camp_identificacion` AS `camp_identificacion`,`a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`b`.`nombre` AS `nacionalidad`,`a`.`camp_apodo` AS `camp_apodo`,`a`.`camp_imagen` AS `camp_imagen`,`d`.`camp_profesional` AS `camp_profesional`,`e`.`camp_conducta` AS `camp_conducta`,`f`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`j`.`camp_tipoAlquiler_nombre` AS `camp_tipoAlquiler_nombre`,`k`.`camp_etiquetaInquilino_nombre` AS `etiqueta_uno`,`l`.`camp_etiquetaInquilino_nombre` AS `etiqueta_dos`,`m`.`camp_etiquetaInquilino_nombre` AS `etiqueta_tres`,`n`.`camp_etiquetaInquilino_nombre` AS `etiqueta_cuatro`,`a`.`camp_comentario_adicional` AS `camp_comentario_adicional`,`a`.`camp_fk_calificacion` AS `camp_fk_calificacion`,`a`.`camp_fk_proceso_judicial` AS `camp_fk_proceso_judicial`,`a`.`camp_fk_dano_vivienda` AS `camp_fk_dano_vivienda`,`a`.`camp_fk_recomienda_inquilino` AS `camp_fk_recomienda_inquilino`,`a`.`camp_fecha_registro` AS `camp_fecha_registro`,`o`.`camp_identificacion_resenador` AS `camp_identificacion_resenador`,`a`.`camp_fk_sexo` AS `sexo`,`a`.`camp_nacimiento` AS `nacimiento`,`a`.`camp_fk_personas_con_inquilino` AS `personas_con_inquilino`,`a`.`camp_fk_tiempo_alquiler` AS `tiempo_alquiler`,`a`.`camp_fk_tipo_contrato` AS `tipo_contrato`,`a`.`camp_drogas` AS `drogas` from ((((((((((`tb_inquilinos_no_nacionales` `a` join `tb_paises` `b` on(`a`.`camp_fk_nacionalidad` = `b`.`id`)) join `tb_profesion` `d` on(`a`.`camp_fk_trabajo` = `d`.`camp_id_profesion`)) join `tb_conducta` `e` on(`a`.`camp_fk_conducta` = `e`.`camp_id_conducta`)) join `tb_provincia` `f` on(`a`.`camp_fk_provincia` = `f`.`camp_id_provincia`)) join `tb_tipoalquiler` `j` on(`a`.`camp_fk_tipo_alquiler` = `j`.`camp_id_tipoAlquiler`)) join `tb_etiquetainquilino` `k` on(`a`.`camp_fk_etiqueta_uno` = `k`.`camp_id_etiquetaInquilino`)) join `tb_etiquetainquilino` `l` on(`a`.`camp_fk_etiqueta_dos` = `l`.`camp_id_etiquetaInquilino`)) join `tb_etiquetainquilino` `m` on(`a`.`camp_fk_etiqueta_tres` = `m`.`camp_id_etiquetaInquilino`)) join `tb_etiquetainquilino` `n` on(`a`.`camp_fk_etiqueta_cuatro` = `n`.`camp_id_etiquetaInquilino`)) join `tb_resenador` `o` on(`a`.`camp_fk_registrador` = `o`.`camp_id_resenador`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_ficha_inquilino_extranjero2`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_ficha_inquilino_extranjero2` AS select `a`.`camp_id_inquilino` AS `camp_id_inquilino`,`a`.`camp_identificacion` AS `camp_identificacion`,`a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`b`.`nombre` AS `nacionalidad`,`f`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`a`.`camp_comentario_adicional` AS `camp_comentario_adicional`,`a`.`camp_fk_dano_vivienda` AS `camp_fk_dano_vivienda`,`a`.`camp_fecha_registro` AS `camp_fecha_registro`,`o`.`camp_identificacion` AS `camp_identificacion_resenador`,`a`.`camp_fk_sexo` AS `sexo`,`a`.`camp_nacimiento` AS `nacimiento`,`a`.`camp_fk_personas_con_inquilino` AS `personas_con_inquilino`,`a`.`camp_fk_tiempo_alquiler` AS `tiempo_alquiler`,`a`.`camp_drogas` AS `drogas`,`a`.`camp_imagen` AS `camp_imagen`,`a`.`camp_fk_proceso_judicial` AS `camp_fk_proceso_judicial` from (((`tb_inquilinos_no_nacionales` `a` join `tb_paises` `b` on(`a`.`camp_fk_nacionalidad` = `b`.`id`)) join `tb_provincia` `f` on(`a`.`camp_fk_provincia` = `f`.`camp_id_provincia`)) join `tb_persona` `o` on(`a`.`camp_fk_registrador` = `o`.`camp_id_persona`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_resenas_por_usuario`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`laprotec`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_resenas_por_usuario` AS select `a`.`camp_id_inquilino` AS `camp_id`,`a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`a`.`camp_identificacion` AS `camp_identificacion`,`a`.`camp_fecha_registro` AS `camp_fecha_registro`,`a`.`camp_fk_calificacion` AS `camp_fk_calificacion`,`a`.`camp_id_inquilino` AS `camp_id_inquilino`,`a`.`camp_calificacion_text` AS `camp_calificacion_text`,`a`.`camp_calificacion_imagen` AS `camp_calificacion_imagen`,`a`.`camp_estado` AS `camp_estado`,`a`.`camp_estadoText` AS `camp_estadoText`,concat(`b`.`camp_nombre`,' ',`b`.`camp_apellido_uno`,' ',`b`.`camp_apellido_dos`) AS `nombreCompletoResenador`,`a`.`camp_fk_registrador` AS `camp_fk_registrador` from (`tb_inquilinos_no_nacionales` `a` join `tb_solicitante` `b`) where `a`.`camp_identificacion` <> 0 and `b`.`camp_id` = `a`.`camp_fk_registrador` order by `a`.`camp_fecha_registro` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_solicitudes_usuarios` AS select distinct `a`.`camp_id` AS `camp_id`,`a`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,`a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`b`.`nombre` AS `nombrePais`,`a`.`camp_nacimiento` AS `camp_nacimiento`,`a`.`camp_sexo` AS `camp_sexo`,`a`.`camp_telefono_uno` AS `camp_telefono_uno`,`a`.`camp_telefono_dos` AS `camp_telefono_dos`,`e`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`i`.`camp_tipoAlquiler_nombre` AS `camp_tipoAlquiler_nombre`,`a`.`camp_tipo_suscripcion` AS `camp_tipo_suscripcion`,`a`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`a`.`camp_ruta_cedula` AS `camp_ruta_cedula`,`a`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`a`.`camp_status` AS `camp_status`,`a`.`camp_detalle_status` AS `camp_detalle_status`,`a`.`camp_recibe_pago` AS `camp_recibe_pago`,`a`.`camp_medio_pago` AS `camp_medio_pago`,`a`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`a`.`camp_aprobador` AS `camp_aprobador`,`a`.`camp_email` AS `camp_email`,`a`.`camp_cedula` AS `camp_cedula`,`b`.`nombre` AS `nombrePais2`,`a`.`camp_perfil_facebook` AS `perfil_facebook` from ((((`tb_solicitante` `a` join `tb_paises` `b`) join `tb_provincia` `e`) join `tb_tipoalquiler` `i`) join `tb_login` `j`) where `a`.`camp_nacionalidad` = `b`.`id` and `a`.`camp_provincia` = `e`.`camp_id_provincia` and `a`.`camp_tipo_alquiler` = `i`.`camp_id_tipoAlquiler` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios2`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_solicitudes_usuarios2` AS select distinct `a`.`camp_id` AS `camp_id`,`a`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,`a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`b`.`nombre` AS `nombrePais`,`a`.`camp_nacimiento` AS `camp_nacimiento`,`a`.`camp_sexo` AS `camp_sexo`,`a`.`camp_telefono_uno` AS `camp_telefono_uno`,`a`.`camp_telefono_dos` AS `camp_telefono_dos`,`e`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`e`.`camp_nombre_provincia` AS `camp_nombre_provincia2`,`a`.`camp_tipo_suscripcion` AS `camp_tipo_suscripcion`,`a`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`a`.`camp_ruta_cedula` AS `camp_ruta_cedula`,`a`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`a`.`camp_status` AS `camp_status`,`a`.`camp_detalle_status` AS `camp_detalle_status`,`a`.`camp_recibe_pago` AS `camp_recibe_pago`,`a`.`camp_medio_pago` AS `camp_medio_pago`,`a`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`a`.`camp_aprobador` AS `camp_aprobador`,`a`.`camp_email` AS `camp_email`,`a`.`camp_cedula` AS `camp_cedula`,`b`.`nombre` AS `nombrePais2`,`a`.`camp_perfil_facebook` AS `perfil_facebook` from (((`tb_solicitante` `a` join `tb_paises` `b`) join `tb_provincia` `e`) join `tb_login` `j`) where `a`.`camp_nacionalidad` = `b`.`id` and `a`.`camp_provincia` = `e`.`camp_id_provincia` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios3`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_solicitudes_usuarios3` AS select `a`.`camp_id` AS `camp_id`,`a`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,`a`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`a`.`camp_cedula` AS `camp_cedula`,`a`.`camp_nacimiento` AS `camp_nacimiento`,`a`.`camp_perfil_facebook` AS `camp_perfil_facebook`,`a`.`camp_status` AS `camp_status`,concat(`a`.`camp_nombre`,' ',`a`.`camp_apellido_uno`,' ',`a`.`camp_apellido_dos`) AS `nombreCompleto`,`c`.`camp_activo` AS `camp_activo`,`c`.`camp_clave` AS `camp_clave`,`d`.`camp_nombre` AS `camp_nombre`,`a`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`a`.`camp_email` AS `correo`,`a`.`camp_tipo_suscripcion` AS `camp_tipo_suscripcion`,case `a`.`camp_tipo_suscripcion` when 1 then 'Platino Mensual' when 2 then 'Oro Semestral' when 3 then 'Diamante Anual' end AS `Name_exp_15` from (((`tb_solicitante` `a` join `tb_persona` `b`) join `tb_login` `c`) join `tb_permiso` `d`) where `a`.`camp_id` = `b`.`camp_idSolicitud` and `c`.`camp_fk_persona` = `b`.`camp_id_persona` and `c`.`camp_fk_persona` = `d`.`camp_fk_persona` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios4`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_solicitudes_usuarios4` AS select `a`.`camp_id` AS `id_solicitud`,`a`.`camp_codigo_solicitud` AS `codigo_solicitud`,`a`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`a`.`camp_cedula` AS `camp_cedula`,`a`.`camp_nacimiento` AS `camp_nacimiento`,`a`.`camp_status` AS `camp_status`,`c`.`camp_activo` AS `camp_activo`,concat(`a`.`camp_nombre`,' ',`a`.`camp_apellido_uno`,' ',`a`.`camp_apellido_dos`) AS `nombre`,`d`.`camp_id_persona` AS `id_persona`,`a`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`a`.`camp_email` AS `camp_email` from (((`tb_solicitante` `a` join `tb_permiso` `b`) join `tb_login` `c`) join `tb_persona` `d`) where `d`.`camp_id_persona` = `c`.`camp_fk_persona` and `b`.`camp_fk_persona` = `d`.`camp_id_persona` and `a`.`camp_id` = `d`.`camp_idSolicitud` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios_pendientes`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`laprotec`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_solicitudes_usuarios_pendientes` AS select distinct `a`.`camp_id` AS `camp_id`,`a`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,`a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`b`.`nombre` AS `nombrePais`,`a`.`camp_nacimiento` AS `camp_nacimiento`,`a`.`camp_sexo` AS `camp_sexo`,`a`.`camp_telefono_uno` AS `camp_telefono_uno`,`a`.`camp_telefono_dos` AS `camp_telefono_dos`,`e`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`i`.`camp_tipoAlquiler_nombre` AS `camp_tipoAlquiler_nombre`,`a`.`camp_tipo_suscripcion` AS `camp_tipo_suscripcion`,`a`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`a`.`camp_ruta_cedula` AS `camp_ruta_cedula`,`a`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`a`.`camp_status` AS `camp_status`,`a`.`camp_detalle_status` AS `camp_detalle_status`,`a`.`camp_recibe_pago` AS `camp_recibe_pago`,`a`.`camp_medio_pago` AS `camp_medio_pago`,`a`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`a`.`camp_aprobador` AS `camp_aprobador`,`a`.`camp_email` AS `camp_email`,`a`.`camp_cedula` AS `camp_cedula`,`b`.`nombre` AS `nombrePais2`,`a`.`camp_perfil_facebook` AS `perfil_facebook`,`k`.`camp_id_inquilino` AS `camp_id_inquilino` from (((((`tb_solicitante` `a` join `tb_paises` `b`) join `tb_provincia` `e`) join `tb_tipoalquiler` `i`) join `tb_login` `j`) join `tb_inquilinos_no_nacionales` `k`) where `a`.`camp_nacionalidad` = `b`.`id` and `a`.`camp_provincia` = `e`.`camp_id_provincia` and `a`.`camp_id` = `k`.`camp_id_solicitud` and `a`.`camp_tipo_alquiler` = `i`.`camp_id_tipoAlquiler` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios_pendientes2`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = cp850 */;
/*!50001 SET character_set_results     = cp850 */;
/*!50001 SET collation_connection      = cp850_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_solicitudes_usuarios_pendientes2` AS select distinct `a`.`camp_id` AS `camp_id`,`a`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,`a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`b`.`nombre` AS `nombrePais`,`a`.`camp_nacimiento` AS `camp_nacimiento`,`a`.`camp_sexo` AS `camp_sexo`,`a`.`camp_telefono_uno` AS `camp_telefono_uno`,`a`.`camp_telefono_dos` AS `camp_telefono_dos`,`e`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`a`.`camp_status` AS `camp_status3`,`a`.`camp_tipo_suscripcion` AS `camp_tipo_suscripcion`,`a`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`a`.`camp_status` AS `camp_status2`,`a`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`a`.`camp_status` AS `camp_status`,`a`.`camp_detalle_status` AS `camp_detalle_status`,`a`.`camp_recibe_pago` AS `camp_recibe_pago`,`a`.`camp_medio_pago` AS `camp_medio_pago`,`a`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`a`.`camp_aprobador` AS `camp_aprobador`,`a`.`camp_email` AS `camp_email`,`a`.`camp_cedula` AS `camp_cedula`,`b`.`nombre` AS `nombrePais2`,`a`.`camp_perfil_facebook` AS `perfil_facebook`,`k`.`camp_id_inquilino` AS `camp_id_inquilino` from (((`tb_solicitante` `a` join `tb_paises` `b`) join `tb_provincia` `e`) join `tb_inquilinos_no_nacionales` `k`) where `a`.`camp_nacionalidad` = `b`.`id` and `a`.`camp_provincia` = `e`.`camp_id_provincia` and `a`.`camp_id` = `k`.`camp_id_solicitud` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_solicitudes_usuarios_pendientes3`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`laprotec`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_solicitudes_usuarios_pendientes3` AS select distinct `a`.`camp_id` AS `camp_id`,`a`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,`a`.`camp_nombre` AS `camp_nombre`,`a`.`camp_apellido_uno` AS `camp_apellido_uno`,`a`.`camp_apellido_dos` AS `camp_apellido_dos`,`b`.`nombre` AS `nombrePais`,`a`.`camp_nacimiento` AS `camp_nacimiento`,`a`.`camp_sexo` AS `camp_sexo`,`a`.`camp_telefono_uno` AS `camp_telefono_uno`,`a`.`camp_telefono_dos` AS `camp_telefono_dos`,`e`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`i`.`camp_tipoAlquiler_nombre` AS `camp_tipoAlquiler_nombre`,`a`.`camp_tipo_suscripcion` AS `camp_tipo_suscripcion`,`a`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`a`.`camp_ruta_cedula` AS `camp_ruta_cedula`,`a`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`a`.`camp_status` AS `camp_status`,`a`.`camp_detalle_status` AS `camp_detalle_status`,`a`.`camp_recibe_pago` AS `camp_recibe_pago`,`a`.`camp_medio_pago` AS `camp_medio_pago`,`a`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`a`.`camp_aprobador` AS `camp_aprobador`,`a`.`camp_email` AS `camp_email`,`a`.`camp_cedula` AS `camp_cedula`,`b`.`nombre` AS `nombrePais2`,`a`.`camp_perfil_facebook` AS `perfil_facebook`,`k`.`camp_id_inquilino` AS `camp_id_inquilino` from (((((`tb_solicitante` `a` join `tb_paises` `b`) join `tb_provincia` `e`) join `tb_tipoalquiler` `i`) join `tb_login` `j`) join `tb_inquilinos_no_nacionales` `k`) where `a`.`camp_nacionalidad` = `b`.`id` and `a`.`camp_provincia` = `e`.`camp_id_provincia` and `a`.`camp_id` = `k`.`camp_id_solicitud` and `a`.`camp_tipo_alquiler` = `i`.`camp_id_tipoAlquiler` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_listar_usuario`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_listar_usuario` AS select `a`.`camp_id_usuario` AS `camp_id_usuario`,`b`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,`a`.`camp_id_permiso` AS `camp_id_permiso`,concat(`b`.`camp_nombre`,' ',`b`.`camp_apellido_uno`,' ',`b`.`camp_apellido_dos`) AS `nombreCompleto`,`b`.`nombrePais` AS `nombrePais`,`b`.`camp_nacimiento` AS `camp_nacimiento`,`b`.`camp_sexo` AS `camp_sexo`,`b`.`camp_telefono_uno` AS `camp_telefono_uno`,`b`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`b`.`camp_tipoAlquiler_nombre` AS `camp_tipoAlquiler_nombre`,`c`.`camp_detalle` AS `camp_detalle_suscripcion`,`b`.`camp_detalle_solicitud` AS `camp_detalle_solicitud`,`b`.`camp_ruta_cedula` AS `camp_ruta_cedula`,`b`.`camp_fecha_solicitud` AS `camp_fecha_solicitud`,`b`.`camp_detalle_status` AS `camp_detalle_status`,`b`.`camp_recibe_pago` AS `camp_recibe_pago`,`b`.`camp_medio_pago` AS `camp_medio_pago`,`b`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`b`.`camp_aprobador` AS `camp_aprobador`,`b`.`camp_email` AS `camp_email`,`b`.`camp_cedula` AS `camp_cedula`,`b`.`camp_status` AS `camp_status`,`a`.`camp_alta` AS `camp_alta`,`a`.`camp_fecha_pago` AS `camp_fecha_pago`,`a`.`camp_clave` AS `camp_clave`,`a`.`camp_clave_temporal` AS `camp_clave_temporal`,`a`.`camp_detalle` AS `camp_detalle`,`b`.`camp_nombre` AS `camp_nombre`,`b`.`camp_apellido_uno` AS `camp_apellido_uno`,`b`.`camp_apellido_dos` AS `camp_apellido_dos`,`a`.`camp_permiso` AS `camp_permiso` from ((`tb_usuario` `a` join `view_listar_solicitudes_usuarios` `b`) join `tb_tipo_suscripcion` `c`) where `b`.`camp_id` = `a`.`camp_id_solicitud` and `b`.`camp_status` <> 0 and `b`.`camp_tipo_suscripcion` = `c`.`camp_id_suscripcion` order by `b`.`camp_fecha_aprobacion` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_login_usuario`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_login_usuario` AS select `pers`.`camp_id_persona` AS `camp_id_persona`,`pers`.`camp_identificacion` AS `camp_identificacion`,`pers`.`camp_nombreUno` AS `camp_nombreUno`,`pers`.`camp_nombreDOs` AS `camp_nombreDos`,`pers`.`camp_apellidoUno` AS `camp_apellidoUno`,`pers`.`camp_apellidoDos` AS `camp_apellidoDos`,`login`.`camp_fk_persona` AS `camp_fk_persona`,`login`.`camp_clave` AS `camp_clave`,`login`.`camp_activo` AS `camp_activo`,`perm`.`camp_id_permiso` AS `camp_id_permiso`,`perm`.`camp_nombre` AS `camp_nombre` from ((`tb_persona` `pers` join `tb_login` `login`) join `tb_permiso` `perm`) where `pers`.`camp_id_persona` = `login`.`camp_fk_persona` and `perm`.`camp_fk_persona` = `pers`.`camp_id_persona` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_resumen_solicitante_persona`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_resumen_solicitante_persona` AS select `a`.`camp_id` AS `camp_id`,`a`.`camp_cedula` AS `camp_cedula`,`a`.`camp_status` AS `camp_status`,`b`.`camp_id_persona` AS `camp_id_persona`,concat(`a`.`camp_nombre`,' ',`a`.`camp_apellido_uno`,' ',`a`.`camp_apellido_dos`) AS `nombreCompleto`,`b`.`camp_identificacion` AS `camp_identificacion`,`c`.`camp_fk_persona` AS `camp_fk_persona`,`c`.`camp_clave` AS `camp_clave`,`c`.`camp_fecha_ingreso` AS `camp_fecha_ingreso`,`c`.`camp_activo` AS `camp_activo`,`d`.`camp_id_permiso` AS `camp_id_permiso`,`d`.`camp_fk_persona` AS `camp_fk_persona_login`,`d`.`camp_nombre` AS `camp_nombre`,`d`.`camp_descripcion` AS `camp_descripcion`,`d`.`camp_fecha_registro` AS `camp_fecha_registro`,`d`.`camp_persona_registra` AS `camp_persona_registra` from (((`tb_solicitante` `a` join `tb_persona` `b`) join `tb_login` `c`) join `tb_permiso` `d`) where `a`.`camp_cedula` = `b`.`camp_identificacion` and `c`.`camp_fk_persona` = `d`.`camp_fk_persona` and `b`.`camp_id_persona` = `c`.`camp_fk_persona` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_ubicacion_global`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_ubicacion_global` AS select `pro`.`camp_id_provincia` AS `camp_id_provincia`,`can`.`camp_id` AS `cam_id_canton`,`dis`.`camp_id` AS `cam_id_distrito`,`bar`.`camp_id` AS `cam_id_barrio`,`pro`.`camp_nombre_provincia` AS `camp_nombre_provincia`,`can`.`camp_canton` AS `camp_nombre_canton`,`dis`.`camp_distrito` AS `camp_nombre_distrito`,`bar`.`camp_barrio` AS `camp_nombre_barrio` from (((`tb_provincia` `pro` join `tb_canton` `can`) join `tb_distrito` `dis`) join `tb_barrio` `bar`) where `pro`.`camp_id_provincia` = `can`.`camp_idProvincia` and `can`.`camp_id` = `dis`.`camp_idCanton` and `bar`.`camp_idDistrito` = `dis`.`camp_id` order by `pro`.`camp_nombre_provincia`,`can`.`camp_canton`,`dis`.`camp_distrito`,`bar`.`camp_barrio` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!50001 DROP VIEW IF EXISTS `view_verificar_login`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `view_verificar_login` AS select distinct `c`.`camp_fk_persona` AS `camp_fk_persona`,`c`.`camp_clave` AS `camp_clave`,`c`.`camp_claveTemporal` AS `camp_claveTemporal`,`c`.`camp_activo` AS `camp_activo`,`d`.`camp_nombre` AS `tipoPermiso`,`d`.`camp_persona_registra` AS `aprobador`,`a`.`camp_codigo_solicitud` AS `camp_codigo_solicitud`,concat(`a`.`camp_nombre`,' ',`a`.`camp_apellido_uno`,' ',`a`.`camp_apellido_dos`) AS `nombreCompleto`,`a`.`camp_sexo` AS `camp_sexo`,`a`.`camp_tipo_suscripcion` AS `camp_tipo_suscripcion`,`a`.`camp_fecha_aprobacion` AS `camp_fecha_aprobacion`,`a`.`camp_status` AS `camp_status`,`a`.`camp_email` AS `camp_email`,`b`.`camp_identificacion` AS `identificacionUsuario`,`b`.`camp_fechaNacimiento` AS `camp_fechaNacimiento` from (((`tb_solicitante` `a` join `tb_persona` `b`) join `tb_login` `c`) join `tb_permiso` `d`) where `a`.`camp_cedula` = `b`.`camp_identificacion` and `c`.`camp_fk_persona` = `b`.`camp_id_persona` and `d`.`camp_fk_persona` = `b`.`camp_id_persona` order by `c`.`camp_fecha_ingreso` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

