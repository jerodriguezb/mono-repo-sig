import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import api from '../api/axios';

const quantityFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const normalizeText = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const decodeJwtPayload = (token) => {
  if (!token) return null;
  try {
    const [, payload = ''] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('No se pudo decodificar el token JWT', error);
    return null;
  }
};

const clampDelivered = (value, max) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  const sanitized = Math.max(numeric, 0);
  if (Number.isFinite(max)) {
    return Math.min(sanitized, max);
  }
  return sanitized;
};

const buildRowId = (comandaId, itemId, index) => {
  if (itemId) return `${comandaId}-${itemId}`;
  return `${comandaId}-item-${index}`;
};

export default function DistribucionPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTabletDown = useMediaQuery(theme.breakpoints.down('md'));
  const [authState, setAuthState] = useState({ checking: true, role: null, userId: null });
  const [estadoDistribucionId, setEstadoDistribucionId] = useState(null);
  const [rows, setRows] = useState([]);
  const [comandasById, setComandasById] = useState({});
  const [editedRows, setEditedRows] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setAuthState({ checking: false, role: null, userId: null });
      return;
    }
    const cleanedToken = storedToken.replace(/^"|"$/g, '');
    const payload = decodeJwtPayload(cleanedToken);
    if (!payload?._id || !payload?.role) {
      setAuthState({ checking: false, role: null, userId: null });
      return;
    }
    setAuthState({ checking: false, role: payload.role, userId: payload._id });
  }, []);

  const transformComandas = useCallback((comandas = []) => {
    const result = [];
    comandas.forEach((comanda) => {
      const clienteNombre = comanda?.codcli?.razonsocial ?? '';
      const items = Array.isArray(comanda?.items) ? comanda.items : [];
      items.forEach((item, index) => {
        const itemId = item?._id ? String(item._id) : null;
        const rowId = buildRowId(comanda?._id ?? `comanda-${index}`, itemId, index);
        const cantidad = Number(item?.cantidad ?? 0);
        const monto = Number(item?.monto ?? 0);
        const cantidadEntregada = Number(item?.cantidadentregada ?? 0);
        result.push({
          rowId,
          comandaId: comanda?._id ?? null,
          itemId: itemId ?? `item-${index}`,
          nrodecomanda: comanda?.nrodecomanda ?? '',
          clienteNombre,
          productoDescripcion: item?.codprod?.descripcion ?? '',
          cantidad,
          monto,
          total: cantidad * monto,
          cantidadEntregada,
          cantidadEntregadaOriginal: cantidadEntregada,
          totalEntregado: cantidadEntregada * monto,
        });
      });
    });
    return result;
  }, []);

  const fetchEstadoDistribucion = useCallback(async () => {
    const { data } = await api.get('/estados');
    const estados = Array.isArray(data) ? data : data?.estados ?? [];
    const target = estados.find(
      (estado) => normalizeText(estado?.estado ?? estado?.descripcion ?? '') === 'en distribucion',
    );
    if (!target?._id) {
      throw new Error('No se encontró el estado "En distribución".');
    }
    return target._id;
  }, []);

  const fetchComandas = useCallback(
    async (estadoId, camioneroId) => {
      if (!estadoId || !camioneroId) return;
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/comandas', {
          params: { estado: estadoId, camionero: camioneroId },
        });
        const comandas = data?.comandas ?? [];
        const mapped = {};
        comandas.forEach((comanda) => {
          if (comanda?._id) mapped[comanda._id] = comanda;
        });
        setComandasById(mapped);
        setRows(transformComandas(comandas));
        setEditedRows({});
      } catch (requestError) {
        console.error('Error obteniendo comandas en distribución', requestError);
        const message =
          requestError?.response?.data?.err?.message ||
          requestError?.response?.data?.message ||
          'No se pudieron obtener las comandas en distribución.';
        setError(message);
        setRows([]);
        setEditedRows({});
      } finally {
        setLoading(false);
      }
    },
    [transformComandas],
  );

  useEffect(() => {
    if (authState.checking) return;
    if (authState.role !== 'USER_CAM') return;

    let cancelled = false;
    const loadEstado = async () => {
      try {
        const estadoId = await fetchEstadoDistribucion();
        if (cancelled) return;
        setEstadoDistribucionId(estadoId);
      } catch (stateError) {
        console.error('Error obteniendo estados', stateError);
        if (cancelled) return;
        const message = stateError?.message || 'No se pudieron obtener los estados activos.';
        setError(message);
      }
    };

    loadEstado();

    return () => {
      cancelled = true;
    };
  }, [authState.checking, authState.role, fetchEstadoDistribucion]);

  useEffect(() => {
    if (authState.role !== 'USER_CAM') return;
    if (!estadoDistribucionId || !authState.userId) return;
    fetchComandas(estadoDistribucionId, authState.userId);
  }, [authState.role, authState.userId, estadoDistribucionId, fetchComandas]);

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleCantidadEntregadaChange = useCallback((row, rawValue) => {
    const cantidad = clampDelivered(rawValue, row.cantidad);
    setRows((prevRows) =>
      prevRows.map((current) => {
        if (current.rowId !== row.rowId) return current;
        const totalEntregado = cantidad * current.monto;
        return {
          ...current,
          cantidadEntregada: cantidad,
          totalEntregado,
        };
      }),
    );
    setEditedRows((prev) => {
      const next = { ...prev };
      if (cantidad === row.cantidadEntregadaOriginal) {
        delete next[row.rowId];
      } else {
        next[row.rowId] = {
          comandaId: row.comandaId,
          itemId: row.itemId,
          cantidadentregada: cantidad,
        };
      }
      return next;
    });
  }, []);

  const handleSaveChanges = async () => {
    const entries = Object.entries(editedRows);
    if (!entries.length) {
      showSnackbar('No hay cambios para guardar.', 'info');
      return;
    }

    const updatesByComanda = new Map();
    entries.forEach(([, value]) => {
      if (!value?.comandaId) return;
      const comandaKey = String(value.comandaId);
      if (!updatesByComanda.has(comandaKey)) {
        updatesByComanda.set(comandaKey, new Map());
      }
      updatesByComanda.get(comandaKey).set(String(value.itemId), Number(value.cantidadentregada ?? 0));
    });

    const rowLookup = new Map(rows.map((row) => [`${row.comandaId ?? ''}__${row.itemId ?? ''}`, row]));

    setSaving(true);

    try {
      for (const [comandaId, itemUpdates] of updatesByComanda.entries()) {
        const comanda = comandasById[comandaId];
        if (!comanda) continue;
        const items = Array.isArray(comanda.items) ? comanda.items : [];
        const updatedItems = items.map((item) => {
          const itemId = String(item?._id ?? '');
          const override = itemUpdates.get(itemId);
          let cantidadEntregada = override;
          if (cantidadEntregada === undefined) {
            const rowKey = `${comandaId}__${itemId}`;
            const row = rowLookup.get(rowKey);
            if (row) {
              cantidadEntregada = Number(row.cantidadEntregada ?? 0);
            } else {
              cantidadEntregada = Number(item?.cantidadentregada ?? 0);
            }
          }
          if (cantidadEntregada === undefined) cantidadEntregada = Number(item?.cantidadentregada ?? 0);
          const cantidad = Number(item?.cantidad ?? 0);
          return {
            ...item,
            cantidadentregada: cantidadEntregada,
            entregado: cantidad > 0 ? cantidadEntregada >= cantidad : Boolean(item?.entregado),
          };
        });

        await api.put(`/comandas/${comandaId}`, { items: updatedItems });
      }

      showSnackbar('Entregas actualizadas correctamente.', 'success');
      setEditedRows({});
      if (estadoDistribucionId && authState.userId) {
        fetchComandas(estadoDistribucionId, authState.userId);
      }
    } catch (requestError) {
      console.error('Error actualizando entregas', requestError);
      const message =
        requestError?.response?.data?.err?.message ||
        requestError?.response?.data?.message ||
        'No se pudieron actualizar las entregas.';
      showSnackbar(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReload = () => {
    if (estadoDistribucionId && authState.userId) {
      fetchComandas(estadoDistribucionId, authState.userId);
    }
  };

  const totals = useMemo(() => {
    let totalCantidadEntregada = 0;
    let totalMontoEntregado = 0;
    rows.forEach((row) => {
      totalCantidadEntregada += Number(row.cantidadEntregada ?? 0);
      totalMontoEntregado += Number(row.totalEntregado ?? 0);
    });
    return {
      registros: rows.length,
      cantidad: totalCantidadEntregada,
      monto: totalMontoEntregado,
    };
  }, [rows]);

  const hasEditedRows = Object.keys(editedRows).length > 0;
  const isUnauthorized = !authState.checking && authState.role !== 'USER_CAM';

  const renderMobileCards = () => (
    <Stack spacing={2} sx={{ width: '100%' }}>
      {rows.map((row) => (
        <Paper
          key={row.rowId}
          variant="outlined"
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Comanda
              </Typography>
              <Typography variant="h6">{row.nrodecomanda || '—'}</Typography>
            </Box>
            <Box sx={{ minWidth: 120, flexShrink: 0 }}>
              <Typography variant="caption" color="text.secondary">
                Cant entregada
              </Typography>
              <TextField
                value={row.cantidadEntregada}
                onChange={(event) => handleCantidadEntregadaChange(row, event.target.value)}
                type="number"
                size="medium"
                fullWidth
                inputProps={{ min: 0, max: row.cantidad, step: '0.01' }}
              />
            </Box>
          </Stack>

          <Grid container spacing={1.5} columns={{ xs: 6, sm: 12 }}>
            <Grid item xs={6} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Cliente
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {row.clienteNombre || '—'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Producto
              </Typography>
              <Typography variant="body2">{row.productoDescripcion || '—'}</Typography>
            </Grid>
            <Grid item xs={3} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Cant
              </Typography>
              <Typography variant="body2">{quantityFormatter.format(Number(row.cantidad ?? 0))}</Typography>
            </Grid>
            <Grid item xs={3} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Cant entregada
              </Typography>
              <Typography variant="body2">{quantityFormatter.format(Number(row.cantidadEntregada ?? 0))}</Typography>
            </Grid>
            <Grid item xs={3} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Precio unitario
              </Typography>
              <Typography variant="body2">
                ${decimalFormatter.format(Number(row.monto ?? 0))}
              </Typography>
            </Grid>
            <Grid item xs={3} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Total entregado
              </Typography>
              <Typography variant="body2">
                ${decimalFormatter.format(Number(row.totalEntregado ?? 0))}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      ))}
    </Stack>
  );

  const renderDesktopTable = () => (
    <TableContainer component={Paper} variant="outlined" sx={{ width: '100%' }}>
      <Table size={isTabletDown ? 'small' : 'medium'}>
        <TableHead>
          <TableRow>
            <TableCell align="right">Com</TableCell>
            <TableCell>Cliente</TableCell>
            <TableCell>Producto</TableCell>
            <TableCell align="right">Cant</TableCell>
            <TableCell align="right">Precio unitario</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">Cant entreg</TableCell>
            <TableCell align="right">Total entreg</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.rowId} hover>
              <TableCell align="right">{row.nrodecomanda || '—'}</TableCell>
              <TableCell>{row.clienteNombre || '—'}</TableCell>
              <TableCell>{row.productoDescripcion || '—'}</TableCell>
              <TableCell align="right">
                {quantityFormatter.format(Number(row.cantidad ?? 0))}
              </TableCell>
              <TableCell align="right">
                ${decimalFormatter.format(Number(row.monto ?? 0))}
              </TableCell>
              <TableCell align="right">
                ${decimalFormatter.format(Number(row.total ?? 0))}
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 140 }}>
                <TextField
                  value={row.cantidadEntregada}
                  onChange={(event) => handleCantidadEntregadaChange(row, event.target.value)}
                  type="number"
                  size={isTabletDown ? 'small' : 'medium'}
                  fullWidth
                  inputProps={{ min: 0, max: row.cantidad, step: '0.01' }}
                />
              </TableCell>
              <TableCell align="right">
                ${decimalFormatter.format(Number(row.totalEntregado ?? 0))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, pb: 4 }}>
      <Box
        sx={{
          width: '100%',
          backgroundColor: 'primary.dark',
          color: 'primary.contrastText',
          py: { xs: 2, md: 3 },
          px: { xs: 2, md: 4 },
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={600}>
            En distribución
          </Typography>
          {!isUnauthorized && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={handleReload}
                size="large"
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  py: 1.5,
                }}
                disabled={loading || saving}
              >
                Recargar
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<SaveIcon />}
                onClick={handleSaveChanges}
                size="large"
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  py: 1.5,
                }}
                disabled={!hasEditedRows || saving}
              >
                Guardar cambios
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>

      {authState.checking && (
        <Box sx={{ px: { xs: 2, md: 4 } }}>
          <LinearProgress />
        </Box>
      )}

      {!authState.checking && isUnauthorized && (
        <Box sx={{ px: { xs: 2, md: 4 } }}>
          <Alert severity="warning">Acceso restringido. Solo disponible para usuarios camioneros.</Alert>
        </Box>
      )}

      {!authState.checking && !isUnauthorized && (
        <Stack spacing={2} sx={{ px: { xs: 2, md: 4 } }}>
          {loading && <LinearProgress />}

          {error && !loading && (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          )}

          {!loading && !error && rows.length === 0 && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography variant="body1">No hay comandas en distribución para mostrar.</Typography>
            </Paper>
          )}

          {rows.length > 0 && (isMobile ? renderMobileCards() : renderDesktopTable())}

          {rows.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Registros: <Typography component="span" color="text.primary" fontWeight={600}>{totals.registros}</Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cantidad entregada total:{' '}
                  <Typography component="span" color="text.primary" fontWeight={600}>
                    {quantityFormatter.format(totals.cantidad)}
                  </Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monto entregado total:{' '}
                  <Typography component="span" color="text.primary" fontWeight={600}>
                    ${decimalFormatter.format(totals.monto)}
                  </Typography>
                </Typography>
              </Stack>
            </Paper>
          )}
        </Stack>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbar.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        action={
          <IconButton size="small" aria-label="Cerrar" color="inherit" onClick={handleSnackbarClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </Box>
  );
}
