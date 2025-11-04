import React, { useEffect, useMemo, useState } from 'react';
import SaveIcon from '@mui/icons-material/Save';
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
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import api from '../api/axios';
import { dashboardNavItems } from '../layouts/DashboardLayout.jsx';

const ROLE_DEFINITIONS = [
  { id: 'ADMIN_ROLE', label: 'Administrador' },
  { id: 'USER_ROLE', label: 'Usuario' },
  { id: 'USER_CAM', label: 'Usuario CAM' },
  { id: 'USER_PREV', label: 'Usuario Preventa' },
];

const createEmptyPermissions = () =>
  ROLE_DEFINITIONS.reduce((acc, role) => {
    acc[role.id] = [];
    return acc;
  }, {});

const orderScreens = (screenIds, orderedScreens) => {
  if (!Array.isArray(screenIds) || screenIds.length === 0) return [];
  const screenSet = new Set(screenIds);
  return orderedScreens
    .filter((screen) => screenSet.has(screen.id))
    .map((screen) => screen.id);
};

const normalizePermissions = (payload, orderedScreens) => {
  const base = createEmptyPermissions();
  if (!Array.isArray(payload)) return base;

  payload.forEach((item) => {
    const { role, screens } = item ?? {};
    if (role && Object.prototype.hasOwnProperty.call(base, role)) {
      base[role] = orderScreens(Array.isArray(screens) ? screens : [], orderedScreens);
    }
  });

  return base;
};

const clonePermissions = (source) => {
  const clone = {};
  ROLE_DEFINITIONS.forEach(({ id }) => {
    clone[id] = [...(source?.[id] ?? [])];
  });
  return clone;
};

const arePermissionStatesEqual = (a, b) =>
  ROLE_DEFINITIONS.every(({ id }) => {
    const first = a?.[id] ?? [];
    const second = b?.[id] ?? [];
    if (first.length !== second.length) return false;
    return first.every((screen, index) => screen === second[index]);
  });

export default function PermissionsPage() {
  const screens = useMemo(
    () => dashboardNavItems.map(({ path, label }) => ({ id: path, label })),
    [],
  );

  const [permissionsState, setPermissionsState] = useState(createEmptyPermissions);
  const [initialPermissions, setInitialPermissions] = useState(createEmptyPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, severity: 'success', message: '' });

  const isDirty = useMemo(
    () => !arePermissionStatesEqual(permissionsState, initialPermissions),
    [permissionsState, initialPermissions],
  );

  useEffect(() => {
    let isMounted = true;

    const fetchPermissions = async () => {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get('/permissions');
        if (!isMounted) return;

        const payload = Array.isArray(data) ? data : data?.permissions;
        const normalized = normalizePermissions(payload, screens);
        setPermissionsState(normalized);
        setInitialPermissions(clonePermissions(normalized));
      } catch (err) {
        if (!isMounted) return;
        const message = err?.response?.data?.message ?? 'No se pudo cargar la configuración de permisos.';
        setError(message);
        const emptyState = createEmptyPermissions();
        setPermissionsState(emptyState);
        setInitialPermissions(clonePermissions(emptyState));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPermissions();

    return () => {
      isMounted = false;
    };
  }, [screens]);

  const handleToggle = (roleId, screenId) => {
    setPermissionsState((prev) => {
      const current = new Set(prev?.[roleId] ?? []);
      if (current.has(screenId)) {
        current.delete(screenId);
      } else {
        current.add(screenId);
      }

      const updated = orderScreens([...current], screens);
      return {
        ...prev,
        [roleId]: updated,
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const payload = ROLE_DEFINITIONS.map(({ id }) => ({
        role: id,
        screens: permissionsState[id] ?? [],
      }));

      await api.put('/permissions', payload);
      const snapshot = clonePermissions(permissionsState);
      setInitialPermissions(snapshot);
      setSnackbar({ open: true, severity: 'success', message: 'Permisos actualizados correctamente.' });
    } catch (err) {
      const message = err?.response?.data?.message ?? 'No se pudieron guardar los permisos.';
      setSnackbar({ open: true, severity: 'error', message });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Gestor de permisos
        </Typography>

        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          disabled={!isDirty || loading || saving}
          onClick={() => setConfirmOpen(true)}
        >
          Guardar cambios
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Perfil</TableCell>
              {screens.map((screen) => (
                <TableCell key={screen.id} align="center" sx={{ fontWeight: 600 }}>
                  {screen.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={screens.length + 1}>
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={32} />
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              ROLE_DEFINITIONS.map((role) => (
                <TableRow key={role.id} hover>
                  <TableCell component="th" scope="row">
                    {role.label}
                  </TableCell>
                  {screens.map((screen) => {
                    const checked = permissionsState?.[role.id]?.includes(screen.id) ?? false;
                    return (
                      <TableCell key={`${role.id}-${screen.id}`} align="center">
                        <Checkbox
                          color="primary"
                          checked={checked}
                          disabled={role.id === 'ADMIN_ROLE' || saving}
                          onChange={() => handleToggle(role.id, screen.id)}
                          inputProps={{ 'aria-label': `${role.label} - ${screen.label}` }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirmar cambios</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Deseas guardar los cambios realizados en las asignaciones de permisos?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} variant="contained" color="primary">
            {saving ? 'Guardando…' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
