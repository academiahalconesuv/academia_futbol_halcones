const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db');
// No usamos fs ni path para comprobantes, solo BD

// Configuración de multer en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF, JPG, PNG o DOCX.'));
  }
});

// Helpers de normalización
const capitalizeWords = text =>
  text
    ? text
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : null;
const capitalizeFirstLetter = text =>
  text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : null;

// GET: Formulario de registro de alumno
router.get('/registro-alumno', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/users/login');
  res.render('registro_alumno', { userId: req.session.userId });
});

// GET: Panel de administración
router.get('/admin-panel/:id', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).send('Acceso no autorizado.');
  try {
    const usersRes = await pool.query('SELECT user_id, email FROM users WHERE is_admin = FALSE');
    const alumnosRes = await pool.query('SELECT * FROM registro_alumno');
    res.render('admin_panel', {
      adminId: req.params.id,
      users: usersRes.rows,
      alumnos: alumnosRes.rows
    });
  } catch (error) {
    console.error('Error al cargar admin_panel:', error);
    res.status(500).send('Error interno del servidor.');
  }
});

// POST: Registrar alumno
// Ruta para registrar un alumno (POST)
router.post(
  '/registro-alumno',
  upload.fields([
    { name: 'acta-nacimiento', maxCount: 1 },
    { name: 'certificado-medico', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const userId = req.session.userId;

      let {
        'curso-interes': cursoInteres,
        'categoria-horario': categoriaHorario,
        'nombre-nino': nombreNino,
        edad,
        'fecha-nacimiento': fechaNacimiento,
        sexo,
        'talla-camiseta': tallaCamiseta,
        estatura,
        peso,
        'centro-educativo': centroEducativo,
        'seguro-medico': seguroMedico,
        'nombre-seguro': nombreSeguro,
        'nombre-tutor': nombreTutor,
        'telefono-contacto': telefonoContacto,
        'correo-electronico': correoElectronico,
        direccion,
        alergias,
        'detalle-alergias': detalleAlergias,
        'alergico-medicamento': alergicoMedicamento,
        'detalle-medicamento': detalleMedicamento,
        'actividad-fisica': actividadFisica,
        'detalle-deporte': detalleDeporte,
        'practico-futbol': practicoFutbol,
        'equipos-participados': equiposParticipados,
        'posicion-campo': posicionCampo,
        habilidades,
        enterado,
        'otra-fuente': otraFuente,
        'hermano-inscrito': hermanoInscrito,
        'nombre-hermano': nombreHermano,
        expectativas,
      } = req.body;

      sexo = capitalizeFirstLetter(sexo);
      tallaCamiseta = tallaCamiseta.toUpperCase();
      nombreNino = capitalizeWords(nombreNino);
      centroEducativo = capitalizeWords(centroEducativo);
      nombreSeguro = capitalizeWords(nombreSeguro);
      nombreTutor = capitalizeWords(nombreTutor);
      nombreHermano = capitalizeWords(nombreHermano);
      detalleAlergias = capitalizeFirstLetter(detalleAlergias);
      detalleMedicamento = capitalizeFirstLetter(detalleMedicamento);
      detalleDeporte = capitalizeFirstLetter(detalleDeporte);

      const actaNacimiento = req.files['acta-nacimiento']
        ? req.files['acta-nacimiento'][0].buffer
        : null;
      const certificadoMedico = req.files['certificado-medico']
        ? req.files['certificado-medico'][0].buffer
        : null;

      const nuevoAlumno = await pool.query(
        `INSERT INTO registro_alumno (
          user_id, 
          curso_interes,
          categoria_horario,
          nombre_nino,
          edad,
          fecha_nacimiento,
          sexo,
          talla_camiseta,
          estatura,
          peso,
          centro_educativo,
          seguro_medico,
          nombre_seguro,
          acta_nacimiento,
          certificado_medico,
          nombre_tutor,
          telefono_contacto,
          correo_electronico,
          direccion,
          alergias,
          detalle_alergias,
          alergico_medicamento,
          detalle_medicamento,
          actividad_fisica,
          detalle_deporte,
          practico_futbol,
          equipos_participados,
          posicion_campo,
          habilidades,
          enterado,
          otra_fuente,
          hermano_inscrito,
          nombre_hermano,
          expectativas
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34) RETURNING *`,
        [
          userId,
          cursoInteres,
          categoriaHorario,
          nombreNino,
          edad,
          fechaNacimiento,
          sexo,
          tallaCamiseta,
          estatura,
          peso,
          centroEducativo,
          seguroMedico === 'si',
          nombreSeguro || null,
          actaNacimiento,
          certificadoMedico,
          nombreTutor,
          telefonoContacto,
          correoElectronico,
          direccion,
          alergias === 'si',
          detalleAlergias || null,
          alergicoMedicamento === 'si',
          detalleMedicamento || null,
          actividadFisica === 'si',
          detalleDeporte || null,
          practicoFutbol === 'si',
          equiposParticipados || null,
          posicionCampo || null,
          habilidades || null,
          enterado,
          otraFuente || null,
          hermanoInscrito === 'si',
          nombreHermano || null,
          expectativas || null,
        ]
      );

      const alumnoId = nuevoAlumno.rows[0].id;

      res.redirect(`/panel-principal/${userId}`);
    } catch (error) {
      console.error('Error al registrar al alumno:', error);
      res.status(500).json({
        message: 'Error al registrar al alumno. Inténtelo de nuevo más tarde.',
      });
    }
  }
);

// POST: Subir comprobante (mensualidad o inscripción)
router.post(
  '/alumno/:id/comprobante',
  upload.single('comprobante'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const tipo = req.body.tipo_comprobante;
      const file = req.file;
      if (!file) return res.status(400).send('Debe subir un comprobante.');
      await pool.query(
        `INSERT INTO comprobantes_pago (
           alumno_id,
           nombre_archivo,
           estado,
           tipo_comprobante,
           fecha_subida,
           archivo_data
         ) VALUES ($1,$2,'pendiente',$3,NOW(),$4)`,
        [id, file.originalname, tipo, file.buffer]
      );
      res.redirect(`/alumno/${id}`);
    } catch (err) {
      console.error('Error al subir comprobante:', err);
      res.status(500).send('Error interno al subir comprobante.');
    }
  }
);

