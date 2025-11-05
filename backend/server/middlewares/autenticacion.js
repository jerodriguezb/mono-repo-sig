// middlewares/autenticacion.js
// -----------------------------------------------------------------------------
// Versión modernizada (Node 22 / Mongoose 8) con:
//   • Soporte estándar “Authorization: Bearer <token>” (+ fallbacks)
//   • async/await + jwt.verify promisificado
//   • Helper único para errores y única función genérica de roles
// -----------------------------------------------------------------------------

const jwt = require('jsonwebtoken');
const { promisify } = require('util');

// -----------------------------------------------------------------------------
// Config & constantes ----------------------------------------------------------
const JWT_SECRET   = process.env.JWT_SECRET || process.env.SEED;      // retro‑compat
const ROLES = {
  SUPER  : 'SUPER_ADMIN',
  ADMIN  : 'ADMIN_ROLE',
  CAMION : 'USER_CAM',
  PREV   : 'USER_PREV',
};

// -----------------------------------------------------------------------------
// Helpers de utilidad ----------------------------------------------------------
const unauthorized = (res, msg = 'No autorizado', code = 401) =>
  res.status(code).json({ ok: false, err: { message: msg } });

/** Extrae el token desde Authorization Bearer, header `token` o query param. */
const getToken = (req) => {
  const auth = req.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return req.get('token') || req.query.token || null;
};

const verifyAsync = promisify(jwt.verify);

// -----------------------------------------------------------------------------
// Middleware principal: valida JWT y añade `req.usuario` ----------------------
const verificaToken = async (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) return unauthorized(res, 'Token requerido');

    const decoded = await verifyAsync(token, JWT_SECRET);
    req.usuario = decoded;            // incluye { _id, role, … } según payload
    next();
  } catch (_) {
    unauthorized(res, 'Token inválido');
  }
};

// -----------------------------------------------------------------------------
// Middleware genérico de roles -------------------------------------------------
/** Uso: `checkRole(ROLES.ADMIN)`, `checkRole(ROLES.ADMIN, ROLES.CAMION)` … */
const checkRole = (...roles) => (req, res, next) => {
  const role = req.usuario?.role;
  if (role === ROLES.SUPER || roles.includes(role)) return next();
  return unauthorized(res, 'Permiso denegado', 403);
};

// Middlewares específicos conservando nombres originales ----------------------
const verificaAdmin_role      = checkRole(ROLES.ADMIN);
const verificaCam_role        = checkRole(ROLES.CAMION);
const verificaAdminCam_role   = checkRole(ROLES.ADMIN,  ROLES.CAMION);
const verificaAdminPrev_role  = checkRole(ROLES.ADMIN,  ROLES.PREV);

// -----------------------------------------------------------------------------
// Exportaciones ---------------------------------------------------------------
module.exports = {
  verificaToken,
  verificaAdmin_role,
  verificaCam_role,
  verificaAdminCam_role,
  verificaAdminPrev_role,
  ROLES,                     // opcional por si se quieren reutilizar
};
