import React from 'react';
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
import { DASHBOARD_SCREENS } from '../constants/screens.js';
import { fetchPermissions, updatePermissions } from '../api/permissions';

const ROLES = [
  { id: 'ADMIN_ROLE', label: 'Administrador' },
  { id: 'USER_ROLE', label: 'Usuario' },
  { id: 'USER_CAM', label: 'Usuario Camionero' },
  { id: 'USER_PREV', label: 'Usuario Preventista' },
];

const SCREENS = DASHBOARD_SCREENS.map(({ label, path }) => ({ label, path }));
const SCREEN_PATHS = SCREENS.map((screen) => screen.path);
const ROLE_IDS = new Set(ROLES.map((role) => role.id));

const orderScreens = (screens = []) =>
  SCREEN_PATHS.filter((path) => screens.includes(path));

const buildStateFromResponse = (permissions = []) => {
  const state = {};

  ROLES.forEach(({ id }) => {
    state[id] = id === 'ADMIN_ROLE' ? [...SCREEN_PATHS] : [];
  });

  permissions.forEach((item) => {
    if (item && ROLE_IDS.has(item.role)) {
      state[item.role] = item.role === 'ADMIN_ROLE'
        ? [...SCREEN_PATHS]
        : orderScreens(item.screens || []);
    }
  });

  return state;
};

const cloneState = (state) =>
  ROLES.reduce((acc, { id }) => {
    acc[id] = [...(state[id] || [])];
    return acc;
  }, {});

const areStatesEqual = (a, b) =>
  ROLES.every(({ id }) => {
    const arrA = orderScreens(a?.[id] || []);
    const arrB = orderScreens(b?.[id] || []);

    return arrA.length === arrB.length && arrA.every((value, index) => value === arrB[index]);
  });

export default function PermissionsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [permissionsState, setPermissionsState] = React.useState(() => buildStateFromResponse());
  const [initialState, setInitialState] = React.useState(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'success' });

  const hasChanges = React.useMemo(() => {
    if (!initialState) return false;
    return !areStatesEqual(permissionsState, initialState);
  }, [permissionsState, initialState]);

  React.useEffect(() => {
    let isMounted = true;

    const loadPermissions = async () => {
      setLoading(true);
      setError(null);
      try {
        const { permissions } = await fetchPermissions();
        if (!isMounted) return;
        const formatted = buildStateFromResponse(permissions);
        setPermissionsState(formatted);
        setInitialState(cloneState(formatted));
      } catch (err) {
        if (!isMounted) return;
        setError(err?.response?.data?.err?.message || 'No se pudo cargar la configuración de permisos.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggle = (roleId, path) => {
    if (roleId === 'ADMIN_ROLE') return;

    setPermissionsState((prev) => {
      const current = new Set(prev[roleId] || []);
      if (current.has(path)) {
        current.delete(path);
      } else {
        current.add(path);
      }

      return {
        ...prev,
        [roleId]: orderScreens(Array.from(current)),
      };
    });
  };

  const handleSaveClick = () => {
    if (!hasChanges) return;
    setConfirmOpen(true);
  };

  const handleConfirmClose = () => setConfirmOpen(false);

  const handleConfirmSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = ROLES.map(({ id }) => ({
        role: id,
        screens: permissionsState[id] || [],
      }));

      const { permissions } = await updatePermissions(payload);
      const formatted = buildStateFromResponse(permissions);
      setPermissionsState(formatted);
      setInitialState(cloneState(formatted));
      setSnackbar({ open: true, message: 'Permisos actualizados correctamente.', severity: 'success' });
    } catch (err) {
      setError(err?.response?.data?.err?.message || 'No se pudieron guardar los cambios.');
      setSnackbar({ open: true, message: 'Error al guardar los permisos.', severity: 'error' });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  const handleCloseSnackbar = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="h6">Gestor de permisos</Typography>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSaveClick}
          disabled={!hasChanges || saving || loading}
        >
          Guardar cambios
        </Button>
      </Stack>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={6}>
          <CircularProgress />
        </Box>
      ) : error && !hasChanges ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Rol</TableCell>
                {SCREENS.map((screen) => (
                  <TableCell key={screen.path} align="center" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    {screen.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {ROLES.map(({ id, label }) => (
                <TableRow key={id} hover>
                  <TableCell component="th" scope="row" sx={{ fontWeight: 500 }}>
                    {label}
                  </TableCell>
                  {SCREENS.map((screen) => (
                    <TableCell key={screen.path} align="center">
                      <Checkbox
                        color="primary"
                        checked={permissionsState[id]?.includes(screen.path) || false}
                        disabled={id === 'ADMIN_ROLE' || saving}
                        onChange={() => handleToggle(id, screen.path)}
                        inputProps={{ 'aria-label': `${label} - ${screen.label}` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {error && hasChanges && !loading && (
        <Alert severity="error">{error}</Alert>
      )}

      <Dialog open={confirmOpen} onClose={handleConfirmClose}>
        <DialogTitle>Confirmar cambios</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Deseas guardar la configuración de permisos seleccionada?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmSave} color="primary" disabled={saving}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
