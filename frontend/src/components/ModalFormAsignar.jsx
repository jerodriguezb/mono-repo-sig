import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import api from '../api/axios.js';

const totalBultos = (comanda) =>
  Array.isArray(comanda?.items)
    ? comanda.items.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0)
    : 0;

const totalVolumen = (comanda) =>
  Array.isArray(comanda?.items)
    ? comanda.items.reduce((sum, item) => {
        const volumen = Number(item?.codprod?.volumen) || 0;
        const cantidad = Number(item?.cantidad) || 0;
        return sum + volumen * cantidad;
      }, 0)
    : 0;

export default function ModalFormAsignar({
  open,
  comanda,
  usuarios = [],
  camiones = [],
  onClose,
  onUpdated,
}) {
  const [form, setForm] = useState({
    camionId: '',
    camioneroId: '',
    fechaEntrega: '',
    motivo: '',
    capacidadBultos: 0,
    capacidadVolumen: 0,
    permitirSobrecarga: false,
  });

  const currentUserId = useMemo(() => localStorage.getItem('id') || '', []);

  useEffect(() => {
    if (open && comanda) {
      setForm({
        camionId: comanda.camion?._id || comanda.camion || '',
        camioneroId: comanda.camionero?._id || comanda.camionero || '',
        fechaEntrega: comanda.fechadeentrega ? dayjs(comanda.fechadeentrega).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        motivo: comanda.motivoLogistica || '',
        capacidadBultos: 0,
        capacidadVolumen: 0,
        permitirSobrecarga: false,
      });
    }
  }, [open, comanda]);

  const handleChange = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const bultos = totalBultos(comanda);
  const volumen = totalVolumen(comanda);

  const capacidadRestanteBultos = useMemo(() => {
    const capacidad = Number(form.capacidadBultos) || 0;
    if (!capacidad) return Infinity;
    return capacidad - bultos;
  }, [form.capacidadBultos, bultos]);

  const capacidadRestanteVolumen = useMemo(() => {
    const capacidad = Number(form.capacidadVolumen) || 0;
    if (!capacidad) return Infinity;
    return capacidad - volumen;
  }, [form.capacidadVolumen, volumen]);

  const excedeCapacidad =
    (capacidadRestanteBultos !== Infinity && capacidadRestanteBultos < 0) ||
    (capacidadRestanteVolumen !== Infinity && capacidadRestanteVolumen < 0);

  const drivers = useMemo(
    () => usuarios.filter((u) => u.role === 'USER_CAM' && u.activo !== false),
    [usuarios],
  );

  const puedeGuardar =
    comanda &&
    comanda.estadoPreparacion === 'Lista para carga' &&
    (!excedeCapacidad || form.permitirSobrecarga);

  const handleSubmit = async () => {
    if (!comanda) return;
    const payload = {
      camion: form.camionId || null,
      camionero: form.camioneroId || null,
      fechadeentrega: form.fechaEntrega || null,
      motivoLogistica: form.motivo || null,
      usuarioLogistica: currentUserId || null,
    };
    try {
      await api.put(`/comandas/${comanda._id}`, payload);
      onUpdated?.();
    } catch (error) {
      console.error('Error asignando logística', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Asignar camión y logística</DialogTitle>
      <DialogContent dividers>
        {comanda?.estadoPreparacion !== 'Lista para carga' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            La comanda todavía no está lista para carga. Completa la preparación antes de asignar logística.
          </Alert>
        )}
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            Comanda #{comanda?.nrodecomanda} – {comanda?.codcli?.razonsocial}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bultos comprometidos: {bultos} · Volumen estimado: {volumen.toFixed(2)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Capacidad restante:
            {' '}
            {capacidadRestanteBultos === Infinity
              ? 'sin límite de bultos definido'
              : `${capacidadRestanteBultos} bultos`}
            {' · '}
            {capacidadRestanteVolumen === Infinity
              ? 'sin límite de volumen definido'
              : `${capacidadRestanteVolumen.toFixed(2)} de volumen disponible`}
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="camion-label">Camión</InputLabel>
                <Select
                  labelId="camion-label"
                  label="Camión"
                  value={form.camionId}
                  onChange={handleChange('camionId')}
                >
                  <MenuItem value="">Sin asignar</MenuItem>
                  {camiones.filter((c) => c.activo !== false).map((camion) => (
                    <MenuItem key={camion._id} value={camion._id}>
                      {camion.camion} – {camion.patente}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="camionero-label">Chofer</InputLabel>
                <Select
                  labelId="camionero-label"
                  label="Chofer"
                  value={form.camioneroId}
                  onChange={handleChange('camioneroId')}
                >
                  <MenuItem value="">Sin asignar</MenuItem>
                  {drivers.map((driver) => (
                    <MenuItem key={driver._id} value={driver._id}>
                      {driver.nombres} {driver.apellidos}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                type="number"
                label="Capacidad de bultos"
                value={form.capacidadBultos}
                onChange={handleChange('capacidadBultos')}
                fullWidth
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                type="number"
                label="Capacidad de volumen"
                value={form.capacidadVolumen}
                onChange={handleChange('capacidadVolumen')}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                type="date"
                label="Fecha estimada de entrega"
                value={form.fechaEntrega}
                onChange={handleChange('fechaEntrega')}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          {excedeCapacidad && (
            <Alert severity="error">
              La carga supera la capacidad configurada del camión. Ajusta la asignación o confirma una reasignación manual.
            </Alert>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={form.permitirSobrecarga}
                onChange={handleChange('permitirSobrecarga')}
              />
            }
            label="Confirmo que la reasignación fue revisada manualmente"
          />

          <TextField
            label="Motivo o notas de logística"
            value={form.motivo}
            onChange={handleChange('motivo')}
            multiline
            minRows={2}
            fullWidth
          />

          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Checklist previo
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Checklist depósito: {comanda?.preparacion?.checklistDepositoConfirmado ? 'Confirmado' : 'Pendiente'} ·
              Control de carga: {comanda?.controlCarga?.checklistDepositoConfirmado ? 'Confirmado' : 'Pendiente'}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!puedeGuardar}
        >
          Confirmar asignación
        </Button>
      </DialogActions>
    </Dialog>
  );
}
