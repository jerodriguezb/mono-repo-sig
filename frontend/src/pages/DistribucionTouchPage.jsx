import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
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
  Grid,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../api/axios';

const quantityFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const statusMeta = {
  complete: {
    label: 'Completado',
    color: 'success',
    description: 'Todos los ítems fueron entregados',
    emoji: '🟢',
  },
  partial: {
    label: 'Entrega parcial',
    color: 'warning',
    description: 'Hay ítems entregados parcialmente',
    emoji: '🟡',
  },
  pending: {
    label: 'Pendiente',
    color: 'info',
    description: 'Aún no se entregaron ítems',
    emoji: '🔵',
  },
};

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

const computeItemStatus = (requested, delivered) => {
  const requestedQty = Number(requested ?? 0);
  const deliveredQty = Number(delivered ?? 0);
  if (requestedQty <= 0) return 'complete';
  if (deliveredQty >= requestedQty) return 'complete';
  if (deliveredQty > 0) return 'partial';
  return 'pending';
};

const computeStatusFromItems = (items) => {
  let hasPending = false;
  let hasPartial = false;
  let hasDelivered = false;

  items.forEach((item) => {
    const requested = Number(item?.cantidadPedida ?? item?.requested ?? 0);
    const delivered = Number(item?.cantidadEntregada ?? item?.delivered ?? 0);

    if (requested <= 0) {
      if (delivered > 0) {
        hasDelivered = true;
      }
      return;
    }

    if (delivered >= requested) {
      hasDelivered = true;
      return;
    }

    hasPending = true;
    if (delivered > 0) {
      hasPartial = true;
      hasDelivered = true;
    }
  });

  if (!hasPending) {
    return 'complete';
  }

  if (hasPartial) {
    return 'partial';
  }

  if (!hasDelivered) {
    return 'pending';
  }

  return 'pending';
};

const clampDelivered = (value, max) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  const sanitized = Math.max(numeric, 0);
  if (Number.isFinite(max)) {
    return Math.min(sanitized, Number(max));
  }
  return sanitized;
};

const buildClientsFromComandas = (comandas = []) => {
  const clientsMap = new Map();

  comandas.forEach((comanda, index) => {
    const clientId = String(
      comanda?.codcli?._id ?? comanda?.codcli?.codigo ?? comanda?.codcli?.codcli ?? `cliente-${index}`,
    );
    const clientName = comanda?.codcli?.razonsocial ?? 'Cliente sin nombre';

    if (!clientsMap.has(clientId)) {
      clientsMap.set(clientId, {
        clientId,
        clientName,
        orders: [],
        status: 'pending',
      });
    }

    const target = clientsMap.get(clientId);
    const items = Array.isArray(comanda?.items) ? comanda.items : [];
    const mappedItems = items.map((item, itemIndex) => {
      const cantidad = Number(item?.cantidad ?? 0);
      const cantidadEntregada = Number(item?.cantidadentregada ?? 0);
      const itemId = String(item?._id ?? `${comanda?._id ?? `com-${index}`}-item-${itemIndex}`);
      const status = computeItemStatus(cantidad, cantidadEntregada);
      return {
        itemId,
        productoDescripcion: item?.codprod?.descripcion ?? 'Producto sin descripción',
        cantidadPedida: cantidad,
        cantidadEntregada,
        cantidadEntregadaOriginal: cantidadEntregada,
        status,
      };
    });

    const orderStatus = computeStatusFromItems(mappedItems);

    target.orders.push({
      comandaId: String(comanda?._id ?? `com-${index}`),
      numero: comanda?.nrodecomanda ?? '—',
      items: mappedItems,
      status: orderStatus,
    });
  });

  const clients = Array.from(clientsMap.values()).map((client) => {
    const allItems = client.orders.flatMap((order) => order.items);
    return {
      ...client,
      status: computeStatusFromItems(allItems),
    };
  });

  return clients;
};

