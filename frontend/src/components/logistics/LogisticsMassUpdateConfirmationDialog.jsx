import React, { useMemo } from 'react';
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
  Stack,
  Typography,
} from '@mui/material';

const buildFieldMessage = (entry) => {
  if (!entry) return 'Sin cambios pendientes.';
  const {
    updateCount = 0,
    skipAlreadyAssignedCount = 0,
    skipNotSelectedCount = 0,
    skipUnchangedCount = 0,
    nextLabel,
  } = entry;

  const fragments = [];
  if (updateCount > 0) {
    const plural = updateCount === 1 ? '' : 's';
    const base = `Se actualizará${plural} en ${updateCount} comanda${plural}`;
    fragments.push(nextLabel ? `${base} al valor "${nextLabel}".` : `${base}.`);
  }
  if (skipAlreadyAssignedCount > 0) {
    const plural = skipAlreadyAssignedCount === 1 ? '' : 's';
    fragments.push(
      `Se mantiene${plural} en ${skipAlreadyAssignedCount} comanda${plural} porque ya tienen un valor asignado.`,
    );
  }
  if (skipUnchangedCount > 0) {
    const plural = skipUnchangedCount === 1 ? '' : 's';
    fragments.push(
      `Se mantiene${plural} en ${skipUnchangedCount} comanda${plural} porque ya poseen el mismo valor.`,
    );
  }
  if (skipNotSelectedCount > 0) {
    const plural = skipNotSelectedCount === 1 ? '' : 's';
    fragments.push(`No se seleccionó un nuevo valor para ${skipNotSelectedCount} comanda${plural}.`);
  }

  if (fragments.length === 0) {
    return 'Sin cambios pendientes para este campo.';
  }

  return fragments.join(' ');
};

export default function LogisticsMassUpdateConfirmationDialog({
  open,
  onClose,
  onConfirm,
  plan,
  loading = false,
}) {
  const summaryEntries = useMemo(() => {
    if (!plan?.summary) return [];
    return Object.values(plan.summary).filter(Boolean);
  }, [plan]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Confirmar actualización masiva</DialogTitle>
      <DialogContent dividers>
        <DialogContentText sx={{ mb: 2 }}>
          Revisá los cambios que se aplicarán. Los campos sin cambios conservarán su valor actual.
        </DialogContentText>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          Comandas seleccionadas
        </Typography>
        <List dense sx={{ mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
          {(plan?.comandas ?? []).map((item) => (
            <ListItem key={item.id ?? item.numero}>
              <ListItemText
                primary={`#${item.numero ?? 'N/D'} — ${item.cliente ?? 'Cliente sin nombre'}`}
                secondary={
                  item.fieldStates?.estado?.currentLabel
                    ? `Estado actual: ${item.fieldStates.estado.currentLabel}`
                    : null
                }
              />
            </ListItem>
          ))}
        </List>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          Resumen de campos
        </Typography>
        <Stack spacing={1.5}>
          {summaryEntries.map((entry) => (
            <Box
              key={entry.key ?? entry.label}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {entry.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {buildFieldMessage(entry)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Regresar
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={loading}>
          {loading ? 'Aplicando…' : 'Aplicar cambios'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
