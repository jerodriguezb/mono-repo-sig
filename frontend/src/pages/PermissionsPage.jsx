import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  fetchPermissions,
  fetchRoles,
  fetchScreens,
  updatePermissions,
} from '../api/permissions.js';

const ROLE_DISPLAY_ORDER = ['SUPER_ADMIN', 'ADMIN_ROLE', 'USER_ROLE', 'USER_CAM', 'USER_PREV'];

const buildDefaultAssignments = (screenPaths) => ({
  SUPER_ADMIN: [...screenPaths],
  ADMIN_ROLE: screenPaths.filter((path) => path !== '/permissions'),
  USER_ROLE: [],
  USER_CAM: screenPaths.includes('/distribucion') ? ['/distribucion'] : [],
  USER_PREV: ['/comandas', '/clients'].filter((path) => screenPaths.includes(path)),
});

const ensureRoleOrder = (roles) => {
  const merged = Array.from(new Set([...roles, ...ROLE_DISPLAY_ORDER]));
  return [
    ...ROLE_DISPLAY_ORDER.filter((role) => merged.includes(role)),
    ...merged.filter((role) => !ROLE_DISPLAY_ORDER.includes(role)),
  ];
};

const sortWithOrder = (screenOrder, values = []) => {
  const orderMap = new Map(screenOrder.map((path, index) => [path, index]));
  return Array.from(new Set(values.filter((value) => orderMap.has(value)))).sort(
    (a, b) => orderMap.get(a) - orderMap.get(b)
  );
};

const normalizeState = (state, roles, screenOrder) =>
  roles.reduce((acc, role) => {
    acc[role] = sortWithOrder(screenOrder, state?.[role]);
    return acc;
  }, {});

const cloneState = (state, roles) =>
  roles.reduce((acc, role) => {
    acc[role] = [...(state[role] ?? [])];
    return acc;
  }, {});

export default function PermissionsPage() {
  const [roles, setRoles] = useState([]);
  const [screens, setScreens] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [initialPermissions, setInitialPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const screenOrder = useMemo(() => screens.map((screen) => screen.path), [screens]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [rolesResponse, screensResponse, permissionsResponse] = await Promise.all([
        fetchRoles(),
        fetchScreens(),
        fetchPermissions(),
      ]);

      const rawRoles = Array.isArray(rolesResponse?.roles) ? rolesResponse.roles : [];
      const withSuper = rawRoles.includes('SUPER_ADMIN')
        ? rawRoles
        : [...rawRoles, 'SUPER_ADMIN'];
      const orderedRoles = ensureRoleOrder(withSuper);

      const screenList = Array.isArray(screensResponse?.screens) ? screensResponse.screens : [];
      const screenPaths = screenList.map((screen) => screen.path);
      const defaults = buildDefaultAssignments(screenPaths);
      const backendPermissions = permissionsResponse?.permissions || {};

      const resolved = orderedRoles.reduce((acc, role) => {
        const fetched = Array.isArray(backendPermissions[role]) ? backendPermissions[role] : [];
        let final = fetched.length ? fetched : defaults[role] || [];

        if (role === 'SUPER_ADMIN') {
          final = [...screenPaths];
        } else if (role === 'ADMIN_ROLE') {
          final = screenPaths.filter((path) => path !== '/permissions');
        } else if (role === 'USER_ROLE') {
          final = [];
        }

        acc[role] = final;
        return acc;
      }, {});

      const normalized = normalizeState(resolved, orderedRoles, screenPaths);

      setRoles(orderedRoles);
      setScreens(screenList);
      setPermissions(normalized);
      setInitialPermissions(cloneState(normalized, orderedRoles));
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los permisos. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasChanges = useMemo(() => {
    if (!roles.length) return false;
    return roles.some((role) => {
      const current = permissions[role] ?? [];
      const initial = initialPermissions[role] ?? [];
      if (current.length !== initial.length) return true;
      return current.some((value, index) => value !== initial[index]);
    });
  }, [roles, permissions, initialPermissions]);

  const sortPaths = useCallback(
    (values) => sortWithOrder(screenOrder, values),
    [screenOrder]
  );

  const handleToggle = useCallback(
    (role, screenPath) => (event) => {
      const { checked } = event.target;
      setPermissions((prev) => {
        const current = new Set(prev[role] ?? []);
        if (checked) {
          current.add(screenPath);
        } else {
          current.delete(screenPath);
        }

        return {
          ...prev,
          [role]: sortPaths(Array.from(current)),
        };
      });
    },
    [sortPaths]
  );

  const handleSave = () => setConfirmOpen(true);
  const handleCancel = () => setConfirmOpen(false);

  const handleConfirmSave = async () => {
    setSaving(true);
    setConfirmOpen(false);

    try {
      const payload = roles.reduce((acc, role) => {
        acc[role] = permissions[role] ?? [];
        return acc;
      }, {});

      await updatePermissions(payload);
      setInitialPermissions(cloneState(permissions, roles));
      setSnackbar({ open: true, severity: 'success', message: 'Permisos actualizados correctamente.' });
    } catch (err) {
      console.error(err);
      const message = err?.response?.data?.err?.message || 'No se pudieron guardar los permisos.';
      setSnackbar({ open: true, severity: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Typography variant="h5">Gestor de permisos</Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!hasChanges || saving || loading}
        >
          Guardar cambios
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Box component={Paper} sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Rol</TableCell>
                  {screens.map((screen) => (
                    <TableCell key={screen.path} align="center">
                      {screen.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{role}</TableCell>
                    {screens.map((screen) => {
                      const isSuperAdmin = role === 'SUPER_ADMIN';
                      const isAdminLocked = role === 'ADMIN_ROLE' && screen.path === '/permissions';
                      const disabled = isSuperAdmin || isAdminLocked;
                      const checked = permissions[role]?.includes(screen.path) || false;

                      return (
                        <TableCell key={`${role}-${screen.path}`} align="center">
                          <Checkbox
                            color="primary"
                            checked={checked}
                            disabled={disabled}
                            onChange={handleToggle(role, screen.path)}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={confirmOpen} onClose={handleCancel}>
        <DialogTitle>Confirmar cambios</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Deseas guardar los cambios realizados en la matriz de permisos?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel}>Cancelar</Button>
          <Button onClick={handleConfirmSave} variant="contained" disabled={saving}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
