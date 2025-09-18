import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { postLogin } from "../api/rutaUsuarios"; // tu helper original
// import fondoLogo from "../assets/logo.png"; // 🖼 asegurate de tener esta imagen en src/assets/
import { useAuth } from "../context/AuthContextState.js";

const LoginForm = () => {
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState({ email: "", password: "" });
  const [user, setUser] = useState({ data: { ok: null }, loading: false });
  const { token, login: authLogin, logout: authLogout } = useAuth();

  useEffect(() => {
    if (user.data.ok) {
      authLogin({ token: user.data.token, user: user.data.usuario });
      navigate("/");
    }
  }, [authLogin, navigate, user]);

  useEffect(() => {
    if (token) {
      navigate("/");
    }
  }, [navigate, token]);

  const logout = useCallback(() => {
    authLogout();
    navigate("/login");
  }, [authLogout, navigate]);

  const resetTimer = useCallback(() => {
    clearTimeout(window.inactivityTimeout);
    window.inactivityTimeout = setTimeout(logout, 600000); // 10 min
  }, [logout]);

  useEffect(() => {
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(window.inactivityTimeout);
    };
  }, [resetTimer]);

  const handleChange = (e) => {
    setFormValues({ ...formValues, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUser((prev) => ({ ...prev, loading: true }));
    const result = await postLogin(formValues);
    setUser(result);
    setFormValues({ email: "", password: "" });
  };

  if (token) {
    navigate("/");
    return null;
  }

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f2f5",
        overflow: "hidden",
      }}
    >
      {/* Imagen de fondo como marca de agua */}
      {/* <Box
        component="img"
        src={fondoLogo}
        alt="Fondo"
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.04,
          filter: "brightness(0.8)",
          width: { xs: "100%", sm: "70%", md: "500px" },
          zIndex: 0,
          pointerEvents: "none",
        }}
      /> */}

      {/* Formulario */}
      <Container maxWidth="xs" sx={{ position: "relative", zIndex: 1 }}>
        <Paper
          elevation={6}
          sx={{
            p: 4,
            borderRadius: 3,
            backdropFilter: "blur(4px)",
            backgroundColor: "rgba(255,255,255,0.97)",
          }}
        >
          <Typography variant="h5" textAlign="center" fontWeight="bold" mb={2}>
            APP SID
          </Typography>
           <Typography variant="h7" textAlign="center" fontWeight="bold" mb={2}>
            SISTEMA INTEGRAL DE DISTRIBUCION
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              label="Correo electrónico"
              name="email"
              type="email"
              fullWidth
              value={formValues.email}
              onChange={handleChange}
              margin="normal"
              required
            />
            <TextField
              label="Contraseña"
              name="password"
              type="password"
              fullWidth
              value={formValues.password}
              onChange={handleChange}
              margin="normal"
              required
            />
            {user.data.ok === false && (
              <Typography color="error" mt={1} textAlign="center">
                {user.data.err?.message || "Error al iniciar sesión"}
              </Typography>
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={user.loading}
            >
              {user.loading ? "Validando..." : "Iniciar sesión"}
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginForm;
