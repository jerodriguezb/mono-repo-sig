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
  const mediaHeight = 112;
  const iconSize = 48;
  const contentPadding = 1.5;
  const contentSpacing = 0.8;
  const selectMinWidth = 96;

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
    <Card
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...(focused ? { outline: '2px solid', outlineColor: 'primary.main' } : {}),
      }}
    >
      {producto.imagen ? (
        <CardMedia
          component="img"
          sx={{ height: mediaHeight }}
          image={producto.imagen}
          alt={producto.descripcion}
        />
      ) : (
        <Box
          sx={{
            height: mediaHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'grey.200',
          }}
        >
          <ImageIcon sx={{ fontSize: iconSize, color: 'text.secondary' }} />
        </Box>
      )}
      <CardContent
        sx={{
          p: contentPadding,
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: contentSpacing,
          '&:last-child': { pb: contentPadding },
        }}
      >
        <Typography variant="subtitle1">{producto.descripcion}</Typography>
        <Typography
          variant="body2"
          color={maxStock === 0 ? 'warning.main' : 'text.secondary'}
        >
          Stock: {maxStock}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: contentSpacing,
            flexGrow: 1,
          }}
        >
          <TextField
            label="Cantidad"
            type="number"
            size="small"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            inputRef={qtyRef}
            inputProps={{ min: 1, max: maxStock }}
            disabled={maxStock <= 0}
          />
          <Select
            size="small"
            value={listaId}
            displayEmpty
            onChange={(e) => setListaId(e.target.value)}
            sx={{ minWidth: selectMinWidth }}
          >
            <MenuItem value=""><em>Lista</em></MenuItem>
            {listas.map((l) => (
              <MenuItem key={l._id} value={l._id}>{l.lista || l.nombre}</MenuItem>
            ))}
          </Select>
          <Typography variant="body2">
            Precio: {precio != null ? `$${precio}` : '-'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={!listaId || precio == null || maxStock <= 0}
          sx={{ alignSelf: 'flex-start' }}
        >
          Agregar
        </Button>
      </CardContent>
    </Card>
  );
}

