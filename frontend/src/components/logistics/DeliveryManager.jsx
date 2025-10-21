import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

const STATUS_LABELS = {
  pending: 'Pendiente',
  partial: 'Parcial',
  complete: 'Completo',
};

const STATUS_COLORS = {
  pending: 'default',
  partial: 'warning',
  complete: 'success',
};

const STATUS_ICONS = {
  pending: <RadioButtonUncheckedIcon fontSize="small" />,
  partial: <ChangeCircleIcon fontSize="small" />,
  complete: <CheckCircleIcon fontSize="small" />,
};

const clampDelivered = (value, max) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric < 0) return 0;
  if (!Number.isFinite(max)) return numeric;
  return Math.min(numeric, max);
};

const getItemStatus = (item) => {
  if ((item.delivered ?? 0) <= 0) return 'pending';
  if ((item.delivered ?? 0) >= item.quantity) return 'complete';
  return 'partial';
};

const getClientStatus = (items) => {
  const statuses = items.map(getItemStatus);
  if (statuses.every((status) => status === 'complete')) return 'complete';
  if (statuses.every((status) => status === 'pending')) return 'pending';
  return 'partial';
};

const buildInitialClients = (data) =>
  data.map((client) => ({
    ...client,
    items: client.items.map((item) => ({
      ...item,
      delivered: clampDelivered(item.delivered ?? 0, item.quantity),
    })),
  }));

const defaultClients = [
  {
    id: 'c1',
    name: 'Almacén Rivera',
    address: 'Av. Siempre Viva 123',
    items: [
      { id: 'p1', name: 'Leche entera 1L', quantity: 12, delivered: 0, unit: 'unidades' },
      { id: 'p2', name: 'Cajas de cereales', quantity: 5, delivered: 2, unit: 'cajas' },
    ],
  },
  {
    id: 'c2',
    name: 'Supermercado Central',
    address: 'Ruta 8 km 45',
    items: [
      { id: 'p3', name: 'Harina 000', quantity: 20, delivered: 20, unit: 'bolsas' },
      { id: 'p4', name: 'Azúcar 1kg', quantity: 15, delivered: 15, unit: 'paquetes' },
    ],
  },
  {
    id: 'c3',
    name: 'Mini Market San José',
    address: 'Calle Principal 678',
    items: [
      { id: 'p5', name: 'Yerba mate 1kg', quantity: 10, delivered: 4, unit: 'paquetes' },
      { id: 'p6', name: 'Gaseosas 2.25L', quantity: 8, delivered: 0, unit: 'botellas' },
    ],
  },
];

