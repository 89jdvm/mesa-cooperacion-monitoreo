# Glosario — Mesa de Cooperación Dashboard

Lenguaje plano para explicar cada pieza del sistema en la presentación.

---

## Conceptos de acceso e identidad

### Enlace mágico (magic link)
Un enlace personal que se envía por email a cada actor de la Mesa. Tiene una forma como:
```
https://mesa.../orellana/?actor=coordinacion-ambiental&token=XYZ123...
```

**Por qué "mágico":** al hacer clic, la persona entra automáticamente a su panel *Mi trabajo* sin necesidad de usuario ni contraseña. El sistema lo reconoce por el `token` (una firma única que solo tiene esa persona).

**Analogía:** es como cuando Netflix te manda un código de inicio de sesión por email — pero en lugar de un código, es un link único.

### Token
Un secreto único para cada actor. Parece una cadena larga al azar:
```
a7f3c5e9b1d2440a8f6b2c3e5d7a9b1c
```
**Para qué sirve:** es la prueba de que "soy yo" cuando hago clic desde mi enlace mágico. Si alguien no tiene el token correcto, el sistema no lo reconoce como ese actor.

**Importante:** cada token es privado. Si se filtra (por ejemplo, si alguien comparte su enlace), la ST puede invalidarlo y generar uno nuevo con `rotarTokenActor(nombre)`.

### Token-gated web form
**Traducción:** "formulario con candado por token".

**Qué es:** cuando un actor hace clic en "✅ Ya la completé" o "⚠ Tengo un bloqueador" en un email, se abre un formulario web (una mini-página alojada por Apps Script). Antes de aceptar cualquier respuesta, ese formulario verifica que el token del remitente sea válido. Si no lo es, rechaza la respuesta.

**Por qué importa:** sin esto, cualquiera podría marcar tareas como completas para otros actores. Con esto, solo el dueño del enlace mágico puede reportar en su nombre.

### Vista pública vs. Mi trabajo
- **Vista pública** (sin enlace mágico): cualquiera puede ver el Panel general, las Actividades y la Línea de Tiempo. Es solo lectura. No puede reportar ni cambiar nada.
- **Mi trabajo** (con enlace mágico): el actor ve su panel personalizado — sus actividades, su racha, su meta del trimestre. Puede reportar completitud y bloqueos.

---

## Conceptos de gamificación

### Podio · Avanzadores del mes
Los 3 actores que **más actividades completaron a tiempo** en el mes actual. Aparecen con nombre en el Panel público. **Solo reconocimiento positivo** — nunca aparece un "podio de atrasos" ni una lista de quien se quedó atrás.

### Submesas en carrera
Comparación visible entre las submesas (S1, S2, S3, etc.) mostrando el % de avance de cada una. La submesa líder recibe reconocimiento en la siguiente sesión del Grupo Gestor.

**Por qué así:** las comparaciones a nivel *equipo* (no individuo) generan orgullo de grupo sin exponer a nadie. Si una submesa va atrasada, es porque el equipo, no una persona, tiene que acelerar.

### Buscan apoyo
Las actividades atrasadas se presentan como **invitaciones** a colaborar, no como acusaciones. En lugar de decir "Coord X tiene 3 actividades atrasadas", el Panel dice "3 actividades en S2 buscan apoyo adicional".

**Efecto:** cambia la emoción de "el que no cumplió" a "vamos a ayudar al grupo".

### Racha (streak) personal
Cuenta cuántos meses consecutivos un actor entregó todo a tiempo, sin atrasos. **Solo visible para esa persona** (en su pestaña Mi trabajo). Nunca se hace público.

**Por qué privada:** motivación intrínseca, sin avergonzar a quien rompió su racha.

### Espejo social privado (estados A/B/C en Mi trabajo)
El saludo en Mi trabajo cambia según cómo va la persona:

- **Estado A** (podio): *"Estás en 1er lugar del podio. La Mesa completa te ve como referente."* Tono dorado, celebración.
- **Estado B** (vas bien): *"Una completada más y entras al podio."* Tono verde, motivador.
- **Estado C** (vas atrás): *"Tu submesa cayó al 2° lugar. Tu nombre no aparece en ningún listado público, solo la ST lo sabe. Camino de salida: pedir apoyo."* Tono sobrio, sin vergüenza, con salida clara.

**La idea:** decirle a la persona en privado lo que los demás ven en público. Presión social sin exposición.

---

## Conceptos del flujo de notificaciones

### Recordatorios diarios (4 niveles)
Cada día a las 6:30 AM (antes de la jornada laboral), el sistema revisa TODAS las actividades y manda email si corresponde uno de 4 tipos:

