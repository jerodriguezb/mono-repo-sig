import React, { useEffect, useReducer, useState, useRef, useCallback } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Select,
  MenuItem,
  Grid,
  Box,
  Pagination,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemText,
  Button,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ProductoItem from '../components/ProductoItem.jsx';
import ResumenComanda from '../components/ResumenComanda.jsx';
import api from '../api/axios.js';

const ESTADO_A_PREPARAR = '62200265c811f41820d8bda9';

export default function ComandasPage() {
  const [productos, setProductos] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [listas, setListas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [rubroSel, setRubroSel] = useState('');
  const [listaSel, setListaSel] = useState('');
  const [clienteSel, setClienteSel] = useState(null);
  const [clienteInput, setClienteInput] = useState('');
  const [clienteOpts, setClienteOpts] = useState([]);
  const clienteCache = useRef(new Map());
  const [clienteLoading, setClienteLoading] = useState(false);
  const [clienteNoOpts, setClienteNoOpts] = useState('Escribí al menos 3 caracteres…');
  const clienteAbort = useRef(null);
  const clienteTimer = useRef(null);
  const [page, setPage] = useState(1); // 1-based
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState('grid');
  const [focusedProdId, setFocusedProdId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [savedComanda, setSavedComanda] = useState(null);
  const scanBufferRef = useRef('');
  const itemsReducer = (state, action) => {
    switch (action.type) {
      case 'add': {
        const { codprod, lista, cantidad, precio, descripcion, stock } = action.payload;
        const idx = state.findIndex((i) => i.codprod === codprod && i.lista === lista);
        if (idx > -1) {
          return state.map((i, n) => (n === idx ? { ...i, cantidad: i.cantidad + cantidad } : i));
        }
        return [...state, { codprod, lista, cantidad, precio, descripcion, stock }];
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
      case 'clear':
        return [];
      default:
        return state;
    }
  };
  const [items, dispatch] = useReducer(itemsReducer, []);

  const canSubmit = items.length > 0 && clienteSel && !isSaving;

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

  const handleClienteInput = useCallback((_, val) => {
    setClienteInput(val);
    if (clienteTimer.current) clearTimeout(clienteTimer.current);

    clienteTimer.current = setTimeout(async () => {
      if (clienteAbort.current) clienteAbort.current.abort();

      if (!val || val.length < 3) {
        setClienteOpts([]);
        setClienteLoading(false);
        setClienteNoOpts('Escribí al menos 3 caracteres…');
        return;
      }

      if (clienteCache.current.has(val)) {
        setClienteOpts(clienteCache.current.get(val));
        setClienteLoading(false);
        setClienteNoOpts('Sin resultados');
        return;
      }

      setClienteLoading(true);
      setClienteNoOpts('Buscando…');
      const controller = new AbortController();
      clienteAbort.current = controller;
      try {
        const { data } = await api.get('/clientes/autocomplete', {
          params: { term: val },
          signal: controller.signal,
        });
        const clientes = (data.clientes || []).slice(0, 20);
        clienteCache.current.set(val, clientes);
        setClienteOpts(clientes);
        setClienteNoOpts('Sin resultados');
      } catch (err) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Error buscando clientes', err);
        }
      } finally {
        setClienteLoading(false);
      }
    }, 300);
  }, []);

  const handleAdd = ({ producto, cantidad, lista, precio }) => {
    const stock = producto.stkactual;
    const existingTotal = items
      .filter((i) => i.codprod === producto._id)
      .reduce((sum, i) => sum + i.cantidad, 0);
    const newTotal = existingTotal + cantidad;
    if (newTotal > stock) {
      alert('Stock insuficiente');
      return;
    }
    dispatch({
      type: 'add',
      payload: {
        codprod: producto._id,
        lista,
        cantidad,
        precio,
        descripcion: producto.descripcion,
        stock,
      },
    });
  };

  const handleQuickAdd = useCallback(
    async (producto) => {
      if (!listaSel) {
        alert('Seleccione lista');
        return;
      }
      try {
        const params = { codproducto: producto._id, lista: listaSel };
        const { data } = await api.get('/precios', { params });
        const item = (data.precios || []).find((p) => {
          const prodId = p.codproducto?._id ?? p.codproducto;
          const lista = p.lista?._id ?? p.lista;
          return prodId === producto._id && lista === listaSel;
        });
        const precio = item?.preciototalventa ?? null;
        if (precio == null) {
          alert('Precio no disponible');
          return;
        }
        const stock = producto.stkactual;
        const existingTotal = items
          .filter((i) => i.codprod === producto._id)
          .reduce((sum, i) => sum + i.cantidad, 0);
        const newTotal = existingTotal + 1;
        if (newTotal > stock) {
          alert('Stock insuficiente');
          return;
        }
        dispatch({
          type: 'add',
          payload: {
            codprod: producto._id,
            lista: listaSel,
            cantidad: 1,
            precio,
            descripcion: producto.descripcion,
            stock,
          },
        });
      } catch (err) {
        console.error('Error obteniendo precio', err);
      }
    },
    [listaSel, dispatch, items],
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        const code = scanBufferRef.current.trim();
        if (code) {
          const producto = productos.find((p) => p._id === code);
          if (producto) {
            setFocusedProdId(producto._id);
            const el = document.getElementById(`prod-${producto._id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            if (viewMode === 'list') {
              handleQuickAdd(producto);
            }
            setTimeout(() => setFocusedProdId(null), 2000);
          } else {
            alert('Código inexistente');
          }
        }
        scanBufferRef.current = '';
      } else if (e.key.length === 1) {
        scanBufferRef.current += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productos, viewMode, handleQuickAdd]);

  const handleViewModeChange = (_, mode) => {
    if (mode !== null) {
      setViewMode(mode);
    }
  };

  const saveComanda = async () => {
    if (items.length === 0) {
      alert('Agrega productos a la comanda');
      return;
    }
    if (!clienteSel) {
      alert('Seleccione un cliente');
      return;
    }
    const payload = {
      codcli: clienteSel._id,
      fecha: new Date().toISOString(),
      codestado: ESTADO_A_PREPARAR,
      items: items.map(({ codprod, lista, cantidad, precio }) => ({
        codprod,
        lista,
        cantidad,
        monto: precio,
      })),
    };
    try {
      setIsSaving(true);
      const { data } = await api.post('/comandas', payload);
      setSavedComanda({ ...data.comanda, cliente: clienteSel });
      dispatch({ type: 'clear' });
      setBusqueda('');
      setRubroSel('');
      setListaSel('');
      setClienteSel(null);
      setClienteInput('');
      setPage(1);
    } catch (err) {
      console.error('Error confirmando comanda', err);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintClick = () => {
    setSavedComanda(null);
    setPrintDialogOpen(true);
    saveComanda();
  };

  const handleRetry = () => {
    setSaveError(false);
    saveComanda();
  };

  const handleCancel = () => {
    setSaveError(false);
    setPrintDialogOpen(false);
    setSavedComanda(null);
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
        <Autocomplete
          value={clienteSel}
          onChange={(_, val) => setClienteSel(val)}
          inputValue={clienteInput}
          onInputChange={handleClienteInput}
          options={clienteOpts}
          getOptionLabel={(option) => option?.razonsocial || ''}
          isOptionEqualToValue={(opt, val) => opt._id === val._id}
          loading={clienteLoading}
          noOptionsText={clienteNoOpts}
          renderInput={(params) => <TextField {...params} label="Cliente" />}
          sx={{ minWidth: 240 }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Box sx={{ flex: 1 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="grid">Grid</ToggleButton>
            <ToggleButton value="list">List</ToggleButton>
          </ToggleButtonGroup>
          {viewMode === 'grid' ? (
            <Grid container spacing={2}>
              <AnimatePresence>
                {productos.map((p) => {
                  const agregado = items
                    .filter((i) => i.codprod === p._id)
                    .reduce((sum, i) => sum + i.cantidad, 0);
                  return (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={4}
                      lg={3}
                      key={p._id}
                      id={`prod-${p._id}`}
                      component={motion.div}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProductoItem
                        producto={p}
                        listas={listas}
                        defaultLista={listaSel}
                        onAdd={handleAdd}
                        focused={focusedProdId === p._id}
                        stockDisponible={p.stkactual - agregado}
                      />
                    </Grid>
                  );
                })}
              </AnimatePresence>
            </Grid>
          ) : (
            <List>
              <AnimatePresence>
                {productos.map((p) => {
                  const agregado = items
                    .filter((i) => i.codprod === p._id)
                    .reduce((sum, i) => sum + i.cantidad, 0);
                  const stockDisp = p.stkactual - agregado;
                  return (
                    <ListItem
                      key={p._id}
                      id={`prod-${p._id}`}
                      divider
                      selected={focusedProdId === p._id}
                      secondaryAction={
                        <Button
                          variant="contained"
                          onClick={() => handleQuickAdd(p)}
                          disabled={!listaSel || stockDisp <= 0}
                        >
                          Agregar
                        </Button>
                      }
                      component={motion.li}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ListItemText
                        primary={p.descripcion}
                        secondary={`Stock: ${stockDisp}`}
                      />
                    </ListItem>
                  );
                })}
              </AnimatePresence>
            </List>
          )}
          <Pagination
            count={Math.max(1, Math.ceil(total / pageSize))}
            page={page}
            onChange={(_, val) => setPage(val)}
            sx={{ mt: 2, alignSelf: 'center' }}
          />
        </Box>
        <AnimatePresence>
          {items.length > 0 && (
            <motion.div
              key="resumen"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <ResumenComanda
                items={items}
                listas={listas}
                dispatch={dispatch}
                clienteSel={clienteSel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Stack>
      <Button
        variant="contained"
        onClick={handlePrintClick}
        disabled={!canSubmit}
      >
        Imprimir Comanda
      </Button>

      <Dialog open={printDialogOpen} onClose={() => setPrintDialogOpen(false)}>
        <DialogTitle>Comanda</DialogTitle>
        <DialogContent>
          {isSaving && (
            <CircularProgress />
          )}
          {!isSaving && savedComanda && (
            <Box className="print-area">
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="subtitle1">
                  Nº de comanda: {savedComanda.nrodecomanda}
                </Typography>
                <Typography variant="subtitle1">
                  Cliente: {savedComanda?.cliente?.razonsocial || clienteSel?.razonsocial}
                </Typography>
                <List>
                  {(savedComanda.items || []).map((item, idx) => (
                    <ListItem key={idx} disablePadding>
                      <ListItemText
                        primary={item.descripcion || item.codprod}
                        secondary={`Cantidad: ${item.cantidad}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Stack>
            </Box>
          )}
          {!isSaving && !savedComanda && !saveError && (
            <Typography sx={{ mt: 1 }}>
              Cargando información de la comanda…
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintDialogOpen(false)}>Cerrar</Button>
          <Button
            onClick={() => window.print()}
            disabled={isSaving || !savedComanda?.nrodecomanda}
          >
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={saveError}
        onClose={() => setSaveError(false)}
        message="No se pudo grabar la comanda. Intente nuevamente."
        action={
          <>
            <Button color="secondary" size="small" onClick={handleRetry}>
              Reintentar
            </Button>
            <Button color="secondary" size="small" onClick={handleCancel}>
              Cancelar
            </Button>
          </>
        }
      />
    </Stack>
  );
}

