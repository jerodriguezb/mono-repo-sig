import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Tooltip,
  Divider,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import {
  ROLE_CONFIG,
  APP_SCREEN_DEFINITIONS,
  getAllowedPathsForRole,
  isPathAllowed,
  PATH_LABELS,
} from '../constants/rolePermissions';

const ROLE_ENTRIES = Object.entries(ROLE_CONFIG);

export default function PermissionsPage() {
  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Gestión de permisos por rol
      </Typography>
      <Typography variant="body1" color="text.secondary" maxWidth={720}>
        Consulta y valida de manera rápida qué pantallas del sistema están
        habilitadas según el rol asignado a cada usuario. La matriz se construye
        automáticamente a partir de las definiciones de roles configuradas en el
        backend.
      </Typography>

      <Paper elevation={2} sx={{ mt: 4, overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Pantalla</TableCell>
              {ROLE_ENTRIES.map(([roleKey, roleConfig]) => (
                <TableCell key={roleKey} align="center" sx={{ fontWeight: 600 }}>
                  {roleConfig.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {APP_SCREEN_DEFINITIONS.map((screen) => (
              <TableRow key={screen.path} hover>
                <TableCell>
                  <Typography fontWeight={600}>{screen.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {screen.path}
                  </Typography>
                </TableCell>
                {ROLE_ENTRIES.map(([roleKey]) => {
                  const allowed = isPathAllowed(roleKey, screen.path);
                  return (
                    <TableCell key={roleKey} align="center">
                      <Tooltip title={allowed ? 'Acceso habilitado' : 'Sin acceso'}>
                        <Box component="span">
                          {allowed ? (
                            <CheckCircleOutlineIcon color="success" fontSize="small" />
                          ) : (
                            <HighlightOffIcon color="disabled" fontSize="small" />
                          )}
                        </Box>
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Divider sx={{ my: 4 }} />

      <Grid container spacing={3}>
        {ROLE_ENTRIES.map(([roleKey, config]) => {
          const allowedPaths = getAllowedPathsForRole(roleKey);
          const deniedPaths = config.deny ?? [];

          return (
            <Grid item xs={12} md={6} key={roleKey}>
              <Card elevation={1}>
                <CardContent>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {config.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {config.description}
                  </Typography>

                  {allowedPaths.length > 0 ? (
                    <Stack direction="row" flexWrap="wrap" gap={1.2}>
                      {allowedPaths.map((path) => (
                        <Chip key={path} color="primary" label={PATH_LABELS[path] ?? path} />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Aún no tiene pantallas asignadas.
                    </Typography>
                  )}

                  {deniedPaths.length > 0 && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                      Sin acceso a: {deniedPaths.map((path) => PATH_LABELS[path] ?? path).join(', ')}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
