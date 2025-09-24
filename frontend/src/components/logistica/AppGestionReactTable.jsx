import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
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
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import dayjs from 'dayjs';
import { getComandas } from '../../api/comandas';

const formatDate = (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—');

const calcularMetrics = (comandas) => {
  let totalPrep = 0;
  let countPrep = 0;
  let totalDemora = 0;
  let countDemora = 0;
  let totalEntregas = 0;
  let entregasParciales = 0;

  comandas.forEach((comanda) => {
    if (comanda.preparacion?.inicio && comanda.preparacion?.fin) {
      const diff = dayjs(comanda.preparacion.fin).diff(dayjs(comanda.preparacion.inicio), 'minute');
      if (!Number.isNaN(diff)) {
        totalPrep += diff;
        countPrep += 1;
      }
    }
    if (comanda.preparacion?.fin && comanda.controlCarga?.fechaHora) {
      const diff = dayjs(comanda.controlCarga.fechaHora).diff(dayjs(comanda.preparacion.fin), 'minute');
      if (!Number.isNaN(diff)) {
        totalDemora += diff;
        countDemora += 1;
      }
    }
    if (Array.isArray(comanda.entregas)) {
      comanda.entregas.forEach((entrega) => {
        totalEntregas += 1;
        if (['Parcial', 'Rechazada'].includes(entrega.estado)) entregasParciales += 1;
      });
    }
  });

  return {
    tiempoPromedioPreparacion: countPrep ? totalPrep / countPrep : 0,
    demoraPromedioDespacho: countDemora ? totalDemora / countDemora : 0,
    porcentajeEntregasParciales: totalEntregas ? (entregasParciales / totalEntregas) * 100 : 0,
  };
};

export default function AppGestionReactTable({ refreshKey = 0, onMetricsCalculated }) {
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [estado, setEstado] = useState('Todos');
  const [operario, setOperario] = useState('Todos');
  const [camion, setCamion] = useState('Todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getComandas({ limite: 500 });
      setComandas(data);
      setError('');
      const metrics = calcularMetrics(data);
      if (typeof onMetricsCalculated === 'function') onMetricsCalculated(metrics);
    } catch (err) {
      console.error('Error obteniendo gestión de comandas', err);
      setError('No se pudieron cargar los datos de gestión');
    } finally {
      setLoading(false);
    }
  }, [onMetricsCalculated]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const estados = useMemo(() => ['Todos', ...new Set(comandas.map((c) => c.estadoPreparacion || 'A Preparar'))], [comandas]);
  const operarios = useMemo(() => {
    const set = new Set();
    comandas.forEach((c) => {
      if (c.operarioAsignado?.nombres || c.operarioAsignado?.apellidos) {
        set.add(`${c.operarioAsignado.nombres || ''} ${c.operarioAsignado.apellidos || ''}`.trim());
      }
    });
    return ['Todos', ...Array.from(set)];
  }, [comandas]);
  const camiones = useMemo(() => {
    const set = new Set();
    comandas.forEach((c) => {
      if (c.camion?.camion) set.add(c.camion.camion);
    });
    return ['Todos', ...Array.from(set)];
  }, [comandas]);

  const filtradas = useMemo(() => {
    return comandas.filter((comanda) => {
      if (estado !== 'Todos' && (comanda.estadoPreparacion || 'A Preparar') !== estado) return false;
      if (
        operario !== 'Todos' &&
        `${comanda.operarioAsignado?.nombres || ''} ${comanda.operarioAsignado?.apellidos || ''}`.trim() !== operario
      )
        return false;
      if (camion !== 'Todos' && comanda.camion?.camion !== camion) return false;
      if (fechaDesde && dayjs(comanda.fecha).isBefore(dayjs(fechaDesde))) return false;
      if (fechaHasta && dayjs(comanda.fecha).isAfter(dayjs(fechaHasta).endOf('day'))) return false;
      return true;
    });
  }, [comandas, estado, operario, camion, fechaDesde, fechaHasta]);

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Gestión y seguimiento
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="estado-label">Estado</InputLabel>
            <Select labelId="estado-label" label="Estado" value={estado} onChange={(event) => setEstado(event.target.value)}>
              {estados.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="operario-label">Operario</InputLabel>
            <Select labelId="operario-label" label="Operario" value={operario} onChange={(event) => setOperario(event.target.value)}>
              {operarios.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="camion-label">Camión</InputLabel>
            <Select labelId="camion-label" label="Camión" value={camion} onChange={(event) => setCamion(event.target.value)}>
              {camiones.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Desde"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fechaDesde}
            onChange={(event) => setFechaDesde(event.target.value)}
          />
          <TextField
            label="Hasta"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={fechaHasta}
            onChange={(event) => setFechaHasta(event.target.value)}
          />
        </Stack>
      </Stack>
      {error && (
        <Typography color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
      <Box sx={{ position: 'relative', mt: 2 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>N.º</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Operario</TableCell>
                <TableCell>Camión</TableCell>
                <TableCell>Seguimiento</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    Sin resultados
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((comanda) => (
                  <TableRow key={comanda._id}>
                    <TableCell>{comanda.nrodecomanda}</TableCell>
                    <TableCell>{comanda.codcli?.razonsocial || '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={comanda.estadoPreparacion || 'A Preparar'} />
                    </TableCell>
                    <TableCell>
                      {comanda.operarioAsignado?.nombres || comanda.operarioAsignado?.apellidos
                        ? `${comanda.operarioAsignado.nombres || ''} ${comanda.operarioAsignado.apellidos || ''}`.trim()
                        : '—'}
                    </TableCell>
                    <TableCell>{comanda.camion?.camion || '—'}</TableCell>
                    <TableCell>
                      <Accordion sx={{ boxShadow: 'none', bgcolor: 'transparent' }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="body2">Ver historial</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={1}>
                            <Typography variant="subtitle2">Preparación</Typography>
                            <Typography variant="body2">
                              Responsable:{' '}
                              {comanda.preparacion?.responsable?.nombres || comanda.preparacion?.responsable?.apellidos
                                ? `${comanda.preparacion.responsable.nombres || ''} ${comanda.preparacion.responsable.apellidos || ''}`.trim()
                                : '—'}
                            </Typography>
                            <Typography variant="body2">Inicio: {formatDate(comanda.preparacion?.inicio)}</Typography>
                            <Typography variant="body2">Fin: {formatDate(comanda.preparacion?.fin)}</Typography>
                            <Typography variant="subtitle2">Control de carga</Typography>
                            <Typography variant="body2">
                              Inspector:{' '}
                              {comanda.controlCarga?.inspector?.nombres || comanda.controlCarga?.inspector?.apellidos
                                ? `${comanda.controlCarga.inspector.nombres || ''} ${comanda.controlCarga.inspector.apellidos || ''}`.trim()
                                : '—'}
                            </Typography>
                            <Typography variant="body2">
                              Checklist depósito: {comanda.controlCarga?.checklistDeposito ? 'Sí' : 'No'}
                            </Typography>
                            <Typography variant="body2">Fecha control: {formatDate(comanda.controlCarga?.fechaHora)}</Typography>
                            <Typography variant="subtitle2">Historial de eventos</Typography>
                            <Stack spacing={0.5}>
                              {(comanda.historial || []).map((evento, index) => (
                                <Typography key={`${comanda._id}-hist-${index}`} variant="body2">
                                  {formatDate(evento.fecha)} — {evento.accion}
                                </Typography>
                              ))}
                            </Stack>
                            {Array.isArray(comanda.entregas) && comanda.entregas.length > 0 && (
                              <>
                                <Typography variant="subtitle2">Entregas</Typography>
                                <Stack spacing={0.5}>
                                  {comanda.entregas.map((entrega, index) => (
                                    <Typography key={`${comanda._id}-ent-${index}`} variant="body2">
                                      {formatDate(entrega.fecha)} — {entrega.estado} — {entrega.motivo || 'Sin motivo'}
                                    </Typography>
                                  ))}
                                </Stack>
                              </>
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
