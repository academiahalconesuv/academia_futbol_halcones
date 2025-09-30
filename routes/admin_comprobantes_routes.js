const express = require('express');
const router = express.Router();
const pool = require('../db'); // Conexión a la base de datos

// Función para obtener el último día del mes de la fecha dada
function ultimoDiaDelMes(fecha) {
  const temp = new Date(fecha.getTime());
  temp.setMonth(temp.getMonth() + 1);
  temp.setDate(1);
  temp.setDate(temp.getDate() - 1);
  return temp;
}

// LISTADO DE COMPROBANTES (ADMIN)
router.get('/', async (req, res) => {
  try {
    if (!req.session || !req.session.isAdmin) {
      return res.status(403).send('Acceso no autorizado.');
    }

    const result = await pool.query(`
      SELECT
        cp.id,
        cp.nombre_archivo   AS archivo,
        cp.tipo_comprobante,
        cp.estado,
        cp.periodo,
        cp.fecha_subida,
        cp.fecha_vencimiento,
        ra.nombre_nino,
        ra.correo_electronico
      FROM comprobantes_pago cp
      INNER JOIN registro_alumno ra ON cp.alumno_id = ra.id
      ORDER BY cp.fecha_subida DESC
    `);
    const comprobantes = result.rows;

    // Filtramos todos los aprobados
    const aprobados = comprobantes.filter(c => c.estado === 'aprobado');

    // **CAMBIO PRINCIPAL**: En lugar de un solo array 'aprobados', creamos dos específicos.
    res.render('admin_comprobantes', {
      aprobadosMensualidad: aprobados.filter(c => c.tipo_comprobante === 'mensualidad'), // Aprobados de mensualidad
      aprobadosInscripcion: aprobados.filter(c => c.tipo_comprobante === 'inscripcion'), // Aprobados de inscripción
      pendientes: comprobantes.filter(c => c.estado === 'pendiente'),
      rechazados: comprobantes.filter(c => c.estado === 'rechazado'),
      vencidos: comprobantes.filter(c => c.estado === 'vencido'),
      adminId: req.session.userId,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Error al cargar comprobantes:', err);
    res.status(500).send('Error interno del servidor.');
  }
});

// DESCARGA DE COMPROBANTE (ADMIN) — desde BD
router.get('/:id/descargar', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT nombre_archivo, archivo_data FROM comprobantes_pago WHERE id = $1',
      [id]
    );
    if (result.rowCount === 0) {
      return res.redirect('/admin/comprobantes?error=Comprobante no encontrado.');
    }

    const { nombre_archivo, archivo_data } = result.rows[0];
    res.setHeader('Content-Disposition', `attachment; filename="${nombre_archivo}"`);
    return res.send(archivo_data);
  } catch (err) {
    console.error('Error al descargar comprobante:', err);
    res.status(500).send('Error interno al descargar el comprobante.');
  }
});

// APROBACIÓN DE COMPROBANTE (ADMIN)
router.post('/:id/aprobar', async (req, res) => {
  try {
    const { id } = req.params;
    const { periodo } = req.body;

    const ahora = new Date();
    let fechaVencimiento;

    switch (periodo) {
      case 'un_minuto':
        fechaVencimiento = new Date(ahora.setMinutes(ahora.getMinutes() + 1));
        break;
      case 'mensual':
        fechaVencimiento = ultimoDiaDelMes(ahora);
        break;
      case 'bimestral':
        const next = new Date(ahora.setMonth(ahora.getMonth() + 1));
        fechaVencimiento = ultimoDiaDelMes(next);
        break;
      // --- NUEVO CASO AÑADIDO ---
      case 'anual':
  const anioActual = ahora.getFullYear();
  // Establece la fecha de vencimiento para el 31 de diciembre del año actual
  fechaVencimiento = new Date(anioActual, 11, 31); // El mes 11 es Diciembre (porque se cuenta de 0 a 11)
  break;
      default:
        // Mensaje de error actualizado para incluir la nueva opción
        return res.status(400).send('Periodo inválido. Usa un_minuto, mensual, bimestral o anual.');
    }

    const actual = await pool.query(
      'SELECT alumno_id FROM comprobantes_pago WHERE id = $1',
      [id]
    );
    if (actual.rowCount === 0) {
      return res.status(404).send('Comprobante no encontrado.');
    }
    const alumnoId = actual.rows[0].alumno_id;

    await pool.query(
      `DELETE FROM comprobantes_pago
         WHERE alumno_id = $1
           AND estado IN ('rechazado', 'vencido')
           AND id <> $2`,
      [alumnoId, id]
    );

     await pool.query(
      `UPDATE comprobantes_pago
        SET estado = 'aprobado',
          periodo = $1,
          fecha_vencimiento = $2,
         fecha_aprobacion = NOW()
         WHERE id = $3`,
[periodo, fechaVencimiento, id]
);
    res.redirect('/admin/comprobantes');
  } catch (err) {
    console.error('Error al aprobar comprobante:', err);
    res.status(500).send('Error interno al aprobar el comprobante.');
  }
});

// RECHAZO DE COMPROBANTE (ADMIN)
router.post('/:id/rechazar', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE comprobantes_pago
         SET estado = 'rechazado', periodo = NULL, fecha_vencimiento = NULL
       WHERE id = $1`,
      [id]
    );
    res.redirect('/admin/comprobantes');
  } catch (err) {
    console.error('Error al rechazar comprobante:', err);
    res.status(500).send('Error interno al rechazar el comprobante.');
  }
});

// ELIMINACIÓN DE COMPROBANTE (ADMIN) — solo BD
router.post('/:id/eliminar', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM comprobantes_pago WHERE id = $1', [id]);
    res.redirect('/admin/comprobantes');
  } catch (err) {
    console.error('Error al eliminar comprobante:', err);
    res.status(500).send('Error interno al eliminar comprobante.');
  }
});
// RUTA PARA VENCER UN COMPROBANTE MANUALMENTE
router.post('/:id/vencer', async (req, res) => {
  try {
    const { id } = req.params;
    
    // La consulta ahora cambia el estado a 'vencido'.
    await pool.query(
      `UPDATE comprobantes_pago
         SET estado = 'vencido', 
             periodo = NULL, 
             fecha_vencimiento = NULL
       WHERE id = $1`,
      [id]
    );

    console.log(`Comprobante ${id} vencido manualmente por un admin.`);
    res.redirect('/admin/comprobantes');

  } catch (err) {
    console.error('Error al vencer comprobante:', err);
    res.status(500).send('Error interno al vencer el comprobante.');
  }
});

module.exports = router;