export default function DeliveryManager({ initialClients = defaultClients }) {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const [clients, setClients] = useState(() => buildInitialClients(initialClients));
  const [selectedClientId, setSelectedClientId] = useState(() => clients[0]?.id ?? null);

  useEffect(() => {
    setClients(buildInitialClients(initialClients));
  }, [initialClients]);

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  const clientsWithStatus = useMemo(
    () =>
      clients.map((client) => {
        const status = getClientStatus(client.items);
        const pendingItems = client.items.filter((item) => getItemStatus(item) === 'pending').length;
        const partialItems = client.items.filter((item) => getItemStatus(item) === 'partial').length;
        return {
          ...client,
          status,
          pendingItems,
          partialItems,
        };
      }),
    [clients],
  );

  const pendingClientsCount = useMemo(
    () => clientsWithStatus.filter((client) => client.status === 'pending').length,
    [clientsWithStatus],
  );

  const selectedClient = useMemo(
    () => clientsWithStatus.find((client) => client.id === selectedClientId) ?? null,
    [clientsWithStatus, selectedClientId],
  );

  const handleDeliveredChange = (clientId, itemId, newValue) => {
    setClients((prevClients) =>
      prevClients.map((client) => {
        if (client.id !== clientId) return client;
        return {
          ...client,
          items: client.items.map((item) => {
            if (item.id !== itemId) return item;
            return {
              ...item,
              delivered: clampDelivered(newValue, item.quantity),
            };
          }),
        };
      }),
    );
  };

  const renderStatusChip = (status) => (
    <Chip
      size="small"
      color={STATUS_COLORS[status]}
      icon={STATUS_ICONS[status]}
      label={STATUS_LABELS[status]}
    />
  );

  return (
    <Stack spacing={3} sx={{ width: '100%' }}>
      <Card variant="outlined">
        <CardContent>
          <Stack direction={isSmallScreen ? 'column' : 'row'} spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="h6" component="div">
              Gestión de entregas
            </Typography>
            <Chip
              color={pendingClientsCount > 0 ? 'warning' : 'success'}
              label={`Clientes pendientes: ${pendingClientsCount}`}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={5} lg={4}>
              <Stack spacing={2}>
                <Autocomplete
                  options={clientsWithStatus}
                  value={selectedClient ?? null}
                  onChange={(event, newValue) => setSelectedClientId(newValue?.id ?? null)}
                  getOptionLabel={(option) => option.name}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {renderStatusChip(option.status)}
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.address}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => <TextField {...params} label="Buscar cliente" placeholder="Seleccioná un cliente" />}
                  fullWidth
                />

                <Card variant="outlined">
                  <CardContent sx={{ p: 0 }}>
                    <List dense disablePadding>
                      {clientsWithStatus.map((client) => {
                        const isSelected = client.id === selectedClientId;
                        return (
                          <React.Fragment key={client.id}>
                            <ListItem disablePadding>
                              <ListItemButton selected={isSelected} onClick={() => setSelectedClientId(client.id)}>
                                <ListItemAvatar>
                                  <Avatar sx={{ bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText }}>
                                    {client.name.slice(0, 2).toUpperCase()}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Typography variant="subtitle2" color="text.primary">
                                        {client.name}
                                      </Typography>
                                      {client.partialItems > 0 && (
                                        <Chip
                                          size="small"
                                          color="warning"
                                          label={`${client.partialItems} parcial${client.partialItems > 1 ? 'es' : ''}`}
                                        />
                                      )}
                                    </Stack>
                                  }
                                  secondary={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      {renderStatusChip(client.status)}
                                      <Typography variant="caption" color="text.secondary">
                                        {`${client.items.length} ítem${client.items.length !== 1 ? 's' : ''}`}
                                      </Typography>
                                    </Stack>
                                  }
                                />
                              </ListItemButton>
                            </ListItem>
                            <Divider component="li" />
                          </React.Fragment>
                        );
                      })}
                    </List>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>

            <Grid item xs={12} md={7} lg={8}>
              {selectedClient ? (
                <Stack spacing={2} sx={{ height: '100%' }}>
                  <Box>
                    <Typography variant="h6">{selectedClient.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedClient.address}
                    </Typography>
                  </Box>
                  <TableContainer component={Card} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Ítem</TableCell>
                          <TableCell align="center">Cantidad pedida</TableCell>
                          <TableCell align="center">Entregada</TableCell>
                          <TableCell align="center">Estado</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedClient.items.map((item) => {
                          const itemStatus = getItemStatus(item);
                          return (
                            <TableRow key={item.id} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  {item.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {`Unidad: ${item.unit ?? 'N/A'}`}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {`${item.quantity} ${item.unit ?? ''}`.trim()}
                              </TableCell>
                              <TableCell align="center" sx={{ minWidth: 140 }}>
                                <TextField
                                  type="number"
                                  size="small"
                                  inputProps={{ min: 0, max: item.quantity }}
                                  value={item.delivered ?? 0}
                                  onChange={(event) => handleDeliveredChange(selectedClient.id, item.id, event.target.value)}
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell align="center">{renderStatusChip(itemStatus)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography variant="body1" color="text.secondary">
                    Seleccioná un cliente para ver el detalle del pedido.
                  </Typography>
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );
}
