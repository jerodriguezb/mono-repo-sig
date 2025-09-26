import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';

export default function DeleteConfirmationDialog({ open, onClose, onConfirm, comandas = [], loading = false }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Eliminar comandas seleccionadas</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Se realizará una baja lógica de las siguientes comandas. Esta acción puede revertirse desde otros módulos del sistema.
        </DialogContentText>
        <List dense>
          {comandas.map((comanda) => (
            <ListItem key={comanda?._id ?? comanda?.nrodecomanda}>
              <ListItemText
                primary={`#${comanda?.nrodecomanda ?? 'N/D'} — ${comanda?.codcli?.razonsocial ?? 'Cliente'}`}
                secondary={`Producto principal: ${comanda?.items?.[0]?.codprod?.descripcion ?? 'Sin información'} — Fecha: ${new Date(comanda?.fecha ?? '').toLocaleDateString()}`}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error" disabled={loading}>
          {loading ? 'Eliminando…' : 'Eliminar seleccionadas'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
