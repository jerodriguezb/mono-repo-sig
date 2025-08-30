import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, TextField, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

export default function ResumenComanda({ items = [], dispatch }) {
  const handleQtyChange = (codprod, lista, cantidad) => {
    const qty = Number(cantidad);
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
      <List>
        {items.map((item) => (
          <ListItem
            key={`${item.codprod}-${item.lista}`}
            secondaryAction={
              <IconButton edge="end" onClick={() => handleRemove(item.codprod, item.lista)}>
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={item.descripcion || item.codprod}
              secondary={`Lista: ${item.lista} Precio: $${item.precio}`}
            />
            <TextField
              type="number"
              size="small"
              value={item.cantidad}
              onChange={(e) => handleQtyChange(item.codprod, item.lista, e.target.value)}
              inputProps={{ min: 1 }}
              sx={{ width: 64, ml: 2 }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
