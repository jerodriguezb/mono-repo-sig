import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

export default function ResumenComanda({ items = [], listas = [], dispatch }) {
  const handleQtyChange = (codprod, lista, cantidad) => {
    const qty = Number(cantidad);
    if (qty > 0) {
      dispatch({
        type: 'update',
        payload: { codprod, lista, changes: { cantidad: qty } },
      });
    }
  };

  const getListaNombre = (id) => {
    const found = listas.find((l) => l._id === id);
    return found ? found.lista || found.nombre : id;
  };

  const handleRemove = (codprod, lista) => {
    dispatch({ type: 'remove', payload: { codprod, lista } });
  };

  return (
    <Box sx={{ minWidth: 260 }}>
      <Typography variant="h6" gutterBottom>
        Resumen
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>Lista</TableCell>
              <TableCell>Cantidad</TableCell>
              <TableCell>Monto</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.codprod}-${item.lista}`}>
                <TableCell>{item.descripcion || item.codprod}</TableCell>
                <TableCell>{getListaNombre(item.lista)}</TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={item.cantidad}
                    onChange={(e) =>
                      handleQtyChange(item.codprod, item.lista, e.target.value)
                    }
                    inputProps={{ min: 1 }}
                    sx={{ width: 64 }}
                  />
                </TableCell>
                <TableCell>{item.monto}</TableCell>
                <TableCell>
                  <IconButton
                    edge="end"
                    onClick={() => handleRemove(item.codprod, item.lista)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

