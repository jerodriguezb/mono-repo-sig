import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import api from '../api/axios.js';

const ESTADOS_ENTREGA = ['Completa', 'Parcial', 'Rechazada'];

const archivoInicial = () => ({ nombre: '', url: '', tipo: '' });

export default function ModalFormCamion({ open, comanda, onClose, onUpdated }) {
  const [form, setForm] = useState({
    parada: '',
    estado: 'Completa',
    cantidadComprometida: '',
    cantidadEntregada: '',
    motivo: '',
    checklistConfirmado: false,
    fotos: [],
    nuevoArchivo: archivoInicial(),
  });

  useEffect(() => {
    if (open) {
      setForm({
        parada: '',
        estado: 'Completa',
        cantidadComprometida: '',
        cantidadEntregada: '',
        motivo: '',
        checklistConfirmado: false,
        fotos: [],
        nuevoArchivo: archivoInicial(),
      });
    }
  }, [open]);

  const handleChange = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleArchivoChange = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({
      ...prev,
      nuevoArchivo: { ...prev.nuevoArchivo, [field]: value },
    }));
  };

  const handleAddFoto = () => {
    setForm((prev) => {
      if (!prev.nuevoArchivo.nombre && !prev.nuevoArchivo.url) return prev;
      return {
        ...prev,
        fotos: [...prev.fotos, prev.nuevoArchivo],
        nuevoArchivo: archivoInicial(),
      };
    });
  };

  const handleRemoveFoto = (idx) => () => {
    setForm((prev) => ({
      ...prev,
      fotos: prev.fotos.filter((_, index) => index !== idx),
    }));
  };

  const handleSubmit = async () => {
    if (!comanda) return;
    const payload = {
      nuevaEntrega: {
        parada: form.parada || null,
        estado: form.estado,
        cantidadComprometida: form.cantidadComprometida ? Number(form.cantidadComprometida) : undefined,
        cantidadEntregada: form.cantidadEntregada ? Number(form.cantidadEntregada) : undefined,
        motivo: form.motivo || null,
        checklistConfirmado: form.checklistConfirmado,
        fotos: form.fotos,
        fecha: new Date().toISOString(),
      },
    };
    try {
      await api.put(`/comandas/${comanda._id}`, payload);
      onUpdated?.();
    } catch (error) {
      console.error('Error registrando entrega', error);
    }
  };

  const entregas = Array.isArray(comanda?.entregas) ? comanda.entregas : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Seguimiento de entregas</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            Comanda #{comanda?.nrodecomanda} – {comanda?.codcli?.razonsocial}
          </Typography>

          <Box>
            <Typography variant="subtitle2">Entregas registradas</Typography>
            {entregas.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aún no se registraron entregas para esta comanda.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ mt: 1 }}>
                {entregas.map((entrega, idx) => (
                  <Chip
                    key={`${comanda?._id}-${idx}`}
                    label={`${entrega.parada || `Parada ${idx + 1}`} · ${entrega.estado}`}
                    color={entrega.estado === 'Completa' ? 'success' : entrega.estado === 'Parcial' ? 'warning' : 'error'}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Nueva entrega
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Parada"
                value={form.parada}
                onChange={handleChange('parada')}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel id="estado-label">Estado</InputLabel>
                <Select
                  labelId="estado-label"
                  value={form.estado}
                  label="Estado"
                  onChange={handleChange('estado')}
                >
                  {ESTADOS_ENTREGA.map((estado) => (
                    <MenuItem key={estado} value={estado}>
                      {estado}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={<Checkbox checked={form.checklistConfirmado} onChange={handleChange('checklistConfirmado')} />}
                label="Checklist informado"
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                type="number"
                label="Cantidad comprometida"
                value={form.cantidadComprometida}
                onChange={handleChange('cantidadComprometida')}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                type="number"
                label="Cantidad entregada"
                value={form.cantidadEntregada}
                onChange={handleChange('cantidadEntregada')}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>

          <TextField
            label="Motivo / observaciones"
            value={form.motivo}
            onChange={handleChange('motivo')}
            fullWidth
            multiline
            minRows={2}
          />

          <Box>
            <Typography variant="subtitle2">Fotos o adjuntos</Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Nombre"
                  value={form.nuevoArchivo.nombre}
                  onChange={handleArchivoChange('nombre')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="URL"
                  value={form.nuevoArchivo.url}
                  onChange={handleArchivoChange('url')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button fullWidth variant="outlined" onClick={handleAddFoto}>
                  Añadir
                </Button>
              </Grid>
            </Grid>
            <List dense>
              {form.fotos.map((foto, idx) => (
                <ListItem
                  key={`${foto.nombre}-${idx}`}
                  secondaryAction={
                    <Button size="small" color="error" onClick={handleRemoveFoto(idx)}>
                      Quitar
                    </Button>
                  }
                >
                  <ListItemText primary={foto.nombre || foto.url} secondary={foto.url} />
                </ListItem>
              ))}
            </List>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Registrar entrega
        </Button>
      </DialogActions>
    </Dialog>
  );
}
