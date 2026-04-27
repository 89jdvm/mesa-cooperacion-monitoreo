/* ============================================================
   Mesa de Cooperación — Motor de Emails Automatizados
   Google Apps Script · Pegar en script.google.com

   Configuración:
   1. Crear un Google Sheet con las hojas: Sucumbíos, Actores, Log, Config
   2. Pegar este script en Extensiones > Apps Script
   3. Configurar triggers (ver función crearTriggers)
   ============================================================ */

// ---- CONFIGURACIÓN ----
const CONFIG = {
  SHEET_ID: '', // <-- Pegar ID del Google Sheet aquí
  EMAIL_REMITENTE_NOMBRE: 'Mesa de Cooperación — Monitoreo',
  DASHBOARD_URL_SUCUMBIOS: 'https://89jdvm.github.io/mesa-cooperacion-monitoreo/sucumbios/',
  DIAS_ANTES_RECORDATORIO: 7,
  DIAS_ANTES_ESCALACION_WARNING: 3,
  DIAS_ANTES_ESCALACION: 7,
  FORMULARIO_URL: '' // Se genera automáticamente con doGet
};

// ---- TRIGGERS (ejecutar una vez para configurar) ----
function crearTriggers() {
  // Eliminar triggers existentes
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Diario a las 6:30am ECT (UTC-5 = 11:30 UTC)
  ScriptApp.newTrigger('enviarRecordatoriosDiarios')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .nearMinute(30)
    .create();

  // Lunes a las 6:30am — resumen semanal
  ScriptApp.newTrigger('enviarResumenSemanal')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(6)
    .nearMinute(30)
    .create();

  // Día 1 de cada mes — informe mensual
  ScriptApp.newTrigger('verificarInformeMensual')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  Logger.log('Triggers creados exitosamente');
}

// ---- FUNCIONES PRINCIPALES ----

/**
 * Envía recordatorios diarios:
 * - 7 días antes del plazo
 * - Día del plazo
 * - 3 días de atraso (con advertencia de escalación)
 * - 7+ días de atraso (escalación a CSE/Presidencia)
 */
function enviarRecordatoriosDiarios() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const provincia = 'Sucumbíos';

  const hoja = ss.getSheetByName(provincia);
  if (!hoja) return;

  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const colIndices = getColumnIndices(headers);

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const estado = fila[colIndices.estado];

    // Saltar completadas y reportadas (pendientes de verificación ST)
    if (estado === 'Completado') continue;
    if (estado === 'Reportada — pendiente verificación ST') continue;

    const fechaLimite = new Date(fila[colIndices.fecha_limite]);
    fechaLimite.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
    const actorTexto = fila[colIndices.lidera_apoya];
    const actividad = fila[colIndices.hito_operativo];
    const id = fila[colIndices.id];
    const que = fila[colIndices.que_se_hace];
    const producto = fila[colIndices.producto_verificable];
    const evidencia = fila[colIndices.evidencia_minima];

    // Each actor gets a personalised formUrl with their (slug, token)
    // so the submit form passes verificarToken on the server side.
    const actores = obtenerActoresParaActividad(ss, actorTexto, provincia);
    if (actores.length === 0) continue;

    // 7 días antes
    if (diasRestantes === CONFIG.DIAS_ANTES_RECORDATORIO) {
      actores.forEach(a => {
        enviarEmail([a.email], {
          asunto: `📋 Recordatorio: "${actividad}" vence el ${formatDate(fechaLimite)}`,
          cuerpo: generarEmailRecordatorio({
            provincia, actividad, que, producto, evidencia, actorTexto,
            fechaLimite, diasRestantes,
            dashUrl: getDashUrlForActor(provincia, a.slug, a.token, id),
            formUrl: getFormUrl(id, a.slug, a.token),
            tipo: 'recordatorio'
          })
        });
      });
      registrarLog(ss, id, provincia, 'Recordatorio 7 días', actores.map(a => a.email).join(', '));
    }

    // Día del plazo
    if (diasRestantes === 0) {
      actores.forEach(a => {
        enviarEmail([a.email], {
          asunto: `⏰ Hoy vence: "${actividad}" — confirma su estado`,
          cuerpo: generarEmailRecordatorio({
            provincia, actividad, que, producto, evidencia, actorTexto,
            fechaLimite, diasRestantes,
            dashUrl: getDashUrlForActor(provincia, a.slug, a.token, id),
            formUrl: getFormUrl(id, a.slug, a.token),
            tipo: 'vencimiento'
          })
        });
      });
      registrarLog(ss, id, provincia, 'Aviso día de vencimiento', actores.map(a => a.email).join(', '));
    }

    // 3 días de atraso — advertencia de escalación
    if (diasRestantes === -CONFIG.DIAS_ANTES_ESCALACION_WARNING) {
      hoja.getRange(i + 1, colIndices.estado + 1).setValue('Atrasado');

      actores.forEach(a => {
        enviarEmail([a.email], {
          asunto: `📌 Actividad pendiente: "${actividad}" — ${Math.abs(diasRestantes)} días de atraso`,
          cuerpo: generarEmailRecordatorio({
            provincia, actividad, que, producto, evidencia, actorTexto,
            fechaLimite, diasRestantes,
            dashUrl: getDashUrlForActor(provincia, a.slug, a.token, id),
            formUrl: getFormUrl(id, a.slug, a.token),
            tipo: 'atraso_warning'
          })
        });
      });
      // Notify ST in copy (no actionable buttons — informational)
      const emailsST = obtenerEmailsST(ss, provincia);
      if (emailsST.length) {
        enviarEmail(emailsST, {
          asunto: `[ST] Atraso 3 días: "${actividad}" en ${provincia}`,
          cuerpo: `<p>La actividad <strong>${actividad}</strong> (${id}) está atrasada 3 días. Asignada a: ${actorTexto}.</p>`
        });
      }
      registrarLog(ss, id, provincia, 'Advertencia atraso (3 días)', actores.map(a => a.email).join(', '));
    }

    // 7+ días de atraso — escalación
    if (diasRestantes === -CONFIG.DIAS_ANTES_ESCALACION) {
      actores.forEach(a => {
        enviarEmail([a.email], {
          asunto: `🔴 Escalación: "${actividad}" — ${Math.abs(diasRestantes)} días de atraso`,
          cuerpo: generarEmailRecordatorio({
            provincia, actividad, que, producto, evidencia, actorTexto,
            fechaLimite, diasRestantes,
            dashUrl: getDashUrlForActor(provincia, a.slug, a.token, id),
            formUrl: getFormUrl(id, a.slug, a.token),
            tipo: 'escalacion'
          })
        });
      });
      const emailsST = obtenerEmailsST(ss, provincia);
      const emailsCSE = obtenerEmailsCSE(ss, provincia);
      const escalados = [...new Set([...emailsST, ...emailsCSE])];
      if (escalados.length) {
        enviarEmail(escalados, {
          asunto: `[ESCALACIÓN] "${actividad}" en ${provincia} — 7 días de atraso`,
          cuerpo: `<p>La actividad <strong>${actividad}</strong> (${id}) está atrasada 7 días. Asignada a: ${actorTexto}. Requiere intervención de la CSE / Presidencia.</p>`
        });
      }
      registrarLog(ss, id, provincia, 'ESCALACIÓN a CSE/Presidencia', actores.map(a => a.email).join(', '));
    }
  }
}

