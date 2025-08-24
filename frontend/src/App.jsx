import React from 'react';
import Rutas from './Routes.jsx'; // Renombralo si querés evitar el conflicto con `Route`

export default function App({ themeName, setThemeName }) {
  return (
    <Rutas themeName={themeName} setThemeName={setThemeName} />
  );
}
