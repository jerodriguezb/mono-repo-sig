import React, { useEffect, useReducer, useState } from 'react';
import { Stack, Typography, TextField, Select, MenuItem, Grid, Box, Pagination } from '@mui/material';
import ProductoItem from '../components/ProductoItem.jsx';
import ResumenComanda from '../components/ResumenComanda.jsx';
import api from '../api/axios.js';

export default function ComandasPage() {
  const [productos, setProductos] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [listas, setListas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [rubroSel, setRubroSel] = useState('');
  const [listaSel, setListaSel] = useState('');
  const [page, setPage] = useState(1); // 1-based
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const itemsReducer = (state, action) => {
    switch (action.type) {
      case 'add': {
        const { codprod, lista, cantidad, precio, descripcion } = action.payload;
        const idx = state.findIndex((i) => i.codprod === codprod && i.lista === lista);
        if (idx > -1) {
          return state.map((i, n) => (n === idx ? { ...i, cantidad: i.cantidad + cantidad } : i));
        }
        return [...state, { codprod, lista, cantidad, precio, descripcion }];
      }
      case 'update': {
        const { codprod, lista, cantidad } = action.payload;
        return state.map((i) =>
          i.codprod === codprod && i.lista === lista ? { ...i, cantidad } : i,
        );
      }
      case 'remove': {
        const { codprod, lista } = action.payload;
        return state.filter((i) => !(i.codprod === codprod && i.lista === lista));
      }
      default:
        return state;
    }
  };
  const [items, dispatch] = useReducer(itemsReducer, []);

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
        const params = {
          limite: pageSize,
          desde: (page - 1) * pageSize,
        };
        if (busqueda) params.search = busqueda;
        if (rubroSel) params.rubro = rubroSel;
        if (listaSel) params.lista = listaSel;
        const { data } = await api.get('/producservs', { params });
        setProductos(data.producservs || []);
        setTotal(data.cantidad || 0);
      } catch (err) {
        console.error('Error obteniendo productos', err);
      }
    };
    fetchProductos();
  }, [busqueda, rubroSel, listaSel, page, pageSize]);

  const handleAdd = ({ producto, cantidad, lista, precio }) => {
    dispatch({
      type: 'add',
      payload: {
        codprod: producto._id,
        lista,
        cantidad,
        precio,
        descripcion: producto.descripcion,
      },
    });
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Comandas</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Buscar"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={rubroSel}
          displayEmpty
          onChange={(e) => {
            setRubroSel(e.target.value);
            setPage(1);
          }}
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
          onChange={(e) => {
            setListaSel(e.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value=""><em>Lista de precios</em></MenuItem>
          {listas.map((l) => (
            <MenuItem key={l._id} value={l._id}>{l.lista || l.nombre}</MenuItem>
          ))}
        </Select>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
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
          <Pagination
            count={Math.max(1, Math.ceil(total / pageSize))}
            page={page}
            onChange={(_, val) => setPage(val)}
            sx={{ mt: 2, alignSelf: 'center' }}
          />
        </Box>
        <ResumenComanda items={items} dispatch={dispatch} />
      </Stack>
    </Stack>
  );
}

