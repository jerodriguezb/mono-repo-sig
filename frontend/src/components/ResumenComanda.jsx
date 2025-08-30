import React from 'react';
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, TextField, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

export default function ResumenComanda({ items = [], listas = [], dispatch }) {
  const handleQtyChange = (codprod, lista, cantidad) => {
    const qty = Number(cantidad);
    const item = items.find((i) => i.codprod === codprod && i.lista === lista);
    if (!item) return;
    const otros = items
      .filter((i) => i.codprod === codprod && i.lista !== lista)
      .reduce((sum, i) => sum + i.cantidad, 0);
    const total = otros + qty;
    if (total > item.stock) {
      alert('Stock insuficiente');
      return;
    }
    if (qty > 0) {
      dispatch({ type: 'update', payload: { codprod, lista, cantidad: qty } });
    }
  };

  const handleRemove = (codprod, lista) => {
    dispatch({ type: 'remove', payload: { codprod, lista } });
  };

  return (
    <Box sx={{ minWidth: 260 }}>
      <Typography variant="h6" gutterBottom>Resumen</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Producto</TableCell>
            <TableCell>Lista</TableCell>
            <TableCell align="right">Precio</TableCell>
            <TableCell align="right">Cantidad</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.codprod}-${item.lista}`}>
              <TableCell>{item.descripcion || item.codprod}</TableCell>
              <TableCell>{listas.find((l) => l._id === item.lista)?.lista || item.lista}</TableCell>
              <TableCell align="right">${item.precio}</TableCell>
              <TableCell align="right">
                <TextField
                  type="number"
                  size="small"
                  value={item.cantidad}
                  onChange={(e) => handleQtyChange(item.codprod, item.lista, e.target.value)}
                  inputProps={{ min: 1, max: item.stock }}
                  sx={{ width: 64 }}
                />
              </TableCell>
              <TableCell align="right">
                <IconButton edge="end" onClick={() => handleRemove(item.codprod, item.lista)}>
                  <DeleteIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
