import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';

export default function MissingProductsDialog({ open, products = [], onRetry, onCancel }) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
      <DialogTitle>Productos sin stock</DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Descripción</TableCell>
              <TableCell>Stock actual</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((p, idx) => (
              <TableRow key={idx}>
                <TableCell>{p.descripcion}</TableCell>
                <TableCell>{p.stkactual}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onRetry} color="primary">Reintentar</Button>
        <Button onClick={onCancel} color="primary">Cancelar</Button>
      </DialogActions>
    </Dialog>
  );
}
