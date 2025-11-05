// File: src/layouts/DashboardLayout.jsx
import React, { useEffect, useMemo, useState } from 'react';
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
import ListAltIcon from '@mui/icons-material/ListAlt';
import HistoryIcon from '@mui/icons-material/History';
import DescriptionIcon from '@mui/icons-material/Description';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import ThemeSelector from '../components/ThemeSelector.jsx';
import Footer from '../components/Footer';
import logo from '../assets/logo.png';
import { getStoredUser } from '../utils/auth';
import { isPathAllowed, getFallbackPath } from '../constants/rolePermissions';

/* ----------------─ Menú lateral ─---------------- */
const navItems = [
  { label: 'Clientes', path: '/clients',   icon: <GroupIcon /> },
  { label: 'Usuarios', path: '/users',     icon: <PeopleAltIcon /> },
  { label: 'Productos', path: '/products',     icon: <Inventory2Icon /> }, // 👈 NUEVO
  { label: 'Documentos', path: '/documents', icon: <DescriptionIcon /> },
  { label: 'Comandas', path: '/comandas', icon: <ReceiptLongIcon /> },

  { label: 'Ordenes', path: '/ordenes', icon: <AssignmentTurnedInIcon /> },

  { label: 'Historial', path: '/historial-comandas', icon: <HistoryIcon /> },
  { label: 'Permisos', path: '/permissions', icon: <SecurityIcon /> },
  { label: 'Distribución', path: '/distribucion', icon: <DeliveryDiningIcon /> },
  { label: 'Logística', path: '/logistics',  icon: <LocalShippingIcon /> },
  { label: 'Precios', path: '/precios', icon: <PriceChangeIcon /> },
];

export default function DashboardLayout({ themeName, setThemeName }) {
  const [open, setOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [userRole, setUserRole] = useState(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  /* -------- Verifica token cada render -------- */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/login');

    const storedUser = getStoredUser();
    if (storedUser) {
      setNombreUsuario(storedUser.nombres ?? '');
      setUserRole(storedUser.role ?? 'USER_ROLE');
    } else {
      setNombreUsuario('');
      setUserRole('USER_ROLE');
    }
  }, [navigate]);

  useEffect(() => {
    if (!userRole) return;

    const fallback = getFallbackPath(userRole);
    const allowed = isPathAllowed(userRole, pathname);

    if ((pathname === '/' || !allowed) && fallback && pathname !== fallback) {
      navigate(fallback, { replace: true });
    }
  }, [userRole, pathname, navigate]);

  const filteredNavItems = useMemo(() => {
    if (!userRole) return [];
    return navItems.filter(({ path }) => isPathAllowed(userRole, path));
  }, [userRole]);

  /* -------- handlers logout -------- */
  const handleLogoutClick   = () => setConfirmLogoutOpen(true);
  const handleLogoutConfirm = () => {
    localStorage.clear();
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
          {filteredNavItems.map(({ label, path, icon }) => {
            const isSelected =
              path === '/ordenes'
                ? pathname.startsWith('/ordenes')
                : pathname.startsWith(path);

            return (
              <ListItemButton
                key={path}
                component={Link}
                to={path}
                selected={isSelected}
                onClick={() => setOpen(false)}
              >
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            );
          })}
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
