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
  Tab,
  Tabs,
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

const ACTION_KEYS = {
  ESTADO: 'estado',
  CAMIONERO: 'camionero',
  PUNTO_DISTRIBUCION: 'puntoDistribucion',
};

const TAB_CONFIG = [
  { key: ACTION_KEYS.ESTADO, label: 'Estado' },
  { key: ACTION_KEYS.CAMIONERO, label: 'Camionero' },
  { key: ACTION_KEYS.PUNTO_DISTRIBUCION, label: 'Punto de distribución' },
];

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
  const [activeTab, setActiveTab] = useState(ACTION_KEYS.ESTADO);

  useEffect(() => {
    if (open) {
      setEstadoSel(initialValues.estado);
      setCamioneroSel(initialValues.camionero);
      setCamionSel(initialValues.camion);
      setPuntoDistribucion(initialValues.puntoDistribucion ?? '');
      setActiveTab(ACTION_KEYS.ESTADO);
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
    switch (activeTab) {
      case ACTION_KEYS.ESTADO:
        onSubmit?.({
          type: ACTION_KEYS.ESTADO,
          estado: estadoSel?.id ?? null,
        });
        break;
      case ACTION_KEYS.CAMIONERO:
        onSubmit?.({
          type: ACTION_KEYS.CAMIONERO,
          camionero: camioneroSel?.id ?? null,
        });
        break;
      case ACTION_KEYS.PUNTO_DISTRIBUCION:
        onSubmit?.({
          type: ACTION_KEYS.PUNTO_DISTRIBUCION,
          camion: camionSel?.id ?? null,
          puntoDistribucion: puntoDistribucion?.trim() || null,
        });
        break;
      default:
        onSubmit?.({ type: null });
        break;
    }
  };

  const handleTabChange = (_, value) => {
    setActiveTab(value);
  };

  const canSubmit = useMemo(() => {
    switch (activeTab) {
      case ACTION_KEYS.ESTADO:
        return Boolean(estadoSel?.id);
      case ACTION_KEYS.CAMIONERO:
        return Boolean(camioneroSel?.id);
      case ACTION_KEYS.PUNTO_DISTRIBUCION:
        return Boolean((puntoDistribucion ?? '').trim());
      default:
        return false;
    }
  }, [activeTab, estadoSel, camioneroSel, puntoDistribucion]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Asignar logística</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Elegí qué campo querés actualizar de forma masiva y completá el nuevo valor para las
          comandas seleccionadas.
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
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            {TAB_CONFIG.map((tab) => (
              <Tab key={tab.key} label={tab.label} value={tab.key} />
            ))}
          </Tabs>

          {activeTab === ACTION_KEYS.ESTADO && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Seleccioná el nuevo estado logístico para las comandas elegidas.
              </Typography>
              <Autocomplete
                value={estadoSel}
                options={estadoOptions}
                onChange={(_, value) => setEstadoSel(value)}
                renderInput={(params) => (
                  <TextField {...params} label="Estado logístico" placeholder="Buscar estado" />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
            </Box>
          )}

          {activeTab === ACTION_KEYS.CAMIONERO && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Elegí el camionero que se asignará a todas las comandas seleccionadas.
              </Typography>
              <Autocomplete
                value={camioneroSel}
                options={camioneroOptions}
                onChange={(_, value) => setCamioneroSel(value)}
                renderInput={(params) => (
                  <TextField {...params} label="Camionero / Chofer" placeholder="Buscar" />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
            </Box>
          )}

          {activeTab === ACTION_KEYS.PUNTO_DISTRIBUCION && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Definí el punto de distribución a aplicar masivamente.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    value={camionSel}
                    options={camionOptions}
                    onChange={(_, value) => {
                      setCamionSel(value);
                      if (value?.label) setPuntoDistribucion(value.label);
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Camión / Punto sugerido" placeholder="Buscar" />
                    )}
                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
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
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || !canSubmit}>
          {loading ? 'Guardando…' : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