/**
 * Envía resumen semanal personalizado cada lunes.
 */
function enviarResumenSemanal() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const actoresHoja = ss.getSheetByName('Actores');
  if (!actoresHoja) return;

  const actoresData = actoresHoja.getDataRange().getValues();
  const hoy = new Date();

  for (let i = 1; i < actoresData.length; i++) {
    const nombre = actoresData[i][0];
    const email = actoresData[i][1];
    const provincia = actoresData[i][3];
    const token = actoresData[i][4];

    if (!email) continue;

    // Obtener actividades de este actor
    const hoja = ss.getSheetByName(provincia);
    if (!hoja) continue;

    const datos = hoja.getDataRange().getValues();
    const headers = datos[0];
    const colIndices = getColumnIndices(headers);

    // Match against the institutional base, not the raw nombre — otherwise
    // "Inst — Person" suffixed actors never match `lidera_apoya` cells which
    // hold only the institutional label.
    const baseNombre = actorBaseName(nombre);
    const misActividades = [];
    for (let j = 1; j < datos.length; j++) {
      const fila = datos[j];
      const la = fila[colIndices.lidera_apoya];
      if (la.includes(baseNombre) || actorCoincide(la, baseNombre)) {
        if (fila[colIndices.estado] !== 'Completado') {
          const fechaLimite = new Date(fila[colIndices.fecha_limite]);
          const diasRestantes = Math.ceil((fechaLimite - hoy) / (1000 * 60 * 60 * 24));
          misActividades.push({
            actividad: fila[colIndices.hito_operativo],
            estado: fila[colIndices.estado],
            fechaLimite: fechaLimite,
            diasRestantes: diasRestantes,
            trimestre: fila[colIndices.trimestre]
          });
        }
      }
    }

    if (misActividades.length === 0) continue;

    // Ordenar por fecha límite
    misActividades.sort((a, b) => a.fechaLimite - b.fechaLimite);

    const dashUrl = getDashUrlForActor(provincia, slugify(nombre), token);

    const cuerpo = generarEmailSemanal(nombre, provincia, misActividades, dashUrl);

    enviarEmail([email], {
      asunto: `📊 Tu semana — Mesa de Cooperación de ${provincia}`,
      cuerpo: cuerpo
    });
  }

  registrarLog(ss, 'GLOBAL', 'Sucumbíos', 'Resumen semanal enviado', 'Todos los actores');
}

/**
 * Verifica si hoy es día 1 del mes y envía informe mensual.
 */
function verificarInformeMensual() {
  const hoy = new Date();
  if (hoy.getDate() !== 1) return;
  enviarInformeMensual();
}

/**
 * Envía informe mensual a TODOS los stakeholders.
 */
function enviarInformeMensual() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const provincia = 'Sucumbíos';

  const hoja = ss.getSheetByName(provincia);
  if (!hoja) return;

  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const colIndices = getColumnIndices(headers);

  // Calcular estadísticas
  const total = datos.length - 1;
  let completadas = 0, atrasadas = 0, enProgreso = 0, pendientes = 0;
  const actoresStats = {};

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const estado = fila[colIndices.estado];
    const actor = fila[colIndices.lidera_apoya];

    if (estado === 'Completado') completadas++;
    else if (estado === 'Atrasado') atrasadas++;
    else if (estado === 'En progreso') enProgreso++;
    else pendientes++;

    if (!actoresStats[actor]) actoresStats[actor] = { total: 0, completadas: 0, atrasadas: 0 };
    actoresStats[actor].total++;
    if (estado === 'Completado') actoresStats[actor].completadas++;
    if (estado === 'Atrasado') actoresStats[actor].atrasadas++;
  }

  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const dashUrl = CONFIG.DASHBOARD_URL_SUCUMBIOS;

  // Generar tabla de actores
  const actoresOrdenados = Object.entries(actoresStats)
    .sort((a, b) => (b[1].completadas / b[1].total) - (a[1].completadas / a[1].total));

  const cuerpo = generarEmailMensual(provincia, {
    total, completadas, atrasadas, enProgreso, pendientes, pct,
    actoresOrdenados, dashUrl
  });

  // Obtener TODOS los emails (miembros incluidos)
  const todosEmails = obtenerTodosEmails(ss, provincia);

  enviarEmail(todosEmails, {
    asunto: `📈 Informe mensual — Mesa de Cooperación de ${provincia} — ${getMesAnio()}`,
    cuerpo: cuerpo
  });

  registrarLog(ss, 'MENSUAL', provincia, `Informe mensual ${getMesAnio()}`, `${todosEmails.length} destinatarios`);
}

// ---- GENERADORES DE EMAIL HTML ----

function generarEmailRecordatorio(params) {
  const { provincia, actividad, que, producto, evidencia, actorTexto,
          fechaLimite, diasRestantes, dashUrl, formUrl, tipo } = params;

  let encabezado, mensaje, colorBarra;

  switch (tipo) {
    case 'recordatorio':
      encabezado = 'Recordatorio de actividad próxima';
      mensaje = `Tienes una actividad que vence en <strong>${diasRestantes} días</strong>.`;
      colorBarra = '#2563eb';
      break;
    case 'vencimiento':
      encabezado = 'Actividad vence hoy';
      mensaje = 'Esta actividad <strong>vence hoy</strong>. Por favor confirma su estado.';
      colorBarra = '#ca8a04';
      break;
    case 'atraso_warning':
      encabezado = 'Actividad pendiente';
      mensaje = `Esta actividad tiene <strong>${Math.abs(diasRestantes)} días de atraso</strong>. Si no se resuelve antes del <strong>${formatDate(addDays(fechaLimite, CONFIG.DIAS_ANTES_ESCALACION))}</strong>, se notificará a la Comisión de Seguimiento y Evaluación (CSE) y a la Presidencia de la Mesa.`;
      colorBarra = '#ea580c';
      break;
    case 'escalacion':
      encabezado = 'Actividad escalada';
      mensaje = `Esta actividad tiene <strong>${Math.abs(diasRestantes)} días de atraso</strong> y ha sido escalada. Requiere atención inmediata por parte del responsable y supervisión de la CSE.`;
      colorBarra = '#dc2626';
      break;
  }

  return `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:${colorBarra};padding:4px 0;"></div>
      <div style="padding:32px;border:1px solid #e2e8f0;border-top:none;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">
            Mesa de Cooperación — ${provincia}
          </div>
          <div style="font-size:20px;font-weight:700;color:#0f172a;margin-top:8px;">${encabezado}</div>
        </div>

        <p style="font-size:15px;color:#334155;line-height:1.6;margin-bottom:20px;">
          Estimado/a responsable de <em>${actorTexto}</em>,<br><br>
          ${mensaje}
        </p>

        <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Actividad</div>
          <div style="font-size:16px;font-weight:600;color:#0f172a;margin-bottom:16px;">${actividad}</div>

          <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">Qué se debe hacer</div>
          <div style="font-size:14px;color:#334155;margin-bottom:16px;line-height:1.5;">${que}</div>

          <div style="display:flex;gap:24px;flex-wrap:wrap;">
            <div>
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">📦 Producto esperado</div>
              <div style="font-size:13px;color:#334155;">${producto}</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">📎 Evidencia requerida</div>
              <div style="font-size:13px;color:#334155;">${evidencia}</div>
            </div>
          </div>

          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">📅 Plazo</div>
            <div style="font-size:14px;font-weight:600;color:${diasRestantes <= 0 ? '#dc2626' : '#0f172a'};">${formatDate(fechaLimite)}${diasRestantes < 0 ? ' (' + Math.abs(diasRestantes) + ' días de atraso)' : ''}</div>
          </div>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="${formUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-right:12px;">
            ✅ Ya la completé
          </a>
          <a href="${formUrl}&bloqueador=true" style="display:inline-block;background:#ea580c;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
            ⚠️ Reportar situación
          </a>
        </div>

        <div style="text-align:center;">
          <a href="${dashUrl}" style="font-size:13px;color:#2563eb;text-decoration:none;">
            Ver todas tus actividades en el Dashboard →
          </a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#9ca3af;">
        Este es un mensaje automático del sistema de seguimiento de la Mesa de Cooperación de ${provincia}.
      </div>
    </div>
  `;
}

