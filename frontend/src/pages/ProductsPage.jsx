import React from 'react';
import { Stack, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ProductTable from '../components/ProductTable.jsx';
import ProductFormDialog from '../components/ProductFormDialog.jsx';

export default function ProductsPage() {
  const [open, setOpen] = React.useState(false);
  const [rowToEdit, setRowToEdit] = React.useState(null);
  const tableRef = React.useRef(null);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Productos</Typography>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => { setRowToEdit(null); setOpen(true); }}
      >
        Nuevo producto
      </Button>

      <ProductTable
        ref={tableRef}
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
