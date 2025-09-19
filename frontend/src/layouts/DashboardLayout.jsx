// File: src/layouts/DashboardLayout.jsx
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import {
  IconButton,
  Tooltip,
  AppBar,
  Box,
  Drawer,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import GroupIcon from '@mui/icons-material/Group';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';   // 👈 NUEVO ícono
import Inventory2Icon from '@mui/icons-material/Inventory2';
import SecurityIcon from '@mui/icons-material/Security';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionIcon from '@mui/icons-material/Description';
import ThemeSelector from '../components/ThemeSelector.jsx';
import Footer from '../components/Footer';
import logo from '../assets/logo.png';
import { AuthContext } from '../context/AuthContext.jsx';

/* ----------------─ Menú lateral ─---------------- */
const navItems = [
  { label: 'Clientes', path: '/clients',   icon: <GroupIcon /> },
  { label: 'Usuarios', path: '/users',     icon: <PeopleAltIcon /> },
  { label: 'Productos', path: '/products',     icon: <Inventory2Icon /> }, // 👈 NUEVO
  { label: 'Documentos', path: '/documents', icon: <DescriptionIcon /> },
  { label: 'Comandas', path: '/comandas', icon: <ReceiptLongIcon /> },
  { label: 'Historial', path: '/historial-comandas', icon: <HistoryIcon /> },
  { label: 'Permisos', path: '/permissions', icon: <SecurityIcon /> },
  { label: 'Logística', path: '/logistics',  icon: <LocalShippingIcon /> },
];

export default function DashboardLayout({ themeName, setThemeName }) {
  const [open, setOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { token, user, clearSession } = useContext(AuthContext) ?? {};

  const nombreUsuario = useMemo(() => {
    if (!user) return '';
    if (typeof user === 'string') return user;
    const nombres = user?.nombres ?? '';
    const apellidos = user?.apellidos ?? '';
    const fullName = `${nombres} ${apellidos}`.trim();
    return fullName || user?.email || '';
  }, [user]);

  /* -------- Verifica token cada render -------- */
  useEffect(() => {
    if (!token) navigate('/login');
  }, [navigate, token]);

  /* -------- handlers logout -------- */
  const handleLogoutClick   = () => setConfirmLogoutOpen(true);
  const handleLogoutConfirm = () => {
    setConfirmLogoutOpen(false);
    clearSession?.();
    navigate('/login');
  };
  const handleLogoutCancel  = () => setConfirmLogoutOpen(false);

  /* -------- render -------- */
  return (
    <Box sx={{ display: 'flex' }}>
      {/* ───────── AppBar superior ───────── */}
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setOpen(!open)}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            SIG – Gestión
          </Typography>

          <Typography variant="body1" sx={{ mr: 2 }}>
            {nombreUsuario}
          </Typography>

          <ThemeSelector themeName={themeName} setThemeName={setThemeName} />

          <Tooltip title="Cerrar sesión">
            <IconButton color="inherit" onClick={handleLogoutClick}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>

          <Box
            component="img"
            src={logo}
            alt="Logo"
            sx={{ height: 40, ml: 2, opacity: 0.9 }}
          />
        </Toolbar>
      </AppBar>

      {/* ───────── Drawer lateral ───────── */}
      <Drawer variant="persistent" open={open}>
        <Toolbar />
        <List>
          {navItems.map(({ label, path, icon }) => (
            <ListItemButton
              key={path}
              component={Link}
              to={path}
              selected={pathname.startsWith(path)}
              onClick={() => setOpen(false)}
            >
              <ListItemIcon>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* ───────── Contenido principal ───────── */}
      <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Toolbar />
        <Box sx={{ flexGrow: 1, p: 3 }}>
          <Outlet />
        </Box>
        <Footer />
      </Box>

      {/* ───────── Diálogo de confirmación Logout ───────── */}
      <Dialog open={confirmLogoutOpen} onClose={handleLogoutCancel}>
        <DialogTitle>¿Cerrar sesión?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vas a cerrar tu sesión actual. ¿Estás seguro?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLogoutCancel} color="primary">
            Cancelar
          </Button>
          <Button onClick={handleLogoutConfirm} color="error" autoFocus>
            Cerrar sesión
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
