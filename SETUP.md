# Guía de Configuración — Mesa de Cooperación Dashboard

## Paso 1: Crear la cuenta Gmail

1. Crear `mesa.cooperacion.monitoreo@gmail.com`
2. Esta cuenta será dueña del Google Sheet y del Apps Script

## Paso 2: Crear el Google Sheet

1. Inicia sesión con la cuenta de monitoreo
2. Crea un nuevo Google Sheet: "Mesa de Cooperación — Seguimiento"
3. Importa los datos:
   - **Hoja "Orellana"**: Archivo > Importar > `orellana_actividades.csv` → Insertar en hoja actual
   - Renombra la hoja a "Orellana"
   - **Hoja "Sucumbíos"**: + Nueva hoja > Importar > `sucumbios_actividades.csv`
   - Renombra a "Sucumbíos"
   - **Hoja "Actores"**: + Nueva hoja > Importar > `actores_plantilla.csv`
   - **Completa los emails** de cada actor en la columna B
   - **Hoja "Log"**: Crear hoja vacía, nombrar "Log"
   - Agregar headers: `fecha | id | provincia | accion | detalle`
   - **Hoja "Config"**: Crear hoja vacía, nombrar "Config" (reserva para futuro)

4. Publicar el Sheet como JSON:
   - Archivo > Compartir > Publicar en la web
   - Seleccionar cada hoja (Orellana, Sucumbíos) > Formato: CSV
   - Copiar los enlaces generados

## Paso 3: Configurar el Apps Script

1. En el Google Sheet: Extensiones > Apps Script
2. Borrar el contenido por defecto
3. Pegar el contenido de `apps-script/Code.gs`
4. En la línea `SHEET_ID: ''`, pegar el ID del Sheet:
   - El ID está en la URL: `docs.google.com/spreadsheets/d/{ESTE_ES_EL_ID}/edit`
5. Guardar (Ctrl+S)
6. Ejecutar la función `crearTriggers`:
   - Seleccionar `crearTriggers` en el dropdown
   - Click en "Ejecutar"
   - Autorizar los permisos (Gmail + Sheets)
7. Desplegar como Web App (para el formulario de confirmación):
   - Implementar > Nueva implementación
   - Tipo: Aplicación web
   - Ejecutar como: Yo
   - Acceso: Cualquier persona
   - Click en "Implementar"
   - Copiar la URL del web app

8. Actualizar `CONFIG.FORMULARIO_URL` con la URL del web app

## Paso 4: Subir el Dashboard a GitHub

1. Crear repositorio: `89jdvm/mesa-cooperacion`
2. Subir la carpeta `mesa-cooperacion-dashboard/`:

```bash
cd mesa-cooperacion-dashboard
git init
git add index.html orellana/ sucumbios/ shared/
git commit -m "Dashboard inicial — Mesa de Cooperación"
git remote add origin https://github.com/89jdvm/mesa-cooperacion.git
git branch -M main
git push -u origin main
```

3. Activar GitHub Pages:
   - Settings > Pages > Source: Deploy from branch > main > / (root)
   - Esperar ~2 minutos
   - URLs:
     - `https://89jdvm.github.io/mesa-cooperacion/` (landing)
     - `https://89jdvm.github.io/mesa-cooperacion/orellana/` (Orellana)
     - `https://89jdvm.github.io/mesa-cooperacion/sucumbios/` (Sucumbíos)

## Paso 5: Conectar Dashboard al Google Sheet (opcional, para datos en vivo)

Si quieres que el dashboard lea directamente del Sheet publicado en vez del JSON local:

En `shared/js/dashboard.js`, cambiar la línea de `initDashboard()` en cada `index.html`:

```javascript
// En vez de:
initDashboard('data/actividades.json');

// Usar la URL del Sheet publicado como CSV:
initDashboard('URL_DEL_SHEET_PUBLICADO');
```

Nota: Esto requiere un pequeño parser CSV→JSON. Por defecto el dashboard usa los JSON locales, que se pueden actualizar periódicamente con un git push.

## Paso 6: Testing

1. Ejecutar `enviarRecordatoriosDiarios` manualmente desde Apps Script
2. Verificar que los emails llegan correctamente
3. Probar el formulario web abriendo la URL del web app
4. Verificar que los datos se escriben en el Sheet

## Mantenimiento

- **Actualizar estados**: La ST abre el Google Sheet y cambia la columna "estado"
- **Verificar reportes**: Cuando alguien marca como completada desde el email, la ST recibe notificación y verifica en el Sheet
- **Actualizar dashboard**: Exportar datos del Sheet → actualizar JSON → git push
- **Agregar actores**: Agregar filas en la hoja "Actores"
