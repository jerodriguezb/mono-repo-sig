import React, { useEffect, useState } from 'react';
import { Stack, Typography, TextField, Select, MenuItem, Grid, Box } from '@mui/material';
import ProductoItem from '../components/ProductoItem.jsx';
import api from '../api/axios.js';

export default function ComandasPage() {
  const [productos, setProductos] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [listas, setListas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [rubroSel, setRubroSel] = useState('');
  const [listaSel, setListaSel] = useState('');

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [r, l] = await Promise.all([
          api.get('/rubros'),
          api.get('/listas'),
        ]);
        setRubros(r.data.rubros || []);
        setListas(l.data.listas || []);
      } catch (err) {
        console.error('Error obteniendo filtros', err);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const params = { limite: 100 };
        if (busqueda) {
          params.searchField = 'descripcion';
          params.searchValue = busqueda;
        }
        const { data } = await api.get('/producservs', { params });
        let prods = data.producservs || [];
        if (rubroSel) {
          prods = prods.filter((p) => {
            const rId = p.rubro?._id ?? p.rubro;
            return rId === rubroSel;
          });
        }
        setProductos(prods);
      } catch (err) {
        console.error('Error obteniendo productos', err);
      }
    };
    fetchProductos();
  }, [busqueda, rubroSel]);

  const handleAdd = (item) => {
    console.log('Producto agregado', item);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Comandas</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Buscar"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Select
          value={rubroSel}
          displayEmpty
          onChange={(e) => setRubroSel(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value=""><em>Todos los rubros</em></MenuItem>
          {rubros.map((r) => (
            <MenuItem key={r._id} value={r._id}>{r.rubro || r.nombre}</MenuItem>
          ))}
        </Select>
        <Select
          value={listaSel}
          displayEmpty
          onChange={(e) => setListaSel(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value=""><em>Lista de precios</em></MenuItem>
          {listas.map((l) => (
            <MenuItem key={l._id} value={l._id}>{l.lista || l.nombre}</MenuItem>
          ))}
        </Select>
      </Stack>

      <Box>
        <Grid container spacing={2}>
          {productos.map((p) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={p._id}>
              <ProductoItem
                producto={p}
                listas={listas}
                defaultLista={listaSel}
                onAdd={handleAdd}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
}

