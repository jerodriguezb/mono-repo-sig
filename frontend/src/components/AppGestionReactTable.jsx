import React, { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import dayjs from 'dayjs';

const nombreUsuario = (usuario) => {
  if (!usuario) return '';
  if (typeof usuario === 'string') return usuario;
  return `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
};

const formatDate = (value) => {
  if (!value) return '-';
  return dayjs(value).format('DD/MM/YYYY HH:mm');
};

export default function AppGestionReactTable({ comandas = [], camiones = [] }) {
  const [operarioFilter, setOperarioFilter] = useState('TODOS');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');
  const [camionFilter, setCamionFilter] = useState('TODOS');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [expanded, setExpanded] = useState(null);

  const operarios = useMemo(
    () =>
      Array.from(
        new Map(
          comandas
            .filter((c) => c.operarioAsignado)
            .map((c) => [c.operarioAsignado._id || c.operarioAsignado, c.operarioAsignado]),
        ).values(),
      ),
    [comandas],
  );

  const filtered = useMemo(() => {
    const desde = fechaDesde ? dayjs(fechaDesde) : null;
    const hasta = fechaHasta ? dayjs(fechaHasta).endOf('day') : null;
    return comandas.filter((comanda) => {
      if (operarioFilter !== 'TODOS') {
        const op = comanda.operarioAsignado?._id || comanda.operarioAsignado;
        if (String(op) !== String(operarioFilter)) return false;
      }
      if (estadoFilter !== 'TODOS' && (comanda.estadoPreparacion || 'A Preparar') !== estadoFilter) return false;
      if (camionFilter !== 'TODOS') {
        const camionId = comanda.camion?._id || comanda.camion;
        if (String(camionId) !== String(camionFilter)) return false;
      }
      if (desde && (!comanda.fecha || dayjs(comanda.fecha).isBefore(desde, 'day'))) return false;
      if (hasta && (!comanda.fecha || dayjs(comanda.fecha).isAfter(hasta, 'day'))) return false;
      return true;
    });
  }, [comandas, operarioFilter, estadoFilter, camionFilter, fechaDesde, fechaHasta]);

  const metrics = useMemo(() => {
    const tiemposPrep = [];
    const demorasDespacho = [];
    let totalEntregas = 0;
    let parciales = 0;

    comandas.forEach((comanda) => {
      if (comanda?.preparacion?.inicio && comanda?.preparacion?.fin) {
        const inicio = dayjs(comanda.preparacion.inicio);
        const fin = dayjs(comanda.preparacion.fin);
        if (inicio.isValid() && fin.isValid() && fin.isAfter(inicio)) {
          tiemposPrep.push(fin.diff(inicio, 'minute'));
        }
      }
      if (comanda?.preparacion?.fin && comanda?.salidaDeposito) {
        const finPrep = dayjs(comanda.preparacion.fin);
        const salida = dayjs(comanda.salidaDeposito);
        if (finPrep.isValid() && salida.isValid() && salida.isAfter(finPrep)) {
          demorasDespacho.push(salida.diff(finPrep, 'minute'));
        }
      }
      if (Array.isArray(comanda.entregas)) {
        comanda.entregas.forEach((ent) => {
          totalEntregas += 1;
          if (ent.estado === 'Parcial') parciales += 1;
        });
      }
    });

    const promedio = (arr) => (arr.length ? arr.reduce((sum, val) => sum + val, 0) / arr.length : 0);

    return {
      promedioPreparacion: promedio(tiemposPrep),
      promedioDespacho: promedio(demorasDespacho),
      porcentajeParciales: totalEntregas ? (parciales / totalEntregas) * 100 : 0,
    };
  }, [comandas]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Monitoreo y auditoría</Typography>
          <Typography variant="body2" color="text.secondary">
            Tiempo prom. de preparación: {metrics.promedioPreparacion.toFixed(1)} min · Demora prom. preparación-despacho:{' '}
            {metrics.promedioDespacho.toFixed(1)} min · Entregas parciales: {metrics.porcentajeParciales.toFixed(1)}%
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="operario-filter">Operario</InputLabel>
            <Select
              labelId="operario-filter"
              value={operarioFilter}
              label="Operario"
              onChange={(event) => setOperarioFilter(event.target.value)}
            >
              <MenuItem value="TODOS">Todos</MenuItem>
              {operarios.map((op) => (
                <MenuItem key={op._id} value={op._id}>
                  {nombreUsuario(op)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="estado-filter">Estado preparación</InputLabel>
            <Select
              labelId="estado-filter"
              value={estadoFilter}
              label="Estado preparación"
              onChange={(event) => setEstadoFilter(event.target.value)}
            >
              <MenuItem value="TODOS">Todos</MenuItem>
              <MenuItem value="A Preparar">A Preparar</MenuItem>
              <MenuItem value="En Curso">En Curso</MenuItem>
              <MenuItem value="Lista para carga">Lista para carga</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="camion-filter">Camión</InputLabel>
            <Select
              labelId="camion-filter"
              value={camionFilter}
              label="Camión"
              onChange={(event) => setCamionFilter(event.target.value)}
            >
              <MenuItem value="TODOS">Todos</MenuItem>
              {camiones.map((camion) => (
                <MenuItem key={camion._id} value={camion._id}>
                  {camion.camion}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label="Desde"
            value={fechaDesde}
            onChange={(event) => setFechaDesde(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="Hasta"
            value={fechaHasta}
            onChange={(event) => setFechaHasta(event.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Comanda</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Estado prep.</TableCell>
              <TableCell>Operario</TableCell>
              <TableCell>Camión</TableCell>
              <TableCell>Chofer</TableCell>
              <TableCell>Despacho</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((comanda) => (
              <React.Fragment key={comanda._id}>
                <TableRow hover>
                  <TableCell>
                    <IconButton size="small" onClick={() => setExpanded((prev) => (prev === comanda._id ? null : comanda._id))}>
                      {expanded === comanda._id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>#{comanda.nrodecomanda}</TableCell>
                  <TableCell>{comanda.codcli?.razonsocial || '-'}</TableCell>
                  <TableCell>
                    <Chip label={comanda.estadoPreparacion || 'A Preparar'} size="small" />
                  </TableCell>
                  <TableCell>{nombreUsuario(comanda.operarioAsignado)}</TableCell>
                  <TableCell>{comanda.camion?.camion || '-'}</TableCell>
                  <TableCell>{nombreUsuario(comanda.camionero)}</TableCell>
                  <TableCell>{formatDate(comanda.salidaDeposito)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={8} sx={{ p: 0 }}>
                    <Collapse in={expanded === comanda._id} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Historial de eventos
                        </Typography>
                        {Array.isArray(comanda.historial) && comanda.historial.length ? (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Fecha</TableCell>
                                <TableCell>Acción</TableCell>
                                <TableCell>Usuario</TableCell>
                                <TableCell>Motivo</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {comanda.historial.map((h, idx) => (
                                <TableRow key={`${comanda._id}-hist-${idx}`}>
                                  <TableCell>{formatDate(h.fecha)}</TableCell>
                                  <TableCell>{h.accion}</TableCell>
                                  <TableCell>{nombreUsuario(h.usuario)}</TableCell>
                                  <TableCell>{h.motivo || '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Aún no hay historial registrado para esta comanda.
                          </Typography>
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No se encontraron comandas con los filtros seleccionados.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
