# Manual de Usuario - Sistema de Atención al Cliente (SAC)

## 📋 Índice

1. [Introducción](#introducción)
2. [Acceso al Sistema](#acceso-al-sistema)
3. [Roles y Permisos](#roles-y-permisos)
4. [Funcionalidades por Rol](#funcionalidades-por-rol)
   - [Agente](#agente)
   - [Supervisor](#supervisor)
   - [Gerente](#gerente)
   - [Administrador](#administrador)
5. [Gestión de Casos](#gestión-de-casos)
6. [Gestión de Agentes y Usuarios](#gestión-de-agentes-y-usuarios)
7. [Paneles y Dashboards](#paneles-y-dashboards)
8. [Personalización de Tema](#personalización-de-tema)
9. [Comunicación con Webhooks](#comunicación-con-webhooks)
10. [Consejos y Mejores Prácticas](#consejos-y-mejores-prácticas)

---

## Introducción

El Sistema de Atención al Cliente (SAC) es una plataforma web diseñada para gestionar casos de soporte técnico y atención al cliente de manera eficiente. El sistema permite crear, asignar, seguir y resolver casos, además de proporcionar herramientas de supervisión y análisis para diferentes niveles de usuarios.

### Características Principales

- ✅ Gestión completa del ciclo de vida de casos
- ✅ Asignación automática de casos a agentes
- ✅ Seguimiento de SLA (Service Level Agreement)
- ✅ Alertas críticas y notificaciones
- ✅ Dashboards ejecutivos con métricas y KPIs
- ✅ Gestión de agentes y usuarios
- ✅ Historial completo de cada caso
- ✅ Soporte para múltiples canales de comunicación

---

## Acceso al Sistema

### Inicio de Sesión

1. Accede a la URL del sistema en tu navegador
2. Ingresa tu **correo electrónico** y **contraseña**
3. Haz clic en **"Iniciar Sesión"**

### Recuperación de Contraseña

Si olvidaste tu contraseña:

1. En la pantalla de login, haz clic en **"¿Olvidaste tu contraseña?"**
2. Ingresa tu correo electrónico
3. Recibirás un código de verificación por correo
4. Ingresa el código recibido
5. Establece una nueva contraseña

---

## Roles y Permisos

El sistema cuenta con cuatro roles principales, cada uno con permisos específicos:

### 🔵 Agente (AGENTE)
- Ver y gestionar casos asignados
- Crear nuevos casos
- Actualizar estado de casos
- Agregar comentarios y seguimientos

### 🟡 Supervisor (SUPERVISOR)
- Todas las funciones de Agente
- Ver todos los casos (Bandeja Global)
- Reasignar casos entre agentes
- Gestionar agentes (crear, editar, ver)
- Ver alertas críticas
- Panel de supervisión con métricas

### 🟢 Gerente (GERENTE)
- Ver todos los casos
- Panel ejecutivo con KPIs y gráficos
- Ver alertas críticas
- Análisis de rendimiento y SLA

### 🔴 Administrador (ADMIN)
- Todas las funciones anteriores
- Administración completa de usuarios
- Crear usuarios con diferentes roles
- Gestionar países (El Salvador, Guatemala)

---

## Funcionalidades por Rol

### Agente

#### Bandeja de Casos

La bandeja de casos es tu vista principal donde verás todos los casos asignados a ti.

**Funcionalidades:**

- **Filtros disponibles:**
  - Por estado: Nuevo, En Proceso, Pendiente Cliente, Escalado, Resuelto, Cerrado
  - Por categoría
  - Búsqueda por texto (asunto, descripción, cliente)

- **Acciones:**
  - **Ver detalle:** Haz clic en cualquier caso para ver información completa
  - **Actualizar:** Usa el botón de actualizar para refrescar la lista
  - **Crear caso:** Botón "+" para crear un nuevo caso

#### Crear Nuevo Caso

1. Haz clic en el botón **"+"** o navega a **"Casos > Nuevo"**
2. Completa el formulario:
   - **Cliente:** Busca y selecciona el cliente (puedes buscar por ID, nombre, email o teléfono)
   - **Categoría:** Selecciona la categoría del caso
   - **Canal de Origen:** Email, WhatsApp, Teléfono, Web, Redes Sociales
   - **Canal de Notificación:** Email, WhatsApp, Ambos
   - **Asunto:** Título breve del caso
   - **Descripción:** Detalle completo del problema o solicitud
   - **Datos de Contacto:** Nombre, teléfono y email del contacto (se autocompletan si seleccionas un cliente)
3. Haz clic en **"Crear Caso"**
4. Verás una animación de éxito confirmando la creación

#### Ver Detalle de Caso

Al hacer clic en un caso, verás:

- **Información General:**
  - ID del caso, número de ticket
  - Cliente y datos de contacto
  - Categoría y estado actual
  - Agente asignado
  - Fechas de creación y actualización

- **Acciones Disponibles:**
  - **Editar:** Modifica asunto, descripción y datos del cliente
  - **Cambiar Estado:** Actualiza el estado del caso y agrega comentarios
  - **Ver Historial:** Revisa todos los cambios y actualizaciones del caso

#### Editar Caso

1. En el detalle del caso, haz clic en **"Editar"**
2. Modifica los campos necesarios:
   - Asunto
   - Descripción
   - Cliente (ID, nombre, email, teléfono)
3. Haz clic en **"Guardar Cambios"**
4. Los cambios se enviarán al sistema y se registrarán en el historial

#### Actualizar Estado del Caso

1. En el detalle del caso, selecciona el nuevo estado del menú desplegable
2. Agrega un comentario explicando el cambio
3. Haz clic en **"Actualizar Estado"**
4. El cambio se registrará en el historial del caso

---

### Supervisor

#### Panel Supervisor

El panel supervisor proporciona una vista general de todos los casos y métricas importantes.

**Métricas Principales:**

- **Casos Abiertos:** Total de casos activos
- **Casos Críticos:** Casos que requieren atención inmediata
- **Casos Vencidos:** Casos que excedieron el SLA
- **Casos por Agente:** Distribución de carga de trabajo

**Filtros:**

- **Período:** Hoy, Semana, Mes
- **Tipo:** Todos, Críticos, Vencidos
- **Agente:** Filtrar por agente específico

#### Bandeja Global

Similar a la bandeja de casos del agente, pero muestra **todos los casos** del sistema, no solo los asignados.

**Funcionalidades Adicionales:**

- Ver casos de todos los agentes
- Reasignar casos entre agentes
- Acceso completo a todos los detalles

#### Reasignar Caso

1. Abre el detalle del caso que deseas reasignar
2. Haz clic en **"Reasignar"** (si está disponible)
3. Selecciona el nuevo agente del menú desplegable
4. Haz clic en **"Confirmar Reasignación"**
5. El caso será transferido al nuevo agente y se actualizará en el historial

**Nota:** La reasignación no requiere justificación, se realiza directamente.

#### Gestión de Agentes

Accede desde el menú lateral: **"Gesti ón de Agentes"**

**Funcionalidades:**

- **Ver Lista de Agentes:**
  - Nombre, email, estado (Activo/Inactivo/Vacaciones)
  - Casos activos asignados
  - Orden de asignación (Round Robin)

- **Crear Nuevo Agente:**
  1. Haz clic en **"Crear Agente"** o navega a **"Crear Cuenta"**
  2. Completa el formulario:
     - Nombre completo
     - Email
     - Contraseña (se genera automáticamente, pero puedes personalizarla)
     - País: El Salvador o Guatemala
     - Rol: AGENTE (por defecto)
  3. Haz clic en **"Crear Agente"**
  4. Verás una animación de éxito
  5. La contraseña generada se enviará al webhook del sistema

- **Editar Agente:**
  - Cambiar estado (Activo/Inactivo/Vacaciones)
  - Modificar información básica

#### Alertas Críticas

Accede desde el menú: **"Alertas Críticas"**

Muestra casos que requieren atención inmediata:
- Casos vencidos (SLA excedido)
- Casos críticos por tiempo abierto
- Casos escalados

---

### Gerente

#### Panel Ejecutivo

El panel ejecutivo proporciona una vista de alto nivel con métricas y análisis.

**KPIs Principales:**

- **Casos Abiertos:** Total de casos activos con variación respecto al período anterior
- **Excedidos SLA:** Casos que superaron el tiempo comprometido
- **CSAT Promedio:** Puntuación promedio de satisfacción del cliente (1-5)
- **Total Histórico:** Total acumulado de casos desde el inicio

**Gráficos Disponibles:**

- **Distribución por Estado:** Gráfico de barras mostrando casos por estado
- **Distribución por Categoría:** Gráfico circular (pie chart) de casos por categoría
- **Tendencias:** Variaciones respecto a períodos anteriores

**Filtros:**

- **Período:** Hoy, Semana, Mes

**Insights Ejecutivos:**

El sistema genera automáticamente insights basados en los datos:
- Alertas sobre casos críticos
- Recomendaciones de acción
- Tendencias importantes

#### Alertas Críticas

Los gerentes también tienen acceso a las alertas críticas para monitoreo de alto nivel.

---

### Administrador

#### Administración de Usuarios

Accede desde el menú: **"Administración de Usuarios"**

**Funcionalidades Completas:**

- **Ver Todos los Usuarios:**
  - Filtros por rol: Todos, Agente, Supervisor, Gerente, Admin
  - Búsqueda por nombre o email
  - Vista de tabla con información completa

- **Crear Usuario:**
  1. Haz clic en **"Crear Usuario"**
  2. Completa el formulario:
     - Nombre completo
     - Email
     - Contraseña
     - País: El Salvador o Guatemala (menú desplegable)
     - Rol: AGENTE, SUPERVISOR, GERENTE, ADMIN
  3. Haz clic en **"Crear"**
  4. El usuario se creará automáticamente como activo

**Nota:** Los usuarios creados desde el panel de administración están activos por defecto. No hay opciones de "activo" o "en vacaciones" en el formulario de creación.

- **Editar Usuario:**
  - Modificar nombre, email, contraseña
  - Cambiar rol
  - Actualizar país

- **Eliminar Usuario:**
  - Eliminar usuarios del sistema (acción permanente)

---

## Gestión de Casos

### Estados de Caso

El sistema maneja los siguientes estados:

1. **Nuevo:** Caso recién creado, pendiente de asignación
2. **En Proceso:** Caso asignado y siendo trabajado
3. **Pendiente Cliente:** Esperando respuesta del cliente
4. **Escalado:** Caso elevado a un nivel superior
5. **Resuelto:** Problema resuelto, pendiente de confirmación
6. **Cerrado:** Caso finalizado y cerrado

### Categorías

Las categorías definen el tipo de caso y tienen asociados:
- **SLA (Service Level Agreement):** Tiempo máximo de resolución
- **Días de Alerta Supervisor:** Días antes del vencimiento para alertar al supervisor
- **Días de Alerta Gerente:** Días antes del vencimiento para alertar al gerente

### Canales de Comunicación

**Canales de Origen:**
- Email
- WhatsApp
- Teléfono
- Web
- Redes Sociales

**Canales de Notificación:**
- Email
- WhatsApp
- Ambos

### Historial de Caso

Cada caso mantiene un historial completo que incluye:

- **Cambios de Estado:**
  - Muestra: "Estado cambiado de [Estado Anterior] a [Estado Nuevo]"
  - Incluye fecha, hora y autor

- **Actualizaciones del Caso:**
  - Ediciones de datos (asunto, descripción, cliente)
  - Reasignaciones de agente
  - Muestra: "Actualización del caso"
  - Incluye detalles de los cambios

- **Comentarios:**
  - Comentarios agregados al cambiar estados
  - Justificaciones de cambios

---

## Gestión de Agentes y Usuarios

### Crear Agente (Supervisor)

1. Navega a **"Gesti ón de Agentes"** o **"Crear Cuenta"**
2. Completa el formulario de registro
3. El sistema generará una contraseña automáticamente
4. La contraseña se enviará al webhook del sistema
5. El agente quedará activo por defecto

### Crear Usuario (Administrador)

1. Navega a **"Administración de Usuarios"**
2. Haz clic en **"Crear Usuario"**
3. Completa todos los campos:
   - Nombre, Email, Contraseña
   - País (El Salvador o Guatemala)
   - Rol (AGENTE, SUPERVISOR, GERENTE, ADMIN)
4. El usuario se creará como activo automáticamente

### Estados de Agente

- **Activo:** Agente disponible para recibir casos
- **Inactivo:** Agente no disponible temporalmente
- **Vacaciones:** Agente en período de vacaciones

---

## Paneles y Dashboards

### Panel de Agente
- Bandeja de casos asignados
- Filtros y búsqueda
- Acceso rápido a crear casos

### Panel Supervisor
- Vista general de todos los casos
- Métricas de rendimiento
- Distribución de carga de trabajo
- Alertas y casos críticos

### Panel Ejecutivo (Gerente)
- KPIs principales
- Gráficos de distribución
- Tendencias y variaciones
- Insights automáticos

### Alertas Críticas
- Casos vencidos (SLA)
- Casos críticos por tiempo
- Casos escalados
- Disponible para Supervisor y Gerente

---

## Personalización de Tema

El sistema SAC incluye soporte para dos temas visuales que puedes cambiar según tu preferencia.

### Modo Oscuro y Modo Claro

El sistema ofrece dos temas:

- **Modo Oscuro (Dark Mode):** Tema oscuro por defecto, ideal para trabajar en ambientes con poca luz
- **Modo Claro (Light Mode):** Tema claro, ideal para ambientes bien iluminados

### Cambiar el Tema

1. **Ubicación del botón:** En la esquina inferior derecha de la pantalla verás un botón flotante con un icono de sol (☀️) o luna (🌙)
2. **Cambiar tema:** Haz clic en el botón para alternar entre modo oscuro y modo claro
3. **Persistencia:** Tu preferencia de tema se guarda automáticamente y se mantendrá en futuras sesiones

### Características del Sistema de Temas

- ✅ **Guardado automático:** El tema seleccionado se guarda en tu navegador
- ✅ **Aplicación inmediata:** El cambio se aplica instantáneamente en toda la aplicación
- ✅ **Persistente:** El tema se mantiene entre sesiones, no necesitas cambiarlo cada vez que inicias sesión
- ✅ **Consistente:** Todos los componentes de la aplicación respetan el tema seleccionado

### Indicadores Visuales

- **Icono de Sol (☀️):** Aparece cuando estás en modo oscuro, indica que puedes cambiar a modo claro
- **Icono de Luna (🌙):** Aparece cuando estás en modo claro, indica que puedes cambiar a modo oscuro

**Nota:** El botón de cambio de tema está siempre visible y accesible desde cualquier página de la aplicación.

---

## Comunicación con Webhooks

El sistema SAC utiliza webhooks de n8n para todas las operaciones de datos. Esta arquitectura permite una integración robusta con sistemas backend y bases de datos.

### ¿Qué son los Webhooks?

Los webhooks son puntos de entrada HTTP que permiten al sistema comunicarse con servicios externos (n8n) para realizar operaciones como:
- Autenticación de usuarios
- Creación y actualización de casos
- Gestión de agentes y usuarios
- Consulta de clientes y categorías
- Asignación automática de casos (Round Robin)

### Operaciones que Utilizan Webhooks

#### 1. Autenticación (`user.login`)
- **Cuándo se usa:** Al iniciar sesión
- **Datos enviados:** Email y contraseña
- **Datos recibidos:** Token JWT y información del usuario (ID, nombre, rol)

#### 2. Gestión de Casos (`case.*`)
- **`case.create`:** Crear nuevos casos
- **`case.read`:** Consultar casos (individual o todos)
- **`case.edit`:** Editar información de casos (asunto, descripción, datos del cliente)
- **`case.update`:** Actualizar estado o reasignar casos
- **`case.delete`:** Eliminar casos (con motivo)

#### 3. Gestión de Agentes (`agent.*`)
- **`agent.create`:** Crear nuevos agentes
- **`agent.read`:** Consultar agentes (individual o todos)
- **`agent.update`:** Actualizar estado de agentes (activo, inactivo, vacaciones)
- **`agent.delete`:** Eliminar agentes

#### 4. Gestión de Usuarios (`user.*`)
- **`user.create`:** Crear usuarios desde el panel de administración
- **`user.read`:** Consultar usuarios
- **`user.update`:** Actualizar información de usuarios
- **`user.delete`:** Eliminar usuarios

#### 5. Round Robin
- **Asignación automática:** El sistema utiliza webhooks para asignar casos automáticamente a agentes siguiendo el algoritmo Round Robin

### Formato de Comunicación

Todas las comunicaciones con webhooks utilizan:

- **Método:** POST (para operaciones que modifican datos)
- **Formato:** JSON
- **Autenticación:** Token JWT en el header `Authorization: Bearer <token>`
- **Timeout:** 30 segundos por defecto

### Ejemplo de Payload

**Crear Caso:**
```json
{
  "action": "case.create",
  "actor": {
    "user_id": 123,
    "email": "agente@intelfon.com",
    "role": "AGENTE"
  },
  "data": {
    "cliente": {
      "cliente_id": "CL003299",
      "nombre_empresa": "EMPRESA S.A.",
      "contacto_principal": "Juan Pérez",
      "email": "contacto@empresa.com",
      "telefono": "+50370000000"
    },
    "categoria": {
      "categoria_id": 3,
      "nombre": "Soporte Técnico"
    },
    "canal_origen": "Web",
    "canal_notificacion": "Email",
    "asunto": "Problema con servicio",
    "descripcion": "Descripción detallada del problema..."
  }
}
```

### Manejo de Errores

El sistema maneja automáticamente:

- **Timeouts:** Si el webhook no responde en 30 segundos, se muestra un mensaje de error
- **Errores de CORS:** Si hay problemas de configuración del servidor, se informa al usuario
- **Errores de validación:** Los errores del webhook se muestran de forma clara al usuario
- **Reintentos:** Algunas operaciones críticas pueden reintentar automáticamente

### Sincronización de Datos

- **Tiempo real:** Los cambios realizados se envían inmediatamente al webhook
- **Actualización automática:** Después de operaciones como crear o actualizar, el sistema consulta el webhook para obtener los datos actualizados
- **Cache local:** El sistema utiliza cache local para mejorar el rendimiento, pero siempre prioriza los datos del webhook

### Ventajas de la Arquitectura con Webhooks

✅ **Escalabilidad:** El backend puede manejar múltiples instancias de la aplicación  
✅ **Seguridad:** La autenticación se centraliza en el webhook  
✅ **Flexibilidad:** Los cambios en la lógica de negocio se realizan en n8n sin modificar la aplicación  
✅ **Trazabilidad:** Todas las operaciones quedan registradas en el sistema backend  
✅ **Integración:** Fácil integración con otros sistemas y bases de datos

### Notas Importantes

- ⚠️ **Requiere conexión a internet:** El sistema necesita conexión activa para funcionar
- ⚠️ **Dependencia del servidor:** Si el servidor de webhooks (n8n) no está disponible, algunas operaciones no funcionarán
- ⚠️ **Timeout:** Las operaciones que tomen más de 30 segundos pueden fallar
- ✅ **Modo offline limitado:** Algunas vistas pueden mostrar datos en cache, pero las operaciones requieren conexión

---

## Consejos y Mejores Prácticas

### Para Agentes

✅ **Actualiza el estado regularmente:** Mantén el estado del caso actualizado para que el supervisor pueda ver el progreso

✅ **Agrega comentarios descriptivos:** Al cambiar el estado, explica brevemente qué se hizo o qué se necesita

✅ **Revisa casos pendientes:** Revisa regularmente casos en estado "Pendiente Cliente" para seguimiento

✅ **Usa las categorías correctas:** Selecciona la categoría adecuada para que el SLA se calcule correctamente

### Para Supervisores

✅ **Monitorea casos críticos:** Revisa regularmente las alertas críticas y casos vencidos

✅ **Balancea la carga de trabajo:** Usa la reasignación para distribuir casos equitativamente entre agentes

✅ **Revisa métricas del panel:** El panel supervisor te da una vista rápida del estado general

✅ **Gestiona agentes activos:** Mantén actualizado el estado de los agentes (activo, inactivo, vacaciones)

### Para Gerentes

✅ **Revisa KPIs regularmente:** El panel ejecutivo te da una vista de alto nivel del rendimiento

✅ **Analiza tendencias:** Usa los gráficos para identificar patrones y áreas de mejora

✅ **Monitorea SLA:** Presta atención a los casos excedidos de SLA para identificar problemas sistémicos

### General

✅ **Usa los filtros:** Los filtros te ayudan a encontrar casos específicos rápidamente

✅ **Actualiza la página cuando sea necesario:** Si no ves cambios recientes, usa el botón de actualizar

✅ **Revisa el historial:** El historial del caso contiene información valiosa sobre su evolución

✅ **Mantén datos actualizados:** Al editar casos, asegúrate de que la información del cliente esté correcta

---

## Solución de Problemas

### No puedo iniciar sesión

- Verifica que tu correo y contraseña sean correctos
- Usa la opción "¿Olvidaste tu contraseña?" para restablecerla
- Contacta al administrador si el problema persiste

### No veo mis casos

- Verifica que estés usando el rol correcto
- Los agentes solo ven casos asignados a ellos
- Los supervisores pueden ver todos los casos en "Bandeja Global"

### El caso no se actualiza

- Haz clic en el botón de actualizar (refresh) en la bandeja
- Espera unos segundos después de hacer cambios
- Verifica tu conexión a internet

### No puedo reasignar un caso

- Solo los supervisores pueden reasignar casos
- Verifica que tengas el rol de SUPERVISOR
- Algunos casos pueden tener restricciones de reasignación

---

## Soporte Técnico

Para problemas técnicos o preguntas sobre el sistema, contacta al equipo de soporte o al administrador del sistema.

---

**Versión del Manual:** 1.0  
**Última Actualización:** Enero 2026
