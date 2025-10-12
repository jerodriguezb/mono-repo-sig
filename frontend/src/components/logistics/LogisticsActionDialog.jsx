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
  Divider,
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

const buildComandaLabel = (comanda) =>
  `#${comanda?.nrodecomanda ?? 'N/D'} — ${
    comanda?.codcli?.razonsocial ?? 'Cliente sin nombre'
  }`;

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
  const [confirming, setConfirming] = useState(false);
  const [estadoError, setEstadoError] = useState(false);

  useEffect(() => {
    if (open) {
      setEstadoSel(initialValues.estado);
      setCamioneroSel(initialValues.camionero);
      setCamionSel(initialValues.camion);
      setPuntoDistribucion(initialValues.puntoDistribucion ?? '');
      setConfirming(false);
      setEstadoError(false);
    }
  }, [open, initialValues]);

  useEffect(() => {
    if (camionSel?.label && !puntoDistribucion) {
      setPuntoDistribucion(camionSel.label);
    }
  }, [camionSel, puntoDistribucion]);

  const sanitizedPuntoDistribucion = useMemo(
    () => puntoDistribucion?.trim() ?? '',
    [puntoDistribucion],
  );

  const estadoOptions = useMemo(() => mapOptions(estados, (e) => e.estado ?? '—'), [estados]);
  const camioneroOptions = useMemo(
    () => mapOptions(camioneros, (u) => `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim()),
    [camioneros],
  );
  const camionOptions = useMemo(() => mapOptions(camiones, (c) => c.camion ?? '—'), [camiones]);

  const handleSubmit = (evt) => {
    evt?.preventDefault?.();
    if (!confirming) {
      if (!estadoSel?.id) {
        setEstadoError(true);
        return;
      }
      setConfirming(true);
      return;
    }

    onSubmit?.({
      estado: estadoSel?.id ?? null,
      camionero: camioneroSel?.id ?? null,
      camion: camionSel?.id ?? null,
      puntoDistribucion: sanitizedPuntoDistribucion || null,
    });
  };

  const handleClose = () => {
    if (confirming) {
      setConfirming(false);
      return;
    }
    onClose?.();
  };

  const handleDialogClose = (_, reason) => {
    if (loading) return;
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      if (confirming) {
        setConfirming(false);
        return;
      }
    }
    handleClose();
  };

  const summaryEntries = useMemo(() => {
    const normalizeId = (value) => {
      if (value === null || value === undefined) return null;
      return String(value);
    };

    const estadoUpdates = [];
    const estadoKeeps = [];
    const camioneroUpdates = [];
    const camioneroKeeps = [];
    const camionUpdates = [];
    const camionKeeps = [];
    const puntoUpdates = [];
    const puntoKeeps = [];

    const normalizedEstadoTarget = normalizeId(estadoSel?.id);

    (comandas ?? []).forEach((comanda, index) => {
      const baseKey = comanda?._id ?? `comanda-${comanda?.nrodecomanda ?? index}`;
      const label = buildComandaLabel(comanda);

      const currentEstadoId = normalizeId(
        comanda?.codestado?._id ?? comanda?.codestado?.id ?? comanda?.codestado,
      );
      if (normalizedEstadoTarget && normalizedEstadoTarget !== currentEstadoId) {
        estadoUpdates.push({ key: `${baseKey}-estado-update`, label });
      } else {
        estadoKeeps.push({ key: `${baseKey}-estado-keep`, label });
      }

      if (camioneroSel?.id) {
        if (comanda?.camionero) {
          camioneroKeeps.push({ key: `${baseKey}-camionero-keep`, label });
        } else {
          camioneroUpdates.push({ key: `${baseKey}-camionero-update`, label });
        }
      }

      if (camionSel?.id) {
        if (comanda?.camion) {
          camionKeeps.push({ key: `${baseKey}-camion-keep`, label });
        } else {
          camionUpdates.push({ key: `${baseKey}-camion-update`, label });
        }
      }

      if (sanitizedPuntoDistribucion) {
        const currentPoint = (comanda?.puntoDistribucion ?? '').trim();
        if (currentPoint) {
          puntoKeeps.push({ key: `${baseKey}-punto-keep`, label });
        } else {
          puntoUpdates.push({ key: `${baseKey}-punto-update`, label });
        }
      }
    });

    const entries = [
      {
        key: 'estado',
        label: 'Estado logístico',
        nextValue: estadoSel?.label ?? '—',
        updates: estadoUpdates,
        keeps: estadoKeeps,
        keepReason: 'Ya se encuentra en el estado seleccionado.',
        noUpdateMessage:
          estadoUpdates.length === 0
            ? 'Todas las comandas ya estaban en este estado. No se realizarán cambios.'
            : null,
      },
    ];

    if (camioneroSel?.id) {
      entries.push({
        key: 'camionero',
        label: 'Camionero / Chofer',
        nextValue: camioneroSel?.label ?? '—',
        updates: camioneroUpdates,
        keeps: camioneroKeeps,
        keepReason: 'Ya tienen un camionero asignado.',
        noUpdateMessage:
          camioneroUpdates.length === 0
            ? 'Todas las comandas ya tienen un camionero asignado. No se realizarán cambios en este campo.'
            : null,
      });
    } else {
      entries.push({
        key: 'camionero',
        label: 'Camionero / Chofer',
        nextValue: 'Sin selección',
        updates: [],
        keeps: [],
        noUpdateMessage: 'No se asignará un camionero de forma masiva.',
      });
    }

    if (camionSel?.id) {
      entries.push({
        key: 'camion',
        label: 'Camión / Punto de distribución',
        nextValue: camionSel?.label ?? '—',
        updates: camionUpdates,
        keeps: camionKeeps,
        keepReason: 'Ya tienen un camión asignado.',
        noUpdateMessage:
          camionUpdates.length === 0
            ? 'Todas las comandas ya tienen un camión asignado. No se realizarán cambios en este campo.'
            : null,
      });
    } else {
      entries.push({
        key: 'camion',
        label: 'Camión / Punto de distribución',
        nextValue: 'Sin selección',
        updates: [],
        keeps: [],
        noUpdateMessage: 'No se asignará un nuevo camión en esta operación.',
      });
    }

    if (sanitizedPuntoDistribucion) {
      entries.push({
        key: 'punto',
        label: 'Detalle del punto de distribución',
        nextValue: sanitizedPuntoDistribucion,
        updates: puntoUpdates,
        keeps: puntoKeeps,
        keepReason: 'Ya cuentan con un punto de distribución cargado.',
        noUpdateMessage:
          puntoUpdates.length === 0
            ? 'Todas las comandas ya tenían un punto de distribución. No se realizarán cambios en este campo.'
            : null,
      });
    } else {
      entries.push({
        key: 'punto',
        label: 'Detalle del punto de distribución',
        nextValue: 'Sin selección',
        updates: [],
        keeps: [],
        noUpdateMessage: 'No se actualizará el detalle del punto de distribución.',
      });
    }

    return entries;
  }, [
    camionSel?.id,
    camionSel?.label,
    camioneroSel?.id,
    camioneroSel?.label,
    comandas,
    estadoSel?.id,
    estadoSel?.label,
    sanitizedPuntoDistribucion,
  ]);

  return (
    <Dialog open={open} onClose={handleDialogClose} fullWidth maxWidth="md">
      <DialogTitle>{confirming ? 'Confirmá los cambios logísticos' : 'Asignar logística'}</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          {confirming
            ? 'Revisá el resumen antes de aplicar los cambios masivos. Los campos que ya tengan información se conservarán.'
            : 'Confirmá el estado logístico y las asignaciones para las siguientes comandas.'}
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
        {!confirming ? (
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  value={estadoSel}
                  options={estadoOptions}
                  onChange={(_, value) => {
                    setEstadoSel(value);
                    if (value) setEstadoError(false);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Estado logístico"
                      required
                      error={estadoError && !estadoSel}
                      helperText={estadoError && !estadoSel ? 'Seleccioná un estado' : undefined}
                    />
                  )}
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
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Confirmá los campos que se actualizarán. Los registros listados en "Se mantiene sin cambios"
              conservarán sus valores actuales.
            </Typography>
            {summaryEntries.map((entry, index) => (
              <Box key={entry.key} sx={{ mb: index === summaryEntries.length - 1 ? 0 : 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
                  {entry.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {`Nuevo valor: ${entry.nextValue}`}
                </Typography>
                {entry.updates.length > 0 ? (
                  <Box sx={{ mb: entry.keeps.length > 0 ? 1 : 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Se actualizará en:
                    </Typography>
                    <List dense>
                      {entry.updates.map((item) => (
                        <ListItem key={item.key}>
                          <ListItemText primary={item.label} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ) : (
                  entry.noUpdateMessage && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: entry.keeps.length ? 1 : 0 }}>
                      {entry.noUpdateMessage}
                    </Typography>
                  )
                )}
                {entry.keeps.length > 0 && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Se mantiene sin cambios
                      {entry.keepReason ? ` (${entry.keepReason})` : ''}:
                    </Typography>
                    <List dense>
                      {entry.keeps.map((item) => (
                        <ListItem key={item.key}>
                          <ListItemText primary={item.label} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
                {index < summaryEntries.length - 1 && <Divider sx={{ my: 2 }} />}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit" disabled={loading}>
          {confirming ? 'Volver' : 'Cancelar'}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Guardando…' : confirming ? 'Aplicar cambios' : 'Continuar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
