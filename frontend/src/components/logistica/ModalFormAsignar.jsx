import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { getCamiones, getComandasActivas, updateComanda } from '../../api/comandas';

const calcularBultos = (comanda) => {
  if (!Array.isArray(comanda?.items)) return 0;
  return comanda.items.reduce((sum, item) => sum + (item.cantidad || 0), 0);
};

const calcularVolumen = (comanda) => {
  if (!Array.isArray(comanda?.items)) return 0;
  return comanda.items.reduce((sum, item) => {
    const prod = item.codprod || {};
    const volumen = prod.volumen || prod.m3 || prod.metrosCubicos || 0;
    return sum + (Number(volumen) || 0) * (item.cantidad || 0);
  }, 0);
};

const capacidadDisponible = (camion) => ({
  volumen: camion?.capacidadVolumen || camion?.volumen || 0,
  bultos: camion?.capacidadBultos || camion?.capacidad || 0,
});

export default function ModalFormAsignar({ open, onClose, onAssigned }) {
  const [camiones, setCamiones] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [selectedComandaId, setSelectedComandaId] = useState('');
  const [selectedCamionId, setSelectedCamionId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errorCapacidad, setErrorCapacidad] = useState('');
  const [saving, setSaving] = useState(false);

  const currentUserId = useMemo(() => localStorage.getItem('id'), []);

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      try {
        const [camionesData, comandasData] = await Promise.all([
          getCamiones(),
          getComandasActivas({ limite: 400 }),
        ]);
        setCamiones(camionesData);
        setComandas(
          comandasData.filter((c) => c.estadoPreparacion === 'Lista para carga' && c.activo !== false)
        );
      } catch (err) {
        console.error('Error cargando datos de logística', err);
      }
    };
    fetchData();
  }, [open]);

  const comandaSeleccionada = useMemo(
    () => comandas.find((c) => c._id === selectedComandaId),
    [comandas, selectedComandaId]
  );
  const camionSeleccionado = useMemo(
    () => camiones.find((c) => c._id === selectedCamionId),
    [camiones, selectedCamionId]
  );

  useEffect(() => {
    if (!comandaSeleccionada || !camionSeleccionado) {
      setErrorCapacidad('');
      return;
    }
    const cargaVolumen = calcularVolumen(comandaSeleccionada);
    const cargaBultos = calcularBultos(comandaSeleccionada);
    const capacidad = capacidadDisponible(camionSeleccionado);
    if ((capacidad.volumen && cargaVolumen > capacidad.volumen) || (capacidad.bultos && cargaBultos > capacidad.bultos)) {
      setErrorCapacidad(
        `La carga supera la capacidad disponible del camión. Volumen requerido: ${cargaVolumen.toFixed(
          2
        )} / Capacidad: ${capacidad.volumen || 's/d'} | Bultos: ${cargaBultos} / Capacidad: ${capacidad.bultos || 's/d'}`
      );
    } else {
      setErrorCapacidad('');
    }
  }, [comandaSeleccionada, camionSeleccionado]);

  const handleAssign = async () => {
    if (!comandaSeleccionada || !camionSeleccionado) return;
    try {
      setSaving(true);
      await updateComanda(comandaSeleccionada._id, {
        camion: camionSeleccionado._id,
        usuarioLogistica: currentUserId,
        motivoLogistica: motivo || undefined,
        motivoHistorial: 'Asignación logística',
      });
      if (typeof onAssigned === 'function') onAssigned();
      setSelectedCamionId('');
      setSelectedComandaId('');
      setMotivo('');
    } catch (err) {
      console.error('Error asignando comanda a camión', err);
      alert('No se pudo asignar la comanda.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Asignar comanda a camión</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel id="comanda-label">Comanda</InputLabel>
            <Select
              labelId="comanda-label"
              label="Comanda"
              value={selectedComandaId}
              onChange={(event) => setSelectedComandaId(event.target.value)}
            >
              {comandas.map((comanda) => (
                <MenuItem key={comanda._id} value={comanda._id}>
                  #{comanda.nrodecomanda} — {comanda.codcli?.razonsocial}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel id="camion-label">Camión</InputLabel>
            <Select
              labelId="camion-label"
              label="Camión"
              value={selectedCamionId}
              onChange={(event) => setSelectedCamionId(event.target.value)}
            >
              {camiones.map((camion) => (
                <MenuItem key={camion._id} value={camion._id}>
                  {camion.camion || camion.patente}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {comandaSeleccionada && (
            <Typography variant="body2" color="text.secondary">
              Bultos: {calcularBultos(comandaSeleccionada)} — Volumen estimado: {calcularVolumen(comandaSeleccionada).toFixed(2)}
            </Typography>
          )}
          {errorCapacidad && <Alert severity="warning">{errorCapacidad}</Alert>}
          <TextField
            label="Motivo / notas"
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleAssign}
          disabled={!selectedCamionId || !selectedComandaId || saving}
          variant="contained"
        >
          Confirmar asignación
        </Button>
      </DialogActions>
    </Dialog>
  );
}
