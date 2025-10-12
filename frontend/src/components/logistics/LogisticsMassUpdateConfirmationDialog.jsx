import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';

const resolveSelectionValue = (value, fallback) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : fallback;
};

export default function LogisticsMassUpdateConfirmationDialog({
  open,
  plan = [],
  selection,
  onCancel,
  onConfirm,
  loading = false,
}) {
  const safePlan = Array.isArray(plan) ? plan : [];
  const selectionEntries = selection
    ? [
        {
          key: 'estado',
          label: 'Estado logístico',
          value: selection?.estado ?? '—',
          fallback: '—',
        },
        {
          key: 'camionero',
          label: 'Camionero / Chofer',
          value: selection?.camionero ?? '',
          fallback: 'Sin seleccionar',
        },
        {
          key: 'camion',
          label: 'Punto de distribución (catálogo)',
          value: selection?.camion ?? '',
          fallback: 'Sin seleccionar',
        },
        {
          key: 'puntoDistribucion',
          label: 'Detalle del punto de distribución',
          value: selection?.puntoDistribucion ?? '',
          fallback: 'Sin ingresar',
        },
      ]
    : [];

  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} fullWidth maxWidth="md">
      <DialogTitle>Confirmar cambios masivos</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Revisá los cambios que se aplicarán. Los campos que ya cuenten con un valor asignado se
          conservarán sin modificaciones.
        </DialogContentText>

        {selectionEntries.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Selecciones realizadas
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              {selectionEntries.map((entry) => (
                <Box
                  key={entry.key}
                  sx={{
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    p: 1.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {entry.label}
                  </Typography>
                  <Typography variant="body2">
                    {resolveSelectionValue(entry.value, entry.fallback)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {safePlan.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No hay registros seleccionados para confirmar.
          </Typography>
        ) : (
          <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
            {safePlan.map((item, index) => {
              const comanda = item?.comanda ?? {};
              const key = comanda?._id ?? `${comanda?.nrodecomanda ?? 'comanda'}-${index}`;
              const clienteNombre = comanda?.codcli?.razonsocial ?? 'Cliente sin nombre';
              const numeroComanda = comanda?.nrodecomanda ?? 'N/D';
              const updates = Array.isArray(item?.updates) ? item.updates : [];
              const unchanged = Array.isArray(item?.unchanged) ? item.unchanged : [];

              return (
                <ListItem key={key} alignItems="flex-start" divider={index < safePlan.length - 1}>
                  <ListItemText
                    primary={`#${numeroComanda} — ${clienteNombre}`}
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        {updates.length > 0 ? (
                          <Box sx={{ mb: unchanged.length > 0 ? 1.5 : 0 }}>
                            <Typography variant="body2" fontWeight={600} color="success.main">
                              Se actualizará
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
                              {updates.map((update) => (
                                <Box component="li" key={update.key} sx={{ typography: 'body2' }}>
                                  {update?.description ?? 'Sin descripción'}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        ) : (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: unchanged.length > 0 ? 1.5 : 0 }}
                          >
                            No hay campos para actualizar en esta comanda.
                          </Typography>
                        )}

                        {unchanged.length > 0 && (
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              Se mantiene
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
                              {unchanged.map((field) => (
                                <Box
                                  component="li"
                                  key={field.key}
                                  sx={{ typography: 'body2', color: 'text.secondary' }}
                                >
                                  {field?.description ?? 'Sin descripción'}
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit" disabled={loading}>
          Volver
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={loading}>
          {loading ? 'Aplicando…' : 'Aplicar cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
