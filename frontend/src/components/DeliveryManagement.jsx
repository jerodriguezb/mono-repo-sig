import React, { useMemo, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';

const clampDelivery = (value, max) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  if (!Number.isFinite(max)) {
    return Math.max(numeric, 0);
  }
  return Math.max(Math.min(numeric, max), 0);
};

const enhanceClients = (clients) =>
  clients.map((client) => ({
    ...client,
    orders: client.orders.map((order) => ({
      ...order,
      delivered: clampDelivery(order.delivered ?? 0, order.quantity),
    })),
  }));

const getClientStatus = (client) => {
  if (!client?.orders?.length) {
    return 'pendiente';
  }

  let hasDeliveredSomething = false;
  let hasRemaining = false;

  client.orders.forEach((order) => {
    const quantity = Number(order.quantity ?? 0);
    if (quantity <= 0) {
      return;
    }

    const delivered = Number(order.delivered ?? 0);
    if (delivered > 0) {
      hasDeliveredSomething = true;
    }
    if (delivered < quantity) {
      hasRemaining = true;
    }
  });

  if (!hasDeliveredSomething) {
    return 'pendiente';
  }

  if (!hasRemaining) {
    return 'completo';
  }

  return 'parcial';
};

const statusVisuals = {
  pendiente: {
    label: 'Pendiente',
    color: '#1976d2',
    icon: <ScheduleIcon fontSize="small" />,
  },
  parcial: {
    label: 'Entrega parcial',
    color: '#f9a825',
    icon: <WarningAmberIcon fontSize="small" />,
  },
  completo: {
    label: 'Completo',
    color: '#2e7d32',
    icon: <CheckCircleIcon fontSize="small" />,
  },
};

const getOrderStatus = (order) => {
  const quantity = Number(order.quantity ?? 0);
  const delivered = Number(order.delivered ?? 0);

  if (quantity <= 0 || delivered <= 0) {
    return delivered <= 0 ? 'pendiente' : 'parcial';
  }

  if (delivered >= quantity) {
    return 'completo';
  }

  return 'parcial';
};

const createRowStyles = (status, theme) => {
  const config = statusVisuals[status] ?? statusVisuals.pendiente;
  return {
    border: `1px solid ${alpha(config.color, 0.35)}`,
    backgroundColor: alpha(config.color, 0.08),
    boxShadow: `inset 4px 0 0 ${config.color}`,
    borderRadius: theme.shape.borderRadius * 1.5,
  };
};

