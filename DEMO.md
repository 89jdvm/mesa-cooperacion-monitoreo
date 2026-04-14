# Demo — Mesa de Cooperación Dashboard

## URLs públicas (cualquier persona puede ver)

| Vista | URL |
|---|---|
| Landing | https://89jdvm.github.io/mesa-cooperacion-monitoreo/ |
| Panel de Orellana | https://89jdvm.github.io/mesa-cooperacion-monitoreo/orellana/ |
| Panel de Sucumbíos | https://89jdvm.github.io/mesa-cooperacion-monitoreo/sucumbios/ |

Todas las vistas públicas son de solo lectura: Panel (scorecard + gamificación), Actividades (tabla filtrable), Línea de Tiempo (Gantt por submesa).

## URLs privadas de demo (Mi trabajo con acceso personal)

Cada actor recibirá un enlace personal con un token único. Para el demo, sembramos estos tokens:

**Orellana — Coordinación General de Gestión Ambiental (Submesa S1):**
```
https://89jdvm.github.io/mesa-cooperacion-monitoreo/orellana/?actor=coordinacion-general-de-gestion-ambiental&token=DEMO2026-ORL-S1#mi-trabajo
```

**Sucumbíos — Dirección Gestión Ambiental (Submesa S1):**
```
https://89jdvm.github.io/mesa-cooperacion-monitoreo/sucumbios/?actor=direccion-gestion-ambiental-gadps&token=DEMO2026-SUC-S1#mi-trabajo
```

Con un enlace personal, aparece:
- La pestaña **Mi trabajo** (saludo personalizado, racha, meta del trimestre, agenda, standing de la submesa).
- Botones de acción en las actividades (una vez configurado el formulario de Apps Script).
- Opción de "Cerrar sesión" arriba a la derecha.

Sin un enlace personal (vista pública):
- No aparece la pestaña Mi trabajo.
- No hay manera de escoger una identidad desde la UI — previene impersonación.

## Para el rollout real

1. Revocar los tokens de demo y regenerar reales:
   - En el Google Sheet (hoja Actores), borrar las celdas de token `DEMO2026-*`.
   - Ejecutar `generarTokensParaActores()` en Apps Script para crear UUIDs únicos.
2. Llenar la columna `email` en la hoja Actores con los correos reales.
3. Ejecutar `enviarEnlacesMagicos()` para mandarle a cada actor su URL personal.
4. Después: `crearTriggers()` para activar los recordatorios automáticos diarios/semanales/mensuales.

## Arquitectura de seguridad

- El dashboard es estático (GitHub Pages). No hay servidor.
- La identidad se verifica mediante el par `(?actor=<slug>&token=<uuid>)` en la URL contra una lista pública de actores + tokens (el archivo `apps-script/actores_plantilla.csv`, que se reemplaza con la versión con tokens poblada).
- Las acciones (reportar completada, reportar bloqueador) se envían al Web App de Apps Script, que verifica el token server-side antes de aceptar — previene reportes fraudulentos.
- La Secretaría Técnica sigue verificando todo reporte de completitud manualmente en la hoja — segunda línea de defensa.
- Rotación de tokens: si un enlace se filtra, ejecutar `rotarTokenActor(nombre)` para invalidar el viejo y emitir uno nuevo.
