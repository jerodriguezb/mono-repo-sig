import React from 'react';
import { Stack, Button, Typography, Snackbar, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PriceTable from '../components/PriceTable.jsx';
import PriceFormDialog from '../components/PriceFormDialog.jsx';

export default function PricesPage() {
  const [open, setOpen] = React.useState(false);
  const [rowToEdit, setRowToEdit] = React.useState(null);
  const [feedback, setFeedback] = React.useState({ open: false, message: '', severity: 'success' });
  const tableRef = React.useRef(null);

  const handleCloseDialog = (success, message) => {
    setOpen(false);
    setRowToEdit(null);
    if (success) {
      if (message) {
        setFeedback({ open: true, message, severity: 'success' });
      }
      tableRef.current?.refresh();
    }
  };

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
        onClose={handleCloseDialog}
      />

      <Snackbar
        open={feedback.open}
        autoHideDuration={4000}
        onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
          severity={feedback.severity}
          sx={{ width: '100%' }}
        >
          {feedback.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
