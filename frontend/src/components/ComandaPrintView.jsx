import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Stack,
} from '@mui/material';

export default function ComandaPrintView({ items = [], nrodecomanda, cliente }) {
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  const total = items.reduce(
    (sum, item) => sum + (Number(item.precio) || 0) * (Number(item.cantidad) || 0),
    0,
  );

  return (
    <Box className="print-area">
      <Stack spacing={1} sx={{ mb: 1 }}>
        {nrodecomanda && (
          <Typography variant="subtitle1">
            Nº de comanda: {nrodecomanda}
          </Typography>
        )}
        <Typography variant="subtitle1">
          Cliente: {cliente?.razonsocial || 'Consumidor Final'}
        </Typography>
      </Stack>
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
            const codigo = item.codigo || item.codprod;
            const precio = Number(item.precio) || 0;
            const cantidad = Number(item.cantidad) || 0;
            const subtotal = precio * cantidad;
            return (
              <TableRow key={codigo}>
                <TableCell>{codigo}</TableCell>
                <TableCell>{item.nombre}</TableCell>
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
        </TableBody>
      </Table>
    </Box>
  );
}
