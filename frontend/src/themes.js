// src/themes.js
import { createTheme } from '@mui/material/styles';

const blueTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#3F51B5' }, // Azul
    secondary: { main: '#FFC107' },
  },
});

const greenTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2E7D32' }, // Verde
    secondary: { main: '#FF5722' },
  },
});

const negroTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#020202ff' }, // Negro
    secondary: { main: '#FF5722' },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' }, // Azul claro modo oscuro
    secondary: { main: '#f48fb1' },
  },
});

export const themes = {
  blue: blueTheme,
  green: greenTheme,
  negro: negroTheme,
  dark: darkTheme,
};
