# Manejo de Archivos Adjuntos en Webhook

## Formato de Envío al Webhook

### Opción 1: Base64 (Recomendado para archivos pequeños/medianos)

Cuando el usuario adjunta un archivo, se convierte a Base64 y se envía en el payload del webhook:

```json
{
  "action": "case.update",
  "actor": {
    "user_id": 123,
    "email": "usuario@ejemplo.com",
    "role": "AGENTE"
  },
  "data": {
    "case_id": "CASO-0001",
    "estado": "Resuelto",
    "parametros": {
      "adjuntos": [
        {
          "nombre_archivo": "documento.pdf",
          "tipo_mime": "application/pdf",
          "tamaño_bytes": 245678,
          "contenido_base64": "JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDQgMCBSCi9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVAovRjggMTIgVGYKNzAgNzUwIFRkCihIZWxsbyBXb3JsZCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1NCAwMDAwMCBuIAowMDAwMDAwMTIwIDAwMDAwIG4gCjAwMDAwMDAxNzcgMDAwMDAgbiAKMDAwMDAwMDI0NCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjMyNAolJUVPRgo=",
          "fecha_subida": "2024-01-15T10:30:00Z",
          "subido_por": {
            "user_id": 123,
            "email": "usuario@ejemplo.com",
            "nombre": "Juan Pérez"
          }
        }
      ]
    }
  }
}
```

### Opción 2: URL de Almacenamiento (Recomendado para archivos grandes)

El webhook almacena el archivo y retorna una URL para accederlo:

```json
{
  "action": "case.update",
  "actor": {
    "user_id": 123,
    "email": "usuario@ejemplo.com",
    "role": "AGENTE"
  },
  "data": {
    "case_id": "CASO-0001",
    "estado": "Resuelto",
    "parametros": {
      "adjuntos": [
        {
          "archivo_id": "ARCH-20240115-001",
          "nombre_archivo": "documento.pdf",
          "tipo_mime": "application/pdf",
          "tamaño_bytes": 245678,
          "url_descarga": "https://storage.ejemplo.com/archivos/CASO-0001/ARCH-20240115-001.pdf",
          "url_temporal": "https://storage.ejemplo.com/temp/abc123xyz?expires=2024-01-16T10:30:00Z",
          "fecha_subida": "2024-01-15T10:30:00Z",
          "subido_por": {
            "user_id": 123,
            "email": "usuario@ejemplo.com",
            "nombre": "Juan Pérez"
          }
        }
      ]
    }
  }
}
```

## Proceso en el Frontend

### 1. Capturar el archivo del input

```typescript
const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validar tamaño (ej: máximo 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    alert('El archivo es demasiado grande. Máximo 10MB');
    return;
  }

  // Validar tipo de archivo
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword'];
  if (!allowedTypes.includes(file.type)) {
    alert('Tipo de archivo no permitido');
    return;
  }

  // Convertir a Base64
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64String = reader.result as string;
    // Remover el prefijo "data:application/pdf;base64,"
    const base64Content = base64String.split(',')[1];
    
    // Preparar para enviar al webhook
    const archivoData = {
      nombre_archivo: file.name,
      tipo_mime: file.type,
      tamaño_bytes: file.size,
      contenido_base64: base64Content
    };
    
    // Agregar a los parámetros del caso
    setParametrosAdjuntos([...parametrosAdjuntos, archivoData]);
  };
  reader.readAsDataURL(file);
};
```

### 2. Enviar al webhook

```typescript
const enviarCasoConAdjuntos = async () => {
  const payload = {
    action: "case.update",
    actor: {
      user_id: usuario.id,
      email: usuario.email,
      role: usuario.role
    },
    data: {
      case_id: casoId,
      estado: nuevoEstado,
      parametros: {
        adjuntos: parametrosAdjuntos.map(adj => ({
          nombre_archivo: adj.nombre_archivo,
          tipo_mime: adj.tipo_mime,
          tamaño_bytes: adj.tamaño_bytes,
          contenido_base64: adj.contenido_base64
        }))
      }
    }
  };

  await api.callWebhook(payload);
};
```

## Proceso en el Webhook (n8n/Backend)

### 1. Recibir y almacenar el archivo