export default function DeliveryManagement({ clients, onSave }) {
  const theme = useTheme();
  const isTabletDown = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [clientOrders, setClientOrders] = useState(() => enhanceClients(clients));
  const [selectedClientId, setSelectedClientId] = useState(null);

  useEffect(() => {
    setClientOrders(enhanceClients(clients));
  }, [clients]);

  const clientsWithStatus = useMemo(
    () =>
      clientOrders.map((client) => ({
        ...client,
        status: getClientStatus(client),
      })),
    [clientOrders],
  );

  const pendingCount = useMemo(
    () => clientsWithStatus.filter((client) => client.status === 'pendiente').length,
    [clientsWithStatus],
  );

  const selectedClient = useMemo(
    () => clientsWithStatus.find((client) => client.id === selectedClientId) ?? null,
    [clientsWithStatus, selectedClientId],
  );

  const filteredClients = selectedClient ? [selectedClient] : clientsWithStatus;

  const handleDeliveredChange = useCallback((clientId, orderId, value) => {
    setClientOrders((prev) =>
      prev.map((client) => {
        if (client.id !== clientId) return client;
        return {
          ...client,
          orders: client.orders.map((order) => {
            if (order.id !== orderId) return order;
            return {
              ...order,
              delivered: clampDelivery(value, order.quantity),
            };
          }),
        };
      }),
    );
  }, []);

  const handleResetClient = useCallback((clientId) => {
    setClientOrders((prev) =>
      prev.map((client) => {
        if (client.id !== clientId) return client;
        return {
          ...client,
          orders: client.orders.map((order) => ({
            ...order,
            delivered: 0,
          })),
        };
      }),
    );
  }, []);

  const handleSave = useCallback(
    (clientId) => {
      const normalize = (client) => ({
        id: client.id,
        orders: client.orders.map((order) => ({
          id: order.id,
          delivered: Number(order.delivered ?? 0),
        })),
      });

      const payload = clientId
        ? clientOrders.filter((client) => client.id === clientId).map(normalize)
        : clientOrders.map(normalize);

      if (onSave) {
        onSave(payload, { clientId: clientId ?? null });
      }
    },
    [clientOrders, onSave],
  );

  const renderAutocompleteOption = useCallback((props, option) => {
    const config = statusVisuals[option.status] ?? statusVisuals.pendiente;
    return (
      <Box component="li" {...props} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: config.color }} />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {option.name}
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ color: config.color, fontWeight: 600 }}>
          {config.label}
        </Typography>
      </Box>
    );
  }, []);

  return (
    <Box sx={{ width: '100%', px: { xs: 1, sm: 2 } }}>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack
          spacing={2}
          direction={isTabletDown ? 'column' : 'row'}
          alignItems={isTabletDown ? 'stretch' : 'center'}
        >
          <Box sx={{ flex: 1 }}>
            <Autocomplete
              fullWidth
              options={clientsWithStatus}
              value={selectedClient}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, newValue) => setSelectedClientId(newValue ? newValue.id : null)}
              getOptionLabel={(option) => option?.name ?? ''}
              renderOption={renderAutocompleteOption}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Cliente"
                  placeholder="Selecciona un cliente"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ ml: selectedClient ? 1 : 0 }}>
                        {selectedClient && (
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor:
                                statusVisuals[selectedClient.status]?.color ?? statusVisuals.pendiente.color,
                            }}
                          />
                        )}
                        {params.InputProps.startAdornment}
                      </Stack>
                    ),
                  }}
                />
              )}
            />
          </Box>
          <Chip
            color="default"
            sx={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              px: 1.5,
              py: 1,
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
            label={`Clientes pendientes: ${pendingCount}`}
          />
        </Stack>
      </Stack>

      <Stack spacing={3}>
        {filteredClients.map((client) => {
          const config = statusVisuals[client.status] ?? statusVisuals.pendiente;
          const headerStyles = {
            background: alpha(config.color, 0.12),
            border: `1px solid ${alpha(config.color, 0.4)}`,
            boxShadow: `inset 4px 0 0 ${config.color}`,
          };

          return (
            <Paper key={client.id} elevation={0} sx={{ p: { xs: 2, sm: 3 }, ...headerStyles }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={2}
                >
                  <Box>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
                      {client.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {client.address ?? 'Sin dirección registrada'}
                    </Typography>
                  </Box>
                  <Chip
                    icon={config.icon}
                    label={config.label}
                    sx={{
                      fontWeight: 600,
                      bgcolor: alpha(config.color, 0.16),
                      color: config.color,
                    }}
                  />
                </Stack>

                <Divider sx={{ borderColor: alpha(config.color, 0.4) }} />

                <Stack spacing={1.5}>
                  {!isSmallScreen && (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '2.2fr repeat(3, minmax(110px, 1fr))',
                        gap: 2,
                        fontWeight: 600,
                        color: alpha(theme.palette.text.primary, 0.7),
                        px: 1,
                      }}
                    >
                      <Typography variant="body2">Producto</Typography>
                      <Typography variant="body2">Solicitado</Typography>
                      <Typography variant="body2">Entregado</Typography>
                      <Typography variant="body2">Estado</Typography>
                    </Box>
                  )}

                  {client.orders.map((order) => {
                    const remaining = Math.max(Number(order.quantity ?? 0) - Number(order.delivered ?? 0), 0);
                    const orderStatus = getOrderStatus(order);
                    const rowStyles = createRowStyles(orderStatus, theme);
                    const orderConfig = statusVisuals[orderStatus] ?? statusVisuals.pendiente;

                    return (
                      <Box
                        key={order.id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: isSmallScreen
                            ? '1fr'
                            : '2.2fr repeat(3, minmax(110px, 1fr))',
                          gap: isSmallScreen ? 1 : 2,
                          alignItems: 'center',
                          p: { xs: 1.5, sm: 2 },
                          ...rowStyles,
                        }}
                      >
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {order.description}
                        </Typography>

                        {isSmallScreen ? (
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" color="text.secondary">
                                Solicitado
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {order.quantity}
                              </Typography>
                            </Stack>
                            <Stack spacing={1}>
                              <TextField
                                type="number"
                                label="Entregado"
                                value={order.delivered ?? 0}
                                onChange={(event) =>
                                  handleDeliveredChange(client.id, order.id, event.target.value)
                                }
                                InputProps={{
                                  inputProps: {
                                    min: 0,
                                    max: order.quantity,
                                  },
                                  endAdornment: (
                                    <InputAdornment position="end">
                                      / {order.quantity}
                                    </InputAdornment>
                                  ),
                                }}
                                fullWidth
                              />
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" color="text.secondary">
                                  Estado
                                </Typography>
                                <Chip
                                  size="small"
                                  label={orderConfig.label}
                                  sx={{
                                    bgcolor: alpha(orderConfig.color, 0.2),
                                    color: orderConfig.color,
                                    fontWeight: 600,
                                  }}
                                />
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                Restan {remaining} unidades por entregar.
                              </Typography>
                            </Stack>
                          </Stack>
                        ) : (
                          <>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {order.quantity}
                            </Typography>
                            <TextField
                              type="number"
                              value={order.delivered ?? 0}
                              onChange={(event) =>
                                handleDeliveredChange(client.id, order.id, event.target.value)
                              }
                              InputProps={{
                                inputProps: {
                                  min: 0,
                                  max: order.quantity,
                                },
                                endAdornment: (
                                  <InputAdornment position="end">/ {order.quantity}</InputAdornment>
                                ),
                              }}
                              fullWidth
                            />
                            <Chip
                              icon={orderConfig.icon}
                              label={orderConfig.label}
                              sx={{
                                justifySelf: 'flex-start',
                                bgcolor: alpha(orderConfig.color, 0.2),
                                color: orderConfig.color,
                                fontWeight: 600,
                              }}
                            />
                          </>
                        )}
                      </Box>
                    );
                  })}
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => handleResetClient(client.id)}
                    fullWidth
                    size="large"
                  >
                    Reiniciar cantidades
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleSave(client.id)}
                    fullWidth
                    size="large"
                  >
                    Guardar cambios
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          );
        })}

        {!filteredClients.length && (
          <Paper elevation={0} sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No hay clientes para mostrar con los filtros seleccionados.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

DeliveryManagement.propTypes = {
  clients: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      address: PropTypes.string,
      orders: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          description: PropTypes.string.isRequired,
          quantity: PropTypes.number.isRequired,
          delivered: PropTypes.number,
        }),
      ).isRequired,
    }),
  ),
  onSave: PropTypes.func,
};

DeliveryManagement.defaultProps = {
  clients: [],
  onSave: undefined,
};
