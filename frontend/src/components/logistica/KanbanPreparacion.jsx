import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { getComandasActivas, updateComanda } from '../../api/comandas';
import ControlCargaModal from './ControlCargaModal.jsx';

const STATES = ['A Preparar', 'En Curso', 'Lista para carga'];
const TRANSITIONS = {
  'A Preparar': 'En Curso',
  'En Curso': 'Lista para carga',
  'Lista para carga': null,
};

const getCliente = (comanda) => comanda?.codcli?.razonsocial || '—';
const getRuta = (comanda) =>
  comanda?.codcli?.ruta?.nombre || comanda?.codcli?.ruta?.descripcion || 'Sin ruta';

export default function KanbanPreparacion({ refreshKey = 0 }) {
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRuta, setSelectedRuta] = useState('Todas');
  const [selectedOperario, setSelectedOperario] = useState('Todos');
  const [search, setSearch] = useState('');
  const [controlComanda, setControlComanda] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const currentUserId = useMemo(() => localStorage.getItem('id'), []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getComandasActivas({ limite: 400 });
      setComandas(data);
      setError('');
    } catch (err) {
      console.error('Error obteniendo comandas activas', err);
      setError('No se pudieron cargar las comandas activas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const rutas = useMemo(() => {
    const set = new Set();
    comandas.forEach((c) => set.add(getRuta(c)));
    return ['Todas', ...Array.from(set)];
  }, [comandas]);

  const operarios = useMemo(() => {
    const set = new Set();
    comandas.forEach((c) => {
      if (c.operarioAsignado?.nombres || c.operarioAsignado?.apellidos) {
        set.add(`${c.operarioAsignado.nombres || ''} ${c.operarioAsignado.apellidos || ''}`.trim());
      }
    });
    return ['Todos', ...Array.from(set)];
  }, [comandas]);

  const filtradas = useMemo(() => {
    return comandas.filter((comanda) => {
      if (selectedRuta !== 'Todas' && getRuta(comanda) !== selectedRuta) return false;
      if (
        selectedOperario !== 'Todos' &&
        `${comanda.operarioAsignado?.nombres || ''} ${comanda.operarioAsignado?.apellidos || ''}`.trim() !== selectedOperario
      )
        return false;
      if (search) {
        const texto = `${getCliente(comanda)} ${comanda.nrodecomanda}`.toLowerCase();
        if (!texto.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [comandas, selectedRuta, selectedOperario, search]);

  const columns = useMemo(() => {
    const map = Object.fromEntries(STATES.map((state) => [state, []]));
    filtradas.forEach((comanda) => {
      const estado = comanda.estadoPreparacion || 'A Preparar';
      map[estado] = map[estado] || [];
      map[estado].push(comanda);
    });
    return map;
  }, [filtradas]);

  const handleTakeComanda = async (comanda) => {
    if (!currentUserId) {
      alert('No se encontró usuario logueado.');
      return;
    }
    try {
      await updateComanda(comanda._id, {
        operarioAsignado: currentUserId,
        preparacion: {
          responsable: currentUserId,
          inicio: comanda.preparacion?.inicio || new Date().toISOString(),
        },
        estadoPreparacion: 'En Curso',
        motivoHistorial: 'Asignación desde tablero Kanban',
      });
      fetchData();
    } catch (err) {
      console.error('Error asignando comanda', err);
      alert('No se pudo asignar la comanda.');
    }
  };

  const handleDrop = async (comanda, destino) => {
    const origen = comanda.estadoPreparacion || 'A Preparar';
    if (destino === origen) return;
    if (TRANSITIONS[origen] !== destino) {
      alert('Sólo se puede avanzar una etapa a la vez.');
      return;
    }
    if (!comanda) return;
    if (destino === 'Lista para carga') {
      const asignadoId = comanda.operarioAsignado?._id || comanda.operarioAsignado;
      if (!asignadoId || String(asignadoId) !== String(currentUserId)) {
        alert('Sólo el operario asignado puede finalizar la preparación.');
        return;
      }
    }
    try {
      const payload = {
        estadoPreparacion: destino,
        motivoHistorial: `Movimiento Kanban ${origen} → ${destino}`,
      };
      if (destino === 'En Curso' && !comanda.preparacion?.inicio) {
        payload.preparacion = { inicio: new Date().toISOString() };
      }
      if (destino === 'Lista para carga') {
        payload.preparacion = {
          ...(payload.preparacion || {}),
          fin: new Date().toISOString(),
        };
      }
      await updateComanda(comanda._id, payload);
      fetchData();
    } catch (err) {
      console.error('Error moviendo tarjeta', err);
      alert('No se pudo actualizar la comanda.');
    }
  };

  const openControlCarga = (comanda) => {
    if (comanda.estadoPreparacion !== 'Lista para carga') {
      alert('El control de carga solo está disponible cuando la comanda está lista para carga.');
      return;
    }
    setControlComanda(comanda);
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Tablero de depósito
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="kanban-ruta">Ruta/Zona</InputLabel>
            <Select
              labelId="kanban-ruta"
              label="Ruta/Zona"
              value={selectedRuta}
              onChange={(event) => setSelectedRuta(event.target.value)}
            >
              {rutas.map((ruta) => (
                <MenuItem key={ruta} value={ruta}>
                  {ruta}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="kanban-operario">Operario</InputLabel>
            <Select
              labelId="kanban-operario"
              label="Operario"
              value={selectedOperario}
              onChange={(event) => setSelectedOperario(event.target.value)}
            >
              {operarios.map((op) => (
                <MenuItem key={op} value={op}>
                  {op}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Buscar"
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button variant="outlined" onClick={fetchData}>
            Actualizar
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Typography color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}

      <Box sx={{ mt: 2, position: 'relative' }}>
        {loading && (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        )}
        {!loading && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {STATES.map((estado) => (
              <Box
                key={estado}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData('text/plain') || draggedId;
                  const comanda = filtradas.find((c) => c._id === id);
                  if (comanda) handleDrop(comanda, estado);
                  setDraggedId(null);
                }}
                sx={{
                  flex: 1,
                  minHeight: 260,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  p: 1.5,
                  boxShadow: 1,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {estado}
                  </Typography>
                  <Chip label={columns[estado]?.length || 0} size="small" />
                </Stack>
                <Stack spacing={1}>
                  {columns[estado]?.map((comanda) => {
                    const assigned =
                      comanda.operarioAsignado?.nombres || comanda.operarioAsignado?.apellidos
                        ? `${comanda.operarioAsignado.nombres || ''} ${comanda.operarioAsignado.apellidos || ''}`.trim()
                        : comanda.operarioAsignado
                        ? 'Asignado'
                        : 'Sin asignar';
                    return (
                      <Card
                        key={comanda._id}
                        draggable
                        onDragStart={(event) => {
                          setDraggedId(comanda._id);
                          event.dataTransfer.setData('text/plain', comanda._id);
                        }}
                        onDragEnd={() => setDraggedId(null)}
                        sx={{ border: '1px solid transparent', '&:active': { borderColor: 'primary.main' } }}
                      >
                        <CardHeader
                          title={`#${comanda.nrodecomanda} — ${getCliente(comanda)}`}
                          subheader={getRuta(comanda)}
                          sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 0 }}>
                          <Stack spacing={1}>
                            <Typography variant="body2" color="text.secondary">
                              Bultos: {Array.isArray(comanda.items) ? comanda.items.reduce((sum, item) => sum + (item.cantidad || 0), 0) : 0}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Operario: {assigned}
                            </Typography>
                            <Stack direction="row" spacing={1}>
                              {comanda.preparacion?.inicio && (
                                <Chip label={`Inicio ${new Date(comanda.preparacion.inicio).toLocaleTimeString()}`} size="small" />
                              )}
                              {comanda.preparacion?.fin && (
                                <Chip label={`Fin ${new Date(comanda.preparacion.fin).toLocaleTimeString()}`} size="small" color="success" />
                              )}
                            </Stack>
                            <Stack direction="row" spacing={1}>
                              {!comanda.operarioAsignado && (
                                <Button size="small" startIcon={<PlayArrowIcon />} onClick={() => handleTakeComanda(comanda)}>
                                  Tomar
                                </Button>
                              )}
                              {estado === 'Lista para carga' && (
                                <Button
                                  size="small"
                                  startIcon={<LocalShippingIcon />}
                                  onClick={() => openControlCarga(comanda)}
                                >
                                  Control carga
                                </Button>
                              )}
                              {estado === 'Lista para carga' && comanda.controlCarga?.checklistDeposito && (
                                <Chip size="small" color="success" icon={<DoneAllIcon />} label="Control ok" />
                              )}
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {(!columns[estado] || columns[estado].length === 0) && (
                    <Typography variant="caption" color="text.secondary">
                      No hay comandas en este estado.
                    </Typography>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <ControlCargaModal
        open={Boolean(controlComanda)}
        comanda={controlComanda}
        onClose={() => setControlComanda(null)}
        onSaved={() => {
          setControlComanda(null);
          fetchData();
        }}
      />
    </Box>
  );
}
