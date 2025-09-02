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

const ComandaPrintView = React.forwardRef(({ comanda }, ref) => {
  if (!comanda) return null;
  const { nrodecomanda, cliente, fecha, items = [] } = comanda;
  const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
  return (
    <Box ref={ref} p={2}>
      <Typography variant="h6" gutterBottom>
        Comanda Nº {nrodecomanda}
      </Typography>
      <Typography>Cliente: {cliente?.razonsocial || cliente?.nombre}</Typography>
      <Typography>Fecha: {new Date(fecha).toLocaleString()}</Typography>
      <Table size="small" sx={{ mt: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>Producto</TableCell>
            <TableCell align="right">Cant.</TableCell>
            <TableCell align="right">Precio</TableCell>
            <TableCell align="right">Subtotal</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={idx}>
              <TableCell>{item.descripcion}</TableCell>
              <TableCell align="right">{item.cantidad}</TableCell>
              <TableCell align="right">${item.precio}</TableCell>
              <TableCell align="right">${item.precio * item.cantidad}</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={3} align="right">
              Total
            </TableCell>
            <TableCell align="right">${total}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
});

export default ComandaPrintView;

