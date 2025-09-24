import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import api from '../api/axios.js';
import dayjs from 'dayjs';

const ESTADOS_KANBAN = [
  { key: 'A Preparar', label: 'A Preparar' },
  { key: 'En Curso', label: 'En Curso' },
  { key: 'Lista para carga', label: 'Lista para carga' },
];

const INTERVALOS = [
  { label: '30 s', value: 30000 },
  { label: '60 s', value: 60000 },
  { label: '90 s', value: 90000 },
  { label: '120 s', value: 120000 },
];

const archivosIniciales = () => ({ nombre: '', url: '', tipo: '' });

const getRutaZona = (comanda) =>
  comanda?.codcli?.ruta || comanda?.codcli?.zona || comanda?.codcli?.localidad || 'Sin ruta definida';

const getNombreOperario = (comanda) =>
  comanda?.operarioAsignado?.nombres
    ? `${comanda.operarioAsignado.nombres} ${comanda.operarioAsignado.apellidos || ''}`.trim()
    : '';

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

export default function AppOrdenAPrepararReactTable({
  usuarios = [],
  onComandaChange,
  onOpenAsignar,
}) {
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [intervalo, setIntervalo] = useState(60000);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [routeFilter, setRouteFilter] = useState('TODAS');
  const [onlyMine, setOnlyMine] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [checklistTarget, setChecklistTarget] = useState(null);
  const [controlTarget, setControlTarget] = useState(null);
  const [checklistForm, setChecklistForm] = useState({
    responsable: '',
    inicio: '',
    fin: '',
    verificacionBultos: false,
    controlTemperatura: '',
    incidencias: '',
    checklistDepositoConfirmado: false,
    archivos: [],
    nuevoArchivo: archivosIniciales(),
  });
  const [controlForm, setControlForm] = useState({
    inspector: '',
    fecha: dayjs().format('YYYY-MM-DDTHH:mm'),
    checklistDepositoConfirmado: true,
    numeroSello: '',
    anotaciones: '',
    archivos: [],
    nuevoArchivo: archivosIniciales(),
  });

  const currentUserId = useMemo(() => localStorage.getItem('id') || '', []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/comandasapreparar');
      setComandas(data.comandas || []);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Error obteniendo comandas a preparar', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(fetchData, intervalo);
    return () => clearInterval(timer);
  }, [paused, intervalo, fetchData]);

  useEffect(() => {
    if (!lastUpdate) return undefined;
    setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdate) / 1000));
    const timer = setInterval(() => {
      setSecondsSinceUpdate(Math.floor((Date.now() - lastUpdate) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdate]);

  const rutasDisponibles = useMemo(() => {
    const values = new Set();
    comandas.forEach((c) => values.add(getRutaZona(c)));
    return ['TODAS', ...Array.from(values).sort()];
  }, [comandas]);

  const filtered = useMemo(() => {
    return comandas.filter((comanda) => {
      if (routeFilter !== 'TODAS' && getRutaZona(comanda) !== routeFilter) return false;
      if (onlyMine && comanda?.operarioAsignado && String(comanda.operarioAsignado?._id) !== String(currentUserId)) {
        return false;
      }
      return true;
    });
  }, [comandas, routeFilter, onlyMine, currentUserId]);

  const kanbanData = useMemo(() => {
    const result = {
      'A Preparar': [],
      'En Curso': [],
      'Lista para carga': [],
    };
    filtered.forEach((comanda) => {
      const estado = comanda.estadoPreparacion || 'A Preparar';
      if (!result[estado]) result[estado] = [];
      result[estado].push(comanda);
    });
    return result;
  }, [filtered]);

  const handleManualRefresh = () => {
    fetchData();
  };

  const handleDragStart = (id) => () => setDraggingId(id);

  const handleDrop = (estado) => async (event) => {
    event.preventDefault();
    if (!draggingId) return;
    const comanda = comandas.find((c) => c._id === draggingId);
    setDraggingId(null);
    if (!comanda) return;
    const estadoActual = comanda.estadoPreparacion || 'A Preparar';
    if (estadoActual === estado) return;
    const allowed = {
      'A Preparar': ['En Curso'],
      'En Curso': ['Lista para carga'],
      'Lista para carga': [],
    };
    if (!allowed[estadoActual]?.includes(estado)) return;
    try {
      await api.put(`/comandas/${draggingId}`, {
        estadoPreparacion: estado,
        motivoPreparacion: `Cambio manual desde tablero a ${estado}`,
      });
      if (onComandaChange) onComandaChange();
      fetchData();
    } catch (error) {
      console.error('Error actualizando estado de preparación', error);
    }
  };

  const handleDragOver = (event) => event.preventDefault();

  const handleTakeComanda = async (comanda) => {
    if (!currentUserId) return;
    try {
      const payload = {
        operarioAsignado: currentUserId,
      };
      if ((comanda.estadoPreparacion || 'A Preparar') === 'A Preparar') {
        payload.estadoPreparacion = 'En Curso';
        payload.preparacion = {
          ...(comanda.preparacion || {}),
          responsable: currentUserId,
          inicio: comanda.preparacion?.inicio || new Date().toISOString(),
        };
        payload.motivoPreparacion = 'Inicio de preparación por el operario';
      }
      await api.put(`/comandas/${comanda._id}`, payload);
      if (onComandaChange) onComandaChange();
      fetchData();
    } catch (error) {
      console.error('Error tomando comanda', error);
    }
  };

  const handleOpenChecklist = (comanda) => {
    const prep = comanda?.preparacion || {};
    setChecklistForm({
      responsable: prep?.responsable?._id || prep?.responsable || currentUserId || '',
      inicio: prep?.inicio ? dayjs(prep.inicio).format('YYYY-MM-DDTHH:mm') : '',
      fin: prep?.fin ? dayjs(prep.fin).format('YYYY-MM-DDTHH:mm') : '',
      verificacionBultos: Boolean(prep?.verificacionBultos),
      controlTemperatura: prep?.controlTemperatura || '',
      incidencias: prep?.incidencias || '',
      checklistDepositoConfirmado: Boolean(prep?.checklistDepositoConfirmado),
      archivos: Array.isArray(prep?.archivos) ? prep.archivos : [],
      nuevoArchivo: archivosIniciales(),
    });
    setChecklistTarget(comanda);
  };

  const handleCloseChecklist = () => setChecklistTarget(null);

  const handleChecklistChange = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setChecklistForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleChecklistArchivoChange = (field) => (event) => {
    const value = event.target.value;
    setChecklistForm((prev) => ({
      ...prev,
      nuevoArchivo: { ...prev.nuevoArchivo, [field]: value },
    }));
  };

  const handleAddChecklistArchivo = () => {
    setChecklistForm((prev) => {
      if (!prev.nuevoArchivo.nombre && !prev.nuevoArchivo.url) return prev;
      return {
        ...prev,
        archivos: [...prev.archivos, prev.nuevoArchivo],
        nuevoArchivo: archivosIniciales(),
      };
    });
  };

  const handleRemoveChecklistArchivo = (idx) => () => {
    setChecklistForm((prev) => ({
      ...prev,
      archivos: prev.archivos.filter((_, index) => index !== idx),
    }));
  };

  const handleSaveChecklist = async () => {
    if (!checklistTarget) return;
    const payload = {
      preparacion: {
        responsable: checklistForm.responsable || null,
        inicio: checklistForm.inicio ? new Date(checklistForm.inicio).toISOString() : null,
        fin: checklistForm.fin ? new Date(checklistForm.fin).toISOString() : null,
        verificacionBultos: checklistForm.verificacionBultos,
        controlTemperatura: checklistForm.controlTemperatura || null,
        incidencias: checklistForm.incidencias || null,
        checklistDepositoConfirmado: checklistForm.checklistDepositoConfirmado,
        archivos: checklistForm.archivos,
      },
      motivoPreparacion: checklistForm.incidencias || 'Checklist actualizado',
    };
    try {
      await api.put(`/comandas/${checklistTarget._id}`, payload);
      if (onComandaChange) onComandaChange();
      fetchData();
      handleCloseChecklist();
    } catch (error) {
      console.error('Error guardando checklist de preparación', error);
    }
  };

  const handleOpenControl = (comanda) => {
    const ctrl = comanda?.controlCarga || {};
    setControlForm({
      inspector: ctrl?.inspector?._id || ctrl?.inspector || currentUserId || '',
      fecha: ctrl?.fecha ? dayjs(ctrl.fecha).format('YYYY-MM-DDTHH:mm') : dayjs().format('YYYY-MM-DDTHH:mm'),
      checklistDepositoConfirmado: Boolean(ctrl?.checklistDepositoConfirmado ?? true),
      numeroSello: ctrl?.numeroSello || '',
      anotaciones: ctrl?.anotaciones || '',
      archivos: Array.isArray(ctrl?.archivos) ? ctrl.archivos : [],
      nuevoArchivo: archivosIniciales(),
    });
    setControlTarget(comanda);
  };

  const handleCloseControl = () => setControlTarget(null);

  const handleControlChange = (field) => (event) => {
    const value = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setControlForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleControlArchivoChange = (field) => (event) => {
    const value = event.target.value;
    setControlForm((prev) => ({
      ...prev,
      nuevoArchivo: { ...prev.nuevoArchivo, [field]: value },
    }));
  };

  const handleAddControlArchivo = () => {
    setControlForm((prev) => {
      if (!prev.nuevoArchivo.nombre && !prev.nuevoArchivo.url) return prev;
      return {
        ...prev,
        archivos: [...prev.archivos, prev.nuevoArchivo],
        nuevoArchivo: archivosIniciales(),
      };
    });
  };

  const handleRemoveControlArchivo = (idx) => () => {
    setControlForm((prev) => ({
      ...prev,
      archivos: prev.archivos.filter((_, index) => index !== idx),
    }));
  };

  const handleSaveControl = async () => {
    if (!controlTarget) return;
    const payload = {
      controlCarga: {
        inspector: controlForm.inspector || null,
        fecha: controlForm.fecha ? new Date(controlForm.fecha).toISOString() : new Date().toISOString(),
        checklistDepositoConfirmado: controlForm.checklistDepositoConfirmado,
        numeroSello: controlForm.numeroSello || null,
        anotaciones: controlForm.anotaciones || null,
        archivos: controlForm.archivos,
      },
      motivoLogistica: controlForm.anotaciones || 'Control de carga confirmado',
    };
    try {
      await api.put(`/comandas/${controlTarget._id}`, payload);
      if (onComandaChange) onComandaChange();
      fetchData();
      handleCloseControl();
    } catch (error) {
      console.error('Error registrando control de carga', error);
    }
  };

  const renderChecklistDialog = () => {
    const responsables = usuarios.filter((u) => u.activo !== false);
    return (
      <Dialog open={Boolean(checklistTarget)} onClose={handleCloseChecklist} maxWidth="md" fullWidth>
        <DialogTitle>Checklist de preparación – Comanda {checklistTarget?.nrodecomanda}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="responsable-label">Responsable</InputLabel>
              <Select
                labelId="responsable-label"
                label="Responsable"
                value={checklistForm.responsable}
                onChange={handleChecklistChange('responsable')}
              >
                <MenuItem value="">Sin asignar</MenuItem>
                {responsables.map((u) => (
                  <MenuItem key={u._id} value={u._id}>
                    {u.nombres} {u.apellidos}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Inicio"
                  value={checklistForm.inicio}
                  onChange={handleChecklistChange('inicio')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Fin"
                  value={checklistForm.fin}
                  onChange={handleChecklistChange('fin')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            <FormControlLabel
              control={
                <Checkbox
                  checked={checklistForm.verificacionBultos}
                  onChange={handleChecklistChange('verificacionBultos')}
                />
              }
              label="Verificación de bultos completa"
            />

            <TextField
              label="Control de temperatura"
              value={checklistForm.controlTemperatura}
              onChange={handleChecklistChange('controlTemperatura')}
              fullWidth
            />

            <TextField
              label="Incidencias / observaciones"
              value={checklistForm.incidencias}
              onChange={handleChecklistChange('incidencias')}
              fullWidth
              multiline
              minRows={2}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={checklistForm.checklistDepositoConfirmado}
                  onChange={handleChecklistChange('checklistDepositoConfirmado')}
                />
              }
              label="Checklist de depósito confirmado"
            />

            <Divider />
            <Typography variant="subtitle2">Archivos / fotos</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Nombre"
                  value={checklistForm.nuevoArchivo.nombre}
                  onChange={handleChecklistArchivoChange('nombre')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="URL"
                  value={checklistForm.nuevoArchivo.url}
                  onChange={handleChecklistArchivoChange('url')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button fullWidth variant="outlined" onClick={handleAddChecklistArchivo}>
                  Añadir
                </Button>
              </Grid>
            </Grid>
            <List dense>
              {checklistForm.archivos.map((file, idx) => (
                <ListItem
                  key={`${file.nombre}-${idx}`}
                  secondaryAction={
                    <Button size="small" color="error" onClick={handleRemoveChecklistArchivo(idx)}>
                      Quitar
                    </Button>
                  }
                >
                  <ListItemText primary={file.nombre || file.url} secondary={file.url} />
                </ListItem>
              ))}
            </List>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseChecklist}>Cancelar</Button>
          <Button onClick={handleSaveChecklist} variant="contained" startIcon={<TaskAltIcon />}>
            Guardar checklist
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderControlDialog = () => {
    const inspectores = usuarios.filter((u) => u.activo !== false);
    return (
      <Dialog open={Boolean(controlTarget)} onClose={handleCloseControl} maxWidth="md" fullWidth>
        <DialogTitle>Control de carga – Comanda {controlTarget?.nrodecomanda}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="inspector-label">Inspector de carga</InputLabel>
              <Select
                labelId="inspector-label"
                label="Inspector de carga"
                value={controlForm.inspector}
                onChange={handleControlChange('inspector')}
              >
                <MenuItem value="">Sin asignar</MenuItem>
                {inspectores.map((u) => (
                  <MenuItem key={u._id} value={u._id}>
                    {u.nombres} {u.apellidos}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="datetime-local"
              label="Fecha y hora"
              value={controlForm.fecha}
              onChange={handleControlChange('fecha')}
              InputLabelProps={{ shrink: true }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={controlForm.checklistDepositoConfirmado}
                  onChange={handleControlChange('checklistDepositoConfirmado')}
                />
              }
              label="Checklist de depósito confirmado"
            />

            <TextField
              label="N° de sello de seguridad"
              value={controlForm.numeroSello}
              onChange={handleControlChange('numeroSello')}
              fullWidth
            />

            <TextField
              label="Anotaciones"
              value={controlForm.anotaciones}
              onChange={handleControlChange('anotaciones')}
              fullWidth
              multiline
              minRows={2}
            />

            <Divider />
            <Typography variant="subtitle2">Archivos / fotos</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Nombre"
                  value={controlForm.nuevoArchivo.nombre}
                  onChange={handleControlArchivoChange('nombre')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="URL"
                  value={controlForm.nuevoArchivo.url}
                  onChange={handleControlArchivoChange('url')}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button fullWidth variant="outlined" onClick={handleAddControlArchivo}>
                  Añadir
                </Button>
              </Grid>
            </Grid>
            <List dense>
              {controlForm.archivos.map((file, idx) => (
                <ListItem
                  key={`${file.nombre}-${idx}`}
                  secondaryAction={
                    <Button size="small" color="error" onClick={handleRemoveControlArchivo(idx)}>
                      Quitar
                    </Button>
                  }
                >
                  <ListItemText primary={file.nombre || file.url} secondary={file.url} />
                </ListItem>
              ))}
            </List>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseControl}>Cancelar</Button>
          <Button onClick={handleSaveControl} variant="contained" startIcon={<TaskAltIcon />}>
            Confirmar control de carga
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderCard = (comanda) => {
    const estado = comanda.estadoPreparacion || 'A Preparar';
    const operario = getNombreOperario(comanda);
    const puedeTomar = !comanda.operarioAsignado || String(comanda.operarioAsignado?._id) === String(currentUserId);
    const tieneChecklist = Boolean(comanda.preparacion?.checklistDepositoConfirmado);
    const ruta = getRutaZona(comanda);

    return (
      <Box
        key={comanda._id}
        draggable
        onDragStart={handleDragStart(comanda._id)}
        sx={{
          mb: 2,
          p: 2,
          borderRadius: 2,
          bgcolor: 'background.paper',
          boxShadow: 3,
          cursor: 'grab',
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={600}>
              #{comanda.nrodecomanda}
            </Typography>
            <Chip label={ruta} size="small" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {comanda.codcli?.razonsocial || 'Cliente sin nombre'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ítems: {comanda.items?.length || 0} · Bultos: {totalBultos(comanda)} · Volumen: {totalVolumen(comanda).toFixed(2)}
          </Typography>
          {operario && (
            <Typography variant="body2" color="text.secondary">
              Operario: {operario}
            </Typography>
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              startIcon={<AssignmentIndIcon />}
              disabled={!puedeTomar || (comanda.operarioAsignado && String(comanda.operarioAsignado?._id) === String(currentUserId))}
              onClick={() => handleTakeComanda(comanda)}
            >
              Tomar comanda
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleOpenChecklist(comanda)}
            >
              Checklist
            </Button>
            <Tooltip title={tieneChecklist ? 'Checklist completo' : 'Checklist pendiente'}>
              <span>
                <IconButton color={tieneChecklist ? 'success' : 'default'} size="small">
                  <TaskAltIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {estado === 'Lista para carga' && (
              <>
                <Button size="small" onClick={() => handleOpenControl(comanda)}>
                  Control de carga
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => onOpenAsignar && onOpenAsignar(comanda)}
                >
                  Asignar camión
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Box>
    );
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="h6">Tablero de depósito</Typography>
          <Chip
            icon={<AccessTimeIcon />}
            label={lastUpdate ? `Actualizado hace ${secondsSinceUpdate}s` : 'Sincronizando...'}
            color={paused ? 'default' : 'primary'}
          />
          <FormControl size="small">
            <InputLabel id="intervalo-label">Intervalo</InputLabel>
            <Select
              labelId="intervalo-label"
              value={intervalo}
              label="Intervalo"
              onChange={(event) => setIntervalo(Number(event.target.value))}
            >
              {INTERVALOS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="ruta-label">Ruta / zona</InputLabel>
            <Select
              labelId="ruta-label"
              value={routeFilter}
              label="Ruta / zona"
              onChange={(event) => setRouteFilter(event.target.value)}
            >
              {rutasDisponibles.map((ruta) => (
                <MenuItem key={ruta} value={ruta}>
                  {ruta === 'TODAS' ? 'Todas las rutas' : ruta}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} />}
            label="Sólo mis comandas"
          />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={paused ? 'Reanudar sincronización' : 'Pausar sincronización'}>
            <IconButton onClick={() => setPaused((prev) => !prev)} color={paused ? 'default' : 'primary'}>
              {paused ? <PlayCircleOutlineIcon /> : <PauseCircleOutlineIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Actualizar ahora">
            <IconButton onClick={handleManualRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {loading ? (
        <Box sx={{ py: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2">Cargando comandas…</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {ESTADOS_KANBAN.map((col) => (
            <Grid item xs={12} md={4} key={col.key}>
              <Box
                onDragOver={handleDragOver}
                onDrop={handleDrop(col.key)}
                sx={{
                  bgcolor: 'background.default',
                  minHeight: 320,
                  borderRadius: 2,
                  p: 2,
                  border: '1px dashed',
                  borderColor: 'divider',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {col.label}
                  </Typography>
                  <Chip label={kanbanData[col.key]?.length || 0} size="small" />
                </Stack>
                {kanbanData[col.key]?.map((comanda) => renderCard(comanda))}
                {!kanbanData[col.key]?.length && (
                  <Typography variant="body2" color="text.secondary">
                    No hay comandas en este estado.
                  </Typography>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {renderChecklistDialog()}
      {renderControlDialog()}
    </Box>
  );
}
