const express = require('express');
const router = express.Router();
const pool = require('../db'); // Asegúrate que la ruta a tu conexión de DB sea correcta

// Middleware para verificar si el usuario es administrador
function verificarAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  res.status(403).send('Acceso no autorizado.');
}

// GET: Muestra la página de gestión de categorías con todas las categorías
router.get('/', verificarAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias ORDER BY nombre ASC');
    res.render('admin_categorias', {
      categorias: result.rows,
      adminId: req.session.userId,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error al obtener las categorías:', error);
    res.status(500).send('Error interno del servidor.');
  }
});

// POST: Agrega una nueva categoría
router.post('/agregar', verificarAdmin, async (req, res) => {
  const { nombre, horario } = req.body;
  if (!nombre || !horario) {
    return res.redirect('/admin/categorias?error=El nombre y el horario son obligatorios.');
  }
  try {
    await pool.query(
      "INSERT INTO categorias (nombre, horario) VALUES ($1, $2)",
      [nombre.trim(), horario.trim()]
    );
    res.redirect('/admin/categorias?success=Categoría agregada exitosamente.');
  } catch (error) {
    console.error('Error al agregar categoría:', error);
    res.redirect('/admin/categorias?error=Error al agregar la categoría.');
  }
});

// POST: Edita una categoría existente
router.post('/editar/:id', verificarAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, horario, is_activa }
  = req.body;

  // Convertir 'on' a booleano para el checkbox
  const activa = is_activa === 'on' ? true : false;

  if (!nombre || !horario) {
    return res.redirect('/admin/categorias?error=El nombre y el horario son obligatorios.');
  }

  try {
    await pool.query(
      "UPDATE categorias SET nombre = $1, horario = $2, is_activa = $3 WHERE id = $4",
      [nombre.trim(), horario.trim(), activa, id]
    );
    res.redirect('/admin/categorias?success=Categoría actualizada exitosamente.');
  } catch (error) {
    console.error('Error al editar categoría:', error);
    res.redirect('/admin/categorias?error=Error al editar la categoría.');
  }
});

// POST: Elimina una categoría
router.post('/eliminar/:id', verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM categorias WHERE id = $1", [id]);
    res.redirect('/admin/categorias?success=Categoría eliminada exitosamente.');
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.redirect('/admin/categorias?error=Error al eliminar la categoría.');
  }
});


module.exports = router;