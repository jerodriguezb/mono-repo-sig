import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

function AsyncUserAutocomplete({ label, placeholder, value, onChange, loadOptions, roleLabel }) {
  const [options, setOptions] = useState(value ? [value] : []);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value && !options.find((opt) => opt?.id === value?.id)) {
      setOptions((prev) => [...prev, value]);
    }
  }, [value, options]);

  useEffect(() => {
    let active = true;
    if (inputValue.length < 3) return () => { active = false; };

    (async () => {
      setLoading(true);
      try {
        const fetched = await loadOptions(inputValue);
        if (active) setOptions(fetched);
      } catch (error) {
        console.error('Error cargando usuarios', error);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [inputValue, loadOptions]);

  return (
    <Autocomplete
      options={options}
      loading={loading}
      value={value}
      onChange={(_, newValue) => onChange(newValue ?? null)}
      getOptionLabel={(option) => option?.label ?? ''}
      isOptionEqualToValue={(option, val) => option?.id === val?.id}
      filterOptions={(opts) => opts}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          size="small"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          helperText={roleLabel}
        />
      )}
      inputValue={inputValue}
      onInputChange={(_, newInput) => setInputValue(newInput)}
      clearOnBlur={false}
      sx={{ minWidth: 260 }}
    />
  );
}

export default function LogisticsAssignmentDialog({
  open,
  onClose,
  onSubmit,
  comandas,
  estadoOptions,
  loadUsuarios,
  loading = false,
}) {
  const [selectedEstado, setSelectedEstado] = useState(null);
  const [selectedUsuario, setSelectedUsuario] = useState(null);
  const [puntoDistribucion, setPuntoDistribucion] = useState('');

  const estados = useMemo(
    () => estadoOptions.map((estado) => ({ id: estado.id, label: estado.label })),
    [estadoOptions],
  );

  useEffect(() => {
    if (!open) return;
    const [comanda] = comandas;
    if (comandas.length === 1 && comanda) {
      setSelectedEstado(comanda?.codestado?._id
        ? { id: comanda.codestado._id, label: comanda.codestado.estado }
        : null);
      setSelectedUsuario(comanda?.usuarioAsignado?._id
        ? {
            id: comanda.usuarioAsignado._id,
            label: `${comanda.usuarioAsignado.nombres ?? ''} ${comanda.usuarioAsignado.apellidos ?? ''}`.trim(),
          }
        : null);
      setPuntoDistribucion(comanda?.puntoDistribucion ?? '');
    } else {
      setSelectedEstado(null);
      setSelectedUsuario(null);
      setPuntoDistribucion('');
    }
  }, [open, comandas]);

  const resumen = useMemo(
    () => comandas.map((c) => ({
      id: c._id,
      titulo: `#${c.nrodecomanda}`,
      descripcion: c?.codcli?.razonsocial ?? 'Sin cliente',
    })),
    [comandas],
  );

  const handleSubmit = () => {
    onSubmit({
      estadoId: selectedEstado?.id ?? null,
      usuarioId: selectedUsuario?.id ?? null,
      puntoDistribucion: puntoDistribucion?.trim() ?? '',
    });
  };

  const estadoValue = estados.find((opt) => opt.id === selectedEstado?.id) ?? null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocalShippingIcon color="primary" />
        Gestión logística
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Se actualizarán {comandas.length} comanda(s).
        </Typography>
        <List dense sx={{ maxHeight: 220, overflow: 'auto', mb: 2 }}>
          {resumen.map((item) => (
            <React.Fragment key={item.id}>
              <ListItem disableGutters>
                <ListItemText primary={item.titulo} secondary={item.descripcion} />
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
        </List>
        <Stack spacing={2}>
          <Autocomplete
            options={estados}
            value={estadoValue}
            onChange={(_, newValue) => setSelectedEstado(newValue ?? null)}
            renderInput={(params) => (
              <TextField {...params} label="Estado" placeholder="Seleccioná estado" size="small" required />
            )}
            isOptionEqualToValue={(option, val) => option.id === val.id}
          />
          <AsyncUserAutocomplete
            label="Asignar a"
            placeholder="Buscar camionero o chofer"
            value={selectedUsuario}
            onChange={setSelectedUsuario}
            loadOptions={loadUsuarios}
            roleLabel="Ingresá al menos 3 letras para buscar"
          />
          <TextField
            label="Punto de distribución"
            placeholder="Ej: Centro de distribución Norte"
            value={puntoDistribucion}
            onChange={(event) => setPuntoDistribucion(event.target.value)}
            size="small"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!selectedEstado?.id || loading}
        >
          {loading ? 'Guardando…' : 'Confirmar cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
