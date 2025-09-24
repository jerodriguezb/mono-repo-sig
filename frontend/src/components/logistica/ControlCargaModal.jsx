import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import { getUsuarios, updateComanda } from '../../api/comandas';

const formatDateTime = (value) => {
  if (!value) return '';
  return dayjs(value).format('YYYY-MM-DDTHH:mm');
};

const parseDateTime = (value) => {
  if (!value) return undefined;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toISOString() : undefined;
};

export default function ControlCargaModal({ open, comanda, onClose, onSaved }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({
    inspector: '',
    fechaHora: '',
    checklistDeposito: false,
    selloSeguridad: '',
    anotaciones: '',
    adjuntos: [],
  });
  const [nuevoAdjunto, setNuevoAdjunto] = useState({ nombre: '', url: '' });
  const [saving, setSaving] = useState(false);

  const currentUserId = useMemo(() => localStorage.getItem('id'), []);

  useEffect(() => {
    if (!open) return;
    const fetchUsuarios = async () => {
      try {
        const data = await getUsuarios();
        setUsuarios(data);
      } catch (err) {
        console.error('Error cargando usuarios', err);
      }
    };
    fetchUsuarios();
  }, [open]);

  useEffect(() => {
    if (!comanda) return;
    const control = comanda.controlCarga || {};
    setForm({
      inspector: control.inspector?._id || control.inspector || currentUserId || '',
      fechaHora: formatDateTime(control.fechaHora) || formatDateTime(new Date()),
      checklistDeposito: Boolean(control.checklistDeposito),
      selloSeguridad: control.selloSeguridad || '',
      anotaciones: control.anotaciones || '',
      adjuntos: Array.isArray(control.adjuntos) ? control.adjuntos : [],
    });
  }, [comanda, currentUserId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckbox = (event) => {
    const { name, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const handleAgregarAdjunto = () => {
    if (!nuevoAdjunto.nombre || !nuevoAdjunto.url) return;
    setForm((prev) => ({ ...prev, adjuntos: [...prev.adjuntos, { ...nuevoAdjunto }] }));
    setNuevoAdjunto({ nombre: '', url: '' });
  };

  const handleRemoveAdjunto = (index) => {
    setForm((prev) => ({
      ...prev,
      adjuntos: prev.adjuntos.filter((_, idx) => idx !== index),
    }));
  };

  const handleSave = async () => {
    if (!comanda) return;
    if (!form.inspector) {
      alert('Seleccioná inspector de carga');
      return;
    }
    try {
      setSaving(true);
      await updateComanda(comanda._id, {
        controlCarga: {
          inspector: form.inspector,
          fechaHora: parseDateTime(form.fechaHora) || new Date().toISOString(),
          checklistDeposito: form.checklistDeposito,
          selloSeguridad: form.selloSeguridad || undefined,
          anotaciones: form.anotaciones || undefined,
          adjuntos: form.adjuntos,
        },
        motivoHistorial: 'Control de carga registrado',
      });
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      console.error('Error registrando control de carga', err);
      alert('No se pudo registrar el control de carga.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Control de carga — Comanda #{comanda?.nrodecomanda}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel id="inspector-label">Inspector de carga</InputLabel>
            <Select
              labelId="inspector-label"
              name="inspector"
              label="Inspector de carga"
              value={form.inspector}
              onChange={handleChange}
            >
              {usuarios.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  {user.nombres} {user.apellidos}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Fecha y hora"
            type="datetime-local"
            name="fechaHora"
            value={form.fechaHora}
            onChange={handleChange}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={form.checklistDeposito}
                onChange={handleCheckbox}
                name="checklistDeposito"
              />
            }
            label="Checklist de depósito confirmado"
          />
          <TextField
            label="Sello de seguridad"
            name="selloSeguridad"
            value={form.selloSeguridad}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Anotaciones"
            name="anotaciones"
            value={form.anotaciones}
            onChange={handleChange}
            fullWidth
            multiline
            minRows={2}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label="Nombre adjunto"
              value={nuevoAdjunto.nombre}
              onChange={(event) => setNuevoAdjunto((prev) => ({ ...prev, nombre: event.target.value }))}
              size="small"
            />
            <TextField
              label="URL adjunto"
              value={nuevoAdjunto.url}
              onChange={(event) => setNuevoAdjunto((prev) => ({ ...prev, url: event.target.value }))}
              size="small"
              fullWidth
            />
            <Button variant="outlined" size="small" onClick={handleAgregarAdjunto}>
              Agregar
            </Button>
          </Stack>
          <List dense>
            {form.adjuntos.map((adjunto, index) => (
              <ListItem key={`${adjunto.url}-${index}`} secondaryAction={
                <IconButton edge="end" onClick={() => handleRemoveAdjunto(index)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              }>
                <ListItemText primary={adjunto.nombre} secondary={adjunto.url} />
              </ListItem>
            ))}
            {form.adjuntos.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                Sin adjuntos cargados
              </Typography>
            )}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          Guardar control de carga
        </Button>
      </DialogActions>
    </Dialog>
  );
}
