import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';

export default function StockInsuficienteDialog({ open, onClose, productos = [] }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Stock insuficiente</DialogTitle>
      <DialogContent dividers>
        <List>
          {productos.map((p, idx) => (
            <ListItem key={idx}>
              <ListItemText
                primary={p.descripcion || p.codprod}
                secondary={
                  `Disponible: ${p.disponible ?? p.stkactual ?? p.stock ?? 0}` +
                  (p.solicitado != null ? ` - Solicitado: ${p.solicitado}` : '')
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

