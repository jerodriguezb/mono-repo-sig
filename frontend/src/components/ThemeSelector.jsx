// src/components/ThemeSelector.jsx
import React from 'react';
import { Select, MenuItem } from '@mui/material';

const ThemeSelector = ({ themeName, setThemeName }) => {
  return (
    <Select
      value={themeName}
      onChange={(e) => setThemeName(e.target.value)}
      variant="standard"
      sx={{ color: 'white', borderBottom: '1px solid white' }}
    >
      <MenuItem value="blue">Azul</MenuItem>
      <MenuItem value="green">Verde</MenuItem>
            <MenuItem value="negro">Negro</MenuItem>
      <MenuItem value="dark">Oscuro</MenuItem>
    </Select>
  );
};

export default ThemeSelector;
