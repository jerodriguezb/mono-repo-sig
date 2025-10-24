import React, { useMemo, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
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

const statusConfig = (theme) => ({
  pendiente: {
    color: theme.palette.info.main,
    background: alpha(theme.palette.info.main, 0.12),
    label: 'Pendiente',
    icon: <ScheduleIcon fontSize="small" />,
  },
  parcial: {
    color: theme.palette.warning.main,
    background: alpha(theme.palette.warning.main, 0.12),
    label: 'Entrega parcial',
    icon: <WarningAmberIcon fontSize="small" />,
  },
  completo: {
    color: theme.palette.success.main,
    background: alpha(theme.palette.success.main, 0.12),
    label: 'Completo',
    icon: <CheckCircleIcon fontSize="small" />,
  },
});

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

  const statusPalette = useMemo(() => statusConfig(theme), [theme]);

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
              isOptionEqualToValue={(option, value) => option.id === value?.id}
              onChange={(_, newValue) => setSelectedClientId(newValue ? newValue.id : null)}
              getOptionLabel={(option) => option?.name ?? ''}
              renderOption={(props, option) => {
                const optionConfig = statusPalette[option.status] ?? statusPalette.pendiente;
                return (
                  <Box
                    component="li"
                    {...props}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: optionConfig.color,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {option.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {optionConfig.label}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Buscar cliente"
                  placeholder="Selecciona un cliente"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: selectedClient ? (
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor:
                            (statusPalette[selectedClient.status] ?? statusPalette.pendiente).color,
                          mr: 1,
                        }}
                      />
                    ) : (
                      params.InputProps.startAdornment
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

      <Grid container spacing={2}>
        {filteredClients.map((client) => {
          const config = statusPalette[client.status] ?? statusPalette.pendiente;
          return (
            <Grid item xs={12} key={client.id}>
              <Card
                variant="outlined"
                sx={{
                  borderLeft: `8px solid ${config.color}`,
                  backgroundColor: alpha(config.color, 0.04),
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Box>
                      <Typography variant="h6" component="div">
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
                        backgroundColor: config.background,
                        color: config.color,
                        fontWeight: 600,
                      }}
                    />
                  </Stack>

                  <Divider />

                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      borderColor: alpha(config.color, 0.4),
                      overflowX: 'auto',
                    }}
                  >
                    <Table size="medium" aria-label={`Productos de ${client.name}`} sx={{ minWidth: 320 }}>
                      <TableHead sx={{ display: { xs: 'none', sm: 'table-header-group' } }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Producto</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>
                            Cantidad solicitada
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>
                            Cantidad entregada
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>
                            Ajustar entrega
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {client.orders.map((order) => {
                          const quantity = Number(order.quantity ?? 0);
                          const delivered = Number(order.delivered ?? 0);
                          const remaining = Math.max(quantity - delivered, 0);
                          return (
                            <TableRow
                              key={order.id}
                              sx={{
                                backgroundColor: alpha(config.color, 0.08),
                                '&:nth-of-type(odd)': {
                                  backgroundColor: alpha(config.color, 0.14),
                                },
                                display: { xs: 'grid', sm: 'table-row' },
                                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))' },
                                gap: { xs: 1, sm: 0 },
                                borderColor: alpha(config.color, 0.2),
                                borderWidth: { xs: '0 0 1px', sm: undefined },
                                borderStyle: { xs: 'solid', sm: undefined },
                                '& td': {
                                  borderBottom: { xs: 'none', sm: `1px solid ${alpha(config.color, 0.2)}` },
                                  px: { xs: 1, sm: 2 },
                                  py: { xs: 1, sm: 1.5 },
                                },
                              }}
                            >
                              <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {order.description}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: { xs: 'block', sm: 'none' }, mt: 0.5 }}
                                >
                                  Solicitado: {quantity}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: { xs: 'block', sm: 'none' } }}
                                >
                                  Entregado: {delivered}
                                </Typography>
                              </TableCell>
                              <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {quantity}
                                </Typography>
                              </TableCell>
                              <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                                <Typography variant="body2">{delivered}</Typography>
                              </TableCell>
                              <TableCell sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: { xs: 'column', sm: 'row' },
                                gap: 1,
                              }}>
                                <TextField
                                  type="number"
                                  label="Entrega"
                                  value={delivered}
                                  onChange={(event) =>
                                    handleDeliveredChange(client.id, order.id, event.target.value)
                                  }
                                  inputProps={{ min: 0, max: quantity, inputMode: 'numeric', pattern: '[0-9]*' }}
                                  fullWidth
                                  size="medium"
                                />
                                <Typography variant="caption" color="text.secondary">
                                  Restan {remaining}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Button variant="contained" color="primary" fullWidth size="large">
                    Guardar cambios
                  </Button>
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
