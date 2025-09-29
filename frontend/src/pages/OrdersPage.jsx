import React from 'react';
import { Stack, Typography } from '@mui/material';

export default function OrdersPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">Órdenes</Typography>
      <Typography variant="body1">
        Gestiona y revisa el estado de las órdenes desde este módulo.
      </Typography>
    </Stack>
  );
}