function generarEmailSemanal(nombre, provincia, actividades, dashUrl) {
  const urgentes = actividades.filter(a => a.diasRestantes <= 7);
  const proximas = actividades.filter(a => a.diasRestantes > 7 && a.diasRestantes <= 30);
  const futuras = actividades.filter(a => a.diasRestantes > 30);

  let tablaHtml = '';
  actividades.forEach(a => {
    let colorEstado, textoEstado;
    if (a.estado === 'Atrasado' || a.diasRestantes < 0) {
      colorEstado = '#dc2626'; textoEstado = `⚠ ${Math.abs(a.diasRestantes)} días de atraso`;
    } else if (a.diasRestantes <= 7) {
      colorEstado = '#ea580c'; textoEstado = `Vence en ${a.diasRestantes} días`;
    } else if (a.diasRestantes <= 30) {
      colorEstado = '#ca8a04'; textoEstado = `Vence en ${a.diasRestantes} días`;
    } else {
      colorEstado = '#6b7280'; textoEstado = a.trimestre;
    }

    tablaHtml += `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;">${a.actividad}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:${colorEstado};font-weight:600;white-space:nowrap;">${textoEstado}</td>
      </tr>`;
  });

  return `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#2563eb;padding:4px 0;"></div>
      <div style="padding:32px;border:1px solid #e2e8f0;border-top:none;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Mesa de Cooperación — ${provincia}</div>
          <div style="font-size:20px;font-weight:700;color:#0f172a;margin-top:8px;">Tu semana</div>
        </div>

        <p style="font-size:15px;color:#334155;line-height:1.6;margin-bottom:20px;">
          Estimado/a ${nombre},<br><br>
          Aquí está el resumen de tus actividades pendientes en la Mesa de Cooperación de ${provincia}:
        </p>

        <div style="background:#f8fafc;border-radius:8px;padding:4px 0;margin-bottom:20px;display:flex;text-align:center;">
          <div style="flex:1;padding:12px;">
            <div style="font-size:24px;font-weight:800;color:#dc2626;">${urgentes.length}</div>
            <div style="font-size:11px;color:#6b7280;">Urgentes</div>
          </div>
          <div style="flex:1;padding:12px;">
            <div style="font-size:24px;font-weight:800;color:#ca8a04;">${proximas.length}</div>
            <div style="font-size:11px;color:#6b7280;">Próximas</div>
          </div>
          <div style="flex:1;padding:12px;">
            <div style="font-size:24px;font-weight:800;color:#6b7280;">${futuras.length}</div>
            <div style="font-size:11px;color:#6b7280;">Futuras</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Actividad</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Estado</th>
          </tr>
          ${tablaHtml}
        </table>

        <div style="text-align:center;margin-top:24px;">
          <a href="${dashUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
            Ver mi panel completo →
          </a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#9ca3af;">
        Resumen semanal automático — Mesa de Cooperación de ${provincia}
      </div>
    </div>
  `;
}

function generarEmailMensual(provincia, stats) {
  const { total, completadas, atrasadas, enProgreso, pendientes, pct, actoresOrdenados, dashUrl } = stats;

  // Tabla de reconocimiento y pendientes
  let tablaActores = '';
  actoresOrdenados.forEach(([actor, s]) => {
    const pctActor = s.total > 0 ? Math.round((s.completadas / s.total) * 100) : 0;
    const barColor = pctActor >= 70 ? '#16a34a' : pctActor >= 40 ? '#ca8a04' : '#dc2626';

    tablaActores += `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;">${actor}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">
          <div style="background:#f1f5f9;border-radius:10px;height:16px;overflow:hidden;">
            <div style="background:${barColor};height:100%;width:${pctActor}%;border-radius:10px;"></div>
          </div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:700;color:${barColor};text-align:center;">${pctActor}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:center;color:#dc2626;font-weight:${s.atrasadas > 0 ? '700' : '400'};">${s.atrasadas > 0 ? s.atrasadas : '—'}</td>
      </tr>`;
  });

  return `
    <div style="font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;margin:0 auto;background:#fff;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px;text-align:center;color:#fff;">
        <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;opacity:0.7;">Mesa de Cooperación — ${provincia}</div>
        <div style="font-size:24px;font-weight:800;margin-top:8px;">Informe Mensual</div>
        <div style="font-size:14px;opacity:0.7;margin-top:4px;">${getMesAnio()}</div>
        <div style="margin-top:20px;display:inline-block;background:rgba(255,255,255,0.15);padding:16px 32px;border-radius:12px;">
          <div style="font-size:48px;font-weight:800;">${pct}%</div>
          <div style="font-size:12px;opacity:0.8;">Avance General</div>
        </div>
      </div>

      <div style="padding:32px;border:1px solid #e2e8f0;border-top:none;">
        <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
          <div style="flex:1;min-width:120px;background:#dcfce7;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#16a34a;">${completadas}</div>
            <div style="font-size:11px;color:#16a34a;font-weight:600;">Completadas</div>
          </div>
          <div style="flex:1;min-width:120px;background:#dbeafe;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#2563eb;">${enProgreso}</div>
            <div style="font-size:11px;color:#2563eb;font-weight:600;">En progreso</div>
          </div>
          <div style="flex:1;min-width:120px;background:#fee2e2;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#dc2626;">${atrasadas}</div>
            <div style="font-size:11px;color:#dc2626;font-weight:600;">Atrasadas</div>
          </div>
          <div style="flex:1;min-width:120px;background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:800;color:#6b7280;">${pendientes}</div>
            <div style="font-size:11px;color:#6b7280;font-weight:600;">Pendientes</div>
          </div>
        </div>

        <h3 style="font-size:14px;font-weight:700;margin-bottom:12px;color:#0f172a;">Avance por Actor Responsable</h3>

        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;">Actor</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;min-width:100px;">Progreso</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;">%</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;">Atrasadas</th>
          </tr>
          ${tablaActores}
        </table>

        <div style="text-align:center;margin-top:28px;">
          <a href="${dashUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
            Ver Dashboard Completo →
          </a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#9ca3af;">
        Informe mensual automático — Mesa de Cooperación de ${provincia} — Hoja de Ruta 2026–2028
      </div>
    </div>
  `;
}

