import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';

function ComandaPrintView({ items = [], showTotal = false }) {
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  const total = items.reduce(
    (sum, item) =>
      sum + (Number(item.monto) || 0) * (Number(item.cantidad) || 0),
    0,
  );

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Código</TableCell>
            <TableCell>Producto</TableCell>
            <TableCell align="right">Precio</TableCell>
            <TableCell align="right">Cantidad</TableCell>
            <TableCell align="right">Subtotal</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, idx) => {
            const precio = Number(item.monto) || 0;
            const cantidad = Number(item.cantidad) || 0;
            const subtotal = precio * cantidad;
            return (
              <TableRow key={item.codprod?.codprod ?? idx}>
                <TableCell>{item.codprod?.codprod ?? ''}</TableCell>
                <TableCell>{item.codprod?.descripcion ?? ''}</TableCell>
                <TableCell align="right">
                  {currencyFormatter.format(precio)}
                </TableCell>
                <TableCell align="right">{cantidad}</TableCell>
                <TableCell align="right">
                  {currencyFormatter.format(subtotal)}
                </TableCell>
              </TableRow>
            );
          })}
          {showTotal && (
            <TableRow>
              <TableCell colSpan={4} align="right">
                <Typography variant="subtitle2">Total</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="subtitle2">
                  {currencyFormatter.format(total)}
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

export default ComandaPrintView;
