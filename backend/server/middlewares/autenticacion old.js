const jwt = require("jsonwebtoken");

let verificaToken = (req, res, next) => {
  let token = req.get("token");

  jwt.verify(token, process.env.SEED, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        ok: false,
        err: {
          message: "Token inválido",
        },
      });
    }
    req.usuario = decoded.usuario;
    next();
  });

  //   res.json({
  //     token: token,
  //   });
};

let verificaAdmin_role = (req, res, next) => {
  let usuario = req.usuario;

  if (usuario.role === "ADMIN_ROLE") {
    next();
  } else {
    return res.json({
      ok: false,
      err: {
        message: "El usuario no es administrador",
      },
    });
  }
};

let verificaCam_role = (req, res, next) => {
  let usuario = req.usuario;

  if (usuario.role === "USER_CAM") {
    next();
  } else {
    return res.json({
      ok: false,
      err: {
        message: "El usuario no es camionero",
      },
    });
  }
};

let verificaAdminCam_role = (req, res, next) => {
  let usuario = req.usuario;

  if (usuario.role === "USER_CAM" || usuario.role === "ADMIN_ROLE") {
    next();
  } else {
    return res.json({
      ok: false,
      err: {
        message: "El usuario no es camionero o administrador",
      },
    });
  }
};

let verificaAdminPrev_role = (req, res, next) => {
  let usuario = req.usuario;

  if (usuario.role === "USER_PREV" || usuario.role === "ADMIN_ROLE") {
    next();
  } else {
    return res.json({
      ok: false,
      err: {
        message: "El usuario no es preventista o administrador",
      },
    });
  }
};

module.exports = {
  verificaToken,
  verificaAdmin_role,
  verificaCam_role,
  verificaAdminCam_role,
  verificaAdminPrev_role,
};