// ---- WEB APP: Formulario de Confirmación ----

function doGet(e) {
  const id = e.parameter.id || '';
  const bloqueador = e.parameter.bloqueador === 'true';
  const actorSlug = e.parameter.actor || '';
  const token = e.parameter.token || '';
  const action = e.parameter.action || ''; // '' | 'verify' | 'reject'

  // ST-only verification flow: one-click confirm or reject from Mi trabajo.
  if (action === 'verify' || action === 'reject') {
    return doGetVerify({ id, actorSlug, token, action });
  }

  // Look up activity metadata to show evidencia_minima on the form
  let hitoOperativo = '';
  let evidenciaMinima = '';
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const hoja = ss.getSheetByName('Sucumbíos');
    if (hoja) {
      const datos = hoja.getDataRange().getValues();
      const headers = datos[0];
      const colIndices = getColumnIndices(headers);
      for (let i = 1; i < datos.length; i++) {
        if (datos[i][colIndices.id] === id) {
          hitoOperativo = datos[i][colIndices.hito_operativo] || '';
          evidenciaMinima = datos[i][colIndices.evidencia_minima] || '';
          break;
        }
      }
    }
  } catch (err) { /* non-fatal: form still works without it */ }

  const evidenciaBanner = (!bloqueador && evidenciaMinima) ? `
    <div style="margin-bottom:1.25rem;padding:12px 14px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px;font-size:0.85rem;color:#166534">
      <strong>📎 Evidencia requerida:</strong><br>${evidenciaMinima}
    </div>` : '';

  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family:'Inter',sans-serif; background:#f8fafc; padding:2rem; display:flex; justify-content:center; }
        .card { background:#fff; border-radius:12px; padding:2rem; max-width:480px; width:100%; border:1px solid #e2e8f0; }
        h2 { font-size:1.25rem; margin-bottom:0.5rem; }
        p { color:#6b7280; font-size:0.9rem; margin-bottom:1.5rem; }
        label { display:block; font-size:0.8rem; font-weight:600; color:#374151; margin-bottom:0.35rem; }
        input, textarea, select { width:100%; padding:0.6rem; border:1px solid #d1d5db; border-radius:8px; font-family:inherit; font-size:0.9rem; margin-bottom:1rem; }
        textarea { height:80px; resize:vertical; }
        button { background:#16a34a; color:#fff; border:none; padding:0.85rem 2rem; border-radius:8px; font-weight:700; font-size:1rem; cursor:pointer; width:100%; }
        button:hover { background:#15803d; }
        button.bloqueador { background:#ea580c; }
        button.bloqueador:hover { background:#c2410c; }
        .ok { text-align:center; padding:3rem; }
        .ok h2 { color:#16a34a; }
      </style>
    </head>
    <body>
      <div class="card" id="form-card">
        <h2>${bloqueador ? '⚠️ Reportar situación' : '✅ Confirmar actividad completada'}</h2>
        ${hitoOperativo ? `<p style="font-weight:600;color:#111827;font-size:0.95rem;margin-bottom:0.25rem">${hitoOperativo}</p>` : ''}
        <p>ID de actividad: <strong>${id}</strong></p>
        ${evidenciaBanner}

        <form onsubmit="submitForm(event)">
          <input type="hidden" id="actId" value="${id}">
          <input type="hidden" id="isBloqueador" value="${bloqueador}">
          <input type="hidden" id="actorSlug" value="${actorSlug}">
          <input type="hidden" id="actorToken" value="${token}">

          ${bloqueador ? `
            <label>Describe la situación:</label>
            <textarea id="notas" placeholder="¿Qué está impidiendo avanzar con esta actividad?" required></textarea>
          ` : `
            <label>Enlace a evidencia (Google Drive, repositorio, etc.):</label>
            <input type="url" id="evidencia" placeholder="https://drive.google.com/..." />

            <label>Notas adicionales (opcional):</label>
            <textarea id="notas" placeholder="Comentarios sobre la ejecución..."></textarea>
          `}

          <button type="submit" class="${bloqueador ? 'bloqueador' : ''}">${bloqueador ? 'Reportar situación' : 'Confirmar completada'}</button>
        </form>
      </div>

      <script>
        function submitForm(e) {
          e.preventDefault();
          const data = {
            id: document.getElementById('actId').value,
            bloqueador: document.getElementById('isBloqueador').value === 'true',
            notas: document.getElementById('notas')?.value || '',
            evidencia: document.getElementById('evidencia')?.value || '',
            actor: document.getElementById('actorSlug').value,
            token: document.getElementById('actorToken').value
          };

          google.script.run
            .withSuccessHandler(() => {
              document.getElementById('form-card').innerHTML = '<div class="ok"><h2>✓ Registrado</h2><p>Tu respuesta ha sido registrada. La Secretaría Técnica será notificada para verificar.</p></div>';
            })
            .withFailureHandler((err) => {
              alert('Error: ' + err.message);
            })
            .procesarRespuesta(data);
        }
      </script>
    </body>
    </html>
  `).setTitle('Mesa de Cooperación — Confirmación');

  return html;
}

/**
 * Procesa la respuesta del formulario web.
 */
function procesarRespuesta(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  // Verify the requester's identity via (actor slug, token) pair against
  // the Actores sheet. Rejects any submission from an untrusted source.
  if (!verificarToken(ss, data.actor, data.token)) {
    registrarLog(ss, data.id || '—', '—', 'RECHAZADO: token inválido', 'actor=' + (data.actor || '') + ' · token=' + (data.token ? '***' : 'ausente'));
    throw new Error('Identidad no verificada. Abre el formulario desde tu enlace personal en tu email o desde Mi trabajo en el dashboard.');
  }

  const provincia = 'Sucumbíos';
  const hoja = ss.getSheetByName(provincia);
  if (!hoja) throw new Error('Hoja no encontrada');

  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const colIndices = getColumnIndices(headers);

  // Buscar la fila
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][colIndices.id] === data.id) {
      if (data.bloqueador) {
        hoja.getRange(i + 1, colIndices.notas_bloqueador + 1).setValue(data.notas);
        registrarLog(ss, data.id, provincia, 'Bloqueador reportado', data.notas);
      } else {
        hoja.getRange(i + 1, colIndices.estado + 1).setValue('Reportada — pendiente verificación ST');
        hoja.getRange(i + 1, colIndices.fecha_reporte + 1).setValue(new Date());
        if (data.evidencia) {
          hoja.getRange(i + 1, colIndices.enlace_evidencia + 1).setValue(data.evidencia);
        }
        if (data.notas) {
          hoja.getRange(i + 1, colIndices.notas_bloqueador + 1).setValue(data.notas);
        }
        registrarLog(ss, data.id, provincia, 'Completada reportada (pendiente verificación ST)', data.evidencia || '');
      }

      // Notificar a la ST con botones one-click de verificar/rechazar
      // Cada miembro de la ST recibe los enlaces personalizados con SU
      // (slug, token) para que verificarToken pase del lado server.
      const stActores = obtenerActoresParaActividad(ss, 'Secretaría Técnica (GADPS)', provincia);
      // Si la búsqueda anterior no encontró ST (provincia diferente o nombre
      // distinto en CSV), buscar por rol como fallback.
      const stRecipients = stActores.length > 0 ? stActores : obtenerActoresST(ss, provincia);
      stRecipients.forEach(st => {
        const tipo = data.bloqueador ? 'situación reportada' : 'completada';
        const verifyUrl = getFormUrl(data.id, st.slug, st.token) + '&action=verify';
        const rejectUrl = getFormUrl(data.id, st.slug, st.token) + '&action=reject';
        enviarEmail([st.email], {
          asunto: `📝 Actividad ${tipo}: "${datos[i][colIndices.hito_operativo]}" (${data.id})`,
          cuerpo: `<div style="font-family:Inter,sans-serif;padding:20px;max-width:560px">
            <h3 style="margin-top:0">Se ha reportado una actividad como <strong>${tipo}</strong></h3>
            <p><strong>ID:</strong> ${data.id}</p>
            <p><strong>Actividad:</strong> ${datos[i][colIndices.hito_operativo]}</p>
            <p><strong>Producto esperado:</strong> ${datos[i][colIndices.producto_verificable] || '—'}</p>
            <p><strong>Evidencia mínima esperada:</strong> ${datos[i][colIndices.evidencia_minima] || '—'}</p>
            ${data.evidencia ? `<p><strong>Evidencia recibida:</strong> <a href="${data.evidencia}">${data.evidencia}</a></p>` : ''}
            ${data.notas ? `<p><strong>Notas del reportante:</strong> ${data.notas}</p>` : ''}
            ${!data.bloqueador ? `
            <div style="margin-top:24px;display:flex;gap:8px">
              <a href="${verifyUrl}" style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">✓ Verificar</a>
              <a href="${rejectUrl}" style="background:#fff;color:#b45309;border:1px solid #d97706;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">✗ Pedir más info</a>
            </div>
            <p style="font-size:11px;color:#94a3b8;margin-top:14px">Verificar marca la actividad como completada y la publica en el dashboard. Pedir más info la devuelve al responsable.</p>
            ` : ''}
          </div>`
        });
      });

      return;
    }
  }

  throw new Error('Actividad no encontrada: ' + data.id);
}

/**
 * Devuelve actores con rol ST para una provincia, cada uno con su slug/token.
 * Helper para los botones one-click de verificación.
 */
function obtenerActoresST(ss, provincia) {
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) return [];
  const datos = hoja.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < datos.length; i++) {
    const nombre = String(datos[i][0] || '').trim();
    const email = datos[i][1];
    const rol = datos[i][2];
    const prov = datos[i][3];
    const token = datos[i][4] || '';
    if (!email || !nombre || prov !== provincia) continue;
    if (rol === 'ST' || String(rol).startsWith('ST')) {
      out.push({ email, slug: slugify(nombre), token, name: nombre });
    }
  }
  return out;
}

/**
 * One-click verification flow for ST members.
 * Renders a confirmation page; when ST clicks the verify/reject link in their
 * email, this is what they see. No form submission needed for verify; reject
 * shows a textarea for the reason.
 */
function doGetVerify({ id, actorSlug, token, action }) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  // Identity check
  if (!verificarToken(ss, actorSlug, token)) {
    return HtmlService.createHtmlOutput(_renderVerifyPage({
      title: '⚠ Identidad no verificada',
      body: 'Este enlace solo funciona si lo abres desde tu correo personal de la Secretaría Técnica.',
      color: '#b45309'
    }));
  }

  // Role check — only ST can verify
  const actor = obtenerActorPorSlug(ss, actorSlug);
  if (!actor || !(actor.rol === 'ST' || String(actor.rol).startsWith('ST'))) {
    return HtmlService.createHtmlOutput(_renderVerifyPage({
      title: '⚠ Sin permiso',
      body: 'Solo la Secretaría Técnica puede verificar reportes. Tu rol actual: ' + (actor?.rol || 'desconocido') + '.',
      color: '#b45309'
    }));
  }

  if (action === 'verify') {
    try {
      const result = procesarVerificacion(id, actor);
      return HtmlService.createHtmlOutput(_renderVerifyPage({
        title: '✓ Actividad verificada',
        body: `<strong>${result.actividad}</strong><br><br>El estado pasa a "Completado" y queda visible en el dashboard público en el siguiente ciclo.<br><br><span style="color:#94a3b8;font-size:12px">Reportada por: ${result.reportadaPor}</span>`,
        color: '#16a34a'
      }));
    } catch (err) {
      return HtmlService.createHtmlOutput(_renderVerifyPage({
        title: '✗ Error al verificar',
        body: err.message,
        color: '#dc2626'
      }));
    }
  }

  if (action === 'reject') {
    // Render form with textarea for the reason
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family:'Inter',sans-serif; background:#f8fafc; padding:2rem; display:flex; justify-content:center }
          .card { background:#fff; border-radius:12px; padding:2rem; max-width:480px; width:100%; border:1px solid #e2e8f0 }
          h2 { font-size:1.25rem; margin:0 0 0.5rem; color:#b45309 }
          p { color:#6b7280; font-size:0.9rem }
          label { display:block; font-size:0.8rem; font-weight:600; color:#374151; margin:1rem 0 0.35rem }
          textarea { width:100%; padding:0.6rem; border:1px solid #d1d5db; border-radius:8px; font-family:inherit; font-size:0.9rem; height:100px }
          button { background:#d97706; color:#fff; border:none; padding:0.85rem 2rem; border-radius:8px; font-weight:700; font-size:1rem; cursor:pointer; width:100%; margin-top:1rem }
          button:hover { background:#b45309 }
          .ok { text-align:center; padding:3rem }
          .ok h2 { color:#16a34a }
        </style>
      </head>
      <body>
        <div class="card" id="form-card">
          <h2>✗ Pedir más información</h2>
          <p>Devolver el reporte de actividad <strong>${id}</strong> al reportante con un motivo.</p>
          <form onsubmit="submitReject(event)">
            <input type="hidden" id="actId" value="${id}">
            <input type="hidden" id="actorSlug" value="${actorSlug}">
            <input type="hidden" id="actorToken" value="${token}">
            <label>Motivo (será enviado al reportante):</label>
            <textarea id="motivo" placeholder="Ej: Necesito el acta firmada en lugar del borrador, o falta la lista de asistencia..." required></textarea>
            <button type="submit">Devolver y notificar al reportante</button>
          </form>
        </div>
        <script>
          function submitReject(e) {
            e.preventDefault();
            const data = {
              id: document.getElementById('actId').value,
              actor: document.getElementById('actorSlug').value,
              token: document.getElementById('actorToken').value,
              motivo: document.getElementById('motivo').value
            };
            google.script.run
              .withSuccessHandler(() => {
                document.getElementById('form-card').innerHTML = '<div class="ok"><h2>✓ Devuelto</h2><p>El reportante fue notificado. La actividad volvió a su estado anterior.</p></div>';
              })
              .withFailureHandler(err => alert('Error: ' + err.message))
              .procesarRechazo(data);
          }
        </script>
      </body>
      </html>
    `);
  }
}

function _renderVerifyPage({ title, body, color }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family:'Inter',sans-serif; background:#f8fafc; padding:2rem; display:flex; justify-content:center }
        .card { background:#fff; border-radius:12px; padding:3rem 2rem; max-width:480px; width:100%; border:1px solid #e2e8f0; text-align:center }
        h2 { font-size:1.5rem; margin:0 0 1rem; color:${color} }
        .body { color:#374151; font-size:0.95rem; line-height:1.6 }
      </style>
    </head>
    <body>
      <div class="card"><h2>${title}</h2><div class="body">${body}</div></div>
    </body>
    </html>
  `;
}

/**
 * Aplica la verificación: cambia estado a Completado, marca verificado_st=TRUE,
 * registra log, devuelve datos para el render.
 */
function procesarVerificacion(id, stActor) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const provincia = 'Sucumbíos';
  const hoja = ss.getSheetByName(provincia);
  if (!hoja) throw new Error('Hoja no encontrada: ' + provincia);

  const datos = hoja.getDataRange().getValues();
  const colIndices = getColumnIndices(datos[0]);

  for (let i = 1; i < datos.length; i++) {
    if (datos[i][colIndices.id] !== id) continue;

    const estadoActual = datos[i][colIndices.estado];
    if (estadoActual !== 'Reportada — pendiente verificación ST') {
      throw new Error('La actividad no está pendiente de verificación. Estado actual: ' + estadoActual);
    }

    hoja.getRange(i + 1, colIndices.estado + 1).setValue('Completado');
    hoja.getRange(i + 1, colIndices.verificado_st + 1).setValue(true);
    hoja.getRange(i + 1, colIndices.porcentaje + 1).setValue(100);

    registrarLog(ss, id, provincia, 'Verificada por ST', stActor.name);

    return {
      actividad: datos[i][colIndices.hito_operativo],
      reportadaPor: datos[i][colIndices.lidera_apoya]
    };
  }
  throw new Error('Actividad no encontrada: ' + id);
}

/**
 * Procesa el rechazo: devuelve la actividad al estado anterior + notifica al
 * reportante con el motivo. Llamado vía google.script.run desde la página
 * de rechazo.
 */
function procesarRechazo(data) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);

  if (!verificarToken(ss, data.actor, data.token)) {
    throw new Error('Identidad no verificada.');
  }
  const actor = obtenerActorPorSlug(ss, data.actor);
  if (!actor || !(actor.rol === 'ST' || String(actor.rol).startsWith('ST'))) {
    throw new Error('Solo la ST puede rechazar reportes.');
  }
  if (!data.motivo || data.motivo.trim().length < 5) {
    throw new Error('El motivo es obligatorio (mínimo 5 caracteres).');
  }

  const provincia = 'Sucumbíos';
  const hoja = ss.getSheetByName(provincia);
  if (!hoja) throw new Error('Hoja no encontrada: ' + provincia);

  const datos = hoja.getDataRange().getValues();
  const colIndices = getColumnIndices(datos[0]);

  for (let i = 1; i < datos.length; i++) {
    if (datos[i][colIndices.id] !== data.id) continue;
    const actividad = datos[i][colIndices.hito_operativo];
    const lideraApoya = datos[i][colIndices.lidera_apoya];

    // Revert: estado pasa a "Rechazado" para que el modal lo muestre con
    // banner de rechazo, y el actor pueda re-reportar desde Mi trabajo.
    hoja.getRange(i + 1, colIndices.estado + 1).setValue('Rechazado');
    hoja.getRange(i + 1, colIndices.fecha_reporte + 1).setValue('');
    hoja.getRange(i + 1, colIndices.notas_bloqueador + 1).setValue('Devuelto por ST: ' + data.motivo);

    registrarLog(ss, data.id, provincia, 'Rechazado por ST', actor.name + ' — motivo: ' + data.motivo);

    // Notificar a los actores responsables
    const reportantes = obtenerActoresParaActividad(ss, lideraApoya, provincia);
    reportantes.forEach(r => {
      // Pass data.id so the email link opens the rejected activity directly.
      const dashUrl = getDashUrlForActor(provincia, r.slug, r.token, data.id);
      enviarEmail([r.email], {
        asunto: `↩ Reporte devuelto: "${actividad}" (${data.id})`,
        cuerpo: `<div style="font-family:Inter,sans-serif;padding:20px;max-width:560px">
          <h3 style="margin-top:0;color:#b45309">La Secretaría Técnica devolvió tu reporte para que lo completes</h3>
          <p><strong>Actividad:</strong> ${actividad}</p>
          <p><strong>Motivo:</strong> ${data.motivo}</p>
          <p style="margin-top:20px"><a href="${dashUrl}" style="background:#1a6b3c;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Abrir mi trabajo</a></p>
          <p style="font-size:12px;color:#94a3b8;margin-top:14px">Cuando ajustes lo solicitado, vuelve a marcar "Ya la completé" desde tu panel.</p>
        </div>`
      });
    });
    return;
  }
  throw new Error('Actividad no encontrada: ' + data.id);
}

// ---- FUNCIONES AUXILIARES ----

function getColumnIndices(headers) {
  const indices = {};
  const map = {
    'id': 'id',
    'provincia': 'provincia',
    'trimestre': 'trimestre',
    'fecha_inicio': 'fecha_inicio',
    'fecha_limite': 'fecha_limite',
    'hito_operativo': 'hito_operativo',
    'que_se_hace': 'que_se_hace',
    'producto_verificable': 'producto_verificable',
    'evidencia_minima': 'evidencia_minima',
    'lidera_apoya': 'lidera_apoya',
    'tipo': 'tipo',
    'ambito': 'ambito',
    'estado': 'estado',
    'porcentaje': 'porcentaje',
    'fecha_reporte': 'fecha_reporte',
    'verificado_st': 'verificado_st',
    'enlace_evidencia': 'enlace_evidencia',
    'notas_bloqueador': 'notas_bloqueador'
  };

  headers.forEach((h, i) => {
    const key = h.toString().toLowerCase().trim();
    if (map[key]) indices[map[key]] = i;
  });

  return indices;
}

function obtenerEmailsActor(ss, actorTexto, provincia) {
  // Backwards-compatible wrapper that returns just the email strings.
  // Prefer obtenerActoresParaActividad below for new code that needs token+slug.
  return obtenerActoresParaActividad(ss, actorTexto, provincia).map(a => a.email);
}

// Returns [{email, slug, token, name}] for each actor whose name appears in
// `actorTexto` (the "Lidera / Apoya" cell of an activity row), filtered to
// the given provincia. Used to build per-actor personalised formUrl that
// includes their (slug, token) for verificarToken on submit.
// Strip personal-name suffix to derive the institutional base name.
// Mirrors shared/js/utils.js:actorBaseName so server and client agree.
// "Dirección Gestión Ambiental GADPS — Holger Salas" → "Dirección Gestión Ambiental GADPS"
// "Secretaría Técnica (GADPS) - Apoyo" → "Secretaría Técnica (GADPS)"
function actorBaseName(name) {
  return String(name || '')
    .replace(/\s*—\s*.+$/, '')
    .replace(/\s*-\s*(Apoyo|\d+)$/i, '')
    .trim();
}

function obtenerActoresParaActividad(ss, actorTexto, provincia) {
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) return [];

  const tokens = String(actorTexto || '')
    .split(/[,;·]| y | and /i)
    .map(t => t.trim())
    .filter(Boolean);

  const datos = hoja.getDataRange().getValues();
  const out = [];

  for (let i = 1; i < datos.length; i++) {
    const nombre = String(datos[i][0] || '').trim();
    const email = datos[i][1];
    const prov = datos[i][3];
    const token = datos[i][4] || '';

    if (!email || prov !== provincia || !nombre) continue;
    const base = actorBaseName(nombre);

    if (tokens.some(t => t === base || t === nombre)) {
      out.push({ email, slug: slugify(nombre), token, name: nombre });
    }
  }

  return out;
}

function obtenerEmailsST(ss, provincia) {
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) return [];

  const datos = hoja.getDataRange().getValues();
  const emails = [];

  for (let i = 1; i < datos.length; i++) {
    const rol = datos[i][2];
    const email = datos[i][1];
    const prov = datos[i][3];

    if (email && prov === provincia && rol === 'ST') {
      emails.push(email);
    }
  }

  return emails;
}

function obtenerEmailsCSE(ss, provincia) {
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) return [];

  const datos = hoja.getDataRange().getValues();
  const emails = [];

  for (let i = 1; i < datos.length; i++) {
    const rol = datos[i][2];
    const email = datos[i][1];
    const prov = datos[i][3];

    if (email && prov === provincia && (rol === 'CSE' || rol === 'Presidencia')) {
      emails.push(email);
    }
  }

  return emails;
}

function obtenerTodosEmails(ss, provincia) {
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) return [];

  const datos = hoja.getDataRange().getValues();
  const emails = [];

  for (let i = 1; i < datos.length; i++) {
    const email = datos[i][1];
    const prov = datos[i][3];

    if (email && (prov === provincia || prov === 'Ambas')) {
      emails.push(email);
    }
  }

  return [...new Set(emails)];
}

function actorCoincide(textoCompleto, nombre) {
  return textoCompleto.toLowerCase().includes(nombre.toLowerCase());
}

function enviarEmail(destinatarios, opciones) {
  destinatarios.forEach(email => {
    try {
      GmailApp.sendEmail(email, opciones.asunto, '', {
        htmlBody: opciones.cuerpo,
        name: CONFIG.EMAIL_REMITENTE_NOMBRE,
        charset: 'UTF-8'
      });
    } catch (e) {
      Logger.log('Error enviando a ' + email + ': ' + e.message);
    }
  });
}

function registrarLog(ss, id, provincia, accion, detalle) {
  const hoja = ss.getSheetByName('Log');
  if (!hoja) return;
  hoja.appendRow([new Date(), id, provincia, accion, detalle]);
}

function getFormUrl(id, actorSlug, token) {
  const scriptUrl = ScriptApp.getService().getUrl();
  let url = scriptUrl + '?id=' + encodeURIComponent(id);
  if (actorSlug) url += '&actor=' + encodeURIComponent(actorSlug);
  if (token) url += '&token=' + encodeURIComponent(token);
  return url;
}

// Build a personalized dashboard URL for a specific actor slug + token.
// Assumes CONFIG.DASHBOARD_URL_SUCUMBIOS has no existing query string.
function getDashUrlForActor(provincia, actorSlug, token, openId) {
  const base = CONFIG.DASHBOARD_URL_SUCUMBIOS;
  if (!actorSlug || !token) return base;
  let url = base + '?actor=' + encodeURIComponent(actorSlug) + '&token=' + encodeURIComponent(token);
  if (openId) url += '&open=' + encodeURIComponent(openId);
  url += '#mi-trabajo';
  return url;
}

// Slugify identical to dashboard's shared/js/utils.js:slugify.
// Lowercase, strip accents, kebab non-alphanumerics, trim leading/trailing dashes.
function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Look up an actor row by slug (matches dashboard's CSV parsing).
// Returns { name, email, rol, provincia, token } or null.
function obtenerActorPorSlug(ss, slug) {
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) return null;
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    const nombre = String(datos[i][0] || '').trim();
    if (!nombre) continue;
    if (slugify(nombre) === slug) {
      return {
        name: nombre,
        email: datos[i][1],
        rol: datos[i][2],
        provincia: datos[i][3],
        token: datos[i][4] || ''
      };
    }
  }
  return null;
}

// Verify that a (slug, token) pair matches a registered actor.
function verificarToken(ss, slug, token) {
  if (!slug || !token) return false;
  const a = obtenerActorPorSlug(ss, slug);
  return !!(a && a.token && a.token === token);
}

function formatDate(date) {
  const d = new Date(date);
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getMesAnio() {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const hoy = new Date();
  return `${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
}

/**
 * TEST helper — envía un email de cada tipo al usuario que ejecuta,
 * usando la primera actividad de cada provincia. Útil para validar
 * maquetación de emails sin depender de fechas reales.
 */
function testEnviarTodosLosTipos() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const myEmail = Session.getActiveUser().getEmail();
  if (!myEmail) throw new Error('No se pudo detectar tu email. Ejecuta autenticado.');
  const provincia = 'Sucumbíos';

  const hoja = ss.getSheetByName(provincia);
  if (!hoja) return;
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return;
  const headers = datos[0];
  const cols = getColumnIndices(headers);
  const fila = datos[1];

  // Use the first matching actor for this activity to inject a real token
  // into the test formUrl so the "Ya la completé" button validates end-to-end.
  const actores = obtenerActoresParaActividad(ss, fila[cols.lidera_apoya], provincia);
  const a = actores[0] || { slug: '', token: '' };

  const base = {
    provincia,
    actividad: fila[cols.hito_operativo],
    que: fila[cols.que_se_hace],
    producto: fila[cols.producto_verificable],
    evidencia: fila[cols.evidencia_minima],
    actorTexto: fila[cols.lidera_apoya],
    fechaLimite: new Date(),
    dashUrl: CONFIG.DASHBOARD_URL_SUCUMBIOS,
    formUrl: getFormUrl(fila[cols.id], a.slug, a.token)
  };

  ['recordatorio', 'vencimiento', 'atraso_warning', 'escalacion'].forEach(tipo => {
    const diasRestantes = tipo === 'recordatorio' ? 7
      : tipo === 'vencimiento' ? 0
      : tipo === 'atraso_warning' ? -3
      : -7;
    enviarEmail([myEmail], {
      asunto: `[TEST · ${tipo.toUpperCase()}] ${provincia} — ${base.actividad}`,
      cuerpo: generarEmailRecordatorio({ ...base, diasRestantes, tipo })
    });
  });

  Logger.log('testEnviarTodosLosTipos: 4 emails enviados a ' + myEmail);
}

// ---- GESTIÓN DE TOKENS DE ACCESO POR ACTOR ----

/**
 * Genera un token aleatorio para cada actor que no tenga uno asignado.
 * Ejecuta una sola vez al configurar (o cuando agregues nuevos actores).
 * No sobrescribe tokens existentes — solo rellena los vacíos.
 */
function generarTokensParaActores() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) throw new Error('Hoja "Actores" no encontrada');

  // Asegurar encabezado de columna token (E)
  const headerCell = hoja.getRange(1, 5);
  if (!headerCell.getValue()) headerCell.setValue('token');

  const datos = hoja.getDataRange().getValues();
  let creados = 0;
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][4]) continue; // ya tiene token
    const token = Utilities.getUuid().replace(/-/g, '');
    hoja.getRange(i + 1, 5).setValue(token);
    creados++;
  }
  Logger.log('generarTokensParaActores: ' + creados + ' tokens creados.');
  return creados;
}

/**
 * Regenera el token de un actor específico (por nombre exacto).
 * Invalida el token anterior — cualquier enlace viejo deja de funcionar.
 * Úsalo si sospechas que el enlace personal de alguien se filtró.
 */
function rotarTokenActor(nombreActor) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) throw new Error('Hoja "Actores" no encontrada');
  const datos = hoja.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === nombreActor.trim()) {
      const nuevo = Utilities.getUuid().replace(/-/g, '');
      hoja.getRange(i + 1, 5).setValue(nuevo);
      Logger.log('rotarTokenActor: ' + nombreActor + ' → nuevo token generado');
      return nuevo;
    }
  }
  throw new Error('Actor no encontrado: ' + nombreActor);
}

