import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PriceTable from '../components/PriceTable.jsx';
import PriceFormDialog from '../components/PriceFormDialog.jsx';

export default function PricesPage() {
  const [open, setOpen] = React.useState(false);
  const [rowToEdit, setRowToEdit] = React.useState(null);
  const tableRef = React.useRef(null);

  const handleClose = (shouldRefresh) => {
    setOpen(false);
    if (shouldRefresh) {
      tableRef.current?.refresh();
    }
    setRowToEdit(null);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Precios</Typography>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => {
          setRowToEdit(null);
          setOpen(true);
        }}
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
        onClose={handleClose}
      />
    </Stack>
  );
}
