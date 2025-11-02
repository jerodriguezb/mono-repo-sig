import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const formatNumber = (value) => new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value ?? 0));

export default function ItemsModal({ open, onClose, comanda }) {
  const items = Array.isArray(comanda?.items) ? comanda.items : [];
  const cliente = comanda?.codcli?.razonsocial ?? '—';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
        Detalle de ítems — Comanda #{comanda?.nrodecomanda ?? 'N/D'}
        <IconButton onClick={onClose} sx={{ ml: 'auto' }} aria-label="Cerrar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Cliente
          </Typography>
          <Typography variant="body1">{cliente}</Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>Lista</TableCell>
              <TableCell align="right">Cant. solicitada</TableCell>
              <TableCell align="right">Cant. entregada</TableCell>
              <TableCell align="right">Precio unitario</TableCell>
              <TableCell align="right">Subtotal</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    La comanda no posee ítems registrados.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const descripcion = item?.codprod?.descripcion ?? '—';
                const lista = item?.lista?.lista ?? '—';
                const cantidadSolicitada = Number(item?.cantidad ?? 0);
                const cantidadEntregada = Number(item?.cantidadentregada ?? 0);
                const precio = Number(item?.monto ?? 0);
                const subtotal = cantidadSolicitada * precio;
                return (
                  <TableRow key={item?._id ?? `${descripcion}-${lista}`}>
                    <TableCell>{descripcion}</TableCell>
                    <TableCell>{lista}</TableCell>
                    <TableCell align="right">{formatNumber(cantidadSolicitada)}</TableCell>
                    <TableCell align="right">{formatNumber(cantidadEntregada)}</TableCell>
                    <TableCell align="right">${formatNumber(precio)}</TableCell>
                    <TableCell align="right">${formatNumber(subtotal)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
