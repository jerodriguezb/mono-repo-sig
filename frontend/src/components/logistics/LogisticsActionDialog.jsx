import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  List,
  ListItem,
  ListItemText,
  TextField,
} from '@mui/material';

const buildOption = (item, getLabel) => ({
  id: item?._id,
  label: getLabel(item),
  raw: item,
});

const mapOptions = (collection = [], getLabel) =>
  collection
    .filter(Boolean)
    .map((item) => buildOption(item, getLabel))
    .filter((opt) => Boolean(opt.id));

export default function LogisticsActionDialog({
  open,
  onClose,
  onSubmit,
  comandas = [],
  estados = [],
  camioneros = [],
  camiones = [],
  loading = false,
}) {
  const initialValues = useMemo(() => {
    const first = comandas[0] ?? {};
    const estadoActual = first?.codestado ? buildOption(first.codestado, (e) => e.estado ?? '—') : null;
    const camioneroActual = first?.camionero
      ? buildOption(first.camionero, (u) => `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim())
      : null;
    const camionActual = first?.camion
      ? buildOption(first.camion, (c) => c.camion ?? '—')
      : null;
    return {
      estado: estadoActual,
      camionero: camioneroActual,
      camion: camionActual,
      puntoDistribucion: first?.puntoDistribucion ?? camionActual?.label ?? '',
    };
  }, [comandas]);

  const [estadoSel, setEstadoSel] = useState(null);
  const [camioneroSel, setCamioneroSel] = useState(null);
  const [camionSel, setCamionSel] = useState(null);
  const [puntoDistribucion, setPuntoDistribucion] = useState('');

  useEffect(() => {
    if (open) {
      setEstadoSel(initialValues.estado);
      setCamioneroSel(initialValues.camionero);
      setCamionSel(initialValues.camion);
      setPuntoDistribucion(initialValues.puntoDistribucion ?? '');
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (camionSel?.label && !puntoDistribucion) {
      setPuntoDistribucion(camionSel.label);
    }
  }, [camionSel, puntoDistribucion]);

  const estadoOptions = useMemo(() => mapOptions(estados, (e) => e.estado ?? '—'), [estados]);
  const camioneroOptions = useMemo(
    () => mapOptions(camioneros, (u) => `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim()),
    [camioneros],
  );
  const camionOptions = useMemo(() => mapOptions(camiones, (c) => c.camion ?? '—'), [camiones]);

  const handleSubmit = (evt) => {
    evt?.preventDefault?.();
    onSubmit?.({
      estado: estadoSel ?? null,
      camionero: camioneroSel ?? null,
      camion: camionSel ?? null,
      puntoDistribucion: puntoDistribucion?.trim() || null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Asignar logística</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Confirmá el estado logístico y las asignaciones para las siguientes comandas.
        </DialogContentText>
        <List dense sx={{ mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          {comandas.map((comanda) => (
            <ListItem key={comanda?._id ?? comanda?.nrodecomanda}>
              <ListItemText
                primary={`#${comanda?.nrodecomanda ?? 'N/D'} — ${comanda?.codcli?.razonsocial ?? 'Cliente sin nombre'}`}
                secondary={`Estado actual: ${comanda?.codestado?.estado ?? 'Sin estado asignado'}`}
              />
            </ListItem>
          ))}
        </List>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Autocomplete
                value={estadoSel}
                options={estadoOptions}
                onChange={(_, value) => setEstadoSel(value)}
                renderInput={(params) => <TextField {...params} label="Estado logístico" required />}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                value={camioneroSel}
                options={camioneroOptions}
                onChange={(_, value) => setCamioneroSel(value)}
                renderInput={(params) => (
                  <TextField {...params} label="Camionero / Chofer" placeholder="Buscar" />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                value={camionSel}
                options={camionOptions}
                onChange={(_, value) => {
                  setCamionSel(value);
                  if (value?.label) setPuntoDistribucion(value.label);
                }}
                renderInput={(params) => <TextField {...params} label="Punto de distribución" />}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Detalle del punto de distribución"
                value={puntoDistribucion}
                onChange={(event) => setPuntoDistribucion(event.target.value)}
                placeholder="Depósito, centro logístico, etc."
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Guardando…' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
