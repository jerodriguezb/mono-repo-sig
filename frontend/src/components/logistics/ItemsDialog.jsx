import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Box,
} from '@mui/material';
import dayjs from 'dayjs';

export default function ItemsDialog({ open, onClose, comanda }) {
  const items = comanda?.items ?? [];
  const fecha = comanda?.fecha ? dayjs(comanda.fecha).format('DD/MM/YYYY') : '-';
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Ítems de la comanda #{comanda?.nrodecomanda ?? ''}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Cliente: {comanda?.codcli?.razonsocial ?? 'Sin información'}
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            Fecha: {fecha}
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Cantidad</TableCell>
              <TableCell align="right">Cantidad entregada</TableCell>
              <TableCell align="right">Lista</TableCell>
              <TableCell align="right">Precio unitario</TableCell>
              <TableCell align="right">Subtotal entregado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              const descripcion = item?.codprod?.descripcion ?? '—';
              const cantidad = Number(item?.cantidad ?? 0);
              const cantidadEntregada = Number(item?.cantidadentregada ?? 0);
              const precio = Number(item?.monto ?? 0);
              const subtotal = cantidadEntregada * precio;
              return (
                <TableRow key={item?._id ?? descripcion} hover>
                  <TableCell>{descripcion}</TableCell>
                  <TableCell align="right">{cantidad.toLocaleString('es-AR')}</TableCell>
                  <TableCell align="right">{cantidadEntregada.toLocaleString('es-AR')}</TableCell>
                  <TableCell align="right">{item?.lista?.lista ?? '—'}</TableCell>
                  <TableCell align="right">
                    {precio.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </TableCell>
                  <TableCell align="right">
                    {subtotal.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                  </TableCell>
                </TableRow>
              );
            })}
            {!items.length && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    Sin ítems asociados.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
