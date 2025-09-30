const express = require('express');
const router = express.Router();
const pool = require('../db');

function verificarAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  res.status(403).send('Acceso no autorizado.');
}

router.get('/', verificarAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT matricula FROM matriculas_disponibles WHERE is_asignada = FALSE ORDER BY matricula ASC"
    );
    res.render('admin_matriculas', {
      matriculas: result.rows,
      adminId: req.session.userId,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error al obtener matrículas:', error);
    res.status(500).send('Error interno del servidor.');
  }
});

router.post('/agregar', verificarAdmin, async (req, res) => {
  const { matricula } = req.body;
  if (!matricula) {
    return res.redirect('/admin/matriculas?error=La matrícula no puede estar vacía.');
  }
  try {
    await pool.query(
      "INSERT INTO matriculas_disponibles (matricula) VALUES ($1)",
      [matricula.trim()]
    );
    res.redirect('/admin/matriculas?success=Matrícula agregada exitosamente.');
  } catch (error) {
    if (error.code === '23505') {
      return res.redirect(`/admin/matriculas?error=La matrícula '${matricula}' ya existe.`);
    }
    console.error('Error al agregar matrícula:', error);
    res.redirect('/admin/matriculas?error=Error al agregar la matrícula.');
  }
});

router.post('/eliminar/:matricula', verificarAdmin, async (req, res) => {
  try {
    const { matricula } = req.params;
    await pool.query(
      "DELETE FROM matriculas_disponibles WHERE matricula = $1",
      [matricula]
    );
    res.redirect('/admin/matriculas?success=Matrícula eliminada exitosamente.');
  } catch (error) {
    console.error('Error al eliminar matrícula:', error);
    res.redirect('/admin/matriculas?error=Error al eliminar la matrícula.');
  }
});

module.exports = router;