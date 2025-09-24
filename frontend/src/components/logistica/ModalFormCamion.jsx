import React, { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { updateComanda } from '../../api/comandas';

const ESTADOS_ENTREGA = [
  { value: 'Completada', label: 'Completada' },
  { value: 'Parcial', label: 'Entrega parcial' },
  { value: 'Rechazada', label: 'Rechazada' },
];

export default function ModalFormCamion({ open, comanda, onClose, onSaved }) {
  const [estadoEntrega, setEstadoEntrega] = useState('Completada');
  const [motivo, setMotivo] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [checklistConfirmado, setChecklistConfirmado] = useState(true);
  const [fotos, setFotos] = useState([]);
  const [fotoActual, setFotoActual] = useState({ nombre: '', url: '' });
  const [saving, setSaving] = useState(false);

  const currentUserId = useMemo(() => localStorage.getItem('id'), []);

  const handleAgregarFoto = () => {
    if (!fotoActual.url) return;
    setFotos((prev) => [...prev, { ...fotoActual }]);
    setFotoActual({ nombre: '', url: '' });
  };

  const handleRemoveFoto = (index) => {
    setFotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async () => {
    if (!comanda) return;
    try {
      setSaving(true);
      await updateComanda(comanda._id, {
        entregaNueva: {
          estado: estadoEntrega,
          motivo: motivo || undefined,
          observaciones: observaciones || undefined,
          checklistConfirmado,
          fotos,
          fecha: new Date().toISOString(),
          usuario: currentUserId,
        },
        motivoHistorial: `Entrega ${estadoEntrega.toLowerCase()}`,
      });
      if (typeof onSaved === 'function') onSaved();
      setEstadoEntrega('Completada');
      setMotivo('');
      setObservaciones('');
      setChecklistConfirmado(true);
      setFotos([]);
    } catch (err) {
      console.error('Error registrando entrega', err);
      alert('No se pudo registrar la entrega.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Registrar entrega — Comanda #{comanda?.nrodecomanda}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            select
            label="Estado de entrega"
            value={estadoEntrega}
            onChange={(event) => setEstadoEntrega(event.target.value)}
          >
            {ESTADOS_ENTREGA.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Motivo"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            fullWidth
            multiline
            minRows={2}
            helperText="Describe el motivo de la entrega parcial o rechazo"
          />
          <TextField
            label="Observaciones"
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={checklistConfirmado}
                onChange={(event) => setChecklistConfirmado(event.target.checked)}
              />
            }
            label="Checklist leído por el cliente"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              label="Nombre foto"
              value={fotoActual.nombre}
              onChange={(event) => setFotoActual((prev) => ({ ...prev, nombre: event.target.value }))}
              size="small"
            />
            <TextField
              label="URL foto"
              value={fotoActual.url}
              onChange={(event) => setFotoActual((prev) => ({ ...prev, url: event.target.value }))}
              size="small"
              fullWidth
            />
            <Button onClick={handleAgregarFoto} size="small" variant="outlined">
              Agregar
            </Button>
          </Stack>
          <List dense>
            {fotos.map((foto, index) => (
              <ListItem key={`${foto.url}-${index}`} secondaryAction={
                <IconButton edge="end" onClick={() => handleRemoveFoto(index)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              }>
                <ListItemText primary={foto.nombre || `Foto ${index + 1}`} secondary={foto.url} />
              </ListItem>
            ))}
            {fotos.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                Sin fotos cargadas
              </Typography>
            )}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          Guardar entrega
        </Button>
      </DialogActions>
    </Dialog>
  );
}