| Cuándo | Tipo | A quién | Tono |
|---|---|---|---|
| 7 días antes del plazo | Recordatorio amable | Responsable | Azul, informativo |
| Día del plazo | "Vence hoy" | Responsable | Amarillo, confirmar estado |
| 3 días de atraso | Advertencia | Responsable **+ copia a ST** | Naranja, aviso |
| 7 días de atraso | Escalación | Responsable **+ CSE + Presidencia** | Rojo, acción inmediata |

### Resumen semanal personal
Cada **lunes a las 6:30 AM**, cada actor recibe un email con sus propias actividades agrupadas en: urgentes (≤7 días), próximas (≤30 días), futuras. Incluye un link a su panel Mi trabajo.

**Propósito:** dar inicio a la semana con claridad, sin necesidad de ir al dashboard.

### Informe mensual al Grupo Gestor
El **día 1 de cada mes**, TODOS los miembros de la Mesa reciben un informe con:
- % global de avance de la hoja de ruta
- Totales: completadas, en progreso, atrasadas, por iniciar
- Tabla comparativa con barras de progreso por actor

**Propósito:** transparencia total y presión social positiva — los miembros ven el progreso de todos, los que avanzan son reconocidos, los que se quedan atrás lo saben sin que haya que decirlo.

### Cola de verificación
Cuando un actor reporta una actividad como completada (clic en "✅ Ya la completé" + envía evidencia), la actividad **no** se marca automáticamente como cerrada. Entra a una "cola de verificación" visible en la pestaña Actividades del dashboard de la ST.

**La ST revisa la evidencia** (archivo, acta, enlace a Drive) y solo entonces confirma el cierre. Es una segunda línea de defensa contra reportes falsos o apurados.

---

## Conceptos técnicos (sin tecnicismos)

### GitHub Pages
Un servicio gratuito de GitHub que publica archivos HTML en una URL pública. El dashboard vive ahí. No hay servidor que mantener ni base de datos.

### Google Apps Script
El lenguaje de macros de Google (tipo Excel macros, pero para Google Sheets). Gratis si usas una cuenta Gmail. Sirve para: enviar emails desde el Google Sheet, correr cada mañana automáticamente, recibir respuestas del formulario web.

### Google Sheet como base de datos
La hoja de cálculo de Google es la "base de datos" operativa de la Mesa. La ST edita ahí el estado de las actividades. Cuando alguien reporta completitud desde un email, los datos se escriben en esa hoja. Es simple, ya conocida, y no cuesta nada.

### Costo total del sistema: **$0**
Ninguna de las piezas cuesta dinero:
- GitHub: gratis para repositorios públicos.
- Google Pages, Sheets, Apps Script, Gmail: gratis con cualquier cuenta Google.
- Sin servidores, sin licencias, sin mantenimiento externo.

---

## Flujo típico de un actor (ejemplo: Coord. Ambiental)

1. **Día 1:** recibe su **enlace mágico** por email. Lo guarda en favoritos.
2. **Cada día:** si tiene alguna actividad próxima a vencer o atrasada, recibe un **recordatorio diario** apropiado.
3. **Cada lunes:** recibe su **resumen semanal** con todo lo pendiente.
4. **Termina una actividad:** hace clic en "✅ Ya la completé" en el email → se abre el **formulario** → sube enlace a evidencia → envía. La actividad entra a la **cola de verificación** de la ST.
5. **ST valida:** abre el Google Sheet, revisa evidencia, marca "Verificado Sí". La actividad pasa oficialmente a "Completada".
6. **Ese mes:** si completó varias a tiempo, entra al **podio**. Su nombre aparece público en el Panel. Su **racha personal** crece.
7. **Día 1 del mes siguiente:** recibe el **informe mensual** donde ve su actor destacado y cómo se compara con el resto.

Si el actor se queda atrás: recibe privadamente los escalones 2-4 de recordatorios. Su nombre **nunca** aparece en una lista pública de atrasados. Su submesa sí puede perder el liderato, pero eso es equipo, no individuo.

---

## Qué decir en 30 segundos al jefe

> "Monté un sistema de seguimiento con dos capas: (1) un **dashboard público** que todos los miembros pueden ver — transparencia total; (2) **emails automáticos** que llegan a cada actor con recordatorios diarios, resúmenes semanales y un informe mensual con ranking. Todo cuesta cero dólares, porque usa GitHub + Google gratis. La clave es que **nadie puede suplantar a nadie**: cada actor tiene su link mágico privado, y el sistema verifica su identidad antes de aceptar cualquier reporte."

## Qué decir en 10 segundos

> "Dashboard público + emails automatizados con recordatorios, resúmenes y escalamientos. Con identidad verificada por link mágico. Costo cero."
