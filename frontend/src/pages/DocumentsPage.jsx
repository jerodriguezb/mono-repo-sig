import React from 'react';
import { Paper, Stack, Typography } from '@mui/material';
import DocumentWizard from '../components/documents/DocumentWizard.jsx';

export default function DocumentsPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h5">Documentos</Typography>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
        <DocumentWizard />
      </Paper>
    </Stack>
  );
}