export default function DistribucionTouchPage() {
  const theme = useTheme();
  const isTabletDown = useMediaQuery(theme.breakpoints.down('md'));
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [authState, setAuthState] = useState({ checking: true, role: null, userId: null });
  const [estadoDistribucionId, setEstadoDistribucionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState([]);
  const [comandasById, setComandasById] = useState({});
  const [selectedClient, setSelectedClient] = useState(null);
  const [editedItems, setEditedItems] = useState({});
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const filteredOptions = useMemo(() => {
    const base = clients.filter((client) => client.status === 'pending' || client.status === 'partial');
    if (selectedClient && !base.some((client) => client.clientId === selectedClient.clientId)) {
      return [...base, selectedClient];
    }
    return base;
  }, [clients, selectedClient]);

  const selectedItems = useMemo(() => {
    if (!selectedClient) return [];
    return selectedClient.orders.flatMap((order) =>
      order.items.map((item) => ({
        ...item,
        comandaId: order.comandaId,
        comandaNumero: order.numero,
      })),
    );
  }, [selectedClient]);

  const ordersLookup = useMemo(() => {
    const lookup = new Map();
    clients.forEach((client) => {
      client.orders.forEach((order) => {
        lookup.set(order.comandaId, order);
      });
    });
    return lookup;
  }, [clients]);

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

  const fetchEstadoDistribucion = useCallback(async () => {
    const { data } = await api.get('/estados');
    const estados = Array.isArray(data) ? data : data?.estados ?? [];
    const target = estados.find(
      (estado) =>
        (estado?.estado ?? estado?.descripcion ?? '')
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase()
          .trim() === 'en distribucion',
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
          if (comanda?._id) {
            mapped[comanda._id] = comanda;
          }
        });
        setComandasById(mapped);
        const clientsData = buildClientsFromComandas(comandas);
        setClients(clientsData);
        setSelectedClient(null);
        setEditedItems({});
      } catch (requestError) {
        console.error('Error obteniendo comandas en distribución', requestError);
        const message =
          requestError?.response?.data?.err?.message ||
          requestError?.response?.data?.message ||
          'No se pudieron obtener las comandas en distribución.';
        setError(message);
        setClients([]);
        setSelectedClient(null);
        setEditedItems({});
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (authState.checking) return;
    if (authState.role !== 'USER_CAM') {
      setError('No tienes permisos para acceder a la pantalla de distribución.');
      return;
    }

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

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleSelectClient = (_, newValue) => {
    setSelectedClient(newValue);
  };

  const handleDeliveredChange = (clientId, comandaId, itemId, rawValue, max) => {
    const cantidad = clampDelivered(rawValue, max);

    setClients((prev) =>
      prev.map((client) => {
        if (client.clientId !== clientId) return client;
        const updatedOrders = client.orders.map((order) => {
          if (order.comandaId !== comandaId) return order;
          const updatedItems = order.items.map((item) => {
            if (item.itemId !== itemId) return item;
            const nextStatus = computeItemStatus(item.cantidadPedida, cantidad);
            return {
              ...item,
              cantidadEntregada: cantidad,
              status: nextStatus,
            };
          });
          const nextOrderStatus = computeStatusFromItems(updatedItems);
          return { ...order, items: updatedItems, status: nextOrderStatus };
        });
        const allItems = updatedOrders.flatMap((order) => order.items);
        return { ...client, orders: updatedOrders, status: computeStatusFromItems(allItems) };
      }),
    );

    setEditedItems((prev) => {
      const key = `${comandaId}__${itemId}`;
      const next = { ...prev };
      const order = ordersLookup.get(comandaId);
      const currentItem = order?.items.find((item) => item.itemId === itemId);
      const originalValue = currentItem?.cantidadEntregadaOriginal ?? 0;
      if (cantidad === originalValue) {
        delete next[key];
      } else {
        next[key] = { comandaId, itemId, cantidadEntregada: cantidad };
      }
      return next;
    });

    setSelectedClient((prevSelected) => {
      if (!prevSelected || prevSelected.clientId !== clientId) return prevSelected;
      const updatedOrders = prevSelected.orders.map((order) => {
        if (order.comandaId !== comandaId) return order;
        const updatedItems = order.items.map((item) =>
          item.itemId === itemId
            ? { ...item, cantidadEntregada: cantidad, status: computeItemStatus(item.cantidadPedida, cantidad) }
            : item,
        );
        return { ...order, items: updatedItems, status: computeStatusFromItems(updatedItems) };
      });
      const allItems = updatedOrders.flatMap((order) => order.items);
      return { ...prevSelected, orders: updatedOrders, status: computeStatusFromItems(allItems) };
    });
  };

  const hasEditedItems = Object.keys(editedItems).length > 0;

  const handleSave = async () => {
    if (!hasEditedItems) {
      setSnackbar({ open: true, message: 'No hay cambios para guardar.', severity: 'info' });
      return;
    }

    const updatesByComanda = new Map();
    Object.values(editedItems).forEach(({ comandaId, itemId, cantidadEntregada }) => {
      if (!updatesByComanda.has(comandaId)) {
        updatesByComanda.set(comandaId, new Map());
      }
      updatesByComanda.get(comandaId).set(itemId, cantidadEntregada);
    });

    setSaving(true);

    try {
      for (const [comandaId, itemUpdates] of updatesByComanda.entries()) {
        const comanda = comandasById[comandaId];
        const order = ordersLookup.get(comandaId);
        if (!comanda || !order) continue;

        const items = Array.isArray(comanda.items) ? comanda.items : [];
        const payloadItems = items.map((item) => {
          const itemId = String(item?._id ?? '');
          const override = itemUpdates.get(itemId);
          let cantidadEntregada = override;
          if (cantidadEntregada === undefined) {
            const current = order.items.find((orderItem) => orderItem.itemId === itemId);
            cantidadEntregada = current?.cantidadEntregada ?? Number(item?.cantidadentregada ?? 0);
          }
          const cantidad = Number(item?.cantidad ?? 0);
          return {
            ...item,
            cantidadentregada: cantidadEntregada,
            entregado: cantidad > 0 ? cantidadEntregada >= cantidad : Boolean(item?.entregado),
          };
        });

        await api.put(`/comandas/${comandaId}`, { items: payloadItems });
      }

      setSnackbar({ open: true, message: 'Entregas actualizadas correctamente.', severity: 'success' });
      if (estadoDistribucionId && authState.userId) {
        fetchComandas(estadoDistribucionId, authState.userId);
      }
    } catch (requestError) {
      console.error('Error actualizando entregas', requestError);
      const message =
        requestError?.response?.data?.err?.message ||
        requestError?.response?.data?.message ||
        'No se pudieron actualizar las entregas.';
      setSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReload = () => {
    if (estadoDistribucionId && authState.userId) {
      fetchComandas(estadoDistribucionId, authState.userId);
    }
  };

  const renderStatusBadge = (status) => {
    const meta = statusMeta[status] ?? statusMeta.pending;
    const paletteColor = theme.palette[meta.color]?.main ?? theme.palette.info.main;
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.5,
          borderRadius: 999,
          bgcolor: alpha(paletteColor, 0.12),
          color: paletteColor,
          fontWeight: 600,
          fontSize: '0.875rem',
        }}
      >
        <span role="img" aria-label={meta.label}>
          {meta.emoji}
        </span>
        {meta.label}
      </Box>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto', width: '100%' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Pantalla de distribución
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestiona las entregas pendientes de forma ágil y táctil. Selecciona un cliente y revisa el estado de cada
            producto solicitado.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Paper elevation={0} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Clientes con entregas pendientes
            </Typography>
            <Autocomplete
              options={filteredOptions}
              value={selectedClient}
              onChange={handleSelectClient}
              getOptionLabel={(option) => option.clientName ?? ''}
              isOptionEqualToValue={(option, value) => option.clientId === value.clientId}
              loading={loading}
              noOptionsText={loading ? 'Cargando clientes…' : 'No hay clientes con entregas pendientes.'}
              renderOption={(props, option) => {
                const meta = statusMeta[option.status] ?? statusMeta.pending;
                const paletteColor = theme.palette[meta.color]?.main ?? theme.palette.info.main;
                return (
                  <Box
                    component="li"
                    {...props}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 0.5,
                      p: 1.25,
                      borderRadius: 2,
                      borderLeft: `6px solid ${paletteColor}`,
                      bgcolor: alpha(paletteColor, 0.08),
                    }}
                  >
                    <Typography sx={{ fontWeight: 600 }}>{option.clientName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {meta.emoji} {meta.description}
                    </Typography>
                  </Box>
                );
              }}
              renderInput={(params) => {
                const status = selectedClient?.status;
                const meta = statusMeta[status] ?? null;
                const paletteColor = meta ? theme.palette[meta.color]?.main ?? theme.palette.info.main : null;
                return (
                  <TextField
                    {...params}
                    label="Selecciona un cliente"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        minHeight: 64,
                        borderRadius: 2.5,
                        bgcolor: paletteColor ? alpha(paletteColor, 0.04) : 'background.paper',
                        '& fieldset': {
                          borderColor: paletteColor ?? undefined,
                          borderWidth: paletteColor ? 2 : 1,
                        },
                        '&:hover fieldset': {
                          borderColor: paletteColor ?? theme.palette.primary.main,
                        },
                      },
                      '& .MuiInputLabel-root': {
                        fontWeight: 600,
                        color: paletteColor ?? undefined,
                      },
                    }}
                  />
                );
              }}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleReload}
                fullWidth
                sx={{ minHeight: 56, borderRadius: 2 }}
                disabled={loading}
              >
                Recargar datos
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                fullWidth
                disabled={!hasEditedItems || saving}
                sx={{ minHeight: 56, borderRadius: 2, fontWeight: 700 }}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {loading && (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Cargando información de distribución…
            </Typography>
          </Paper>
        )}

        {!loading && !selectedClient && (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Selecciona un cliente para ver sus pedidos
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Utiliza el combo superior para elegir rápidamente un cliente con entregas pendientes totales o
              parciales. Podrás revisar cada producto y actualizar las cantidades entregadas desde esta pantalla.
            </Typography>
          </Paper>
        )}

        {!loading && selectedClient && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
              <Stack spacing={2}>
                <Stack
                  direction={isTabletDown ? 'column' : 'row'}
                  spacing={2}
                  alignItems={isTabletDown ? 'flex-start' : 'center'}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {selectedClient.clientName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedClient.orders.length} pedido(s) en distribución
                    </Typography>
                  </Box>
                  {renderStatusBadge(selectedClient.status)}
                </Stack>

                {isMobile ? (
                  <Stack spacing={2}>
                    {selectedClient.orders.map((order) => (
                      <Stack key={order.comandaId} spacing={1.5}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Comanda #{order.numero}
                          </Typography>
                          {renderStatusBadge(order.status)}
                        </Box>
                        <Stack spacing={1.5}>
                          {order.items.map((item) => {
                            const meta = statusMeta[item.status] ?? statusMeta.pending;
                            const paletteColor = theme.palette[meta.color]?.main ?? theme.palette.info.main;
                            return (
                              <Paper
                                key={item.itemId}
                                variant="outlined"
                                sx={{
                                  p: 2,
                                  borderRadius: 2.5,
                                  borderLeft: `6px solid ${paletteColor}`,
                                  bgcolor: alpha(paletteColor, 0.05),
                                }}
                              >
                                <Stack spacing={1.25}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                    {item.productoDescripcion}
                                  </Typography>
                                  <Grid container spacing={1.5}>
                                    <Grid item xs={6}>
                                      <Typography variant="caption" color="text.secondary">
                                        Cantidad solicitada
                                      </Typography>
                                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                        {quantityFormatter.format(item.cantidadPedida)}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography variant="caption" color="text.secondary">
                                        Cantidad entregada
                                      </Typography>
                                      <TextField
                                        type="number"
                                        value={item.cantidadEntregada}
                                        onChange={(event) =>
                                          handleDeliveredChange(
                                            selectedClient.clientId,
                                            order.comandaId,
                                            item.itemId,
                                            event.target.value,
                                            item.cantidadPedida,
                                          )
                                        }
                                        fullWidth
                                        inputProps={{
                                          min: 0,
                                          max: item.cantidadPedida,
                                          step: '0.01',
                                          inputMode: 'decimal',
                                        }}
                                        sx={{
                                          '& .MuiOutlinedInput-root': {
                                            borderRadius: 2,
                                            fontSize: '1.1rem',
                                            minHeight: 56,
                                          },
                                        }}
                                      />
                                    </Grid>
                                    <Grid item xs={12}>
                                      {renderStatusBadge(item.status)}
                                    </Grid>
                                  </Grid>
                                </Stack>
                              </Paper>
                            );
                          })}
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table size="medium" sx={{ minWidth: 650 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Comanda</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">
                            Cantidad solicitada
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">
                            Cantidad entregada
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="center">
                            Estado
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedItems.map((item) => {
                          const meta = statusMeta[item.status] ?? statusMeta.pending;
                          const paletteColor = theme.palette[meta.color]?.main ?? theme.palette.info.main;
                          return (
                            <TableRow key={`${item.comandaId}-${item.itemId}`} hover sx={{
                              '& td': {
                                borderBottomColor: alpha(theme.palette.divider, 0.6),
                              },
                            }}>
                              <TableCell sx={{ fontWeight: 600 }}>{item.comandaNumero}</TableCell>
                              <TableCell sx={{ maxWidth: 320 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {item.productoDescripcion}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {quantityFormatter.format(item.cantidadPedida)}
                              </TableCell>
                              <TableCell align="right">
                                <TextField
                                  type="number"
                                  value={item.cantidadEntregada}
                                  onChange={(event) =>
                                    handleDeliveredChange(
                                      selectedClient.clientId,
                                      item.comandaId,
                                      item.itemId,
                                      event.target.value,
                                      item.cantidadPedida,
                                    )
                                  }
                                  inputProps={{ min: 0, max: item.cantidadPedida, step: '0.01', inputMode: 'decimal' }}
                                  sx={{
                                    '& .MuiOutlinedInput-root': {
                                      borderRadius: 2,
                                      minWidth: 140,
                                      fontSize: '1rem',
                                    },
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: 999,
                                    bgcolor: alpha(paletteColor, 0.12),
                                    color: paletteColor,
                                    fontWeight: 600,
                                  }}
                                >
                                  <span role="img" aria-label={meta.label}>
                                    {meta.emoji}
                                  </span>
                                  {meta.label}
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </Paper>
          </Stack>
        )}
      </Stack>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
