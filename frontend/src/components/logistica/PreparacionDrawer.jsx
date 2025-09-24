import React, { useEffect, useMemo, useState } from 'react';
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
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  IconButton,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import { getUsuarios, updateComanda } from '../../api/comandas';

const formatDateTimeLocal = (value) => {
  if (!value) return '';
  return dayjs(value).format('YYYY-MM-DDTHH:mm');
};

const parseDateTimeLocal = (value) => {
  if (!value) return undefined;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toISOString() : undefined;
};

export default function PreparacionDrawer({ open, comanda, onClose, onSaved }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    responsable: '',
    inicio: '',
    fin: '',
    verificacionBultos: false,
    controlTemperatura: '',
    incidencias: '',
    archivos: [],
  });
  const [nuevoArchivo, setNuevoArchivo] = useState({ nombre: '', url: '' });

  const currentUserId = useMemo(() => localStorage.getItem('id'), []);
  const asignadoId = comanda?.operarioAsignado?._id || comanda?.operarioAsignado || null;
  const puedeFinalizar = asignadoId && String(asignadoId) === String(currentUserId);

  useEffect(() => {
    if (!open) return;
    const cargarUsuarios = async () => {
      try {
        setLoadingUsuarios(true);
        const data = await getUsuarios();
        setUsuarios(data);
      } catch (error) {
        console.error('Error cargando usuarios', error);
      } finally {
        setLoadingUsuarios(false);
      }
    };
    cargarUsuarios();
  }, [open]);

  useEffect(() => {
    if (!comanda) return;
    const prep = comanda.preparacion || {};
    setForm({
      responsable: prep.responsable?._id || prep.responsable || asignadoId || currentUserId || '',
      inicio: formatDateTimeLocal(prep.inicio),
      fin: formatDateTimeLocal(prep.fin),
      verificacionBultos: Boolean(prep.verificacionBultos),
      controlTemperatura: prep.controlTemperatura || '',
      incidencias: prep.incidencias || '',
      archivos: Array.isArray(prep.archivos) ? prep.archivos : [],
    });
  }, [comanda, asignadoId, currentUserId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckbox = (event) => {
    const { name, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const handleAgregarArchivo = () => {
    if (!nuevoArchivo.nombre || !nuevoArchivo.url) return;
    setForm((prev) => ({ ...prev, archivos: [...prev.archivos, { ...nuevoArchivo }] }));
    setNuevoArchivo({ nombre: '', url: '' });
  };

  const handleRemoveArchivo = (index) => {
    setForm((prev) => ({
      ...prev,
      archivos: prev.archivos.filter((_, idx) => idx !== index),
    }));
  };

  const buildPayload = (estadoPreparacion) => {
    const payload = {
      preparacion: {
        responsable: form.responsable || undefined,
        inicio: parseDateTimeLocal(form.inicio),
        fin: parseDateTimeLocal(form.fin),
        verificacionBultos: form.verificacionBultos,
        controlTemperatura: form.controlTemperatura || undefined,
        incidencias: form.incidencias || undefined,
        archivos: form.archivos,
      },
      motivoHistorial: 'Actualización checklist de depósito',
    };
    if (estadoPreparacion) payload.estadoPreparacion = estadoPreparacion;
    return payload;
  };

  const handleSave = async (estadoPreparacion) => {
    if (!comanda) return;
    if (!form.responsable) {
      alert('Seleccioná un responsable.');
      return;
    }
    if (!form.inicio) {
      alert('Indicá la hora de inicio.');
      return;
    }
    if (estadoPreparacion === 'Lista para carga' && !form.fin) {
      setForm((prev) => ({ ...prev, fin: formatDateTimeLocal(new Date()) }));
    }
    try {
      setSaving(true);
      const payload = buildPayload(estadoPreparacion);
      if (estadoPreparacion === 'Lista para carga' && !payload.preparacion.fin) {
        payload.preparacion.fin = new Date().toISOString();
      }
      await updateComanda(comanda._id, payload);
      if (typeof onSaved === 'function') onSaved();
    } catch (error) {
      console.error('Error guardando checklist', error);
      alert('No se pudo guardar la preparación.');
    } finally {
      setSaving(false);
    }
  };

  const assignedUserLabel = useMemo(() => {
    if (!comanda?.operarioAsignado) return 'Sin asignar';
    if (typeof comanda.operarioAsignado === 'string') return comanda.operarioAsignado;
    const { nombres, apellidos } = comanda.operarioAsignado;
    return [nombres, apellidos].filter(Boolean).join(' ') || 'Asignado';
  }, [comanda]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Checklist de preparación
        <Typography variant="subtitle2" color="text.secondary">
          Comanda #{comanda?.nrodecomanda} — Operario: {assignedUserLabel}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel id="responsable-label">Responsable</InputLabel>
            <Select
              labelId="responsable-label"
              name="responsable"
              label="Responsable"
              value={form.responsable}
              onChange={handleChange}
              disabled={loadingUsuarios}
            >
              {usuarios.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{user.nombres} {user.apellidos}</span>
                    {user.role && <Chip size="small" label={user.role} />}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Inicio"
              type="datetime-local"
              name="inicio"
              value={form.inicio}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Fin"
              type="datetime-local"
              name="fin"
              value={form.fin}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={form.verificacionBultos}
                name="verificacionBultos"
                onChange={handleCheckbox}
              />
            }
            label="Verificación de bultos realizada"
          />
          <TextField
            label="Control de temperatura"
            name="controlTemperatura"
            value={form.controlTemperatura}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label="Incidencias"
            name="incidencias"
            value={form.incidencias}
            onChange={handleChange}
            fullWidth
            multiline
            minRows={2}
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Evidencias / archivos
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label="Nombre"
                value={nuevoArchivo.nombre}
                onChange={(event) => setNuevoArchivo((prev) => ({ ...prev, nombre: event.target.value }))}
                size="small"
              />
              <TextField
                label="URL"
                value={nuevoArchivo.url}
                onChange={(event) => setNuevoArchivo((prev) => ({ ...prev, url: event.target.value }))}
                size="small"
                fullWidth
              />
              <Button variant="outlined" onClick={handleAgregarArchivo} size="small">
                Agregar
              </Button>
            </Stack>
            <List dense>
              {form.archivos.map((archivo, index) => (
                <ListItem key={`${archivo.url}-${index}`}>
                  <ListItemText primary={archivo.nombre} secondary={archivo.url} />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleRemoveArchivo(index)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {form.archivos.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  Sin archivos adjuntos
                </Typography>
              )}
            </List>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Button onClick={onClose}>Cerrar</Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={() => handleSave()} disabled={saving} variant="outlined">
            Guardar checklist
          </Button>
          <Button
            onClick={() => handleSave('Lista para carga')}
            disabled={!puedeFinalizar || saving}
            variant="contained"
          >
            Marcar lista para carga
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
