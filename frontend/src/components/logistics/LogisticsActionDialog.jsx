import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
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
  mode = 'estado',
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
  }, [open, initialValues, mode]);

  useEffect(() => {
    if (mode === 'puntoDistribucion' && camionSel?.label && !puntoDistribucion) {
      setPuntoDistribucion(camionSel.label);
    }
  }, [camionSel, puntoDistribucion, mode]);

  const estadoOptions = useMemo(() => mapOptions(estados, (e) => e.estado ?? '—'), [estados]);
  const camioneroOptions = useMemo(
    () => mapOptions(camioneros, (u) => `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim()),
    [camioneros],
  );
  const camionOptions = useMemo(() => mapOptions(camiones, (c) => c.camion ?? '—'), [camiones]);

  const handleSubmit = (evt) => {
    evt?.preventDefault?.();
    onSubmit?.({
      mode,
      estado: estadoSel?.id ?? null,
      camionero: camioneroSel?.id ?? null,
      camion: camionSel?.id ?? null,
      puntoDistribucion: puntoDistribucion?.trim() ?? '',
    });
  };

  const modeLabels = {
    estado: 'Estado logístico',
    camionero: 'Camionero / Chofer',
    puntoDistribucion: 'Punto de distribución',
  };

  const modeDescriptions = {
    estado: 'Seleccioná el nuevo estado logístico que se aplicará a todas las comandas seleccionadas.',
    camionero: 'Elegí el camionero o chofer que quedará asignado en forma masiva.',
    puntoDistribucion:
      'Indicá el punto de distribución o seleccioná un camión para completar la asignación.',
  };

  const currentLabel = modeLabels[mode] ?? 'Campo logístico';
  const currentDescription = modeDescriptions[mode] ?? 'Seleccioná el valor que querés asignar.';

  const trimmedPoint = (puntoDistribucion ?? '').trim();
  const disableSubmit =
    !mode ||
    (mode === 'estado' && !estadoSel) ||
    (mode === 'camionero' && !camioneroSel) ||
    (mode === 'puntoDistribucion' && !trimmedPoint && !camionSel);

  const resolveComandaSecondary = (comanda) => {
    if (mode === 'camionero') {
      const chofer = comanda?.camionero;
      const nombre = chofer ? `${chofer?.nombres ?? ''} ${chofer?.apellidos ?? ''}`.trim() : '';
      return `Camionero actual: ${nombre || 'Sin asignar'}`;
    }

    if (mode === 'puntoDistribucion') {
      const puntoActual = comanda?.puntoDistribucion ?? comanda?.camion?.camion ?? '';
      return `Punto actual: ${puntoActual || 'Sin asignar'}`;
    }

    return `Estado actual: ${comanda?.codestado?.estado ?? 'Sin estado asignado'}`;
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Asignación masiva</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Campo seleccionado
          </Typography>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            {currentLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentDescription}
          </Typography>
        </Box>
        <List dense sx={{ mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          {comandas.map((comanda) => (
            <ListItem key={comanda?._id ?? comanda?.nrodecomanda}>
              <ListItemText
                primary={`#${comanda?.nrodecomanda ?? 'N/D'} — ${comanda?.codcli?.razonsocial ?? 'Cliente sin nombre'}`}
                secondary={resolveComandaSecondary(comanda)}
              />
            </ListItem>
          ))}
        </List>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {mode === 'estado' && (
              <Grid item xs={12} md={6}>
                <Autocomplete
                  value={estadoSel}
                  options={estadoOptions}
                  onChange={(_, value) => setEstadoSel(value)}
                  renderInput={(params) => <TextField {...params} label="Estado logístico" required />}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                />
              </Grid>
            )}

            {mode === 'camionero' && (
              <Grid item xs={12} md={6}>
                <Autocomplete
                  value={camioneroSel}
                  options={camioneroOptions}
                  onChange={(_, value) => setCamioneroSel(value)}
                  renderInput={(params) => (
                    <TextField {...params} label="Camionero / Chofer" placeholder="Buscar" required />
                  )}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                />
              </Grid>
            )}

            {mode === 'puntoDistribucion' && (
              <>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    value={camionSel}
                    options={camionOptions}
                    onChange={(_, value) => {
                      setCamionSel(value);
                      if (value?.label) setPuntoDistribucion(value.label);
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Camión (opcional)" placeholder="Seleccionar camión" />
                    )}
                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Punto de distribución"
                    value={puntoDistribucion}
                    onChange={(event) => setPuntoDistribucion(event.target.value)}
                    placeholder="Depósito, centro logístico, etc."
                    required={!camionSel}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || disableSubmit}>
          {loading ? 'Guardando…' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
