import React from 'react';
import { Stack, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PriceTable from '../components/PriceTable.jsx';
import PriceFormDialog from '../components/PriceFormDialog.jsx';

export default function PricesPage() {
  const [open, setOpen] = React.useState(false);
  const [rowToEdit, setRowToEdit] = React.useState(null);
  const tableRef = React.useRef(null);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Precios</Typography>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setOpen(true)}
      >
        Nuevo precio
      </Button>

      <PriceTable
        ref={tableRef}
        onEdit={(row) => {
          setRowToEdit(row);
          setOpen(true);
        }}
      />

      <PriceFormDialog
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