/**
 * Imprime el enlace mágico personal para cada actor.
 * Útil para compartir el enlace manualmente (por WhatsApp, email personal, etc.)
 * cuando el flujo automático de correo no funciona.
 */
function exportarEnlacesMagicos() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) throw new Error('Hoja "Actores" no encontrada');
  const datos = hoja.getDataRange().getValues();
  const lineas = ['ACTOR | PROVINCIA | ENLACE MÁGICO'];
  for (let i = 1; i < datos.length; i++) {
    const nombre = String(datos[i][0] || '').trim();
    const provincia = datos[i][3];
    const token = datos[i][4];
    if (!nombre || !token) continue;
    const slug = slugify(nombre);
    const url = getDashUrlForActor(provincia, slug, token);
    lineas.push(nombre + ' | ' + provincia + ' | ' + url);
  }
  const out = lineas.join('\n');
  Logger.log(out);
  return out;
}

/**
 * Envía por email a cada actor su enlace mágico personal.
 * Ejecutar UNA VEZ tras llenar los emails en la hoja Actores y generar tokens.
 * El actor podrá guardar el link en favoritos o en el email.
 */
function enviarEnlacesMagicos() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) throw new Error('Hoja "Actores" no encontrada');
  const datos = hoja.getDataRange().getValues();
  let enviados = 0;
  for (let i = 1; i < datos.length; i++) {
    const nombre = String(datos[i][0] || '').trim();
    const email = datos[i][1];
    const provincia = datos[i][3];
    const token = datos[i][4];
    if (!nombre || !email || !token) continue;
    const slug = slugify(nombre);
    const url = getDashUrlForActor(provincia, slug, token);
    enviarEmail([email], {
      asunto: `Tu acceso personal — Mesa de Cooperación de ${provincia}`,
      cuerpo: `
        <div style="font-family:Inter,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:700">Mesa de Cooperación de ${provincia}</div>
          <h2 style="font-size:20px;margin-top:8px;color:#0f172a">Hola, ${nombre}</h2>
          <p style="font-size:14px;color:#334155;line-height:1.55;margin-top:12px">Este es tu enlace personal al dashboard de seguimiento. Úsalo para ver tu panel <strong>Mi trabajo</strong>, reportar actividades completadas y gestionar situaciones imprevistas.</p>
          <p style="font-size:12px;color:#64748b;margin-top:8px;line-height:1.55"><strong>Guárdalo:</strong> cualquiera con este enlace puede reportar en tu nombre. No lo compartas.</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${url}" style="display:inline-block;background:#1a6b3c;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Abrir mi dashboard</a>
          </div>
          <p style="font-size:11px;color:#94a3b8;word-break:break-all;margin-top:12px">Enlace: ${url}</p>
        </div>
      `
    });
    enviados++;
  }
  Logger.log('enviarEnlacesMagicos: ' + enviados + ' emails enviados.');
  return enviados;
}

