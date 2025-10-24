import React, { useMemo } from 'react';
import { Box, Container, Typography } from '@mui/material';
import DeliveryManagement from '../components/DeliveryManagement.jsx';

const mockClients = [
  {
    id: 'client-1',
    name: 'Supermercado Central',
    address: 'Av. Libertador 1234, Córdoba',
    orders: [
      { id: 'order-1', description: 'Agua mineral 1L', quantity: 12, delivered: 0 },
      { id: 'order-2', description: 'Gaseosa cola 2L', quantity: 6, delivered: 2 },
      { id: 'order-3', description: 'Jugo de naranja 1L', quantity: 8, delivered: 8 },
    ],
  },
  {
    id: 'client-2',
    name: 'Almacén Don Pepe',
    address: 'Ruta 9 km 120, Jesús María',
    orders: [
      { id: 'order-4', description: 'Cerveza rubia 500ml', quantity: 24, delivered: 24 },
      { id: 'order-5', description: 'Cerveza negra 500ml', quantity: 12, delivered: 10 },
    ],
  },
  {
    id: 'client-3',
    name: 'Kiosco 25 Horas',
    address: 'San Martín 555, Villa María',
    orders: [
      { id: 'order-6', description: 'Snack papas 150g', quantity: 10, delivered: 0 },
      { id: 'order-7', description: 'Galletitas surtidas', quantity: 4, delivered: 0 },
    ],
  },
];

export default function DeliveryManagementPage() {
  const clients = useMemo(() => mockClients, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Gestión de entregas
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Selecciona un cliente para registrar las cantidades entregadas y visualizar el estado de cada
          pedido. La interfaz se adapta automáticamente a móviles y tablets.
        </Typography>
      </Box>
      <DeliveryManagement clients={clients} />
    </Container>
  );
}
