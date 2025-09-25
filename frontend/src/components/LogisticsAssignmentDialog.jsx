import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import api from '../api/axios';

const camioneroLabel = (usuario) => {
  if (!usuario) return '';
  const nombres = usuario?.nombres ?? '';
  const apellidos = usuario?.apellidos ?? '';
  const full = `${nombres} ${apellidos}`.trim();
  return full || usuario?.email || 'Camionero sin nombre';
};

function useAsyncAutocomplete(endpoint, minLength = 2) {
  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noOptionsText, setNoOptionsText] = useState(
    minLength > 0 ? `Escribí al menos ${minLength} caracteres…` : 'Sin resultados',
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const term = inputValue.trim();

    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();

      if (!term || term.length < minLength) {
        setOptions([]);
        setLoading(false);
        setNoOptionsText(
          minLength > 0 ? `Escribí al menos ${minLength} caracteres…` : 'Sin resultados',
        );
        return;
      }

      if (cacheRef.current.has(term)) {
        setOptions(cacheRef.current.get(term));
        setLoading(false);
        setNoOptionsText('Sin resultados');
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setNoOptionsText('Buscando…');

      try {
        const { data } = await api.get(endpoint, {
          params: { term },
          signal: controller.signal,
        });
        const list =
          data?.usuarios ||
          data?.clientes ||
          data?.producservs ||
          data?.rutas ||
          [];
        cacheRef.current.set(term, list);
        setOptions(list);
        setNoOptionsText('Sin resultados');
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Error cargando datos asincrónicos', err);
        }
        setNoOptionsText('Error cargando datos');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [endpoint, inputValue, minLength]);

  return {
    options,
    loading,
    inputValue,
    setInputValue,
    noOptionsText,
  };
}

export default function LogisticsAssignmentDialog({
  open,
  comandas = [],
  estados = [],
  puntos = [],
  onSubmit,
  onClose,
  loading = false,
}) {
  const isMultiple = comandas.length > 1;
  const first = comandas[0];

  const [estadoSel, setEstadoSel] = useState(null);
  const [camioneroSel, setCamioneroSel] = useState(null);
  const [puntoSel, setPuntoSel] = useState('');

  const {
    options: camioneros,
    loading: camioneroLoading,
    inputValue: camioneroInput,
    setInputValue: setCamioneroInput,
    noOptionsText,
  } = useAsyncAutocomplete('/usuarios/camioneros', 2);

  useEffect(() => {
    if (!open) return;
    setEstadoSel(first?.codestado ?? null);
    setCamioneroSel(first?.camionero ?? first?.usuarioAsignado ?? null);
    setPuntoSel(first?.puntoDistribucion ?? '');
  }, [open, first]);

  const estadosOptions = useMemo(
    () => estados.map((estado) => ({ ...estado, label: estado?.estado ?? 'Sin nombre' })),
    [estados],
  );

  const handleConfirm = () => {
    onSubmit({
      estadoId: estadoSel?._id ?? null,
      camioneroId: camioneroSel?._id ?? null,
      puntoDistribucion: puntoSel || '',
    });
  };

  const canConfirm = Boolean(estadoSel || camioneroSel || puntoSel) && !loading;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Gestión logística {isMultiple ? '— acción masiva' : ''}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Resumen de comandas seleccionadas
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {comandas.map((comanda) => (
                <Chip
                  key={comanda._id}
                  label={`${comanda.nrodecomanda ?? comanda.nrocomanda ?? '—'} — ${
                    comanda?.codcli?.razonsocial ?? 'Cliente sin nombre'
                  }`}
                />
              ))}
            </Stack>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={estadosOptions}
                value={estadoSel ?? null}
                onChange={(_, value) => setEstadoSel(value ?? null)}
                getOptionLabel={(option) => option?.estado ?? option?.label ?? ''}
                renderInput={(params) => <TextField {...params} label="Estado" placeholder="Seleccioná estado" />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                options={camioneros}
                value={camioneroSel ?? null}
                onChange={(_, value) => setCamioneroSel(value ?? null)}
                inputValue={camioneroInput}
                onInputChange={(_, value) => setCamioneroInput(value)}
                getOptionLabel={(option) => camioneroLabel(option)}
                isOptionEqualToValue={(option, value) => option?._id === value?._id}
                loading={camioneroLoading}
                noOptionsText={noOptionsText}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Camionero"
                    placeholder="Buscá por nombre"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {camioneroLoading ? <CircularProgress color="inherit" size={18} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                freeSolo
                options={puntos}
                value={puntoSel}
                onChange={(_, value) => setPuntoSel(value ?? '')}
                onInputChange={(_, value) => setPuntoSel(value ?? '')}
                renderInput={(params) => (
                  <TextField {...params} label="Punto de distribución" placeholder="Base / depósito" />
                )}
              />
            </Grid>
          </Grid>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Confirmación
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Estado nuevo: <strong>{estadoSel?.estado ?? 'sin cambios'}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Camionero asignado: <strong>{camioneroLabel(camioneroSel) || 'sin cambios'}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Punto de distribución: <strong>{puntoSel || 'sin cambios'}</strong>
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading} color="inherit">
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={!canConfirm} variant="contained" color="primary">
          Guardar cambios
        </Button>
      </DialogActions>
    </Dialog>
  );
}
