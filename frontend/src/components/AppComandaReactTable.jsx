import React, { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import dayjs from 'dayjs';

const formatDate = (value) => {
  if (!value) return '-';
  return dayjs(value).format('DD/MM/YYYY HH:mm');
};

export default function AppComandaReactTable({ comandas = [] }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <TimelineIcon color="primary" />
        <Typography variant="h6">Seguimiento operativo</Typography>
      </Stack>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Comanda</TableCell>
              <TableCell>Inicio prep.</TableCell>
              <TableCell>Fin prep.</TableCell>
              <TableCell>Control de carga</TableCell>
              <TableCell>Despacho</TableCell>
              <TableCell>Última entrega</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comandas.map((comanda) => {
              const ultimaEntrega = Array.isArray(comanda.entregas) && comanda.entregas.length
                ? comanda.entregas[comanda.entregas.length - 1]
                : null;
              return (
                <React.Fragment key={comanda._id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton size="small" onClick={() => setExpanded((prev) => (prev === comanda._id ? null : comanda._id))}>
                        {expanded === comanda._id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>#{comanda.nrodecomanda}</TableCell>
                    <TableCell>{formatDate(comanda.preparacion?.inicio)}</TableCell>
                    <TableCell>{formatDate(comanda.preparacion?.fin)}</TableCell>
                    <TableCell>{formatDate(comanda.controlCarga?.fecha)}</TableCell>
                    <TableCell>{formatDate(comanda.salidaDeposito)}</TableCell>
                    <TableCell>
                      {ultimaEntrega ? (
                        <Chip
                          label={`${ultimaEntrega.estado}${ultimaEntrega.parada ? ` – ${ultimaEntrega.parada}` : ''}`}
                          color={ultimaEntrega.estado === 'Completa' ? 'success' : ultimaEntrega.estado === 'Parcial' ? 'warning' : 'error'}
                          size="small"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0 }}>
                      <Collapse in={expanded === comanda._id} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Historial completo
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
                                {comanda.historial.map((item, idx) => (
                                  <TableRow key={`${comanda._id}-full-${idx}`}>
                                    <TableCell>{formatDate(item.fecha)}</TableCell>
                                    <TableCell>{item.accion}</TableCell>
                                    <TableCell>
                                      {typeof item.usuario === 'object'
                                        ? `${item.usuario?.nombres || ''} ${item.usuario?.apellidos || ''}`.trim()
                                        : item.usuario || '-'}
                                    </TableCell>
                                    <TableCell>{item.motivo || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No hay registros para mostrar.
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
            {!comandas.length && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No hay comandas registradas.
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
