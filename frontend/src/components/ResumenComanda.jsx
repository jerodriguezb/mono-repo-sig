import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  IconButton,
  Button,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion, AnimatePresence } from 'framer-motion';
import StockInsuficienteDialog from './StockInsuficienteDialog.jsx';

export default function ResumenComanda({
  items = [],
  listas = [],
  dispatch,
  clienteSel,
  onConfirm,
}) {
  const [stockDialogOpen, setStockDialogOpen] = React.useState(false);
  const [stockProductos, setStockProductos] = React.useState([]);
  const handleQtyChange = (codprod, lista, cantidad) => {
    const qty = Number(cantidad);
    const item = items.find((i) => i.codprod === codprod && i.lista === lista);
    if (!item) return;
    const otros = items
      .filter((i) => i.codprod === codprod && i.lista !== lista)
      .reduce((sum, i) => sum + i.cantidad, 0);
    const total = otros + qty;
    if (total > item.stock) {
      setStockProductos([
        {
          descripcion: item.descripcion || item.codprod,
          disponible: item.stock - otros,
        },
      ]);
      setStockDialogOpen(true);
      return;
    }
    if (qty > 0) {
      dispatch({ type: 'update', payload: { codprod, lista, cantidad: qty } });
    }
  };

  const handleRemove = (codprod, lista) => {
    dispatch({ type: 'remove', payload: { codprod, lista } });
  };

  const totalGeneral = items.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0,
  );

  return (
    <>
      <Box sx={{ minWidth: 260 }}>
        <Typography variant="h6" gutterBottom>Resumen</Typography>
        {clienteSel && (
          <Typography variant="subtitle1" gutterBottom>
            Cliente: {clienteSel.razonsocial}
          </Typography>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>Lista</TableCell>
              <TableCell align="right">Precio</TableCell>
              <TableCell align="right">Cantidad</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody component={motion.tbody}>
            <AnimatePresence>
              {items.map((item) => (
                <TableRow
                  key={`${item.codprod}-${item.lista}`}
                  component={motion.tr}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <TableCell>{item.descripcion || item.codprod}</TableCell>
                  <TableCell>
                    {listas.find((l) => l._id === item.lista)?.lista || item.lista}
                  </TableCell>
                  <TableCell align="right">${item.precio}</TableCell>
                  <TableCell align="right">
                    <TextField
                      type="number"
                      size="small"
                      value={item.cantidad}
                      onChange={(e) => handleQtyChange(item.codprod, item.lista, e.target.value)}
                      inputProps={{ min: 1, max: item.stock }}
                      sx={{ width: 64 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    ${item.precio * item.cantidad}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton edge="end" onClick={() => handleRemove(item.codprod, item.lista)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
        <Box mt={2} display="flex" justifyContent="flex-end">
          <TextField
            label="Monto"
            value={`$${totalGeneral}`}
            size="small"
            InputProps={{ readOnly: true }}
          />
        </Box>
        {onConfirm && (
          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            onClick={onConfirm}
            disabled={!clienteSel}
          >
            Confirmar
          </Button>
        )}
      </Box>
      <StockInsuficienteDialog
        open={stockDialogOpen}
        onClose={() => setStockDialogOpen(false)}
        productos={stockProductos}
      />
    </>
  );
}
