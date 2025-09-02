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

export default function ComandaPrintView({ items = [] }) {
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  const total = items.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Producto</TableCell>
            <TableCell align="right">Precio</TableCell>
            <TableCell align="right">Cantidad</TableCell>
            <TableCell align="right">Subtotal</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.codprod}>
              <TableCell>{item.descripcion || item.codprod}</TableCell>
              <TableCell align="right">
                {currencyFormatter.format(item.precio)}
              </TableCell>
              <TableCell align="right">{item.cantidad}</TableCell>
              <TableCell align="right">
                {currencyFormatter.format(item.precio * item.cantidad)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={3} align="right">
              <Typography variant="subtitle2">Total</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="subtitle2">
                {currencyFormatter.format(total)}
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}
