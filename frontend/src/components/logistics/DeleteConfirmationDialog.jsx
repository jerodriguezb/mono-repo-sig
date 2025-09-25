import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';

export default function DeleteConfirmationDialog({ open, onClose, onConfirm, comanda, loading = false }) {
  if (!comanda) return null;
  const fecha = comanda.fecha ? dayjs(comanda.fecha).format('DD/MM/YYYY') : '-';
  const resumen = `${comanda?.codcli?.razonsocial ?? 'Sin cliente'} – ${fecha}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>¿Eliminar comanda?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Esta acción desactivará la comanda seleccionada. Podrás recuperarla desde otros módulos si es necesario.
        </DialogContentText>
        <List dense>
          <ListItem disableGutters>
            <ListItemText
              primary={<Typography variant="subtitle1">#{comanda.nrodecomanda}</Typography>}
              secondary={resumen}
            />
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={loading}>
          {loading ? 'Eliminando…' : 'Eliminar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
