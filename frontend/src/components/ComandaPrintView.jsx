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

export default function ComandaPrintView({ items = [], showTotal = true }) {
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  const total = items.reduce(
    (sum, item) => sum + Number(item.precio) * Number(item.cantidad),
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
          {items.map((item) => {
            const subtotal = Number(item.precio) * Number(item.cantidad);
            return (
              <TableRow key={item.codigo ?? item.codprod}>
                <TableCell>{item.codigo ?? item.codprod}</TableCell>
                <TableCell>{item.descripcion || item.codprod}</TableCell>
                <TableCell align="right">
                  {currencyFormatter.format(Number(item.precio))}
                </TableCell>
                <TableCell align="right">{item.cantidad}</TableCell>
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
