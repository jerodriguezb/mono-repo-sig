import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';

const renderDetailsList = (items, emptyMessage) => {
  if (!items || items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {items.map((item, index) => (
        <ListItem key={`${item.field}-${index}`} disableGutters sx={{ pl: 0 }}>
          <ListItemText
            primary={item.field}
            secondary={item.details}
            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
            secondaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default function LogisticsBulkConfirmationDialog({
  open,
  onClose,
  onConfirm,
  items = [],
  loading = false,
}) {
  const totalChanges = items.filter((item) => item?.hasChanges).length;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Confirmar actualización logística</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Revisá los cambios que se aplicarán. Los campos que ya tienen información asignada se
          mantendrán sin modificaciones.
        </Typography>
        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No hay comandas seleccionadas.
          </Typography>
        ) : (
          <List disablePadding>
            {items.map((item, index) => {
              const comanda = item.comanda ?? {};
              const comandaLabel = `#${comanda?.nrodecomanda ?? 'N/D'} — ${
                comanda?.codcli?.razonsocial ?? 'Cliente sin nombre'
              }`;

              return (
                <Box key={comanda?._id ?? `${comanda?.nrodecomanda}-${index}`} sx={{ mb: index === items.length - 1 ? 0 : 2 }}>
                  <ListItem disableGutters>
                    <ListItemText
                      primary={comandaLabel}
                      secondary={`Estado actual: ${comanda?.codestado?.estado ?? 'Sin estado asignado'}`}
                      primaryTypographyProps={{ fontWeight: 600 }}
                    />
                  </ListItem>
                  <Grid container spacing={2} sx={{ pl: { md: 2 }, pb: 1 }}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Se actualizará
                      </Typography>
                      {renderDetailsList(item.changes, 'No hay cambios para esta comanda.')}
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Se mantiene
                      </Typography>
                      {renderDetailsList(
                        item.preserved,
                        'No hay información previa para esta comanda.',
                      )}
                    </Grid>
                  </Grid>
                  {index < items.length - 1 ? <Divider sx={{ my: 1.5 }} /> : null}
                </Box>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={loading || totalChanges === 0}
        >
          {loading ? 'Guardando…' : 'Aplicar cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
