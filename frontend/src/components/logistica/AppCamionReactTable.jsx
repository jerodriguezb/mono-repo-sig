import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { getComandasActivas } from '../../api/comandas';
import ModalFormCamion from './ModalFormCamion.jsx';

const hasControlCompletado = (comanda) =>
  Boolean(comanda?.controlCarga?.checklistDeposito || comanda?.controlCarga?.fechaHora);

const getCamionLabel = (comanda) => comanda?.camion?.camion || comanda?.camion?.patente || 'Sin camión';

export default function AppCamionReactTable({ refreshKey = 0 }) {
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getComandasActivas({ limite: 400 });
      const filtradas = data.filter((c) => hasControlCompletado(c));
      setComandas(filtradas);
      setError('');
    } catch (err) {
      console.error('Error obteniendo comandas para camiones', err);
      setError('No se pudieron cargar las comandas de camiones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const totalPendientes = useMemo(() => comandas.length, [comandas]);

  return (
    <Box sx={{ mt: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Panel de choferes
        </Typography>
        <Chip icon={<LocalShippingIcon />} label={`${totalPendientes} pendientes`} color="primary" />
        <Button variant="outlined" onClick={fetchData}>
          Actualizar
        </Button>
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
                <TableCell>Camión</TableCell>
                <TableCell>Checklist</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {comandas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay comandas pendientes de reparto.
                  </TableCell>
                </TableRow>
              ) : (
                comandas.map((comanda) => (
                  <TableRow key={comanda._id} hover>
                    <TableCell>{comanda.nrodecomanda}</TableCell>
                    <TableCell>{comanda.codcli?.razonsocial || '—'}</TableCell>
                    <TableCell>{getCamionLabel(comanda)}</TableCell>
                    <TableCell>
                      {hasControlCompletado(comanda) ? (
                        <Chip size="small" color="success" label="Checklist completo" />
                      ) : (
                        <Chip size="small" color="warning" label="Pendiente" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setSelected(comanda)}>
                        Registrar entrega
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Box>
      <ModalFormCamion
        open={Boolean(selected)}
        comanda={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null);
          fetchData();
        }}
      />
    </Box>
  );
}