```javascript
// En n8n o backend
const archivos = webhookData.data.parametros.adjuntos || [];

for (const archivo of archivos) {
  // Opción A: Guardar Base64 directamente en base de datos
  await db.insert('archivos_adjuntos', {
    case_id: webhookData.data.case_id,
    nombre_archivo: archivo.nombre_archivo,
    tipo_mime: archivo.tipo_mime,
    tamaño_bytes: archivo.tamaño_bytes,
    contenido_base64: archivo.contenido_base64,
    fecha_subida: new Date(),
    subido_por: webhookData.actor.user_id
  });

  // Opción B: Convertir Base64 a archivo y guardar en storage
  const buffer = Buffer.from(archivo.contenido_base64, 'base64');
  const archivoId = `ARCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const rutaArchivo = `/storage/casos/${webhookData.data.case_id}/${archivoId}.${archivo.nombre_archivo.split('.').pop()}`;
  
  await storage.save(rutaArchivo, buffer);
  
  await db.insert('archivos_adjuntos', {
    archivo_id: archivoId,
    case_id: webhookData.data.case_id,
    nombre_archivo: archivo.nombre_archivo,
    tipo_mime: archivo.tipo_mime,
    tamaño_bytes: archivo.tamaño_bytes,
    ruta_archivo: rutaArchivo,
    url_descarga: `https://api.ejemplo.com/archivos/${archivoId}/descargar`,
    fecha_subida: new Date(),
    subido_por: webhookData.actor.user_id
  });
}
```

### 2. Retornar información del archivo guardado

```json
{
  "success": true,
  "archivos_guardados": [
    {
      "archivo_id": "ARCH-20240115-001",
      "nombre_archivo": "documento.pdf",
      "url_descarga": "https://api.ejemplo.com/archivos/ARCH-20240115-001/descargar",
      "tamaño_bytes": 245678
    }
  ]
}
```

## Recuperar y Descargar Archivos

### 1. Obtener lista de archivos del caso

```typescript
// Llamada al webhook para obtener archivos
const obtenerArchivos = async (caseId: string) => {
  const response = await api.callWebhook({
    action: "archivo.list",
    actor: { ...usuario },
    data: {
      case_id: caseId
    }
  });

  return response.archivos; // Array de archivos
};
```

### 2. Respuesta del webhook con archivos

```json
{
  "success": true,
  "archivos": [
    {
      "archivo_id": "ARCH-20240115-001",
      "nombre_archivo": "documento.pdf",
      "tipo_mime": "application/pdf",
      "tamaño_bytes": 245678,
      "url_descarga": "https://api.ejemplo.com/archivos/ARCH-20240115-001/descargar",
      "fecha_subida": "2024-01-15T10:30:00Z",
      "subido_por": {
        "user_id": 123,
        "nombre": "Juan Pérez"
      }
    }
  ]
}
```

### 3. Descargar archivo desde el frontend

```typescript
const descargarArchivo = async (archivoId: string, nombreArchivo: string) => {
  try {
    // Opción A: Si el webhook retorna Base64
    const response = await api.callWebhook({
      action: "archivo.get",
      actor: { ...usuario },
      data: {
        archivo_id: archivoId
      }
    });

    // Convertir Base64 a Blob y descargar
    const byteCharacters = atob(response.contenido_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: response.tipo_mime });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    // Opción B: Si el webhook retorna URL directa
    // window.open(response.url_descarga, '_blank');
    
  } catch (error) {
    console.error('Error al descargar archivo:', error);
    alert('Error al descargar el archivo');
  }
};
```

## Recomendaciones

1. **Para archivos pequeños (< 5MB)**: Usar Base64 directamente
2. **Para archivos grandes (> 5MB)**: Usar almacenamiento en servidor y URLs
3. **Validar tipos de archivo** en el frontend antes de enviar
4. **Limitar tamaño máximo** (ej: 10MB por archivo)
5. **Generar IDs únicos** para cada archivo (ej: `ARCH-{timestamp}-{random}`)
6. **Incluir metadatos**: nombre, tipo, tamaño, fecha, usuario
7. **Implementar expiración** para URLs temporales si es necesario
8. **Comprimir archivos grandes** antes de enviar si es posible

## Estructura de Base de Datos Sugerida

```sql
CREATE TABLE archivos_adjuntos (
  archivo_id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  tipo_mime VARCHAR(100) NOT NULL,
  tamaño_bytes INT NOT NULL,
  ruta_archivo VARCHAR(500), -- Si se guarda en filesystem
  contenido_base64 TEXT, -- Si se guarda en BD (solo para archivos pequeños)
  url_descarga VARCHAR(500),
  fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subido_por INT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES casos(case_id),
  FOREIGN KEY (subido_por) REFERENCES usuarios(user_id)
);
```
