import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App.jsx';
import { themes } from './themes.js';

const Root = () => {
  // Intentamos recuperar el tema guardado, si no existe usamos 'blue'
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('themeName') || 'blue';
  });

  // Cuando el tema cambia, lo guardamos
  useEffect(() => {
    localStorage.setItem('themeName', themeName);
  }, [themeName]);

  return (
    <BrowserRouter>
      <ThemeProvider theme={themes[themeName]}>
        <CssBaseline />
        <App themeName={themeName} setThemeName={setThemeName} />
      </ThemeProvider>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