// GET: Descargar comprobante (usuario)
router.get(
  '/alumno/:id/comprobante/:cid/descargar',
  async (req, res) => {
    try {
      const { cid } = req.params;
      const result = await pool.query(
        'SELECT nombre_archivo, archivo_data FROM comprobantes_pago WHERE id=$1',
        [cid]
      );
      if (result.rowCount === 0) return res.status(404).send('Comprobante no encontrado.');
      const { nombre_archivo, archivo_data } = result.rows[0];
      res.setHeader('Content-Disposition', `attachment; filename="${nombre_archivo}"`);
      res.send(archivo_data);
    } catch (err) {
      console.error('Error al descargar comprobante:', err);
      res.status(500).send('Error interno al descargar comprobante.');
    }
  }
);

// DELETE: Eliminar alumno
router.delete('/alumno/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.session || !req.session.userId) return res.status(401).json({ message: 'Usuario no autenticado' });
    const delRes = await pool.query('DELETE FROM registro_alumno WHERE id=$1 RETURNING *',[id]);
    if (delRes.rowCount === 0) return res.status(404).json({ message: 'Alumno no encontrado' });
    res.json({ message: 'Alumno eliminado exitosamente' });
  } catch (err) {
    console.error('Error al eliminar alumno:', err);
    res.status(500).json({ message: 'Error interno al eliminar alumno.' });
  }
});

// GET: Detalle de alumno incluyendo comprobantes
router.get(
  '/alumno/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.session || !req.session.userId) return res.redirect('/users/login');
      const alumRes = await pool.query('SELECT * FROM registro_alumno WHERE id=$1',[id]);
      if (alumRes.rowCount === 0) return res.status(404).send('Alumno no encontrado.');
      const alumno = alumRes.rows[0];
      const compRes = await pool.query(`SELECT *, DATE_PART('day', fecha_vencimiento::timestamp - NOW()::timestamp) AS dias_restantes FROM comprobantes_pago WHERE alumno_id=$1 ORDER BY fecha_subida DESC`,[id]);
      const filas = compRes.rows;
      const comprobanteMensualidad = filas.find(c => c.tipo_comprobante==='mensualidad')||null;
      const comprobanteInscripcion = filas.find(c => c.tipo_comprobante==='inscripcion')||null;
      res.render('detalle_alumno', { alumno, comprobanteMensualidad, comprobanteInscripcion, userId: req.session.userId });
    } catch (err) {
      console.error('Error al obtener detalles del alumno:', err);
      res.status(500).send('Error interno al obtener detalles del alumno.');
    }
  }
);

module.exports = router;
