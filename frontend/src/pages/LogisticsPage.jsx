import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import AppOrdenAPrepararReactTable from '../components/logistica/AppOrdenAPrepararReactTable.jsx';
import KanbanPreparacion from '../components/logistica/KanbanPreparacion.jsx';
import AppCamionReactTable from '../components/logistica/AppCamionReactTable.jsx';
import AppGestionReactTable from '../components/logistica/AppGestionReactTable.jsx';
import ModalFormAsignar from '../components/logistica/ModalFormAsignar.jsx';

const formatMinutes = (minutes) => `${minutes.toFixed(1)} min`;

export default function LogisticsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [metrics, setMetrics] = useState({
    tiempoPromedioPreparacion: 0,
    demoraPromedioDespacho: 0,
    porcentajeEntregasParciales: 0,
  });

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  return (
    <Stack spacing={4}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Logística y depósito
        </Typography>
        <Button variant="contained" onClick={() => setAssignOpen(true)}>
          Asignar comanda a camión
        </Button>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <AppOrdenAPrepararReactTable
            onDataChange={() => {}}
            onManualRefresh={handleRefresh}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6">Métricas claves</Typography>
              <Stack spacing={2} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="subtitle2">Tiempo promedio de preparación</Typography>
                  <Typography variant="h5">{formatMinutes(metrics.tiempoPromedioPreparacion)}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Demora entre preparación y despacho</Typography>
                  <Typography variant="h5">{formatMinutes(metrics.demoraPromedioDespacho)}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Entregas parciales / rechazadas</Typography>
                  <Typography variant="h5">{metrics.porcentajeEntregasParciales.toFixed(1)}%</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <KanbanPreparacion refreshKey={refreshKey} />
      <AppCamionReactTable refreshKey={refreshKey} />
      <AppGestionReactTable
        refreshKey={refreshKey}
        onMetricsCalculated={(data) => setMetrics(data)}
      />

      <ModalFormAsignar
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        onAssigned={() => {
          setAssignOpen(false);
          handleRefresh();
        }}
      />
    </Stack>
  );
}
