import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function NoAccessPage() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        textAlign: 'center',
      }}
    >
      <Typography variant="h4" component="h1" fontWeight={700}>
        No tienes permisos asignados
      </Typography>
      <Typography variant="body1" color="text.secondary" maxWidth={520}>
        Comunícate con un administrador para que te asigne el acceso a las
        pantallas necesarias. Mientras tanto no es posible operar dentro de la
        plataforma.
      </Typography>
      <Button variant="contained" onClick={() => navigate(-1)}>
        Volver
      </Button>
    </Box>
  );
}
