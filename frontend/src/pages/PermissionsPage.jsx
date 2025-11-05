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
import {
  fetchPermissions,
  fetchRoles,
  fetchScreens,
  updatePermissions,
} from '../api/permissions';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super administrador',
  ADMIN_ROLE: 'Administrador',
  USER_ROLE: 'Usuario',
  USER_CAM: 'Usuario CAM',
  USER_PREV: 'Usuario PREV',
};

const ROLE_ORDER = ['SUPER_ADMIN', 'ADMIN_ROLE', 'USER_ROLE', 'USER_CAM', 'USER_PREV'];

const buildRoleList = (rolesFromApi = []) => {
  const roleSet = new Set([...ROLE_ORDER, ...rolesFromApi, 'SUPER_ADMIN']);
  return ROLE_ORDER.filter((role) => roleSet.has(role));
};

const normalizePermissions = (roles, permissions, screenPaths) => {
  const screenSet = new Set(screenPaths);
  return roles.reduce((acc, role) => {
    const items = Array.isArray(permissions?.[role]) ? permissions[role] : [];
    acc[role] = items.filter((path) => screenSet.has(path));
    return acc;
  }, {});
};

const clonePermissions = (roles, permissions) =>
  roles.reduce((acc, role) => {
    acc[role] = [...(permissions[role] ?? [])];
    return acc;
  }, {});

const permissionsAreEqual = (roles, left, right) => {
  if (roles.length === 0) return true;
  return roles.every((role) => {
    const a = left[role] ?? [];
    const b = right[role] ?? [];
    if (a.length !== b.length) return false;
    const set = new Set(a);
    if (set.size !== a.length) return false;
    return b.every((item) => set.has(item));
  });
};

const PermissionsPage = () => {
  const [roles, setRoles] = React.useState([]);
  const [screens, setScreens] = React.useState([]);
  const [permissions, setPermissions] = React.useState({});
  const [initialPermissions, setInitialPermissions] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'success' });

  const screenPaths = React.useMemo(() => screens.map((screen) => screen.path), [screens]);
  const screenOrderSet = React.useMemo(() => new Set(screenPaths), [screenPaths]);

  const hasChanges = React.useMemo(
    () => !permissionsAreEqual(roles, permissions, initialPermissions),
    [roles, permissions, initialPermissions]
  );

  const isCellDisabled = React.useCallback(
    (role, path) => role === 'SUPER_ADMIN' || (role === 'ADMIN_ROLE' && path === '/permissions'),
    []
  );

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, screensRes, permissionsRes] = await Promise.all([
        fetchRoles(),
        fetchScreens(),
        fetchPermissions(),
      ]);

      const rolesFromApi = Array.isArray(rolesRes.data?.roles) ? rolesRes.data.roles : [];
      const screenList = Array.isArray(screensRes.data?.screens) ? screensRes.data.screens : [];
      const screenPathsFromApi = screenList.map((screen) => screen.path);
      const permissionsFromApi = permissionsRes.data?.permissions ?? {};

      const roleList = buildRoleList(rolesFromApi);
      const normalized = normalizePermissions(roleList, permissionsFromApi, screenPathsFromApi);

      setRoles(roleList);
      setScreens(screenList);
      setPermissions(clonePermissions(roleList, normalized));
      setInitialPermissions(clonePermissions(roleList, normalized));
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message:
          error?.response?.data?.err?.message || 'No se pudieron cargar los permisos. Intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePermission = (role, path) => {
    if (isCellDisabled(role, path)) return;
    setPermissions((prev) => {
      const current = new Set(prev[role] ?? []);
      if (current.has(path)) {
        current.delete(path);
      } else if (screenOrderSet.has(path)) {
        current.add(path);
      }
      const ordered = screenPaths.filter((screenPath) => current.has(screenPath));
      return { ...prev, [role]: ordered };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data } = await updatePermissions(permissions);
      const updated = normalizePermissions(roles, data?.permissions ?? {}, screenPaths);
      setPermissions(clonePermissions(roles, updated));
      setInitialPermissions(clonePermissions(roles, updated));
      setSnackbar({ open: true, severity: 'success', message: 'Permisos actualizados correctamente.' });
    } catch (error) {
      setSnackbar({
        open: true,
        severity: 'error',
        message: error?.response?.data?.err?.message || 'Ocurrió un error al guardar los permisos.',
      });
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <Typography variant="h5" component="h1">
          Gestor de permisos
        </Typography>

        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!hasChanges || saving || loading}
          onClick={() => setConfirmOpen(true)}
        >
          Guardar cambios
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 160 }}>Rol</TableCell>
                {screens.map((screen) => (
                  <TableCell key={screen.path} align="center" sx={{ minWidth: 140 }}>
                    {screen.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role} hover>
                  <TableCell component="th" scope="row">
                    {ROLE_LABELS[role] ?? role}
                  </TableCell>
                  {screens.map((screen) => {
                    const disabled = isCellDisabled(role, screen.path);
                    const checked = Boolean(permissions[role]?.includes(screen.path));
                    return (
                      <TableCell key={screen.path} align="center">
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          color={disabled ? 'default' : 'primary'}
                          onChange={() => togglePermission(role, screen.path)}
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
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirmar cambios</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Deseas guardar las modificaciones realizadas en la matriz de permisos?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} color="inherit">
            Cancelar
          </Button>
          <Button onClick={handleSave} color="primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
};

export default PermissionsPage;
