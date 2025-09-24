import React, { useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import api from '../api/axios.js';

const formatDate = (value) => {
  if (!value) return '-';
  return dayjs(value).format('DD/MM/YYYY HH:mm');
};

const nombreUsuario = (usuario) => {
  if (!usuario) return '';
  if (typeof usuario === 'string') return usuario;
  return `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
};

export default function AppCamionReactTable({ comandas = [], onSelectEntrega, onChange }) {
  const currentUserId = useMemo(() => localStorage.getItem('id') || '', []);

  const visibles = useMemo(
    () =>
      comandas.filter(
        (comanda) =>
          comanda?.controlCarga?.checklistDepositoConfirmado &&
          (comanda?.camion || comanda?.camion?._id) &&
          comanda?.estadoPreparacion === 'Lista para carga',
      ),
    [comandas],
  );

  const handleSalida = async (comanda) => {
    try {
      await api.put(`/comandas/${comanda._id}`, {
        salidaDeposito: new Date().toISOString(),
        usuarioDespacho: currentUserId || null,
        motivoLogistica: 'Despacho registrado desde tablero de camiones',
      });
      onChange?.();
    } catch (error) {
      console.error('Error registrando salida de camión', error);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Control de carga y despacho</Typography>
        <Chip label={`${visibles.length} camiones listos`} color="primary" />
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Comanda</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Camión</TableCell>
              <TableCell>Chofer</TableCell>
              <TableCell>Control carga</TableCell>
              <TableCell>Salida</TableCell>
              <TableCell>Entregas</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibles.map((comanda) => {
              const entregas = Array.isArray(comanda.entregas) ? comanda.entregas : [];
              return (
                <TableRow key={comanda._id} hover>
                  <TableCell>#{comanda.nrodecomanda}</TableCell>
                  <TableCell>{comanda.codcli?.razonsocial || '-'}</TableCell>
                  <TableCell>{comanda.camion?.camion || comanda.camion || '-'}</TableCell>
                  <TableCell>{nombreUsuario(comanda.camionero)}</TableCell>
                  <TableCell>
                    {comanda.controlCarga?.fecha ? formatDate(comanda.controlCarga.fecha) : '-'}
                  </TableCell>
                  <TableCell>{formatDate(comanda.salidaDeposito)}</TableCell>
                  <TableCell>
                    {entregas.length === 0 ? (
                      <Chip label="Sin entregas registradas" size="small" />
                    ) : (
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {entregas.map((entrega, idx) => (
                          <Chip
                            key={`${comanda._id}-${idx}`}
                            label={`${entrega.parada || idx + 1}: ${entrega.estado}`}
                            color={entrega.estado === 'Completa' ? 'success' : entrega.estado === 'Parcial' ? 'warning' : 'error'}
                            size="small"
                          />
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {!comanda.salidaDeposito && (
                        <Button size="small" variant="outlined" onClick={() => handleSalida(comanda)}>
                          Registrar salida
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => onSelectEntrega && onSelectEntrega(comanda)}
                      >
                        Registrar entrega
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {!visibles.length && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No hay camiones disponibles. Completa el control de carga para habilitar el despacho.
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
