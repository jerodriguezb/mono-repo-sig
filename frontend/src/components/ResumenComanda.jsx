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
  Checkbox,
  Select,
  MenuItem,
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

  const handleListaChange = (codprod, lista, nuevaLista) => {
    dispatch({
      type: 'update',
      payload: { codprod, lista, changes: { lista: nuevaLista } },
    });
  };

  const handleEntregadoChange = (codprod, lista, entregado) => {
    dispatch({
      type: 'update',
      payload: { codprod, lista, changes: { entregado } },
    });
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
              <TableCell>Entregado</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.codprod}-${item.lista}`}>
                <TableCell>{item.descripcion || item.codprod}</TableCell>
                <TableCell>
                  <Select
                    size="small"
                    value={item.lista}
                    onChange={(e) =>
                      handleListaChange(item.codprod, item.lista, e.target.value)
                    }
                  >
                    {listas.map((l) => (
                      <MenuItem key={l._id} value={l._id}>
                        {l.lista || l.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
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
                  <Checkbox
                    checked={item.entregado}
                    onChange={(e) =>
                      handleEntregadoChange(
                        item.codprod,
                        item.lista,
                        e.target.checked,
                      )
                    }
                  />
                </TableCell>
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

