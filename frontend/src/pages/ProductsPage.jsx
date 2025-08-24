import React from 'react';
import { Stack, Button, Typography, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ProductTable from '../components/ProductTable.jsx';
import ProductFormDialog from '../components/ProductFormDialog.jsx';

export default function ProductsPage() {
  const [open, setOpen] = React.useState(false);
  const [rowToEdit, setRowToEdit] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const tableRef = React.useRef(null);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Productos</Typography>

      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          label="Buscar"
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setRowToEdit(null); setOpen(true); }}
        >
          Nuevo producto
        </Button>
      </Stack>

      <ProductTable
        ref={tableRef}
        search={search}
        onEdit={(row) => {
          setRowToEdit(row);
          setOpen(true);
        }}
      />

      <ProductFormDialog
        open={open}
        row={rowToEdit}
        onClose={(success) => {
          setOpen(false);
          setRowToEdit(null);
          if (success) tableRef.current?.refresh();
        }}
      />
    </Stack>
  );
}
