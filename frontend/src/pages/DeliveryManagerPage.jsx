import React from 'react';
import { Container } from '@mui/material';
import DeliveryManager from '../components/logistics/DeliveryManager';

export default function DeliveryManagerPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <DeliveryManager />
    </Container>
  );
}
