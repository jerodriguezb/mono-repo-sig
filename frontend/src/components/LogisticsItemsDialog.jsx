import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  Box,
} from '@mui/material';

const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

export default function LogisticsItemsDialog({ open, onClose, items = [], comanda }) {
  const itemsWithTotals = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => {
      const cantidad = Number(item?.cantidadentregada ?? item?.cantidad ?? 0);
      const precio = Number(item?.monto ?? 0);
      return {
        id: item?._id ?? index,
        descripcion: item?.codprod?.descripcion ?? '—',
        lista: item?.lista?.lista ?? '—',
        cantidad,
        precio,
        total: cantidad * precio,
      };
    });
  }, [items]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Detalle de ítems — Comanda {comanda?.nrodecomanda ?? comanda?.nrocomanda ?? '—'}</DialogTitle>
      <DialogContent dividers>
        {itemsWithTotals.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No se registran ítems para esta comanda.
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell>Lista</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  <TableCell align="right">Precio unitario</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {itemsWithTotals.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.descripcion}</TableCell>
                    <TableCell>{item.lista}</TableCell>
                    <TableCell align="right">{numberFormatter.format(item.cantidad)}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(item.precio)}</TableCell>
                    <TableCell align="right">{currencyFormatter.format(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
