import React from 'react';
import { Box, Typography } from '@mui/material';
import LogisticsTable from '../components/logistics/LogisticsTable';

export default function LogisticsPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" component="h1">
        Logística
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Gestioná las comandas activas asignando estados, operarios y puntos de distribución. Utilizá los filtros para
        encontrar rápidamente la información clave.
      </Typography>
      <LogisticsTable />
    </Box>
  );
}
