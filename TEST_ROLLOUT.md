# Test Rollout — Mesa de Cooperación

End-to-end self-test del sistema de notificaciones. Todo llega a **delftjd@gmail.com**. Tiempo estimado: **20–30 minutos**.

## Pre-requisitos
- Cuenta Google con acceso a Gmail, Google Sheets, Apps Script
- Archivos de este proyecto:
  - `orellana_actividades.csv`
  - `sucumbios_actividades.csv`
  - `apps-script/Code.gs`
  - `apps-script/actores_plantilla.csv`

---

## Paso 1 — Crear el Google Sheet (5 min)

1. Abre [sheets.new](https://sheets.new). Nombra el documento: **Mesa de Cooperación — TEST**
2. En la pestaña por defecto:
   - Archivo → Importar → Subir → `orellana_actividades.csv`
   - "Importar datos": **Reemplazar hoja de cálculo** → Importar
   - Renombrar pestaña a exactamente: `Orellana`
3. Crear nueva pestaña (+ abajo a la izquierda):
   - Archivo → Importar → `sucumbios_actividades.csv`
   - **Insertar nuevas hojas** → Importar
   - Renombrar a: `Sucumbíos` (con tilde — es importante, el script lo busca así)
4. Crear otra pestaña → Importar `apps-script/actores_plantilla.csv` → insertar nueva hoja → renombrar a: `Actores`
5. En la pestaña **Actores**, columna B (email): pegar `delftjd@gmail.com` **en todas las filas** (selecciona B2:B26 y pega)
6. Crear pestaña vacía `Log` → fila 1 encabezados: `fecha | id | provincia | accion | detalle`
7. Crear pestaña vacía `Config` (reserva)

## Paso 2 — Copiar el ID del Sheet (30 seg)

El ID está en la URL entre `/d/` y `/edit`:
```
https://docs.google.com/spreadsheets/d/AQUI_VA_EL_ID/edit
```
Cópialo. Lo usarás en el paso 4.

## Paso 3 — Abrir Apps Script (1 min)

En el Sheet: **Extensiones → Apps Script**. Se abre un nuevo editor. Borra el contenido de `Code.gs` (la función vacía por defecto).

## Paso 4 — Pegar y configurar Code.gs (2 min)

1. Abre `mesa-cooperacion-dashboard/apps-script/Code.gs` en tu editor local
2. Copia todo el contenido
3. Pégalo en el editor de Apps Script (reemplazando lo que había)
4. En la línea `SHEET_ID: ''`, pega el ID del paso 2:
   ```javascript
   SHEET_ID: 'ID_QUE_COPIASTE_DEL_PASO_2'
   ```
5. Guardar con `Cmd+S`. Dale nombre al proyecto: `Mesa-Cooperacion-Test`

## Paso 5 — Desplegar Web App (2 min)

1. Arriba a la derecha: **Implementar → Nueva implementación**
2. ⚙️ (rueda) → **Aplicación web**
3. Configurar:
   - Descripción: `Formulario confirmación test`
   - Ejecutar como: **Yo (tu email)**
   - Acceso: **Cualquier usuario**
4. **Implementar** → Autorizar permisos (Gmail + Sheets) → revisar permisos → Ir a Mesa-Cooperacion-Test (no seguro) → Permitir
5. **Copiar URL de la aplicación web**
6. Volver al editor → en `Code.gs`, actualizar:
   ```javascript
   FORMULARIO_URL: 'URL_DEL_WEB_APP_QUE_COPIASTE'
   ```
7. `Cmd+S` para guardar

## Paso 6 — Probar cada tipo de email (5 min)

En el editor de Apps Script, en el dropdown superior (junto al botón "Ejecutar"), selecciona y ejecuta:

### 6.1 Recordatorios diarios
- Seleccionar `enviarRecordatoriosDiarios` → **Ejecutar**
- Revisa tu inbox. Deberías recibir emails para actividades:
  - que vencen en 7 días (recordatorio)
  - que vencen hoy (vencimiento)
  - con 3 días de atraso (advertencia)
  - con 7 días de atraso (escalación)

> ⚠ Si no recibes nada, es porque ninguna actividad cae exactamente en esos días. El paso 7 te permite forzar un envío de cada tipo.

### 6.2 Resumen semanal
- Seleccionar `enviarResumenSemanal` → **Ejecutar**
- Recibirás 1 email con tus actividades de la semana (como "delftjd" figura en todas las filas de Actores, recibirás 1 email por cada actor distinto — hasta ~26 emails; puedes reducir dejando emails en solo 3–5 filas de prueba)

### 6.3 Informe mensual
- Seleccionar `enviarInformeMensual` → **Ejecutar**
- Recibirás 1 email con el informe global por provincia

### 6.4 Formulario de confirmación
- Abre cualquiera de los emails recibidos → click en **"✅ Ya la completé"**
- Llenar el formulario → enviar
- Verificar en el Sheet (pestaña Orellana o Sucumbíos) que la columna `estado` cambió a "Reportada — pendiente verificación ST"
- Verificar en la pestaña `Log` que quedó registrado

## Paso 7 — (Opcional) Crear triggers automáticos

Solo si quieres que los emails se envíen solos cada día/semana/mes:
- Seleccionar `crearTriggers` → **Ejecutar**
- Confirma los permisos
- En el Apps Script: reloj ⏰ a la izquierda → verificar que aparecen 3 triggers

Para el test inicial **no hace falta** — puedes correr las funciones manualmente.

---

## Checklist de validación ✅

Márcate como OK cada punto cuando lo hayas confirmado:

- [ ] Recibo email tipo "recordatorio 7 días"
- [ ] Recibo email tipo "vence hoy"
- [ ] Recibo email tipo "advertencia atraso"
- [ ] Recibo email tipo "escalación"
- [ ] Recibo resumen semanal con tabla de actividades
- [ ] Recibo informe mensual con barras de progreso por actor
- [ ] El botón "Ya la completé" abre un formulario funcional
- [ ] Al enviar el formulario, el Sheet se actualiza (estado + fecha_reporte + enlace_evidencia)
- [ ] La ST (= delftjd@gmail.com) recibe notificación de la auto-confirmación
- [ ] El registro queda en la pestaña Log

## Troubleshooting

**No recibo emails:** Revisa spam. Revisa que `SHEET_ID` está correcto. Revisa ejecuciones en Apps Script → "Ejecuciones" a la izquierda.

**"Hoja no encontrada":** Verifica que los nombres de pestañas son exactamente `Orellana` y `Sucumbíos` (con tilde). No `Sucumbios` sin tilde.

**Cuota de email excedida:** Gmail gratuito permite 100 emails/día vía Apps Script. Si pasaste el límite en testing, espera 24h o reduce los actores en la pestaña Actores.

**Formulario da error al enviar:** Probablemente olvidaste guardar `FORMULARIO_URL` después del paso 5.6. Vuelve a guardar y prueba.

## Cleanup post-test

Cuando acabe la validación:
1. Borra todos los triggers (si creaste): Apps Script → Triggers ⏰ → borrar los 3
2. Conserva el Sheet — se convertirá en el de producción, solo hay que cambiar los emails reales en `Actores` cuando los tengas
3. El deployment del Web App sigue vivo; si quieres pausarlo: Implementar → Administrar implementaciones → Archivar
