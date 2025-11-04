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
import { navItems } from '../constants/navigation.js';
import { fetchPermissions, updatePermissions } from '../api/permissions.js';

const roles = [
  { id: 'ADMIN_ROLE', label: 'Administrador' },
  { id: 'USER_ROLE', label: 'Usuario' },
  { id: 'USER_CAM', label: 'Usuario CAM' },
  { id: 'USER_PREV', label: 'Usuario Preventa' },
];

const availableScreens = navItems.reduce((acc, item) => {
  if (!item?.path) return acc;

  const alreadyIncluded = acc.some((screen) => screen.path === item.path);
  if (!alreadyIncluded) {
    acc.push({ label: item.label, path: item.path });
  }

  return acc;
}, []);

const createEmptyState = () =>
  roles.reduce((acc, role) => {
    acc[role.id] = [];
    return acc;
  }, {});

const cloneState = (state) =>
  roles.reduce((acc, role) => {
    acc[role.id] = [...(state[role.id] ?? [])];
    return acc;
  }, {});

const normalizePermissionsResponse = (data) => {
  const normalized = createEmptyState();
  const rawEntries = Array.isArray(data)
    ? data
    : Array.isArray(data?.permissions)
      ? data.permissions
      : [];

  rawEntries.forEach((entry) => {
    if (!entry || !normalized[entry.role]) return;

    const allowedScreens = Array.isArray(entry.screens) ? entry.screens : [];
    const sanitized = allowedScreens
      .filter((path) => availableScreens.some((screen) => screen.path === path))
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort();

    normalized[entry.role] = sanitized;
  });

  return normalized;
};

export default function PermissionsPage() {
  const [permissionsState, setPermissionsState] = useState(createEmptyState());
  const [initialState, setInitialState] = useState(createEmptyState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [snackbarState, setSnackbarState] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadPermissions = async () => {
      setLoading(true);
      try {
        const { data } = await fetchPermissions();
        if (!isMounted) return;

        const normalized = normalizePermissionsResponse(data);
        setPermissionsState(cloneState(normalized));
        setInitialState(cloneState(normalized));
        setErrorMessage('');
      } catch (error) {
        if (!isMounted) return;
        console.error('Error al obtener los permisos', error);
        setErrorMessage('No se pudo cargar la configuración de permisos.');
        setSnackbarState({
          open: true,
          message: 'No se pudo cargar la configuración de permisos.',
          severity: 'error',
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleTogglePermission = useCallback((roleId, screenPath, checked) => {
    setPermissionsState((prev) => {
      const roleScreens = new Set(prev[roleId] ?? []);

      if (checked) {
        roleScreens.add(screenPath);
      } else {
        roleScreens.delete(screenPath);
      }

      return {
        ...prev,
        [roleId]: Array.from(roleScreens).sort(),
      };
    });
  }, []);

  const hasChanges = useMemo(() => {
    const current = JSON.stringify(permissionsState);
    const original = JSON.stringify(initialState);
    return current !== original;
  }, [permissionsState, initialState]);

  const handleOpenConfirmDialog = () => {
    if (!hasChanges || saving) return;
    setConfirmDialogOpen(true);
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarState((prev) => ({ ...prev, open: false }));
  };

  const handleConfirmSave = async () => {
    setConfirmDialogOpen(false);
    setSaving(true);
    try {
      const payload = Object.entries(permissionsState).map(([role, screens]) => ({
        role,
        screens,
      }));

      await updatePermissions({ permissions: payload });
      setInitialState(cloneState(permissionsState));
      setSnackbarState({
        open: true,
        message: 'Permisos actualizados correctamente.',
        severity: 'success',
      });
    } catch (error) {
      console.error('Error al actualizar los permisos', error);
      setSnackbarState({
        open: true,
        message: 'No se pudieron guardar los cambios. Inténtalo nuevamente.',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderTableContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 520 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 160 }}>Perfil</TableCell>
              {availableScreens.map((screen) => (
                <TableCell key={screen.path} align="center" sx={{ minWidth: 140 }}>
                  {screen.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id} hover>
                <TableCell component="th" scope="row">
                  {role.label}
                </TableCell>
                {availableScreens.map((screen) => {
                  const isChecked = permissionsState[role.id]?.includes(screen.path);
                  return (
                    <TableCell key={`${role.id}-${screen.path}`} align="center">
                      <Checkbox
                        color="primary"
                        checked={Boolean(isChecked)}
                        disabled={role.id === 'ADMIN_ROLE'}
                        onChange={(event) =>
                          handleTogglePermission(role.id, screen.path, event.target.checked)
                        }
                        inputProps={{ 'aria-label': `${role.label} puede ver ${screen.label}` }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Gestor de permisos</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
        <Button
          variant="contained"
          color="primary"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          disabled={!hasChanges || saving || loading}
          onClick={handleOpenConfirmDialog}
        >
          Guardar cambios
        </Button>
      </Stack>

      {errorMessage && !loading ? <Alert severity="error">{errorMessage}</Alert> : null}

      {renderTableContent()}

      <Dialog open={confirmDialogOpen} onClose={handleCloseConfirmDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar cambios</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Deseas guardar las modificaciones realizadas en los permisos?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmDialog} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleConfirmSave} color="primary" autoFocus>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarState.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarState.severity} sx={{ width: '100%' }}>
          {snackbarState.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
