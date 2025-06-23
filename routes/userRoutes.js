const express = require('express');
const router = express.Router();
const pool = require('../db'); // Importar la conexión a la base de datos desde db.js
const bcrypt = require('bcrypt');

// --- AÑADIR ESTA FUNCIÓN DE MIDDLEWARE ---
// Para proteger las rutas que requieren que el usuario esté logueado.
function verificarAutenticacion(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/users/login');
}
router.get('/olvide-contrasena', (req, res) => {
  res.render('cambio_contrasena1'); // Renderiza tu nueva página
});
// Ruta para renderizar el formulario de inicio de sesión
router.get('/login', (req, res) => {
  res.render('login'); // Renderiza el archivo views/login.ejs
});


// --- REEMPLAZAR LA RUTA EXISTENTE /cambio-contrasena CON ESTAS DOS ---

// GET: MUESTRA EL FORMULARIO PARA CAMBIAR LA CONTRASEÑA
router.get('/cambiar-contrasena', verificarAutenticacion, (req, res) => {
  res.render('cambiar_contrasena', {
    userId: req.session.userId,
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// POST: PROCESA EL CAMBIO DE CONTRASEÑA DEL USUARIO LOGUEADO
 router.post('/cambiar-contrasena', verificarAutenticacion, async (req, res) => {
  const { contrasena_actual, nueva_contrasena, confirmar_contrasena } = req.body;
  const userId = req.session.userId;

  // Validamos que las contraseñas nuevas coincidan
  if (nueva_contrasena !== confirmar_contrasena) {
    return res.redirect('/users/cambiar-contrasena?error=La nueva contraseña y su confirmación no coinciden.');
  }

  // --- INICIO DEL CAMBIO ---
  // Usamos la misma regla de seguridad que en el registro para consistencia
  const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9!@#$%^&*]).{8,}$/;
  if (!passwordRegex.test(nueva_contrasena)) {
    return res.redirect('/users/cambiar-contrasena?error=La contraseña debe tener al menos 8 caracteres, una mayúscula y un número o símbolo.');
  }
  // --- FIN DEL CAMBIO ---

  try {
    // Obtenemos la contraseña actual del usuario desde la BD
    const userResult = await pool.query('SELECT password FROM users WHERE user_id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.redirect('/users/cambiar-contrasena?error=Usuario no encontrado.');
    }
    const hashedPassword = userResult.rows[0].password;

    // Comparamos la contraseña actual que el usuario ingresó con la de la BD
    const match = await bcrypt.compare(contrasena_actual, hashedPassword);
    if (!match) {
      return res.redirect('/users/cambiar-contrasena?error=La contraseña actual es incorrecta.');
    }

    // Si todo es correcto, encriptamos y guardamos la nueva contraseña
    const newHashedPassword = await bcrypt.hash(nueva_contrasena, 10);
    await pool.query('UPDATE users SET password = $1 WHERE user_id = $2', [newHashedPassword, userId]);

    // Redirigimos al panel principal con un mensaje de éxito
    res.redirect(`/panel-principal/${userId}?success=Contraseña actualizada exitosamente.`);

  } catch (error) {
    console.error('Error al cambiar la contraseña:', error);
    res.redirect('/users/cambiar-contrasena?error=Error interno del servidor.');
  }
});


// Ruta de inicio de sesión (método POST) - SIN CAMBIOS
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Correo electrónico o contraseña incorrectos' });
    }
    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Correo electrónico o contraseña incorrectos' });
    }
    req.session.userId = user.user_id;
    req.session.isAdmin = user.is_admin;
    console.log("🛠️ Sesión almacenada:", req.session);
    req.session.save(() => {
      res.status(200).json({
        message: 'Inicio de sesión correcto',
        redirectUrl: user.is_admin 
          ? `/admin-panel/${user.user_id}` 
          : `/panel-principal/${user.user_id}`
      });
    });
  } catch (error) {
    console.error('❌ Error al iniciar sesión:', error);
    res.status(500).json({ message: 'Error al iniciar sesión. Inténtelo de nuevo más tarde.' });
  }
});

// Ruta para registrar un nuevo usuario (POST) - SIN CAMBIOS
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|hotmail\.com)$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'El correo debe ser un correo válido de Gmail, Outlook, o Hotmail.' });
  }
  const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9!@#$%^&*]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: 'La contraseña debe contener al menos una letra mayúscula, un número o signo, y tener un mínimo de 8 caracteres.' });
  }
  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'El correo ya está registrado.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await pool.query(
      'INSERT INTO users (email, password, is_admin) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, false]
    );
    console.log("✅ Usuario registrado correctamente:", newUser.rows[0]);
    res.status(201).json({ message: 'Usuario registrado exitosamente', redirectUrl: '/users/login' });
  } catch (error) {
    console.error('❌ Error al registrar el usuario:', error);
    res.status(500).json({ message: `Error al registrar el usuario. Detalles: ${error.message}` });
  }
});

// Ruta para cerrar sesión (GET) - SIN CAMBIOS
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error al cerrar sesión. Inténtelo de nuevo más tarde.' });
    }
    res.clearCookie('connect.sid');
    res.redirect('/users/login');
  });
});

module.exports = router;