import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Button,
  Grid,
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
import ShieldIcon from '@mui/icons-material/Shield';
import { getUsuarios } from '../api/rutaUsuarios';
import {
  getScreensForRole,
  mapPathsToLabels,
  ROLE_LABELS,
  SCREEN_DEFINITIONS,
} from '../constants/permissions';

const roleKeys = Object.keys(ROLE_LABELS);
const totalScreens = Object.keys(SCREEN_DEFINITIONS).length;

export default function PermissionsPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUsuarios = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getUsuarios();
      if (response?.ok) {
        setUsuarios(response.usuarios ?? []);
      } else {
        throw new Error(response?.err?.message || 'No fue posible obtener los usuarios.');
      }
    } catch (err) {
      setError(err.message || 'Error inesperado al cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const roleCards = useMemo(
    () =>
      roleKeys.map((role) => {
        const screens = mapPathsToLabels(getScreensForRole(role));
        const hasAccess = screens.length > 0;
        const fullAccess = screens.length === totalScreens;

        return {
          role,
          screens,
          hasAccess,
          fullAccess,
        };
      }),
    []
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Gestión de permisos por rol
        </Typography>
        <Typography variant="body1" color="text.secondary">
          En esta sección podés visualizar qué pantallas tiene habilitadas cada perfil y los usuarios
          que pertenecen a cada uno.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {roleCards.map(({ role, screens, hasAccess, fullAccess }) => (
          <Grid item xs={12} md={6} lg={4} key={role}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShieldIcon color="primary" />
                  <Typography variant="h6">{ROLE_LABELS[role] || role}</Typography>
                </Stack>

                <Divider />

                {fullAccess ? (
                  <Typography variant="body2" color="success.main">
                    Acceso total a todas las pantallas del sistema.
                  </Typography>
                ) : hasAccess ? (
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {screens.map(({ path, label }) => (
                      <Chip key={path} label={label} color="primary" variant="outlined" />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Aún no tiene pantallas asignadas.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper variant="outlined">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 2 }}>
          <ShieldIcon color="primary" />
          <Box>
            <Typography variant="h6">Usuarios y accesos</Typography>
            <Typography variant="body2" color="text.secondary">
              Visualizá los accesos efectivos de cada usuario según su rol actual.
            </Typography>
          </Box>
        </Box>
        <Divider />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ px: 3, py: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="error">{error}</Alert>
            <Button variant="contained" onClick={fetchUsuarios} sx={{ alignSelf: 'flex-start' }}>
              Reintentar
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Pantallas habilitadas</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usuarios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        No se encontraron usuarios activos.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  usuarios.map((usuario) => {
                    const role = usuario.role;
                    const screens = mapPathsToLabels(getScreensForRole(role));
                    const hasAccess = screens.length > 0;

                    return (
                      <TableRow key={usuario._id} hover>
                        <TableCell>
                          <Typography variant="subtitle2">
                            {`${usuario.nombres ?? ''} ${usuario.apellidos ?? ''}`.trim() || 'Sin nombre'}
                          </Typography>
                        </TableCell>
                        <TableCell>{usuario.email}</TableCell>
                        <TableCell>
                          <Chip label={ROLE_LABELS[role] || role || 'Sin rol'} color="secondary" size="small" />
                        </TableCell>
                        <TableCell>
                          {hasAccess ? (
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                              {screens.map(({ path, label }) => (
                                <Chip key={`${usuario._id}-${path}`} label={label} size="small" />
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Sin accesos asignados
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
