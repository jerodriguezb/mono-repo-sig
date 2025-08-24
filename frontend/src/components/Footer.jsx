import React from 'react';
import { Box, Typography, Container } from '@mui/material';
import logo from '../assets/logo.png';

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        width: '100%',
        backgroundColor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        py: 1,
        mt: 'auto',
      }}
    >
      <Container
        maxWidth="xl"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box component="img" src={logo} alt="Logo" sx={{ height: 30, opacity: 0.7 }} />

        <Typography variant="caption" sx={{ opacity: 0.70 }}>
          SID - Sistema Integral de Distribución
        </Typography>

        <Box textAlign="right">
          <Typography variant="caption">Versión 2.0 - </Typography>
          <Typography variant="caption">by Abeto Tech</Typography>
        </Box>
      </Container>
    </Box>
  );
}