// ---- HELPERS PARA SETUP / OPERACIÓN ----

/**
 * Vacía la columna token (E) de TODAS las filas de Actores. Útil antes de
 * generarTokensParaActores para asegurar que tokens DEMO o residuales
 * sean reemplazados por nuevos UUID. NO sobrescribe headers.
 */
function vaciarTokensExistentes() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const hoja = ss.getSheetByName('Actores');
  if (!hoja) throw new Error('Hoja "Actores" no encontrada');
  const lastRow = hoja.getLastRow();
  if (lastRow < 2) return;
  hoja.getRange(2, 5, lastRow - 1, 1).clearContent();
  Logger.log('vaciarTokensExistentes: tokens vaciados en filas 2..' + lastRow);
}

// ---- WRAPPERS PARA ROTACIÓN EN VIVO DURANTE EL TALLER ----
// Pre-creados para que JD pueda ejecutar 1 click sin editar código.
// Si un actor pierde su enlace o reporta token corrupto, seleccionar el
// wrapper correspondiente en el dropdown y ejecutar — luego correr
// exportarEnlacesMagicos para ver el nuevo enlace.

function _rotarSucumbiosST() {
  const t = rotarTokenActor("Secretaría Técnica (GADPS)");
  Logger.log("Nuevo token ST GADPS: " + t);
}
function _rotarSucumbiosS1() {
  const t = rotarTokenActor("Dirección Gestión Ambiental GADPS");
  Logger.log("Nuevo token S1 Ambiental: " + t);
}
function _rotarSucumbiosS2() {
  const t = rotarTokenActor("Dirección de Planificación GADPS");
  Logger.log("Nuevo token S2 Planificación: " + t);
}
function _rotarSucumbiosS3() {
  const t = rotarTokenActor("Dirección Nacionalidades y Turismo GADPS");
  Logger.log("Nuevo token S3 Patrimonio: " + t);
}
function _rotarSucumbiosS4() {
  const t = rotarTokenActor("CorpoSucumbíos");
  Logger.log("Nuevo token S4 Social: " + t);
}
function _rotarSucumbiosS5() {
  const t = rotarTokenActor("Sucumbíos Solidario");
  Logger.log("Nuevo token S5 Gobernanza: " + t);
}
