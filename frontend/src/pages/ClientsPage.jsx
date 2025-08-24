import React from 'react';
import { Stack, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ClientTable from '../components/ClientTable.jsx';
import ClientFormDialog from '../components/ClientFormDialog.jsx';

export default function ClientsPage() {
  const [open, setOpen] = React.useState(false);
  const [rowToEdit, setRowToEdit] = React.useState(null);
  const clientTableRef = React.useRef(null); // 👈 nuevo ref

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Clientes</Typography>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setOpen(true)}
      >
        Nuevo cliente
      </Button>

      <ClientTable
        ref={clientTableRef}
        onEdit={(row) => {
          setRowToEdit(row);
          setOpen(true);
        }}
      />

      <ClientFormDialog
        open={open}
        row={rowToEdit}
        onClose={(success) => {
          setOpen(false);
          setRowToEdit(null);
          if (success) clientTableRef.current?.refresh(); // 👈 refresca
        }}
      />
    </Stack>
  );
}
