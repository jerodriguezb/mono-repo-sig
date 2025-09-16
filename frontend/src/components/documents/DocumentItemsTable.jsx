import React from 'react';
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

export default function DocumentItemsTable({
  items,
  onFieldChange,
  onAddItem,
  onRemoveItem,
  onProductSearch,
  productOptions,
  productLoading,
  errors,
}) {
  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: { xs: '20%', md: '15%' } }}>Cantidad</TableCell>
            <TableCell>Producto</TableCell>
            <TableCell sx={{ width: { xs: '25%', md: '20%' } }}>Código</TableCell>
            <TableCell sx={{ width: 64 }} align="center">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={`item-${index}`}>
              <TableCell>
                <TextField
                  fullWidth
                  type="number"
                  size="small"
                  label="Cantidad"
                  value={item.cantidad}
                  inputProps={{ min: 0, step: 'any' }}
                  onChange={(event) => onFieldChange(index, 'cantidad', event.target.value)}
                  error={Boolean(errors?.[index]?.cantidad)}
                  helperText={errors?.[index]?.cantidad}
                />
              </TableCell>
              <TableCell>
                <Autocomplete
                  size="small"
                  options={productOptions}
                  loading={productLoading}
                  value={item.producto}
                  isOptionEqualToValue={(option, value) => option?._id === value?._id}
                  getOptionLabel={(option) => {
                    if (!option) return '';
                    const codigo = option.codprod ? ` (${option.codprod})` : '';
                    return `${option.descripcion || ''}${codigo}`.trim();
                  }}
                  onChange={(event, newValue) => onFieldChange(index, 'producto', newValue)}
                  onInputChange={(event, newInput, reason) => {
                    if (reason === 'reset') return;
                    onProductSearch(newInput || '');
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Producto"
                      error={Boolean(errors?.[index]?.producto)}
                      helperText={errors?.[index]?.producto}
                    />
                  )}
                />
              </TableCell>
              <TableCell>
                <TextField
                  fullWidth
                  size="small"
                  label="Código"
                  value={item.codprod}
                  onChange={(event) => onFieldChange(index, 'codprod', event.target.value)}
                  error={Boolean(errors?.[index]?.codprod)}
                  helperText={errors?.[index]?.codprod}
                />
              </TableCell>
              <TableCell align="center">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onRemoveItem(index)}
                  disabled={items.length === 1}
                  aria-label="Eliminar fila"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={4}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={onAddItem}
                sx={{ mt: 1 }}
              >
                Añadir ítem
              </Button>
              <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 1 }}>
                Consulta el buscador para obtener productos actualizados desde el backend.
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}

