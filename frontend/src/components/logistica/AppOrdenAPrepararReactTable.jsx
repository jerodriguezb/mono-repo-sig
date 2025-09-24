import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
  IconButton,
} from '@mui/material';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ChecklistIcon from '@mui/icons-material/Checklist';
import { getComandasAPreparar, updateComanda } from '../../api/comandas';
import PreparacionDrawer from './PreparacionDrawer.jsx';

const DEFAULT_INTERVAL = 60000;
const INTERVAL_OPTIONS = [30000, 60000, 90000, 120000];

const getClienteNombre = (comanda) => comanda?.codcli?.razonsocial || '—';
const getRutaNombre = (comanda) =>
  comanda?.codcli?.ruta?.nombre || comanda?.codcli?.ruta?.descripcion || 'Sin ruta';

export default function AppOrdenAPrepararReactTable({ onDataChange, onManualRefresh }) {
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL);
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedRuta, setSelectedRuta] = useState('');
  const [selectedComanda, setSelectedComanda] = useState(null);

  const currentUserId = useMemo(() => localStorage.getItem('id'), []);

  const fetchData = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) setLoading(true);
        const data = await getComandasAPreparar();
        setComandas(data);
        setLastUpdated(Date.now());
        setError('');
        if (typeof onDataChange === 'function') onDataChange(data);
        if (typeof onManualRefresh === 'function') onManualRefresh();
      } catch (err) {
        console.error('Error obteniendo comandas a preparar', err);
        setError('No se pudieron cargar las comandas.');
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [onDataChange, onManualRefresh]
  );

  useEffect(() => {
    fetchData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => {
      fetchData(false);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [fetchData, intervalMs, paused]);

  const handleTogglePause = () => setPaused((prev) => !prev);
  const handleIntervalChange = (event) => setIntervalMs(event.target.value);
  const handleRefresh = () => fetchData(true);

  const rutasDisponibles = useMemo(() => {
    const rutas = new Set();
    comandas.forEach((c) => {
      const ruta = getRutaNombre(c);
      if (ruta) rutas.add(ruta);
    });
    return ['Todas', ...Array.from(rutas)];
  }, [comandas]);

  const filtradas = useMemo(() => {
    if (!selectedRuta || selectedRuta === 'Todas') return comandas;
    return comandas.filter((c) => getRutaNombre(c) === selectedRuta);
  }, [comandas, selectedRuta]);

  const secondsAgo = useMemo(() => {
    if (!lastUpdated) return '—';
    const diff = Math.floor((Date.now() - lastUpdated) / 1000);
    if (diff < 60) return `${diff} segundo${diff === 1 ? '' : 's'}`;
    const minutes = Math.floor(diff / 60);
    return `${minutes} minuto${minutes === 1 ? '' : 's'}`;
  }, [lastUpdated]);

  const handleTakeComanda = async (comanda) => {
    if (!currentUserId) {
      alert('No se encontró el usuario en sesión.');
      return;
    }
    try {
      await updateComanda(comanda._id, {
        operarioAsignado: currentUserId,
        preparacion: {
          responsable: currentUserId,
          inicio: comanda?.preparacion?.inicio || new Date().toISOString(),
        },
        estadoPreparacion: 'En Curso',
        motivoHistorial: 'Toma de comanda por operario',
      });
      fetchData(true);
    } catch (err) {
      console.error('Error tomando comanda', err);
      alert('No se pudo tomar la comanda.');
    }
  };

  const handleOpenChecklist = (comanda) => setSelectedComanda(comanda);
  const handleCloseChecklist = () => setSelectedComanda(null);
  const handleChecklistSaved = () => {
    handleCloseChecklist();
    fetchData(true);
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Comandas a preparar
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={paused ? 'Reanudar sincronización' : 'Pausar sincronización'}>
            <IconButton color={paused ? 'primary' : 'default'} onClick={handleTogglePause}>
              {paused ? <PlayCircleOutlineIcon /> : <PauseCircleOutlineIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Actualizar ahora">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <FormControl size="small">
            <InputLabel id="interval-label">Intervalo</InputLabel>
            <Select
              labelId="interval-label"
              value={intervalMs}
              label="Intervalo"
              onChange={handleIntervalChange}
            >
              {INTERVAL_OPTIONS.map((ms) => (
                <MenuItem key={ms} value={ms}>
                  {ms / 1000} s
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            Actualizado hace {secondsAgo}
          </Typography>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="ruta-filter-label">Ruta/Zona</InputLabel>
          <Select
            labelId="ruta-filter-label"
            value={selectedRuta || 'Todas'}
            label="Ruta/Zona"
            onChange={(event) => setSelectedRuta(event.target.value)}
          >
            {rutasDisponibles.map((ruta) => (
              <MenuItem key={ruta} value={ruta}>
                {ruta}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {error && (
          <Chip color="error" label={error} />
        )}
      </Stack>

      <Box sx={{ position: 'relative', mt: 2 }}>
        {initialLoading ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>N.º</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Ruta/Zona</TableCell>
                <TableCell>Asignado</TableCell>
                <TableCell>Estado preparación</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No hay comandas pendientes.
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((comanda) => {
                  const asignado =
                    comanda?.operarioAsignado?.nombres || comanda?.operarioAsignado?.apellidos
                      ? `${comanda.operarioAsignado.nombres || ''} ${comanda.operarioAsignado.apellidos || ''}`.trim()
                      : comanda?.operarioAsignado
                      ? 'Asignado'
                      : 'Sin asignar';
                  return (
                    <TableRow key={comanda._id} hover>
                      <TableCell>{comanda.nrodecomanda}</TableCell>
                      <TableCell>{getClienteNombre(comanda)}</TableCell>
                      <TableCell>{getRutaNombre(comanda)}</TableCell>
                      <TableCell>
                        {asignado === 'Sin asignar' ? (
                          <Chip label="Sin asignar" color="warning" size="small" />
                        ) : (
                          <Chip label={asignado} color="success" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={comanda.estadoPreparacion || 'A Preparar'} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Tomar comanda">
                            <span>
                              <Button
                                size="small"
                                color="primary"
                                startIcon={<AssignmentTurnedInIcon />}
                                onClick={() => handleTakeComanda(comanda)}
                                disabled={loading}
                              >
                                Tomar
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip title="Checklist de preparación">
                            <IconButton size="small" onClick={() => handleOpenChecklist(comanda)}>
                              <ChecklistIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
        {loading && !initialLoading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(255,255,255,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress size={28} />
          </Box>
        )}
      </Box>

      <PreparacionDrawer
        open={Boolean(selectedComanda)}
        comanda={selectedComanda}
        onClose={handleCloseChecklist}
        onSaved={handleChecklistSaved}
      />
    </Box>
  );
}
