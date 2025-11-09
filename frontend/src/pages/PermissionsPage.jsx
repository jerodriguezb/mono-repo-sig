import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { fetchPermissions, savePermissions } from '../api/permissions';

const FALLBACK_SCREENS = [
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

const ROLE_ORDER = ['SUPER_ADMIN', 'ADMIN_ROLE', 'USER_ROLE', 'USER_CAM', 'USER_PREV'];

const cloneMatrix = (matrix = {}) =>
  Object.fromEntries(
    Object.entries(matrix).map(([role, screens]) => [role, Array.isArray(screens) ? [...screens] : []]),
  );

const ROLE_DESCRIPTIONS = {
  SUPER_ADMIN: 'Posee todos los permisos, accede y puede operar en todas las pantallas.',
  ADMIN_ROLE: 'Posee todos los permisos excepto acceso a la pantalla de Permisos.',
  USER_ROLE: 'Aún sin accesos asignados.',
  USER_CAM: 'Acceso exclusivo a la pantalla de Distribución.',
  USER_PREV: 'Accede solamente a las pantallas de Comandas y Clientes.',
};

const DEFAULT_MATRIX = {
  SUPER_ADMIN: FALLBACK_SCREENS.map((screen) => screen.path),
  ADMIN_ROLE: FALLBACK_SCREENS.filter((screen) => screen.path !== '/permissions').map((screen) => screen.path),
  USER_ROLE: [],
  USER_CAM: ['/distribucion'],
  USER_PREV: ['/comandas', '/clients'],
};

const broadcastPermissionsUpdate = (permissions) => {
  try {
    window.dispatchEvent(new CustomEvent('role-permissions-updated', { detail: permissions }));
  } catch {
    // Ignora si el ambiente no soporta CustomEvent (SSR, tests)
  }
};

const sortRoles = (matrix = {}) => {
  const keys = Object.keys(matrix);
  const sorted = ROLE_ORDER.filter((role) => keys.includes(role));
  keys.forEach((role) => {
    if (!sorted.includes(role)) sorted.push(role);
  });
  return sorted;
};

const buildTableMatrix = (screens = [], roles = [], matrix = {}) =>
  screens.map((screen) => {
    const permissions = roles.reduce((acc, role) => {
      acc[role] = (matrix[role] || []).includes(screen.path);
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
    } catch {
      return { nombres: storedUser };
    }
  }, []);

  const [matrix, setMatrix] = useState(cloneMatrix(DEFAULT_MATRIX));
  const [originalMatrix, setOriginalMatrix] = useState(cloneMatrix(DEFAULT_MATRIX));
  const [screens, setScreens] = useState(FALLBACK_SCREENS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPermissions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPermissions();
        if (!active) return;

        const permissions = cloneMatrix(data.permissions || DEFAULT_MATRIX);
        const availableScreens = Array.isArray(data.screens) && data.screens.length > 0 ? data.screens : FALLBACK_SCREENS;

        setMatrix(permissions);
        setOriginalMatrix(permissions);
        setScreens(availableScreens);
        localStorage.setItem('rolePermissions', JSON.stringify(permissions));
        broadcastPermissionsUpdate(permissions);
      } catch {
        if (!active) return;
        setError('No se pudieron obtener los permisos actuales. Se muestran los valores por defecto.');
        const fallback = cloneMatrix(DEFAULT_MATRIX);
        setMatrix(fallback);
        setOriginalMatrix(fallback);
        localStorage.setItem('rolePermissions', JSON.stringify(fallback));
        broadcastPermissionsUpdate(fallback);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPermissions();
    return () => {
      active = false;
    };
  }, []);

  const roles = useMemo(() => {
    const current = sortRoles(matrix);
    return current.length ? current : sortRoles(DEFAULT_MATRIX);
  }, [matrix]);

  const tableMatrix = useMemo(
    () => buildTableMatrix(screens, roles, matrix),
    [screens, roles, matrix],
  );

  const hasChanges = useMemo(() => {
    const allRoles = new Set([...Object.keys(matrix || {}), ...Object.keys(originalMatrix || {})]);
    for (const role of allRoles) {
      const current = [...(matrix?.[role] || [])].sort();
      const original = [...(originalMatrix?.[role] || [])].sort();
      if (current.length !== original.length) return true;
      for (let i = 0; i < current.length; i += 1) {
        if (current[i] !== original[i]) return true;
      }
    }
    return false;
  }, [matrix, originalMatrix]);

  const handleToggle = useCallback((role, path) => {
    setMatrix((prev) => {
      const current = new Set(prev[role] || []);
      if (current.has(path)) current.delete(path);
      else current.add(path);
      return {
        ...prev,
        [role]: Array.from(current),
      };
    });
    setSuccess(false);
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    setMatrix(cloneMatrix(originalMatrix));
    setSuccess(false);
    setError(null);
  }, [originalMatrix]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const data = await savePermissions(matrix);
      const permissions = cloneMatrix(data.permissions || DEFAULT_MATRIX);
      const availableScreens = Array.isArray(data.screens) && data.screens.length > 0 ? data.screens : FALLBACK_SCREENS;

      setMatrix(permissions);
      setOriginalMatrix(permissions);
      setScreens(availableScreens);
      localStorage.setItem('rolePermissions', JSON.stringify(permissions));
      broadcastPermissionsUpdate(permissions);
      setSuccess(true);
    } catch (err) {
      const message = err?.response?.data?.err?.message || 'No se pudieron guardar los cambios. Intenta nuevamente.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [matrix]);

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
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          mb={2}
        >
          <Typography variant="h6">Accesos a pantallas por rol</Typography>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={handleReset} disabled={!hasChanges || saving}>
              Descartar cambios
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!hasChanges || saving}
              startIcon={saving ? <CircularProgress color="inherit" size={16} /> : null}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </Stack>
        </Stack>

        <Stack spacing={2} mb={2}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(false)}>
              Permisos guardados correctamente.
            </Alert>
          )}
        </Stack>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Pantalla</TableCell>
                  {roles.map((role) => (
                    <TableCell key={role} align="center" sx={{ fontWeight: 'bold' }}>
                      {role}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableMatrix.map((row) => (
                  <TableRow key={row.path} hover>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">{row.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Ruta: {row.path}
                        </Typography>
                      </Stack>
                    </TableCell>
                    {roles.map((role) => (
                      <TableCell key={`${row.path}-${role}`} align="center">
                        <Checkbox
                          color="primary"
                          checked={row.permissions[role]}
                          onChange={() => handleToggle(role, row.path)}
                          disabled={saving}
                          inputProps={{ 'aria-label': `Permiso ${role} ${row.label}` }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Descripción de roles
        </Typography>
        <Stack spacing={2}>
          {roles.map((role) => (
            <Box key={role}>
              <Typography variant="subtitle1" fontWeight="bold">
                {role}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {ROLE_DESCRIPTIONS[role] || 'Rol configurado manualmente.'}
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
