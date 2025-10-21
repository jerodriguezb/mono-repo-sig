import React, { useMemo, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
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
import RestartAltIcon from '@mui/icons-material/RestartAlt';

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

const statusConfig = {
  pendiente: {
    color: 'error',
    label: 'Pendiente',
    icon: <ScheduleIcon fontSize="small" />, 
  },
  parcial: {
    color: 'warning',
    label: 'Entrega parcial',
    icon: <WarningAmberIcon fontSize="small" />, 
  },
  completo: {
    color: 'success',
    label: 'Completo',
    icon: <CheckCircleIcon fontSize="small" />, 
  },
};

export default function DeliveryManagement({ clients }) {
  const theme = useTheme();
  const isTabletDown = useMediaQuery(theme.breakpoints.down('md'));
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
              renderInput={(params) => (
                <TextField {...params} label="Buscar cliente" placeholder="Selecciona un cliente" />
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

      <Grid container spacing={2}>
        {filteredClients.map((client) => {
          const config = statusConfig[client.status] ?? statusConfig.pendiente;
          return (
            <Grid item xs={12} md={6} key={client.id}>
              <Card
                variant="outlined"
                sx={{
                  borderColor:
                    client.status === 'parcial'
                      ? theme.palette.warning.light
                      : theme.palette.divider,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box>
                      <Typography variant="h6" component="div">
                        {client.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {client.address ?? 'Sin dirección registrada'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        icon={config.icon}
                        color={config.color}
                        label={config.label}
                      />
                      <IconButton
                        aria-label="Reiniciar entregas"
                        onClick={() => handleResetClient(client.id)}
                        size="small"
                      >
                        <RestartAltIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Divider />

                  <Stack spacing={1.5}>
                    {client.orders.map((order) => {
                      const remaining = Math.max(Number(order.quantity ?? 0) - Number(order.delivered ?? 0), 0);
                      const partial = Number(order.delivered ?? 0) > 0 && remaining > 0;
                      return (
                        <Box
                          key={order.id}
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            border: `1px solid ${theme.palette.divider}`,
                            backgroundColor: partial
                              ? alpha(theme.palette.warning.light, 0.18)
                              : theme.palette.background.default,
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {order.description}
                              </Typography>
                              {partial && (
                                <WarningAmberIcon sx={{ color: theme.palette.warning.main }} fontSize="small" />
                              )}
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                              <TextField
                                type="number"
                                label="Cantidad a entregar"
                                value={order.delivered ?? 0}
                                onChange={(event) =>
                                  handleDeliveredChange(client.id, order.id, event.target.value)
                                }
                                size="small"
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
                                sx={{ minWidth: 160, flex: 1 }}
                              />
                              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                                Restan {remaining} unidades por entregar.
                              </Typography>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}

        {!filteredClients.length && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" align="center">
                  No hay clientes para mostrar con los filtros seleccionados.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
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
};

DeliveryManagement.defaultProps = {
  clients: [],
};
