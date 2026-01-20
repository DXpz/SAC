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
7. [Configuración del Sistema (Settings)](#configuración-del-sistema-settings)
8. [Paneles y Dashboards](#paneles-y-dashboards)
9. [Personalización de Tema](#personalización-de-tema)
10. [Comunicación con Webhooks](#comunicación-con-webhooks)
11. [Consejos y Mejores Prácticas](#consejos-y-mejores-prácticas)
12. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

El Sistema de Atención al Cliente (SAC) es una plataforma web completa diseñada para gestionar casos de soporte técnico y atención al cliente de manera eficiente y profesional. El sistema permite crear, asignar, seguir y resolver casos, además de proporcionar herramientas avanzadas de supervisión, análisis y configuración para diferentes niveles de usuarios.

### Características Principales

- ✅ **Gestión completa del ciclo de vida de casos** - Desde la creación hasta el cierre
- ✅ **Asignación automática de casos** - Sistema Round Robin para distribución equitativa
- ✅ **Seguimiento de SLA (Service Level Agreement)** - Control de tiempos y alertas automáticas
- ✅ **Alertas críticas y notificaciones** - Sistema de alertas para casos vencidos y críticos
- ✅ **Dashboards ejecutivos** - Métricas y KPIs en tiempo real
- ✅ **Gestión de agentes y usuarios** - Administración completa de personal
- ✅ **Historial completo** - Registro detallado de todos los cambios en cada caso
- ✅ **Soporte para múltiples canales** - Email, WhatsApp, Teléfono, Web, Redes Sociales
- ✅ **Configuración avanzada y flexible** - Gestión completa de categorías, estados, SLA y calendario de asuetos
  - **⚠️ Las categorías y SLAs son completamente configurables** - No son fijas, pueden crearse, editarse y eliminarse desde Settings
  - Los administradores pueden personalizar todas las categorías y sus SLAs según las necesidades del negocio
  - **⚠️ Los estados son completamente configurables** - El administrador crea los estados, define el orden que deben seguir y configura las transiciones permitidas
- ✅ **Búsqueda avanzada** - Filtros y búsqueda por múltiples criterios
- ✅ **Temas personalizables** - Modo oscuro y modo claro

### Arquitectura Técnica

El sistema utiliza una arquitectura moderna basada en:
- **Frontend:** React 19 con TypeScript
- **Backend:** Webhooks de n8n para todas las operaciones
- **Autenticación:** JWT (JSON Web Tokens)
- **Estilos:** Tailwind CSS con tema personalizable
- **Gráficos:** Recharts para visualización de datos

---

## Acceso al Sistema

### Inicio de Sesión

1. Accede a la URL del sistema en tu navegador
2. Ingresa tu **correo electrónico** y **contraseña**
3. Haz clic en **"Iniciar Sesión"**
4. El sistema validará tus credenciales mediante webhook y te redirigirá a tu panel correspondiente según tu rol

**Nota:** El sistema utiliza autenticación JWT. Tu sesión se mantendrá activa hasta que cierres sesión o el token expire.

### Recuperación de Contraseña

Si olvidaste tu contraseña:

1. En la pantalla de login, haz clic en **"¿Olvidaste tu contraseña?"**
2. Ingresa tu correo electrónico
3. Recibirás un código de verificación por correo electrónico
4. Ingresa el código recibido en la pantalla de verificación
5. Establece una nueva contraseña
6. Confirma la nueva contraseña

**Proceso completo:**
- **Paso 1:** Ingresar email → Webhook `forgot_password`
- **Paso 2:** Ingresar código → Webhook `verify_code`
- **Paso 3:** Establecer nueva contraseña → Webhook `reset_password`

### Registro de Nuevos Usuarios

**Para Supervisores:**
- Los supervisores pueden crear nuevas cuentas de agentes desde el menú **"Crear Cuenta"**
- El sistema generará automáticamente una contraseña que se enviará al webhook

**Para Administradores:**
- Los administradores pueden crear usuarios con cualquier rol desde **"Administración de Usuarios"**

---

## Roles y Permisos

El sistema cuenta con cuatro roles principales, cada uno con permisos específicos y acceso a diferentes funcionalidades:

### 🔵 Agente (AGENTE)

**Permisos:**
- Ver y gestionar casos asignados personalmente
- Crear nuevos casos
- Actualizar estado de casos asignados
- Agregar comentarios y seguimientos
- Editar información básica de casos asignados
- Ver historial completo de casos asignados

**Acceso:**
- Bandeja de Casos (solo casos propios)
- Crear Nuevo Caso
- Detalle de Caso (solo casos propios)
- Editar Caso (solo casos propios)

**Restricciones:**
- No puede ver casos de otros agentes
- No puede reasignar casos
- No puede eliminar casos
- No tiene acceso a paneles de supervisión o administración

### 🟡 Supervisor (SUPERVISOR)

**Permisos:**
- Todas las funciones de Agente
- Ver todos los casos del sistema (Bandeja Global)
- Reasignar casos entre agentes
- Gestionar agentes (crear, editar, ver estado)
- Ver alertas críticas
- Acceso al Panel de Supervisión con métricas
- Crear nuevas cuentas de agentes

**Acceso:**
- Panel Supervisor (con métricas y KPIs)
- Bandeja Global (todos los casos)
- Gestión de Agentes
- Alertas Críticas
- Crear Cuenta (para nuevos agentes)
- Todas las funciones de Agente

**Métricas del Panel:**
- Casos Abiertos
- Casos Críticos
- Casos Vencidos
- Casos Totales
- SLA Promedio
- Agentes Online

### 🟢 Gerente (GERENTE)

**Permisos:**
- Ver todos los casos del sistema
- Panel Ejecutivo con KPIs y gráficos avanzados
- Ver alertas críticas
- Análisis de rendimiento y SLA
- Visualización de tendencias y variaciones
- Acceso a métricas de alto nivel

**Acceso:**
- Panel Ejecutivo (Gerente Dashboard)
- Alertas Críticas
- Vista de todos los casos (solo lectura)

**KPIs del Panel:**
- Casos Abiertos (con variación)
- Excedidos SLA (con variación)
- CSAT Promedio (1-5)
- Total Histórico
- Gráficos de distribución por estado y categoría

**Restricciones:**
- No puede crear o editar casos directamente
- No puede gestionar agentes
- No tiene acceso a configuración del sistema

### 🔴 Administrador (ADMIN)

**Permisos:**
- Todas las funciones anteriores
- Administración completa de usuarios
- Crear usuarios con diferentes roles
- Gestionar países (El Salvador, Guatemala)
- Configuración completa del sistema
- Gestión de categorías, estados y flujos
- Configuración de SLA
- Calendario de asuetos
- Carga masiva de fechas
- Directorio de usuarios

**Acceso:**
- Panel Admin
- Administración de Usuarios
- Configuración (Settings) - Todas las secciones
- Bandeja de Casos Admin (con filtros avanzados)
- Todas las funciones de Supervisor y Gerente

**Secciones de Configuración:**
1. **Configuración General** - Ajustes de SLA por defecto
2. **Estados y Flujos** - Gestión de estados de casos y transiciones
3. **Categorías** - CRUD completo de categorías con webhooks
4. **Usuarios** - Directorio completo de usuarios del sistema
5. **Calendario de Asuetos** - Gestión de días festivos
6. **Carga Masiva** - Importación masiva de fechas

---

## Funcionalidades por Rol

### Agente

#### Bandeja de Casos

La bandeja de casos es tu vista principal donde verás todos los casos asignados a ti.

**Características:**

- **Vista de tabla** con información esencial de cada caso
- **Filtros disponibles:**
  - Por estado: Nuevo, En Proceso, Pendiente Cliente, Escalado, Resuelto, Cerrado
  - Por categoría
  - Búsqueda por texto (asunto, descripción, cliente, número de ticket)
- **Ordenamiento** por fecha de creación, estado, prioridad
- **Indicadores visuales:**
  - Colores por estado
  - Badges de prioridad
  - Indicadores de SLA vencido
- **Actualización automática** al crear o modificar casos

**Acciones disponibles:**

- **Ver detalle:** Haz clic en cualquier fila para ver información completa del caso
- **Actualizar:** Botón de refresh para recargar la lista manualmente
- **Crear caso:** Botón "+" flotante para crear un nuevo caso rápidamente

#### Crear Nuevo Caso

1. Haz clic en el botón **"+"** o navega a **"Casos > Nuevo"**
2. Completa el formulario:

   **Información del Cliente:**
   - **Cliente:** Busca y selecciona el cliente usando el buscador inteligente
     - Puedes buscar por: ID de cliente, nombre de empresa, email o teléfono
     - El sistema mostrará sugerencias mientras escribes
     - Si el cliente no existe, puedes crear uno nuevo ingresando los datos manualmente
   - **Datos de Contacto:** Se autocompletan si seleccionas un cliente existente
     - Nombre del contacto
     - Teléfono
     - Email

   **Información del Caso:**
   - **Categoría:** Selecciona la categoría del caso
     - Cada categoría muestra un tooltip con su descripción al pasar el mouse
     - El SLA se calcula automáticamente según la categoría seleccionada
     - **Nota:** Las categorías son completamente configurables por el administrador en Settings > Categorías. Pueden crearse nuevas categorías, editarse existentes o eliminarse según las necesidades del negocio. Los SLAs también son configurables individualmente para cada categoría.
   - **Canal de Origen:** Email, WhatsApp, Teléfono, Web, Redes Sociales
   - **Canal de Notificación:** Email, WhatsApp, Ambos
   - **Asunto:** Título breve y descriptivo del caso (obligatorio)
   - **Descripción:** Detalle completo del problema o solicitud (obligatorio)

3. Haz clic en **"Crear Caso"**
4. El sistema:
   - Validará todos los campos
   - Asignará el caso automáticamente usando Round Robin
   - Enviará la información al webhook `case.create`
   - Mostrará una animación de éxito
   - Redirigirá al detalle del caso creado

**Notas importantes:**
- El caso se asignará automáticamente al siguiente agente disponible según el orden Round Robin
- Si no hay agentes activos, el caso quedará sin asignar hasta que haya un agente disponible
- El SLA se calcula automáticamente según la categoría seleccionada
- **Las categorías disponibles son configurables por el administrador** - Si no encuentras una categoría adecuada, contacta al administrador para que la cree o modifique las existentes desde Settings > Categorías

#### Ver Detalle de Caso

Al hacer clic en un caso, verás una vista detallada con toda la información:

**Información General:**
- **ID del caso** y número de ticket
- **Cliente** y datos de contacto completos
- **Categoría** y estado actual
- **Agente asignado** (si aplica)
- **Fechas:** Creación, última actualización, vencimiento SLA
- **Canales:** Origen y notificación
- **Prioridad** (si está configurada)

**Secciones principales:**

1. **Información del Caso:**
   - Asunto y descripción
   - Estado actual con indicador visual
   - Tiempo transcurrido desde la creación
   - Días restantes para cumplir el SLA

2. **Historial del Caso:**
   - Lista cronológica de todos los eventos
   - Cambios de estado con fecha, hora y autor
   - Comentarios y justificaciones
   - Actualizaciones del caso
   - Reasignaciones (si aplica)

3. **Acciones Disponibles:**
   - **Editar:** Modifica asunto, descripción y datos del cliente
   - **Cambiar Estado:** Actualiza el estado y agrega comentarios
   - **Ver Historial:** Navega por todos los cambios del caso

#### Editar Caso

1. En el detalle del caso, haz clic en **"Editar"**
2. Se abrirá un formulario con los campos editables:
   - **Asunto** (obligatorio)
   - **Descripción** (obligatorio)
   - **Cliente:**
     - ID de cliente
     - Nombre de empresa
     - Email del cliente
     - Teléfono del cliente
3. Modifica los campos necesarios
4. Haz clic en **"Guardar Cambios"**
5. El sistema:
   - Validará los cambios
   - Enviará la actualización al webhook `case.edit`
   - Actualizará el historial del caso
   - Mostrará un mensaje de confirmación

**Nota:** Solo puedes editar casos asignados a ti. Los supervisores pueden editar cualquier caso.

#### Actualizar Estado del Caso

1. En el detalle del caso, selecciona el nuevo estado del menú desplegable
2. Agrega un comentario explicando el cambio (recomendado)
3. Haz clic en **"Actualizar Estado"**
4. El sistema:
   - Validará la transición de estado (si está permitida)
   - Enviará la actualización al webhook `case.update`
   - Registrará el cambio en el historial con tu nombre y rol
   - Actualizará la fecha de última modificación

**Estados disponibles:**

Los estados disponibles dependen de la configuración realizada por el administrador. Los siguientes son ejemplos comunes:

- **Nuevo:** Caso recién creado
- **En Proceso:** Caso siendo trabajado activamente
- **Pendiente Cliente:** Esperando respuesta del cliente
- **Escalado:** Caso elevado a nivel superior
- **Resuelto:** Problema resuelto, pendiente confirmación
- **Cerrado:** Caso finalizado y cerrado

**Nota:** El administrador puede crear, editar y reordenar estos estados desde Settings > Estados y Flujos. Si necesitas un estado adicional o modificar el orden, contacta al administrador.

**Validaciones:**
- No todos los estados pueden transicionar a cualquier otro estado
- El sistema valida las transiciones permitidas según la configuración
- Los estados finales (Resuelto, Cerrado) generalmente no pueden cambiar a estados anteriores

---

### Supervisor

#### Panel Supervisor

El panel supervisor proporciona una vista general completa de todos los casos y métricas importantes del sistema.

**Métricas Principales:**

1. **Casos Abiertos**
   - Total de casos activos en el sistema
   - Excluye casos cerrados o resueltos

2. **Casos Críticos**
   - Casos que requieren atención inmediata
   - Basados en tiempo abierto y prioridad

3. **Casos Vencidos**
   - Casos que excedieron el SLA comprometido
   - Requieren atención urgente

4. **Casos Totales**
   - Total acumulado de casos (histórico)

5. **SLA Promedio**
   - Tiempo promedio de cumplimiento de SLA
   - Calculado sobre casos cerrados

6. **Agentes Online**
   - Número de agentes activos en el momento

**Filtros Disponibles:**

- **Período:** Hoy, Semana, Mes
- **Tipo:** Todos, Críticos, Vencidos
- **Agente:** Filtrar por agente específico (menú desplegable)

**Visualización:**

- Las métricas se muestran en tarjetas grandes con números animados
- Colores diferenciados por tipo de métrica
- Iconos representativos para cada métrica
- Actualización en tiempo real

#### Bandeja Global

Similar a la bandeja de casos del agente, pero muestra **todos los casos** del sistema, no solo los asignados a un agente específico.

**Funcionalidades Adicionales:**

- Ver casos de todos los agentes
- Ver casos sin asignar
- Filtros avanzados:
  - Por agente
  - Por estado
  - Por categoría
  - Por rango de fechas
- Búsqueda global en todos los campos
- Indicadores de asignación y agente responsable

**Acciones Adicionales:**

- **Reasignar casos** entre agentes
- **Ver detalles completos** de cualquier caso
- **Editar cualquier caso** del sistema

#### Reasignar Caso

1. Abre el detalle del caso que deseas reasignar
2. Haz clic en **"Reasignar"** (disponible solo para supervisores)
3. Se abrirá un menú desplegable con todos los agentes activos
4. Selecciona el nuevo agente
5. Opcionalmente, agrega un comentario explicando la reasignación
6. Haz clic en **"Confirmar Reasignación"**
7. El sistema:
   - Enviará la reasignación al webhook `case.update` con `agent_id`
   - Actualizará el historial del caso
   - Notificará al nuevo agente (si está configurado)
   - Actualizará los contadores de casos por agente

**Nota:** La reasignación no requiere justificación obligatoria, pero es recomendable agregar un comentario.

#### Gestión de Agentes

Accede desde el menú lateral: **"Gestión de Agentes"**

**Funcionalidades:**

**Ver Lista de Agentes:**
- Tabla completa con información de cada agente:
  - Avatar con iniciales
  - Nombre completo
  - Email
  - Estado (Activo/Inactivo/Vacaciones) con indicador visual
  - Casos activos asignados
  - Orden de asignación (Round Robin)
  - Fecha del último caso asignado
- Filtros por estado
- Búsqueda por nombre o email
- Ordenamiento por diferentes columnas

**Crear Nuevo Agente:**

1. Haz clic en **"Crear Agente"** o navega a **"Crear Cuenta"**
2. Completa el formulario:
   - **Nombre completo** (obligatorio)
   - **Email** (obligatorio, debe ser único)
   - **Contraseña** (se genera automáticamente, pero puedes personalizarla)
   - **País:** El Salvador o Guatemala (menú desplegable)
   - **Rol:** AGENTE (por defecto, no editable desde esta vista)
3. Haz clic en **"Crear Agente"**
4. El sistema:
   - Validará los datos
   - Enviará la información al webhook `agent.create`
   - Generará una contraseña (si no se proporcionó)
   - Enviará la contraseña al webhook para notificación
   - Mostrará una animación de éxito
   - El agente quedará activo por defecto

**Editar Agente:**

- **Cambiar estado:**
  - Activo: Agente disponible para recibir casos
  - Inactivo: Agente no disponible temporalmente
  - Vacaciones: Agente en período de vacaciones (no recibe casos)
- **Modificar información básica:**
  - Nombre
  - Email
  - País

**Eliminar Agente:**

- Solo disponible para supervisores
- Requiere confirmación
- Los casos asignados deben ser reasignados antes de eliminar
- Acción permanente e irreversible

**Estados de Agente:**

- **Activo:** Agente disponible para recibir casos mediante Round Robin
- **Inactivo:** Agente no disponible temporalmente, no recibe nuevos casos
- **Vacaciones:** Agente en período de vacaciones, no recibe casos

**Round Robin:**

- El sistema asigna casos automáticamente siguiendo el orden Round Robin
- Cada agente tiene un orden de asignación
- El sistema lleva registro del último caso asignado
- Los agentes inactivos o en vacaciones se saltan automáticamente

#### Alertas Críticas

Accede desde el menú: **"Alertas Críticas"**

Muestra casos que requieren atención inmediata:

**Tipos de Alertas:**

1. **Casos Vencidos (SLA)**
   - Casos que excedieron el tiempo comprometido de SLA
   - Requieren atención urgente
   - Se muestran con indicador rojo

2. **Casos Críticos por Tiempo**
   - Casos abiertos por mucho tiempo sin resolver
   - Basados en umbrales configurables

3. **Casos Escalados**
   - Casos que han sido elevados a nivel superior
   - Requieren revisión de gerencia

**Funcionalidades:**

- Vista de lista con información esencial
- Filtros por tipo de alerta
- Acceso directo al detalle del caso
- Acciones rápidas (reasignar, cambiar estado)
- Actualización automática

---

### Gerente

#### Panel Ejecutivo (Gerente Dashboard)

El panel ejecutivo proporciona una vista de alto nivel con métricas, análisis y gráficos para toma de decisiones estratégicas.

**KPIs Principales:**

1. **Casos Abiertos**
   - Total de casos activos
   - Variación respecto al período anterior (↑ o ↓)
   - Porcentaje de cambio

2. **Excedidos SLA**
   - Casos que superaron el tiempo comprometido
   - Variación respecto al período anterior
   - Indicador de tendencia

3. **CSAT Promedio**
   - Puntuación promedio de satisfacción del cliente (escala 1-5)
   - Calculado sobre casos cerrados con evaluación
   - Indicador de calidad del servicio

4. **Total Histórico**
   - Total acumulado de casos desde el inicio
   - Incluye todos los estados

**Gráficos Disponibles:**

1. **Distribución por Estado**
   - Gráfico de barras horizontal
   - Muestra cantidad de casos por cada estado
   - Colores diferenciados por estado
   - Valores numéricos en cada barra

2. **Distribución por Categoría**
   - Gráfico circular (pie chart)
   - Porcentaje de casos por categoría
   - Leyenda con valores absolutos
   - Colores diferenciados

3. **Tendencias**
   - Variaciones respecto a períodos anteriores
   - Indicadores de crecimiento o decrecimiento
   - Comparación con períodos anteriores

**Filtros:**

- **Período:** Hoy, Semana, Mes
- Los filtros afectan todas las métricas y gráficos simultáneamente

**Insights Ejecutivos:**

El sistema genera automáticamente insights basados en los datos:

- **Alertas sobre casos críticos:**
  - Identificación de categorías con más casos vencidos
  - Agentes con mayor carga de trabajo
  - Tendencias preocupantes

- **Recomendaciones de acción:**
  - Sugerencias para mejorar el SLA
  - Recomendaciones de distribución de carga
  - Áreas que requieren atención

- **Tendencias importantes:**
  - Patrones identificados en los datos
  - Comparaciones con períodos anteriores
  - Proyecciones basadas en datos históricos

**Características Visuales:**

- Diseño limpio y profesional
- Números grandes y legibles
- Colores consistentes con el tema del sistema
- Animaciones suaves en números y gráficos
- Responsive (se adapta a diferentes tamaños de pantalla)

#### Alertas Críticas

Los gerentes también tienen acceso a las alertas críticas para monitoreo de alto nivel:

- Vista consolidada de todos los casos críticos
- Filtros por tipo y severidad
- Acceso rápido a detalles
- Exportación de reportes (si está disponible)

---

### Administrador

#### Panel Admin

El panel de administración es el centro de control completo del sistema, proporcionando acceso a todas las funcionalidades administrativas.

**Acceso:**
- Menú lateral: **"Panel Admin"**
- Disponible solo para usuarios con rol ADMIN

**Funcionalidades Principales:**

1. **Vista General del Sistema**
   - Resumen de estadísticas globales
   - Estado de servicios y webhooks
   - Información del sistema

2. **Acceso Rápido:**
   - Enlaces directos a todas las secciones administrativas
   - Acceso a configuración
   - Gestión de usuarios
   - Bandeja de casos administrativa

#### Administración de Usuarios

Accede desde el menú: **"Administración de Usuarios"**

**Funcionalidades Completas:**

**Ver Todos los Usuarios:**

- Tabla completa con información detallada:
  - **Avatar:** Círculo con iniciales del usuario
  - **Nombre:** Nombre completo del usuario
  - **ID:** Identificador único (formato: AGT-INT-XXXX)
  - **Rol:** Badge con color según rol (AGENTE, SUPERVISOR, GERENTE, ADMIN)
  - **Email:** Correo electrónico del usuario
  - **Orden R.R.:** Orden de asignación Round Robin
  - **Estado:** Activo, Inactivo o Vacaciones con indicador visual
  - **Acciones:** Editar y eliminar

**Filtros:**

- **Por rol:** Todos, Agente, Supervisor, Gerente, Admin
- **Búsqueda:** Por nombre o email (búsqueda en tiempo real)
- **Sugerencias:** El sistema muestra sugerencias mientras escribes

**Crear Usuario:**

1. Haz clic en **"Crear Usuario"**
2. Completa el formulario:
   - **Nombre completo** (obligatorio)
   - **Email** (obligatorio, debe ser único)
   - **Contraseña** (obligatorio, mínimo 6 caracteres)
   - **País:** El Salvador o Guatemala (menú desplegable)
   - **Rol:** AGENTE, SUPERVISOR, GERENTE, ADMIN (menú desplegable)
3. Haz clic en **"Crear"**
4. El sistema:
   - Validará todos los campos
   - Enviará la información al webhook `user.create`
   - Creará el usuario como activo por defecto
   - Mostrará confirmación de éxito

**Editar Usuario:**

- Modificar nombre, email, contraseña
- Cambiar rol (con validaciones)
- Actualizar país
- Cambiar estado (Activo/Inactivo/Vacaciones)

**Eliminar Usuario:**

- Eliminar usuarios del sistema
- Requiere confirmación explícita
- Acción permanente e irreversible
- Los casos asignados deben ser reasignados antes de eliminar

**Nota:** Los usuarios creados desde el panel de administración están activos por defecto.

#### Bandeja de Casos Admin

Accede desde: **"Admin > Casos"**

Vista administrativa completa de todos los casos con filtros avanzados:

**Características:**

- **Filtros avanzados:**
  - Por estado (múltiple selección)
  - Por categoría (con tooltips de descripción)
  - Por agente asignado
  - Por rango de fechas
  - Por cliente
  - Por canal de origen
- **Búsqueda global:**
  - Busca en todos los campos del caso
  - Búsqueda en tiempo real
  - Resalta resultados encontrados
- **Vista de tabla completa:**
  - Todas las columnas disponibles
  - Ordenamiento por cualquier columna
  - Exportación de datos (si está disponible)
- **Acciones administrativas:**
  - Editar cualquier caso
  - Reasignar casos
  - Cambiar estados
  - Ver historial completo

---

## Gestión de Casos

### Estados de Caso

**⚠️ IMPORTANTE: Los estados son completamente configurables por el administrador**

Los estados de caso **NO son fijos**. El administrador puede crear, editar, eliminar y reordenar los estados según las necesidades del flujo de trabajo de la organización. El administrador también define el orden que los estados deben seguir en el proceso de atención.

**Estados Comunes** (pueden variar según configuración):

Los siguientes son ejemplos de estados típicos que el administrador puede configurar:

1. **Nuevo**
   - Caso recién creado
   - Pendiente de asignación o inicio de trabajo
   - Color: Azul

2. **En Proceso**
   - Caso asignado y siendo trabajado activamente
   - El agente está trabajando en la resolución
   - Color: Amarillo/Naranja

3. **Pendiente Cliente**
   - Esperando respuesta o información del cliente
   - El caso está pausado hasta recibir respuesta
   - Color: Naranja

4. **Escalado**
   - Caso elevado a un nivel superior
   - Requiere atención de supervisión o gerencia
   - Color: Rojo

5. **Resuelto**
   - Problema resuelto, pendiente de confirmación del cliente
   - Estado final transitorio antes del cierre
   - Color: Verde

6. **Cerrado**
   - Caso finalizado y cerrado definitivamente
   - No se pueden hacer más cambios
   - Color: Gris

**Configuración de Estados:**

- **Creación:** El administrador puede crear nuevos estados con cualquier nombre
- **Orden:** El administrador define el orden que los estados deben seguir (arrastrar y soltar)
- **Estados finales:** El administrador marca qué estados son finales (no permiten transiciones hacia atrás)
- **Edición:** Los nombres de los estados pueden editarse
- **Eliminación:** Los estados pueden eliminarse (con validación para evitar problemas)

**Transiciones de Estado:**

- El administrador configura qué estados pueden transicionar a otros
- No todos los estados pueden transicionar a cualquier otro
- El sistema valida las transiciones permitidas según la configuración del administrador
- Los estados finales generalmente no pueden cambiar a estados anteriores
- Las transiciones se configuran completamente en Settings > Estados y Flujos

**Nota:** Si necesitas un nuevo estado o modificar el orden de los estados, contacta al administrador del sistema.

### Categorías

Las categorías definen el tipo de caso y son **completamente configurables** desde el perfil de administrador en Settings. Cada categoría tiene asociados:

- **SLA (Service Level Agreement):** Tiempo máximo de resolución en días (configurable)
- **Descripción:** Descripción breve de la categoría (opcional, configurable)
- **Días de Alerta Supervisor:** Días antes del vencimiento para alertar al supervisor (configurable en Settings > Configuración General)
- **Días de Alerta Gerente:** Días antes del vencimiento para alertar al gerente (configurable en Settings > Configuración General)

**⚠️ Importante:** Las categorías y sus SLAs **NO son fijas**. El administrador puede:

- **Crear nuevas categorías** con cualquier nombre y SLA personalizado
- **Editar categorías existentes** para modificar nombre, SLA y descripción
- **Eliminar categorías** que ya no se necesiten
- **Configurar SLAs individuales** para cada categoría según las necesidades del negocio

**Gestión de Categorías:**

Todas las categorías se gestionan desde **Settings > Categorías** (solo administradores):

- Ver todas las categorías con tooltips de descripción
- Crear nuevas categorías con SLA personalizado
- Editar categorías existentes (nombre, SLA, descripción)
- Eliminar categorías (con confirmación)
- Búsqueda por nombre, descripción o ID
- Sincronización automática con webhook `category.*`

**Ejemplo de categorías comunes** (pueden variar según configuración):
- Soporte Técnico (SLA configurable, típicamente 5 días)
- Facturación (SLA configurable, típicamente 5 días)
- Reclamos (SLA configurable, típicamente 3 días)
- Consultas Comerciales (SLA configurable, típicamente 2 días)

**Nota:** Los SLAs se pueden ajustar individualmente para cada categoría según los acuerdos de nivel de servicio de tu organización. Consulta con tu administrador para conocer las categorías y SLAs configurados en tu sistema.

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

Los canales determinan cómo se originó el caso y cómo se notificará al cliente sobre actualizaciones.

### Historial de Caso

Cada caso mantiene un historial completo que incluye:

**Tipos de Eventos:**

1. **Cambios de Estado:**
   - Muestra: "Estado cambiado de [Estado Anterior] a [Estado Nuevo]"
   - Incluye fecha, hora y autor
   - Comentario o justificación (si se proporcionó)

2. **Actualizaciones del Caso:**
   - Ediciones de datos (asunto, descripción, cliente)
   - Muestra: "Actualización del caso"
   - Incluye detalles de los cambios realizados
   - Fecha, hora y autor

3. **Reasignaciones:**
   - Cambios de agente asignado
   - Muestra el agente anterior y el nuevo
   - Fecha, hora y autor (supervisor)

4. **Comentarios:**
   - Comentarios agregados al cambiar estados
   - Justificaciones de cambios
   - Notas adicionales

**Visualización del Historial:**

- Lista cronológica (más reciente primero)
- Formato de tarjeta con información clara
- Iconos diferenciados por tipo de evento
- Colores según el tipo de cambio
- Fecha y hora formateadas en español

### Round Robin (Asignación Automática)

El sistema utiliza un algoritmo Round Robin para asignar casos automáticamente:

**Cómo Funciona:**

1. Los casos nuevos se asignan automáticamente al siguiente agente disponible
2. El sistema mantiene un orden de asignación para cada agente
3. Se lleva registro del último caso asignado a cada agente
4. Los agentes inactivos o en vacaciones se saltan automáticamente
5. Cuando un agente completa su turno, el siguiente agente recibe el próximo caso

**Configuración:**

- El orden de asignación se puede ajustar en Gestión de Agentes
- Los supervisores pueden reasignar casos manualmente si es necesario
- El sistema consulta el webhook `round-robin` para determinar el siguiente agente

**Ventajas:**

- Distribución equitativa de carga de trabajo
- Evita sobrecarga de agentes individuales
- Automatiza el proceso de asignación
- Reduce tiempo de respuesta

---

## Gestión de Agentes y Usuarios

### Crear Agente (Supervisor)

1. Navega a **"Gestión de Agentes"** o **"Crear Cuenta"**
2. Completa el formulario de registro:
   - Nombre completo
   - Email (único)
   - Contraseña (se genera automáticamente si no se proporciona)
   - País: El Salvador o Guatemala
   - Rol: AGENTE (por defecto)
3. Haz clic en **"Crear Agente"**
4. El sistema:
   - Generará una contraseña automáticamente (si no se proporcionó)
   - Enviará la contraseña al webhook `agent.create`
   - El agente quedará activo por defecto
   - Se asignará un orden Round Robin automáticamente

### Crear Usuario (Administrador)

1. Navega a **"Administración de Usuarios"**
2. Haz clic en **"Crear Usuario"**
3. Completa todos los campos:
   - Nombre, Email, Contraseña
   - País (El Salvador o Guatemala)
   - Rol (AGENTE, SUPERVISOR, GERENTE, ADMIN)
4. El usuario se creará como activo automáticamente

### Estados de Agente

- **Activo:** Agente disponible para recibir casos mediante Round Robin
- **Inactivo:** Agente no disponible temporalmente, no recibe nuevos casos
- **Vacaciones:** Agente en período de vacaciones, no recibe casos

**Efectos en Round Robin:**

- Solo los agentes activos reciben casos automáticamente
- Los agentes inactivos o en vacaciones se saltan en la asignación
- Al reactivar un agente, vuelve a recibir casos según su orden

---

## Configuración del Sistema (Settings)

La sección de Configuración es exclusiva para administradores y permite gestionar todos los aspectos configurables del sistema.

**Acceso:** Menú lateral > **"Configuración"** (solo ADMIN)

### Pestañas de Configuración

#### 1. Configuración General

**Ajustes de SLA y Alertas:**

Esta sección permite configurar los valores globales de SLA y alertas que se aplican cuando no se especifica una categoría o como valores base del sistema.

- **SLA por Defecto (días):** Tiempo estándar de resolución cuando no se especifica categoría o como valor base
- **Días de Alerta Supervisor:** Días antes del vencimiento del SLA para alertar al supervisor (aplicable a todas las categorías)
- **Días de Alerta Gerente:** Días antes del vencimiento del SLA para alertar al gerente (aplicable a todas las categorías)

**⚠️ Importante sobre SLAs:**

- Los SLAs **NO son fijos** y pueden configurarse completamente desde Settings
- Cada categoría puede tener su propio SLA personalizado (ver sección Categorías)
- El SLA por defecto se usa cuando no hay categoría específica o como valor base
- Los administradores pueden ajustar los SLAs según las necesidades del negocio

**Funcionalidades:**

- Campos numéricos con validación
- Botón "Guardar" para aplicar cambios
- Los cambios se guardan localmente (pueden integrarse con webhook en el futuro)
- Los valores configurados aquí afectan el cálculo de SLA en todo el sistema

#### 2. Estados y Flujos

**⚠️ IMPORTANTE: Los administradores crean y configuran todos los estados**

Esta sección permite a los administradores gestionar completamente el flujo de trabajo de los casos. Los estados **NO son fijos** y pueden ser creados, editados, reordenados y eliminados según las necesidades del negocio.

**Gestión Completa de Estados:**

**Crear Estados:**

Los administradores pueden crear nuevos estados con cualquier nombre que se ajuste al flujo de trabajo de la organización. No hay límites en la cantidad de estados ni restricciones en los nombres.

**Definir el Orden de los Estados:**

- **El administrador define el orden** que los estados deben seguir en el proceso de atención
- El orden se establece mediante **arrastrar y soltar** (drag and drop)
- El orden determina la secuencia lógica del flujo de trabajo
- Cada estado tiene un número de orden que indica su posición en el proceso

**Funcionalidades de Gestión:**

- **Lista de Estados:**
  - Ver todos los estados configurados en el sistema
  - **Reordenar estados** arrastrando y soltando para definir el orden del flujo
  - Marcar estados como finales (estados que no permiten transiciones hacia atrás)
  - Editar nombre de estados existentes
  - Eliminar estados (con validación para evitar problemas con casos existentes)

**Estados de Ejemplo** (pueden variar según configuración):

Los siguientes son ejemplos comunes que el administrador puede configurar:

- Nuevo (orden configurable, típicamente 1)
- En Proceso (orden configurable, típicamente 2)
- Pendiente Cliente (orden configurable, típicamente 3)
- Escalado (orden configurable, típicamente 4)
- Resuelto (orden configurable, típicamente 5, puede marcarse como final)
- Cerrado (orden configurable, típicamente 6, generalmente marcado como final)

**Gestión de Transiciones:**

- **Matriz de transiciones permitidas:** El administrador configura qué estados pueden transicionar a otros
- **Control total:** Marcar qué estados pueden transicionar a otros estados
- **Validación automática:** El sistema valida las transiciones permitidas al cambiar estados en casos
- **Visualización clara:** Interfaz visual que muestra los flujos permitidos

**Crear Nuevo Estado:**

1. Ingresa el nombre del estado (puede ser cualquier texto descriptivo)
2. Define el orden (posición en el flujo de trabajo) - puedes ajustarlo después arrastrando
3. Marca si es un estado final (estados finales generalmente no permiten transiciones hacia atrás)
4. Haz clic en "Agregar Estado"
5. Configura las transiciones permitidas (qué estados pueden cambiar a este nuevo estado y a qué estados puede cambiar este estado)

**Reordenar Estados:**

1. Simplemente arrastra el estado a la posición deseada en la lista
2. El orden se actualiza automáticamente
3. El nuevo orden se aplica inmediatamente a todos los casos

**Nota:** El orden de los estados es importante porque define la secuencia lógica del proceso de atención. Los administradores deben organizar los estados de manera que refleje el flujo de trabajo real de la organización.

#### 3. Categorías

**⚠️ IMPORTANTE: Las categorías y SLAs son completamente configurables**

Esta sección permite a los administradores gestionar completamente todas las categorías del sistema. **Las categorías NO son fijas** y pueden ser creadas, editadas o eliminadas según las necesidades del negocio.

**Gestión Completa de Categorías:**

**Ver Categorías:**

- Tabla con todas las categorías configuradas en el sistema:
  - **ID:** Identificador único (asignado automáticamente)
  - **Nombre:** Nombre de la categoría con tooltip de descripción (editable)
  - **SLA (días):** Tiempo de resolución comprometido (configurable para cada categoría)
  - **Descripción:** Tooltip al pasar el mouse sobre el icono de ayuda (editable)
  - **Acciones:** Editar y Eliminar

**Características:**

- **Totalmente personalizable:** Puedes crear tantas categorías como necesites
- **SLAs individuales:** Cada categoría puede tener su propio SLA (no están limitados a valores predefinidos)
- **Sincronización en tiempo real:** Los cambios se sincronizan automáticamente con el webhook
- **Flexibilidad total:** No hay restricciones en nombres, SLAs o descripciones

**Búsqueda de Categorías:**

- Campo de búsqueda en tiempo real
- Busca por:
  - Nombre (coincidencia de frase)
  - Descripción (coincidencia de frase)
  - ID (coincidencia exacta)
- Búsqueda sin tildes y sin mayúsculas/minúsculas
- Botón "Limpiar" para resetear la búsqueda
- Si no hay resultados locales y el término es numérico, busca en el webhook

**Crear Categoría:**

Los administradores pueden crear nuevas categorías con cualquier nombre y SLA personalizado. No hay límites en la cantidad de categorías ni en los valores de SLA.

1. Completa el formulario:
   - **Nombre:** Nombre de la categoría (obligatorio, puede ser cualquier texto)
   - **SLA (días):** Tiempo de resolución en días (obligatorio, mínimo 1, puede ser cualquier número)
   - **Descripción:** Descripción breve de la categoría (opcional, ayuda a otros usuarios a entender la categoría)
2. Haz clic en **"Crear Categoría"**
3. El sistema:
   - Valida los campos
   - Envía al webhook `category.create` con:
     - `action: "category.create"`
     - `actor:` (usuario actual con rol mapeado: ADMIN → ADMINISTRADOR)
     - `data:` (id: "", category_name, description, sla como string)
   - Actualiza la lista local
   - Muestra confirmación
   - La nueva categoría estará disponible inmediatamente para usar en casos

**Ejemplos de categorías personalizadas:**
- Puedes crear categorías como "Soporte Premium" con SLA de 1 día
- O "Consultas Generales" con SLA de 7 días
- No hay restricciones en los nombres o valores de SLA

**Editar Categoría:**

Los administradores pueden modificar cualquier categoría existente, incluyendo su nombre, SLA y descripción. Esto permite ajustar las categorías según cambien las necesidades del negocio.

1. Haz clic en el icono de **"Editar"** junto a la categoría
2. Se abre un modal con el formulario prellenado con los valores actuales
3. Modifica los campos necesarios:
   - **Nombre:** Puedes cambiar el nombre completo de la categoría
   - **SLA (días):** Puede dejarse vacío mientras editas, pero debe ser >= 1 al guardar. Puedes ajustar el SLA a cualquier valor según tus necesidades
   - **Descripción:** Actualiza o agrega una descripción para ayudar a los usuarios
4. Haz clic en **"Guardar Cambios"**
5. El sistema:
   - Valida los campos
   - Envía al webhook `category.update` con:
     - `action: "category.update"`
     - `actor:` (usuario actual)
     - `data:` (id, category_name, description, sla como string)
   - Actualiza la lista local
   - Cierra el modal
   - Los cambios se aplican inmediatamente a todos los casos que usen esta categoría

**Nota:** Al cambiar el SLA de una categoría, los casos existentes mantendrán su SLA original, pero los nuevos casos usarán el SLA actualizado.

**Eliminar Categoría:**

1. Haz clic en el icono de **"Eliminar"** junto a la categoría
2. Se abre un modal de confirmación animado con:
   - Icono de advertencia
   - Nombre de la categoría a eliminar
   - Botones "Cancelar" y "Confirmar Eliminación"
3. Haz clic en **"Confirmar Eliminación"**
4. El sistema:
   - Envía al webhook `category.delete` con:
     - `action: "category.delete"`
     - `actor:` (usuario actual)
     - `data:` (id de la categoría)
   - Elimina la categoría de la lista local
   - Muestra confirmación

**Carga Automática de Categorías:**

- Al cargar la página o activar la pestaña "Categorías", el sistema:
  - Envía al webhook `category.read` con `data: { id: "" }`
  - Recibe todas las categorías configuradas en el sistema
  - Mapea los datos del formato del webhook al formato local
  - Actualiza la lista con todas las categorías disponibles
  - Si el webhook no retorna datos, muestra categorías de ejemplo (que pueden ser modificadas o eliminadas)

**Sincronización:**

- Las categorías se sincronizan automáticamente con el backend mediante webhooks
- Cualquier cambio realizado en Settings se refleja inmediatamente en todo el sistema
- Los usuarios verán las categorías actualizadas al crear o editar casos

**Formato del Webhook:**

El webhook retorna categorías en el formato:
```json
[
  {
    "data": [
      {
        "id": 2,
        "caegoria": "Facturación",
        "descripcion": "",
        "valor SLA": 5
      }
    ]
  }
]
```

El sistema mapea automáticamente:
- `caegoria` → `name`
- `valor SLA` → `slaDays`
- `descripcion` → `description`

#### 4. Usuarios (Directorio de Usuarios)

**Vista Completa del Directorio:**

- Tabla con todos los usuarios del sistema
- Columnas separadas:
  - **AVATAR:** Círculo con iniciales del usuario
  - **NOMBRE:** Nombre completo del usuario
  - **ID:** Identificador único (formato: AGT-INT-XXXX)
  - **ROL:** Badge con color según rol
  - **EMAIL:** Correo electrónico
  - **ORDEN R.R.:** Orden de asignación Round Robin
  - **ESTADO:** Activo, Inactivo o Vacaciones
  - **ACCIONES:** Editar y eliminar

**Funcionalidades:**

- Carga automática desde webhook al activar la pestaña
- Búsqueda y filtrado
- Vista de información completa
- Acceso a acciones administrativas

**Botón "Nuevo Usuario":**

- Enlace directo a la creación de usuarios
- Redirige a Administración de Usuarios

#### 5. Calendario de Asuetos

**Gestión de Días Festivos:**

- **Vista de Calendario:**
  - Lista de fechas festivas configuradas
  - Formato: Fecha (semibold) y día de la semana (regular)
  - Botón de eliminar por cada fecha (rojo al hover)

**Agregar Fecha:**

1. Selecciona una fecha en el calendario
2. Haz clic en **"Agregar Fecha"**
3. La fecha se agregará a la lista
4. Los días festivos se excluyen del cálculo de SLA

**Eliminar Fecha:**

1. Haz clic en el botón de eliminar (icono de papelera) junto a la fecha
2. Se elimina de la lista inmediatamente

**Características Visuales:**

- Diseño limpio y organizado
- Tabla con fechas formateadas en español
- Botones de eliminar sutiles hasta hover
- Colores consistentes con el tema

#### 6. Carga Masiva

**Importación Masiva de Fechas:**

- **Área de Texto:**
  - Ingresa fechas en formato texto (una por línea)
  - Formatos aceptados: DD/MM/YYYY, YYYY-MM-DD, etc.
  - El sistema parsea automáticamente los formatos comunes

**Importar Fechas:**

1. Ingresa las fechas en el área de texto (una por línea)
2. Haz clic en **"Importar Fechas"** (botón rojo prominente)
3. El sistema:
   - Valida y parsea las fechas
   - Agrega todas las fechas válidas al calendario
   - Muestra confirmación de fechas importadas
   - Limpia el área de texto

**Características:**

- Validación de fechas
- Manejo de errores para fechas inválidas
- Confirmación visual de importación exitosa
- Botón destacado como CTA principal

---

## Paneles y Dashboards

### Panel de Agente

**Bandeja de Casos:**
- Vista principal del agente
- Solo casos asignados personalmente
- Filtros y búsqueda
- Acceso rápido a crear casos
- Actualización automática

**Características:**
- Interfaz simple y enfocada
- Acciones rápidas
- Notificaciones visuales de casos nuevos
- Indicadores de SLA

### Panel Supervisor

**Vista General:**
- Métricas principales en tiempo real
- Distribución de carga de trabajo
- Alertas y casos críticos
- Acceso a todas las funcionalidades de supervisión

**Métricas:**
- Casos Abiertos
- Casos Críticos
- Casos Vencidos
- Casos Totales
- SLA Promedio
- Agentes Online

**Filtros:**
- Período (Hoy, Semana, Mes)
- Tipo (Todos, Críticos, Vencidos)
- Por agente

### Panel Ejecutivo (Gerente)

**KPIs Principales:**
- Casos Abiertos (con variación)
- Excedidos SLA (con variación)
- CSAT Promedio
- Total Histórico

**Gráficos:**
- Distribución por Estado (barras)
- Distribución por Categoría (pie chart)
- Tendencias y variaciones

**Insights:**
- Alertas automáticas
- Recomendaciones de acción
- Identificación de tendencias

### Alertas Críticas

**Disponible para:** Supervisor y Gerente

**Tipos:**
- Casos vencidos (SLA)
- Casos críticos por tiempo
- Casos escalados

**Funcionalidades:**
- Vista consolidada
- Filtros por tipo
- Acceso rápido a detalles
- Acciones rápidas

---

## Personalización de Tema

El sistema SAC incluye soporte completo para dos temas visuales que puedes cambiar según tu preferencia.

### Modo Oscuro y Modo Claro

**Modo Oscuro (Dark Mode):**
- Tema oscuro por defecto
- Ideal para trabajar en ambientes con poca luz
- Reduce fatiga visual en sesiones largas
- Colores suaves y contrastes adecuados

**Modo Claro (Light Mode):**
- Tema claro
- Ideal para ambientes bien iluminados
- Mayor contraste para mejor legibilidad
- Diseño limpio y profesional

### Cambiar el Tema

1. **Ubicación del botón:** En la esquina inferior derecha de la pantalla verás un botón flotante con un icono de sol (☀️) o luna (🌙)
2. **Cambiar tema:** Haz clic en el botón para alternar entre modo oscuro y modo claro
3. **Persistencia:** Tu preferencia de tema se guarda automáticamente y se mantendrá en futuras sesiones

### Características del Sistema de Temas

- ✅ **Guardado automático:** El tema seleccionado se guarda en tu navegador (localStorage)
- ✅ **Aplicación inmediata:** El cambio se aplica instantáneamente en toda la aplicación
- ✅ **Persistente:** El tema se mantiene entre sesiones, no necesitas cambiarlo cada vez que inicias sesión
- ✅ **Consistente:** Todos los componentes de la aplicación respetan el tema seleccionado
- ✅ **Transiciones suaves:** Los cambios de tema tienen animaciones suaves

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

**Cuándo se usa:** Al iniciar sesión

**Datos enviados:**
```json
{
  "type": "login",
  "email": "usuario@intelfon.com",
  "password": "contraseña"
}
```

**Datos recibidos:**
- Token JWT
- Información del usuario (ID, nombre, rol, email)
- Datos adicionales del perfil

**Webhook:** `WEBHOOK_URL` → `https://n8n.red.com.sv/webhook/6f27bb4b-bfcd-4776-b554-5194569be2a7`

#### 2. Gestión de Casos (`case.*`)

**`case.create` - Crear nuevos casos**

**Payload:**
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

**`case.read` - Consultar casos**

- Individual: `data: { case_id: "123" }`
- Todos: `data: { case_id: "" }`

**`case.edit` - Editar información de casos**

**Payload:**
```json
{
  "action": "case.edit",
  "actor": { ... },
  "data": {
    "case_id": "123",
    "asunto": "Nuevo asunto",
    "descripcion": "Nueva descripción",
    "cliente_id": "CL003299",
    "cliente_nombre": "EMPRESA S.A.",
    "email_cliente": "contacto@empresa.com",
    "telefono_cliente": "+50370000000"
  }
}
```

**`case.update` - Actualizar estado o reasignar**

**Payload:**
```json
{
  "action": "case.update",
  "actor": { ... },
  "data": {
    "case_id": "123",
    "update_type": "status_change", // o "agent_reassign"
    "estado": "En Proceso",
    "comentario": "Iniciando trabajo en el caso",
    "agent_id": "456" // Solo para reasignación
  }
}
```

**`case.delete` - Eliminar casos**

**Payload:**
```json
{
  "action": "case.delete",
  "actor": { ... },
  "data": {
    "case_id": "123",
    "motivo": "Caso duplicado"
  }
}
```

**Webhook:** `WEBHOOK_CASOS_URL` → `https://n8n.red.com.sv/webhook-test/97a6c0f7-ea50-4542-b99e-710b96b58652`

#### 3. Gestión de Agentes (`agent.*`)

**`agent.create` - Crear nuevos agentes**

**Payload:**
```json
{
  "action": "agent.create",
  "actor": { ... },
  "data": {
    "nombre": "Juan Pérez",
    "email": "juan@intelfon.com",
    "password": "contraseña_generada",
    "pais": "El_Salvador",
    "rol": "AGENTE"
  }
}
```

**`agent.read` - Consultar agentes**

- Individual: `data: { agente_id: "123" }`
- Todos: `data: { agente_id: "" }`

**`agent.update` - Actualizar estado de agentes**

**Payload:**
```json
{
  "action": "agent.update",
  "actor": { ... },
  "data": {
    "agente_id": "123",
    "activo": true,
    "vacaciones": false,
    "estado": "Activo"
  }
}
```

**`agent.delete` - Eliminar agentes**

**Payload:**
```json
{
  "action": "agent.delete",
  "actor": { ... },
  "data": {
    "agente_id": "123"
  }
}
```

**Webhook:** `WEBHOOK_AGENTES_URL` → `https://n8n.red.com.sv/webhook/d804c804-9841-41f7-bc4b-66d2edeed53b`

#### 4. Gestión de Usuarios (`user.*`)

**`user.create` - Crear usuarios desde admin**

**Payload:**
```json
{
  "action": "user.create",
  "actor": { ... },
  "data": {
    "nombre": "María García",
    "email": "maria@intelfon.com",
    "password": "contraseña",
    "pais": "El_Salvador",
    "rol": "SUPERVISOR"
  }
}
```

**`user.read` - Consultar usuarios**

**`user.update` - Actualizar información de usuarios**

**`user.delete` - Eliminar usuarios**

**Webhook:** `WEBHOOK_CREAR_USUARIO_URL` → `https://n8n.red.com.sv/webhook/8679122d-c982-4cc8-92a9-7591ef887d61`

#### 5. Gestión de Categorías (`category.*`)

**`category.create` - Crear categoría**

**Payload:**
```json
{
  "action": "category.create",
  "actor": {
    "user_id": 0,
    "email": "admin@intelfon.com",
    "role": "ADMINISTRADOR"
  },
  "data": {
    "id": "",
    "category_name": "Soporte Técnico",
    "description": "Casos relacionados con problemas técnicos",
    "sla": "5"
  }
}
```

**`category.update` - Actualizar categoría**

**Payload:**
```json
{
  "action": "category.update",
  "actor": { ... },
  "data": {
    "id": "9",
    "category_name": "Soporte Técnico",
    "description": "Nueva descripción",
    "sla": "5"
  }
}
```

**`category.delete` - Eliminar categoría**

**Payload:**
```json
{
  "action": "category.delete",
  "actor": { ... },
  "data": {
    "id": "8"
  }
}
```

**`category.read` - Leer todas las categorías**

**Payload:**
```json
{
  "action": "category.read",
  "actor": { ... },
  "data": {
    "id": ""
  }
}
```

**Respuesta del webhook:**
```json
[
  {
    "data": [
      {
        "id": 2,
        "caegoria": "Facturación",
        "descripcion": "",
        "valor SLA": 5
      }
    ]
  }
]
```

**`category.query` - Buscar categoría por ID**

**Payload:**
```json
{
  "action": "category.query",
  "actor": { ... },
  "data": {
    "id": "9"
  }
}
```

**Webhook:** `WEBHOOK_CATEGORIAS_URL` → `https://n8n.red.com.sv/webhook/8c0719d8-1d51-47ce-a8df-73dbfeffc757`

#### 6. Round Robin

**Asignación automática:** El sistema utiliza webhooks para asignar casos automáticamente a agentes siguiendo el algoritmo Round Robin

**Webhook:** `WEBHOOK_ROUND_ROBIN_URL` → `https://n8n.red.com.sv/webhook-test/case-create-round-robin`

#### 7. Consulta de Clientes (`client.*`)

**Búsqueda de clientes:** Al crear o editar casos, el sistema consulta clientes mediante webhook

**Webhook:** `WEBHOOK_CLIENTES_URL` → `https://n8n.red.com.sv/webhook/b30aeff4-1d3a-4b40-b8da-141b4e1fc5b6`

### Formato de Comunicación

Todas las comunicaciones con webhooks utilizan:

- **Método:** POST (para operaciones que modifican datos)
- **Formato:** JSON
- **Autenticación:** Token JWT en el header `Authorization: Bearer <token>` (cuando aplica)
- **Timeout:** 30 segundos por defecto
- **CORS:** Configurado en el servidor n8n

### Manejo de Errores

El sistema maneja automáticamente:

- **Timeouts:** Si el webhook no responde en 30 segundos, se muestra un mensaje de error específico
- **Errores de CORS:** Si hay problemas de configuración del servidor, se informa al usuario con mensaje claro
- **Errores de validación:** Los errores del webhook se muestran de forma clara al usuario
- **Reintentos:** Algunas operaciones críticas pueden reintentar automáticamente
- **Fallbacks:** El sistema puede usar datos locales en caso de fallo del webhook (modo demo deshabilitado)

### Sincronización de Datos

- **Tiempo real:** Los cambios realizados se envían inmediatamente al webhook
- **Actualización automática:** Después de operaciones como crear o actualizar, el sistema consulta el webhook para obtener los datos actualizados
- **Cache local:** El sistema utiliza cache local (localStorage) para mejorar el rendimiento, pero siempre prioriza los datos del webhook
- **Invalidación de cache:** El cache se invalida automáticamente después de operaciones de escritura

### Ventajas de la Arquitectura con Webhooks

✅ **Escalabilidad:** El backend puede manejar múltiples instancias de la aplicación  
✅ **Seguridad:** La autenticación se centraliza en el webhook  
✅ **Flexibilidad:** Los cambios en la lógica de negocio se realizan en n8n sin modificar la aplicación  
✅ **Trazabilidad:** Todas las operaciones quedan registradas en el sistema backend  
✅ **Integración:** Fácil integración con otros sistemas y bases de datos  
✅ **Mantenimiento:** Separación clara entre frontend y backend

### Notas Importantes

- ⚠️ **Requiere conexión a internet:** El sistema necesita conexión activa para funcionar
- ⚠️ **Dependencia del servidor:** Si el servidor de webhooks (n8n) no está disponible, algunas operaciones no funcionarán
- ⚠️ **Timeout:** Las operaciones que tomen más de 30 segundos pueden fallar
- ✅ **Modo offline limitado:** Algunas vistas pueden mostrar datos en cache, pero las operaciones requieren conexión
- ✅ **Validación local:** El sistema valida datos localmente antes de enviar al webhook para mejor UX

---

## Consejos y Mejores Prácticas

### Para Agentes

✅ **Actualiza el estado regularmente:** Mantén el estado del caso actualizado para que el supervisor pueda ver el progreso

✅ **Agrega comentarios descriptivos:** Al cambiar el estado, explica brevemente qué se hizo o qué se necesita

✅ **Revisa casos pendientes:** Revisa regularmente casos en estado "Pendiente Cliente" para seguimiento

✅ **Usa las categorías correctas:** Selecciona la categoría adecuada para que el SLA se calcule correctamente. Si no estás seguro de qué categoría usar, consulta con tu supervisor o revisa las descripciones de las categorías (tooltips)

✅ **Completa la información del cliente:** Asegúrate de que los datos de contacto estén completos y correctos

✅ **Revisa el historial:** Antes de trabajar en un caso, revisa el historial para entender el contexto completo

### Para Supervisores

✅ **Monitorea casos críticos:** Revisa regularmente las alertas críticas y casos vencidos

✅ **Balancea la carga de trabajo:** Usa la reasignación para distribuir casos equitativamente entre agentes

✅ **Revisa métricas del panel:** El panel supervisor te da una vista rápida del estado general

✅ **Gestiona agentes activos:** Mantén actualizado el estado de los agentes (activo, inactivo, vacaciones)

✅ **Revisa el Round Robin:** Asegúrate de que el orden de asignación sea equitativo

✅ **Comunica cambios importantes:** Cuando reasignes casos, agrega comentarios explicando el motivo

### Para Gerentes

✅ **Revisa KPIs regularmente:** El panel ejecutivo te da una vista de alto nivel del rendimiento

✅ **Analiza tendencias:** Usa los gráficos para identificar patrones y áreas de mejora

✅ **Monitorea SLA:** Presta atención a los casos excedidos de SLA para identificar problemas sistémicos

✅ **Revisa insights automáticos:** El sistema genera recomendaciones basadas en los datos

✅ **Compara períodos:** Usa los filtros de período para comparar rendimiento entre diferentes tiempos

### Para Administradores

✅ **Configura categorías adecuadamente:** Define SLAs realistas según el tipo de caso. Recuerda que las categorías y SLAs son completamente configurables desde Settings > Categorías, no son fijas

✅ **Mantén el calendario de asuetos actualizado:** Los días festivos afectan el cálculo de SLA

✅ **Revisa estados y flujos:** Asegúrate de que las transiciones de estado sean lógicas

✅ **Gestiona usuarios activamente:** Mantén actualizada la lista de usuarios y sus roles

✅ **Monitorea el sistema:** Revisa regularmente el estado de los webhooks y la sincronización

✅ **Documenta cambios:** Cuando hagas cambios en la configuración, documenta el motivo

### General

✅ **Usa los filtros:** Los filtros te ayudan a encontrar casos específicos rápidamente

✅ **Actualiza la página cuando sea necesario:** Si no ves cambios recientes, usa el botón de actualizar

✅ **Revisa el historial:** El historial del caso contiene información valiosa sobre su evolución

✅ **Mantén datos actualizados:** Al editar casos, asegúrate de que la información del cliente esté correcta

✅ **Usa búsqueda inteligente:** La búsqueda encuentra resultados en múltiples campos simultáneamente

✅ **Revisa tooltips:** Los iconos de ayuda proporcionan información adicional sobre categorías y campos

✅ **Personaliza tu tema:** Elige el tema (oscuro/claro) que sea más cómodo para ti

---

## Solución de Problemas

### No puedo iniciar sesión

**Posibles causas y soluciones:**

- **Credenciales incorrectas:** Verifica que tu correo y contraseña sean correctos
- **Conexión a internet:** Asegúrate de tener conexión activa (el sistema requiere webhook)
- **Servidor no disponible:** Si el servidor de webhooks está caído, no podrás iniciar sesión
- **Token expirado:** Cierra sesión y vuelve a iniciar sesión

**Acciones:**
1. Usa la opción "¿Olvidaste tu contraseña?" para restablecerla
2. Verifica tu conexión a internet
3. Contacta al administrador si el problema persiste

### No veo mis casos

**Posibles causas y soluciones:**

- **Rol incorrecto:** Verifica que estés usando el rol correcto
- **Casos no asignados:** Los agentes solo ven casos asignados a ellos
- **Filtros activos:** Revisa si hay filtros aplicados que ocultan casos
- **Cache desactualizado:** Haz clic en el botón de actualizar

**Acciones:**
1. Verifica que estés en la vista correcta (Bandeja de Casos para agentes)
2. Los supervisores pueden ver todos los casos en "Bandeja Global"
3. Limpia los filtros y vuelve a buscar
4. Actualiza la página manualmente

### El caso no se actualiza

**Posibles causas y soluciones:**

- **Cambios no guardados:** Verifica que hayas hecho clic en "Guardar" o "Actualizar Estado"
- **Error de conexión:** El sistema requiere conexión para guardar cambios
- **Timeout del webhook:** Si el servidor tarda mucho, puede fallar la operación
- **Validación fallida:** Revisa que todos los campos requeridos estén completos

**Acciones:**
1. Haz clic en el botón de actualizar (refresh) en la bandeja
2. Espera unos segundos después de hacer cambios
3. Verifica tu conexión a internet
4. Revisa la consola del navegador (F12) para ver errores

### No puedo reasignar un caso

**Posibles causas y soluciones:**

- **Permisos insuficientes:** Solo los supervisores pueden reasignar casos
- **Caso en estado final:** Algunos estados finales no permiten reasignación
- **Sin agentes disponibles:** Debe haber al menos un agente activo

**Acciones:**
1. Verifica que tengas el rol de SUPERVISOR
2. Algunos casos pueden tener restricciones de reasignación según su estado
3. Asegúrate de que haya agentes activos disponibles

### Las categorías no aparecen

**Posibles causas y soluciones:**

- **Webhook no responde:** El servidor de categorías puede estar caído
- **Formato incorrecto:** El webhook puede estar retornando datos en formato inesperado
- **Cache desactualizado:** El sistema puede estar mostrando datos en cache

**Acciones:**
1. Recarga la página y activa la pestaña "Categorías" en Settings
2. Revisa la consola del navegador (F12) para ver logs de webhook
3. Contacta al administrador si el problema persiste

### Error al crear/editar categoría

**Posibles causas y soluciones:**

- **Campos incompletos:** Todos los campos requeridos deben estar completos
- **SLA inválido:** El SLA debe ser un número mayor o igual a 1
- **Webhook no disponible:** El servidor puede estar caído

**Acciones:**
1. Verifica que todos los campos requeridos estén completos
2. El SLA debe ser un número válido >= 1
3. Revisa la conexión a internet
4. Intenta nuevamente después de unos segundos

### No se cargan los usuarios

**Posibles causas y soluciones:**

- **Webhook no responde:** El servidor puede estar caído
- **Permisos insuficientes:** Solo administradores pueden ver todos los usuarios
- **Cache desactualizado:** Datos en cache pueden estar obsoletos

**Acciones:**
1. Verifica que tengas rol de ADMIN
2. Recarga la página
3. Revisa la consola del navegador para errores
4. Contacta al administrador del sistema

### El tema no se guarda

**Posibles causas y soluciones:**

- **LocalStorage deshabilitado:** Tu navegador puede tener localStorage deshabilitado
- **Modo incógnito:** En modo incógnito, el tema no se guarda entre sesiones
- **Cache del navegador:** Limpia el cache del navegador

**Acciones:**
1. Verifica la configuración de tu navegador
2. El tema se guarda en localStorage, asegúrate de que esté habilitado
3. En modo normal (no incógnito), el tema debería persistir

### Errores de CORS

**Posibles causas y soluciones:**

- **Configuración del servidor:** El servidor n8n debe tener CORS configurado correctamente
- **URL incorrecta:** Verifica que las URLs de webhook sean correctas

**Acciones:**
1. Este es un error del servidor, contacta al administrador
2. El mensaje de error indicará específicamente el problema de CORS
3. El administrador debe configurar CORS en el servidor n8n

---

## Soporte Técnico

Para problemas técnicos o preguntas sobre el sistema:

1. **Revisa este manual** - Muchas preguntas comunes están documentadas aquí
2. **Consulta la consola del navegador** - Presiona F12 y revisa la pestaña "Console" para ver errores
3. **Contacta al administrador** - Para problemas de configuración o acceso
4. **Reporta bugs** - Si encuentras un error, documenta los pasos para reproducirlo

### Información Útil para Reportar Problemas

Cuando reportes un problema, incluye:

- **Rol:** Tu rol en el sistema (Agente, Supervisor, Gerente, Admin)
- **Acción:** Qué estabas intentando hacer
- **Error:** Mensaje de error exacto (si hay)
- **Pasos:** Pasos para reproducir el problema
- **Navegador:** Navegador y versión que estás usando
- **Consola:** Errores de la consola del navegador (F12 > Console)

---

**Versión del Manual:** 2.0  
**Última Actualización:** Enero 2026  
**Sistema:** SAC (Sistema de Atención al Cliente)  
**Versión del Sistema:** 2.6
