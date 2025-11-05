import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  Stack,
  Divider,
} from '@mui/material';

const NAV_SCREENS = [
  { label: 'Clientes', path: '/clients' },
  { label: 'Usuarios', path: '/users' },
  { label: 'Productos', path: '/products' },
  { label: 'Documentos', path: '/documents' },
  { label: 'Comandas', path: '/comandas' },
  { label: 'Órdenes', path: '/ordenes' },
  { label: 'Historial de Comandas', path: '/historial-comandas' },
  { label: 'Permisos', path: '/permissions' },
  { label: 'Distribución', path: '/distribucion' },
  { label: 'Logística', path: '/logistics' },
  { label: 'Precios', path: '/precios' },
];

const ROLE_DESCRIPTIONS = {
  SUPER_ADMIN: 'Posee todos los permisos, accede y puede operar en todas las pantallas.',
  ADMIN_ROLE: 'Posee todos los permisos excepto acceso a la pantalla de Permisos.',
  USER_ROLE: 'Aún sin accesos asignados.',
  USER_CAM: 'Acceso exclusivo a la pantalla de Distribución.',
  USER_PREV: 'Accede solamente a las pantallas de Comandas y Clientes.',
};

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: NAV_SCREENS.map((screen) => screen.path),
  ADMIN_ROLE: NAV_SCREENS.filter((screen) => screen.path !== '/permissions').map((screen) => screen.path),
  USER_ROLE: [],
  USER_CAM: ['/distribucion'],
  USER_PREV: ['/comandas', '/clients'],
};

const ROLES = Object.keys(ROLE_PERMISSIONS);

const buildMatrix = () =>
  NAV_SCREENS.map((screen) => {
    const permissions = ROLES.reduce((acc, role) => {
      acc[role] = ROLE_PERMISSIONS[role].includes(screen.path);
      return acc;
    }, {});

    return {
      ...screen,
      permissions,
    };
  });

export default function PermissionsPage() {
  const usuarioActual = useMemo(() => {
    const storedUser = localStorage.getItem('usuario');
    if (!storedUser) return null;

    try {
      return JSON.parse(storedUser);
    } catch (error) {
      return { nombres: storedUser };
    }
  }, []);

  const matriz = useMemo(() => buildMatrix(), []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h5" fontWeight="bold">
            Configuración de permisos por rol
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Define qué pantallas del sistema están disponibles para cada tipo de usuario según la configuración del backend (ruta <code>/rutas/usuario.js</code>).
          </Typography>
          {usuarioActual?.role && (
            <Chip
              color="primary"
              label={`Tu rol actual: ${usuarioActual.role}`}
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            />
          )}
        </Stack>
      </Paper>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Accesos a pantallas por rol
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Pantalla</TableCell>
                {ROLES.map((role) => (
                  <TableCell key={role} align="center" sx={{ fontWeight: 'bold' }}>
                    {role}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {matriz.map((row) => (
                <TableRow key={row.path} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">{row.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Ruta: {row.path}
                      </Typography>
                    </Stack>
                  </TableCell>
                  {ROLES.map((role) => (
                    <TableCell key={`${row.path}-${role}`} align="center">
                      <Checkbox color="primary" checked={row.permissions[role]} disabled />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Descripción de roles
        </Typography>
        <Stack spacing={2}>
          {ROLES.map((role) => (
            <Box key={role}>
              <Typography variant="subtitle1" fontWeight="bold">
                {role}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {ROLE_DESCRIPTIONS[role]}
              </Typography>
            </Box>
          ))}
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary">
          Estas reglas se encuentran sincronizadas con las políticas definidas en el backend. Las pantallas no asignadas permanecen ocultas para cada rol.
        </Typography>
      </Paper>
    </Box>
  );
}
