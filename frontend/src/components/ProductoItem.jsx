import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  Box,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import api from '../api/axios.js';

export default function ProductoItem({
  producto,
  listas = [],
  defaultLista = '',
  onAdd,
  focused = false,
  stockDisponible,
}) {
  const [cantidad, setCantidad] = useState(1);
  const [listaId, setListaId] = useState(defaultLista);
  const [precio, setPrecio] = useState(null);
  const qtyRef = useRef(null);
  const maxStock = stockDisponible ?? producto.stkactual;

  useEffect(() => {
    setListaId(defaultLista);
  }, [defaultLista]);

  useEffect(() => {
    const fetchPrecio = async () => {
      if (!listaId) {
        setPrecio(null);
        return;
      }
      try {
        const params = { codproducto: producto._id, lista: listaId };
        const { data } = await api.get('/precios', { params });
        const item = (data.precios || []).find((p) => {
          const prodId = p.codproducto?._id ?? p.codproducto;
          const lista = p.lista?._id ?? p.lista;
          return prodId === producto._id && lista === listaId;
        });
        setPrecio(item?.preciototalventa ?? null);
      } catch (err) {
        console.error('Error al obtener precio', err);
        setPrecio(null);
      }
    };
    fetchPrecio();
  }, [listaId, producto._id]);

  const handleAdd = () => {
    const qty = Number(cantidad);
    if (qty > maxStock) {
      alert('Stock insuficiente');
      return;
    }
    onAdd && onAdd({ producto, cantidad: qty, lista: listaId, precio });
  };

  useEffect(() => {
    if (focused && qtyRef.current) {
      qtyRef.current.focus();
    }
  }, [focused]);

  return (
    <Card sx={focused ? { outline: '2px solid', outlineColor: 'primary.main' } : undefined}>
      {producto.imagen ? (
        <CardMedia component="img" height="140" image={producto.imagen} alt={producto.descripcion} />
      ) : (
        <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.200' }}>
          <ImageIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
        </Box>
      )}
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>{producto.descripcion}</Typography>
        <Typography
          variant="body2"
          color={maxStock === 0 ? 'warning.main' : 'text.secondary'}
          sx={{ mb: 1 }}
        >
          Stock: {maxStock}
        </Typography>
        <TextField
          label="Cantidad"
          type="number"
          size="small"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          inputRef={qtyRef}
          inputProps={{ min: 1, max: maxStock }}
          sx={{ mb: 1 }}
          disabled={maxStock <= 0}
        />
        <Select
          size="small"
          value={listaId}
          displayEmpty
          onChange={(e) => setListaId(e.target.value)}
          sx={{ mb: 1, minWidth: 120 }}
        >
          <MenuItem value=""><em>Lista</em></MenuItem>
          {listas.map((l) => (
            <MenuItem key={l._id} value={l._id}>{l.lista || l.nombre}</MenuItem>
          ))}
        </Select>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Precio: {precio != null ? `$${precio}` : '-'}
        </Typography>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!listaId || precio == null || maxStock <= 0}
        >
          Agregar
        </Button>
      </CardContent>
    </Card>
  );
}

