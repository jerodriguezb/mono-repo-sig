import React from 'react';
import { Box } from '@mui/material';
import logo from '../assets/logo.png';

export default function HomePage() {
  return (
    <Box
      sx={{
        height: '80vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <Box
        component="img"
        src={logo}
        alt="Logo"
        sx={{
          opacity: 0.2, // Marca de agua
          width: '50%', // Tamaño relativo
          maxWidth: 400, // Máximo en px
        }}
      />
    </Box>
  );
}
