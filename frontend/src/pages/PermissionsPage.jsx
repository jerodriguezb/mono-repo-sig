import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import api from '../api/axios.js';
import { screens, screenPaths } from '../constants/screens.js';

const ROLE_ORDER = ['SUPER_ADMIN', 'ADMIN_ROLE', 'USER_ROLE', 'USER_CAM', 'USER_PREV'];

const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN: [...screenPaths],
  ADMIN_ROLE: screenPaths.filter((path) => path !== '/permissions'),
  USER_ROLE: [],
  USER_CAM: ['/distribucion'],
  USER_PREV: ['/comandas', '/clients'],
};

const normalizeScreens = (list = []) => {
  const set = new Set();
  list.forEach((path) => {
    if (typeof path === 'string' && screenPaths.includes(path)) {
      set.add(path);
    }
  });
  return Array.from(set).sort();
};

const applyRoleRules = (role, currentScreens) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return [...screenPaths];
    case 'ADMIN_ROLE':
      return screenPaths.filter((path) => path !== '/permissions');
    case 'USER_CAM':
    case 'USER_PREV':
    case 'USER_ROLE':
      return normalizeScreens(
        currentScreens && currentScreens.length
          ? currentScreens
          : DEFAULT_PERMISSIONS[role] ?? [],
      );
    default:
      return normalizeScreens(currentScreens);
  }
};

const clonePermissions = (perms) =>
  Object.fromEntries(Object.entries(perms).map(([role, list]) => [role, [...list]]));

export default function PermissionsPage() {
  const [roles, setRoles] = useState(ROLE_ORDER);
  const [permissions, setPermissions] = useState({});
  const [initialPermissions, setInitialPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        api.get('/roles'),
        api.get('/permissions'),
      ]);

      const apiRoles = Array.isArray(rolesRes.data?.roles) ? rolesRes.data.roles : [];
      const combinedRoles = Array.from(new Set([...ROLE_ORDER, ...apiRoles]));
      if (!combinedRoles.includes('SUPER_ADMIN')) combinedRoles.unshift('SUPER_ADMIN');

      const currentPermissions = permissionsRes.data?.permissions ?? {};
      const computed = {};
      combinedRoles.forEach((role) => {
        computed[role] = applyRoleRules(role, currentPermissions[role]);
      });

      setRoles(combinedRoles);
      setPermissions(computed);
      setInitialPermissions(clonePermissions(computed));
    } catch (error) {
      console.error('Error al cargar permisos', error);
      setSnackbar({
        open: true,
        message: 'No se pudieron cargar los permisos. Intenta nuevamente.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasChanges = useMemo(() => {
    const allRoles = new Set([
      ...Object.keys(initialPermissions),
      ...Object.keys(permissions),
    ]);
    for (const role of allRoles) {
      const initial = initialPermissions[role] ?? [];
      const current = permissions[role] ?? [];
      if (initial.length !== current.length) return true;
      for (let i = 0; i < initial.length; i += 1) {
        if (initial[i] !== current[i]) return true;
      }
    }
    return false;
  }, [initialPermissions, permissions]);

  const isCellDisabled = (role, path) =>
    role === 'SUPER_ADMIN' || (role === 'ADMIN_ROLE' && path === '/permissions');

  const handleToggle = (role, path) => {
    if (isCellDisabled(role, path) || loading || saving) return;
    setPermissions((prev) => {
      const current = new Set(prev[role] ?? []);
      if (current.has(path)) current.delete(path);
      else current.add(path);
      const next = { ...prev, [role]: Array.from(current).sort() };
      return next;
    });
  };

  const handleConfirmClose = () => setConfirmOpen(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = clonePermissions(permissions);
      const { data } = await api.put('/permissions', { permissions: payload });
      const sanitized = data?.permissions ?? payload;
      setPermissions(clonePermissions(sanitized));
      setInitialPermissions(clonePermissions(sanitized));
      setSnackbar({ open: true, message: 'Permisos actualizados correctamente.', severity: 'success' });
    } catch (error) {
      console.error('Error al guardar permisos', error);
      setSnackbar({
        open: true,
        message: 'No se pudieron guardar los cambios. Intenta nuevamente.',
        severity: 'error',
      });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
        <Typography variant="h5">Gestor de permisos</Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={() => setConfirmOpen(true)}
          disabled={!hasChanges || loading || saving}
        >
          Guardar cambios
        </Button>
      </Stack>

      <Box sx={{ position: 'relative' }}>
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'rgba(255,255,255,0.6)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        <TableContainer component={Paper} sx={{ maxHeight: { xs: 440, md: 'none' }, overflowX: 'auto' }}>
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
                  <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                    {role}
                  </TableCell>
                  {screens.map((screen) => {
                    const checked = permissions[role]?.includes(screen.path) ?? false;
                    const disabled = isCellDisabled(role, screen.path) || loading || saving;
                    return (
                      <TableCell key={screen.path} align="center">
                        <Checkbox
                          checked={checked}
                          onChange={() => handleToggle(role, screen.path)}
                          disabled={disabled}
                          inputProps={{ 'aria-label': `${role}-${screen.path}` }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={confirmOpen} onClose={handleConfirmClose}>
        <DialogTitle>Confirmar cambios</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Deseas guardar los cambios realizados en los permisos?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} color="primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
