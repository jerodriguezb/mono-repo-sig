import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  LinearProgress,
  Link,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import dayjs from 'dayjs';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';
import ItemsModal from '../components/logistics/ItemsModal.jsx';
import LogisticsActionDialog from '../components/logistics/LogisticsActionDialog.jsx';
import DeleteConfirmationDialog from '../components/logistics/DeleteConfirmationDialog.jsx';

const PAGE_SIZE = 20;
const columnHelper = createColumnHelper();

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

const sumDelivered = (items = []) =>
  items.reduce((acc, item) => acc + Number(item?.cantidadentregada ?? 0), 0);

const sumDeliveredTotal = (items = []) =>
  items.reduce(
    (acc, item) =>
      acc + Number(item?.cantidadentregada ?? 0) * Number(item?.monto ?? 0),
    0,
  );

const sumRequestedTotal = (items = []) =>
  items.reduce(
    (acc, item) => acc + Number(item?.cantidad ?? 0) * Number(item?.monto ?? 0),
    0,
  );

const resolvePrecioTotal = (comanda) => {
  if (comanda?.precioTotal !== undefined && comanda?.precioTotal !== null) {
    return Number(comanda.precioTotal) || 0;
  }
  return sumRequestedTotal(comanda?.items);
};

const extractPrimaryProduct = (items = []) => items?.[0]?.codprod?.descripcion ?? '—';

const buildOption = (entity, labelFn) => {
  if (!entity?._id) return null;
  return {
    id: entity._id,
    label: labelFn(entity),
    raw: entity,
  };
};

const safeGetFilterValue = (column) => column?.getFilterValue?.() ?? null;

export default function LogisticsPage() {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [itemsModal, setItemsModal] = useState({ open: false, comanda: null });
  const [logisticsDialog, setLogisticsDialog] = useState({ open: false, comandas: [] });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, comandas: [] });
  const [savingLogistics, setSavingLogistics] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [estados, setEstados] = useState([]);
  const [camiones, setCamiones] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [camioneros, setCamioneros] = useState([]);

  const [clienteOptions, setClienteOptions] = useState([]);
  const [productoOptions, setProductoOptions] = useState([]);
  const [usuarioOptions, setUsuarioOptions] = useState([]);
  const clienteCache = useRef(new Map());
  const productoCache = useRef(new Map());
  const clienteAbort = useRef(null);
  const productoAbort = useRef(null);
  const clienteTimer = useRef(null);
  const productoTimer = useRef(null);
  const camioneroTimer = useRef(null);
  const usuarioTimer = useRef(null);

  const collator = useMemo(() => new Intl.Collator('es', { sensitivity: 'base', numeric: true }), []);

  const columns = useMemo(() => [
      {
        id: 'select',
        size: 48,
        header: ({ table: tbl }) => (
          <Checkbox
            indeterminate={tbl.getIsSomePageRowsSelected()}
            checked={tbl.getIsAllPageRowsSelected()}
            onChange={tbl.getToggleAllPageRowsSelectedHandler()}
            inputProps={{ 'aria-label': 'Seleccionar todas las comandas de la página' }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            indeterminate={row.getIsSomeSelected()}
            onChange={row.getToggleSelectedHandler()}
            inputProps={{ 'aria-label': `Seleccionar comanda ${row.original?.nrodecomanda ?? ''}` }}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: 'center' },
      },
      columnHelper.accessor('nrodecomanda', {
        id: 'nrodecomanda',
        header: 'Nro. Comanda',
        cell: (info) => info.getValue() ?? '—',
        meta: { align: 'left' },
        enableSorting: true,
      }),
      columnHelper.accessor(
        (row) => row?.codcli?.razonsocial ?? '',
        {
          id: 'cliente',
          header: 'Cliente',
          cell: (info) => info.getValue() || '—',
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            collator.compare(rowA.original?.codcli?.razonsocial ?? '', rowB.original?.codcli?.razonsocial ?? ''),
        },
      ),
      columnHelper.accessor(
        (row) => extractPrimaryProduct(row?.items),
        {
          id: 'producto',
          header: 'Producto principal',
          cell: (info) => {
            const descripcion = info.getValue();
            return (
              <Link
                component="button"
                onClick={() => setItemsModal({ open: true, comanda: info.row.original })}
                underline="hover"
                sx={{ fontWeight: 500 }}
              >
                {descripcion}
              </Link>
            );
          },
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            collator.compare(
              extractPrimaryProduct(rowA.original?.items),
              extractPrimaryProduct(rowB.original?.items),
            ),
        },
      ),
      columnHelper.accessor(
        (row) => row?.fecha ?? null,
        {
          id: 'fecha',
          header: 'Fecha',
          cell: (info) => (info.getValue() ? dayjs(info.getValue()).format('DD/MM/YYYY') : '—'),
          meta: { align: 'center' },
          enableSorting: true,
          sortingFn: (rowA, rowB) => {
            const dateA = rowA.original?.fecha ? new Date(rowA.original.fecha).getTime() : 0;
            const dateB = rowB.original?.fecha ? new Date(rowB.original.fecha).getTime() : 0;
            return dateA - dateB;
          },
        },
      ),
      columnHelper.accessor(
        (row) => sumDelivered(row?.items),
        {
          id: 'cantidadEntregada',
          header: 'Cant. entregada',
          cell: (info) => numberFormatter.format(info.getValue() ?? 0),
          meta: { align: 'right' },
          enableSorting: true,
          sortingFn: (rowA, rowB) => sumDelivered(rowA.original?.items) - sumDelivered(rowB.original?.items),
        },
      ),
      columnHelper.accessor(
        (row) => resolvePrecioTotal(row),
        {
          id: 'precioTotal',
          header: 'Precio total',
          cell: (info) => currencyFormatter.format(info.getValue() ?? 0),
          meta: { align: 'right' },
          enableSorting: true,
          sortingFn: (rowA, rowB) => resolvePrecioTotal(rowA.original) - resolvePrecioTotal(rowB.original),
        },
      ),
      columnHelper.accessor(
        (row) => sumDeliveredTotal(row?.items),
        {
          id: 'totalEntregado',
          header: 'Total entregado',
          cell: (info) => currencyFormatter.format(info.getValue() ?? 0),
          meta: { align: 'right' },
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            sumDeliveredTotal(rowA.original?.items) - sumDeliveredTotal(rowB.original?.items),
        },
      ),
      columnHelper.accessor(
        (row) => row?.codestado?.estado ?? '',
        {
          id: 'estado',
          header: 'Estado',
          cell: (info) => info.getValue() || '—',
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            collator.compare(rowA.original?.codestado?.estado ?? '', rowB.original?.codestado?.estado ?? ''),
        },
      ),
      columnHelper.accessor(
        (row) => row?.codcli?.ruta?.ruta ?? row?.camion?.ruta ?? '',
        {
          id: 'ruta',
          header: 'Ruta',
          cell: (info) => info.getValue() || '—',
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            collator.compare(
              rowA.original?.codcli?.ruta?.ruta ?? rowA.original?.camion?.ruta ?? '',
              rowB.original?.codcli?.ruta?.ruta ?? rowB.original?.camion?.ruta ?? '',
            ),
        },
      ),
      columnHelper.accessor(
        (row) => {
          const camionero = row?.camionero;
          return camionero ? `${camionero?.nombres ?? ''} ${camionero?.apellidos ?? ''}`.trim() : '';
        },
        {
          id: 'camionero',
          header: 'Camionero',
          cell: (info) => info.getValue() || '—',
          enableSorting: true,
          sortingFn: (rowA, rowB) => {
            const nombreA = rowA.original?.camionero
              ? `${rowA.original.camionero?.nombres ?? ''} ${rowA.original.camionero?.apellidos ?? ''}`.trim()
              : '';
            const nombreB = rowB.original?.camionero
              ? `${rowB.original.camionero?.nombres ?? ''} ${rowB.original.camionero?.apellidos ?? ''}`.trim()
              : '';
            return collator.compare(nombreA, nombreB);
          },
        },
      ),
      columnHelper.accessor(
        (row) => row?.puntoDistribucion ?? row?.camion?.camion ?? '',
        {
          id: 'puntoDistribucion',
          header: 'Punto de distribución',
          cell: (info) => info.getValue() || '—',
          enableSorting: true,
          sortingFn: (rowA, rowB) =>
            collator.compare(
              rowA.original?.puntoDistribucion ?? rowA.original?.camion?.camion ?? '',
              rowB.original?.puntoDistribucion ?? rowB.original?.camion?.camion ?? '',
            ),
        },
      ),
      columnHelper.accessor(
        (row) => {
          const usuario = row?.usuario;
          return usuario ? `${usuario?.nombres ?? ''} ${usuario?.apellidos ?? ''}`.trim() : '';
        },
        {
          id: 'usuario',
          header: 'Usuario',
          cell: (info) => info.getValue() || '—',
          enableSorting: true,
          sortingFn: (rowA, rowB) => {
            const nombreA = rowA.original?.usuario
              ? `${rowA.original.usuario?.nombres ?? ''} ${rowA.original.usuario?.apellidos ?? ''}`.trim()
              : '';
            const nombreB = rowB.original?.usuario
              ? `${rowB.original.usuario?.nombres ?? ''} ${rowB.original.usuario?.apellidos ?? ''}`.trim()
              : '';
            return collator.compare(nombreA, nombreB);
          },
        },
      ),
      columnHelper.display({
        id: 'acciones',
        header: 'Acciones',
        cell: ({ row }) => (
          <Stack direction="row" spacing={1} justifyContent="center">
            <Tooltip title="Gestionar logística">
              <IconButton
                color="primary"
                onClick={() => setLogisticsDialog({ open: true, comandas: [row.original] })}
              >
                <LocalShippingIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar comanda">
              <IconButton
                color="error"
                onClick={() => setDeleteDialog({ open: true, comandas: [row.original] })}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: 'center' },
      }),
    ], [collator]);

  const handleSortingChange = useCallback((updater) => {
    setSorting((prev) => {
      const nextSorting = typeof updater === 'function' ? updater(prev) : updater;
      if (!Array.isArray(nextSorting) || nextSorting.length === 0) {
        return [];
      }
      const latest = nextSorting[nextSorting.length - 1];
      return latest ? [latest] : [];
    });
    setPage(1);
  }, []);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      rowSelection,
      sorting,
    },
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualSorting: true,
    enableRowSelection: true,
    getRowId: (row) => row?._id ?? String(row?.nrodecomanda ?? Math.random()),
  });

  const selectedComandas = table.getSelectedRowModel().flatRows.map((row) => row.original);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const buildParamsFromFilters = useCallback(() => {
    const params = { page, limit: PAGE_SIZE };
    const sortingColumnMap = {
      nrodecomanda: 'nrodecomanda',
      fecha: 'fecha',
      estado: 'codestado',
      puntoDistribucion: 'puntoDistribucion',
      cliente: 'codcli',
      precioTotal: 'precioTotal',
      ruta: 'ruta',
      camionero: 'camionero',
      usuario: 'usuario',
    };
    const [currentSorting] = sorting;
    if (currentSorting) {
      const sortField = sortingColumnMap[currentSorting.id];
      if (sortField) {
        params.sortField = sortField;
        params.sortOrder = currentSorting.desc ? 'desc' : 'asc';
      }
    }
    columnFilters.forEach(({ id, value }) => {
      if (!value && value !== 0) return;
      switch (id) {
        case 'nrodecomanda':
          if (value) params.nrocomanda = value;
          break;
        case 'cliente':
          if (value?.id) params.cliente = value.id;
          break;
        case 'producto':
          if (value?.id) params.producto = value.id;
          break;
        case 'fecha':
          if (value?.desde) params.fechaDesde = value.desde;
          if (value?.hasta) params.fechaHasta = value.hasta;
          break;
        case 'ruta':
          if (value?.id) params.ruta = value.id;
          break;
        case 'camionero':
          if (value?.id) params.camionero = value.id;
          break;
        case 'estado':
          if (value?.id) params.estado = value.id;
          break;
        case 'usuario':
          if (value?.id) params.usuario = value.id;
          break;
        case 'puntoDistribucion':
          if (value) params.puntoDistribucion = value;
          break;
        default:
          break;
      }
    });
    return params;
  }, [columnFilters, page, sorting]);

  const fetchComandas = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParamsFromFilters();
      const { data: response } = await api.get('/comandas/logistica', { params });
      setData(response.comandas ?? []);
      setTotal(response.total ?? 0);
      setTotalPages(response.totalPages ?? 0);
      setRowSelection({});
    } catch (error) {
      console.error('Error obteniendo comandas activas', error);
      showSnackbar('No se pudieron obtener las comandas activas', 'error');
    } finally {
      setLoading(false);
    }
  }, [buildParamsFromFilters]);

  useEffect(() => {
    fetchComandas();
  }, [fetchComandas]);

  useEffect(() => {
    const loadStaticData = async () => {
      try {
        const [estadosRes, rutasRes, camionesRes, camionerosRes, usuariosRes] = await Promise.all([
          api.get('/estados'),
          api.get('/rutas', { params: { limite: 200 } }),
          api.get('/camiones', { params: { limite: 200 } }),
          api.get('/usuarios/camioneros'),
          api.get('/usuarios/lookup'),
        ]);
        setEstados(estadosRes.data.estados ?? []);
        setRutas(rutasRes.data.rutas ?? []);
        setCamiones(camionesRes.data.camiones ?? []);
        setCamioneros(camionerosRes.data.usuarios ?? []);
        setUsuarioOptions(
          (usuariosRes.data.usuarios ?? [])
            .map((usuario) => buildOption(usuario, (u) => `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim()))
            .filter(Boolean),
        );
      } catch (error) {
        console.error('Error cargando datos iniciales', error);
        showSnackbar('No se pudieron cargar algunos datos auxiliares', 'warning');
      }
    };
    loadStaticData();
  }, []);

  useEffect(() => () => {
    if (clienteTimer.current) clearTimeout(clienteTimer.current);
    if (clienteAbort.current) clienteAbort.current.abort();
    if (productoTimer.current) clearTimeout(productoTimer.current);
    if (productoAbort.current) productoAbort.current.abort();
    if (camioneroTimer.current) clearTimeout(camioneroTimer.current);
    if (usuarioTimer.current) clearTimeout(usuarioTimer.current);
  }, []);

  const handleClienteInput = useCallback((_, value) => {
    if (clienteTimer.current) clearTimeout(clienteTimer.current);
    if (clienteAbort.current) clienteAbort.current.abort();

    if (!value || value.length < 3) {
      setClienteOptions([]);
      return;
    }

    if (clienteCache.current.has(value)) {
      setClienteOptions(clienteCache.current.get(value));
      return;
    }

    clienteTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      clienteAbort.current = controller;
      try {
        const { data: response } = await api.get('/clientes/autocomplete', {
          params: { term: value },
          signal: controller.signal,
        });
        const options = (response.clientes ?? [])
          .map((cliente) => buildOption(cliente, (c) => c.razonsocial ?? '—'))
          .filter(Boolean);
        clienteCache.current.set(value, options);
        setClienteOptions(options);
      } catch (error) {
        if (error?.code !== 'ERR_CANCELED') {
          console.error('Error buscando clientes', error);
        }
      }
    }, 350);
  }, []);

  const handleProductoInput = useCallback((_, value) => {
    if (productoTimer.current) clearTimeout(productoTimer.current);
    if (productoAbort.current) productoAbort.current.abort();

    if (!value || value.length < 3) {
      setProductoOptions([]);
      return;
    }

    if (productoCache.current.has(value)) {
      setProductoOptions(productoCache.current.get(value));
      return;
    }

    productoTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      productoAbort.current = controller;
      try {
        const { data: response } = await api.get('/producservs/lookup', {
          params: { q: value, limit: 20 },
          signal: controller.signal,
        });
        const options = (response.producservs ?? [])
          .map((prod) => buildOption(prod, (p) => p.descripcion ?? '—'))
          .filter(Boolean);
        productoCache.current.set(value, options);
        setProductoOptions(options);
      } catch (error) {
        if (error?.code !== 'ERR_CANCELED') {
          console.error('Error buscando productos', error);
        }
      }
    }, 350);
  }, []);

  const handleCamioneroInput = useCallback((_, value) => {
    if (camioneroTimer.current) clearTimeout(camioneroTimer.current);
    camioneroTimer.current = setTimeout(async () => {
      try {
        const { data: response } = await api.get('/usuarios/camioneros', {
          params: value && value.length >= 2 ? { term: value } : {},
        });
        setCamioneros(response.usuarios ?? []);
      } catch (error) {
        console.error('Error buscando camioneros', error);
      }
    }, 300);
  }, []);

  const handleUsuarioInput = useCallback((_, value) => {
    if (usuarioTimer.current) clearTimeout(usuarioTimer.current);
    usuarioTimer.current = setTimeout(async () => {
      try {
        const { data: response } = await api.get('/usuarios/lookup', {
          params: value && value.length >= 2 ? { term: value } : {},
        });
        setUsuarioOptions(
          (response.usuarios ?? [])
            .map((usuario) => buildOption(usuario, (u) => `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim()))
            .filter(Boolean),
        );
      } catch (error) {
        console.error('Error buscando usuarios', error);
      }
    }, 300);
  }, []);

  const handleLogisticsSubmit = async ({ estado, camionero, camion, puntoDistribucion }) => {
    if (!estado) {
      showSnackbar('Seleccioná un estado logístico', 'warning');
      return;
    }
    setSavingLogistics(true);
    try {
      const payload = {
        codestado: estado,
        puntoDistribucion: puntoDistribucion ?? '',
      };
      if (camionero) payload.camionero = camionero;
      if (camion) payload.camion = camion;

      await Promise.all(
        (logisticsDialog.comandas ?? []).map((comanda) =>
          api.put(`/comandas/${comanda._id}`, payload),
        ),
      );
      showSnackbar('Actualización logística completada');
      setLogisticsDialog({ open: false, comandas: [] });
      fetchComandas();
    } catch (error) {
      console.error('Error actualizando logística', error);
      showSnackbar('No se pudo actualizar la logística', 'error');
    } finally {
      setSavingLogistics(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await Promise.all(
        (deleteDialog.comandas ?? []).map((comanda) => api.delete(`/comandas/${comanda._id}`)),
      );
      showSnackbar('Comandas eliminadas correctamente');
      setDeleteDialog({ open: false, comandas: [] });
      fetchComandas();
    } catch (error) {
      console.error('Error eliminando comandas', error);
      showSnackbar('No se pudieron eliminar las comandas', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Nro Comanda',
      'Cliente',
      'Producto principal',
      'Fecha',
      'Cantidad entregada',
      'Precio total',
      'Total entregado',
      'Estado',
      'Ruta',
      'Camionero',
      'Punto de distribución',
      'Usuario',
    ];

    const rows = data.map((comanda) => [
      comanda?.nrodecomanda ?? '',
      comanda?.codcli?.razonsocial ?? '',
      extractPrimaryProduct(comanda?.items),
      comanda?.fecha ? dayjs(comanda.fecha).format('DD/MM/YYYY') : '',
      numberFormatter.format(sumDelivered(comanda?.items)),
      currencyFormatter.format(resolvePrecioTotal(comanda)),
      currencyFormatter.format(sumDeliveredTotal(comanda?.items)),
      comanda?.codestado?.estado ?? '',
      comanda?.codcli?.ruta?.ruta ?? comanda?.camion?.ruta ?? '',
      comanda?.camionero
        ? `${comanda.camionero?.nombres ?? ''} ${comanda.camionero?.apellidos ?? ''}`.trim()
        : '',
      comanda?.puntoDistribucion ?? comanda?.camion?.camion ?? '',
      comanda?.usuario
        ? `${comanda.usuario?.nombres ?? ''} ${comanda.usuario?.apellidos ?? ''}`.trim()
        : '',
    ]);

    const content = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(';'),
      )
      .join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `logistica_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Comandas activas — Logística', 40, 30);
    const head = [[
      'Nro',
      'Cliente',
      'Producto',
      'Fecha',
      'Cant. entregada',
      'Precio total',
      'Total entregado',
      'Estado',
      'Ruta',
      'Camionero',
      'Punto de distribución',
      'Usuario',
    ]];
    const body = data.map((comanda) => [
      comanda?.nrodecomanda ?? '',
      comanda?.codcli?.razonsocial ?? '',
      extractPrimaryProduct(comanda?.items),
      comanda?.fecha ? dayjs(comanda.fecha).format('DD/MM/YYYY') : '',
      numberFormatter.format(sumDelivered(comanda?.items)),
      currencyFormatter.format(resolvePrecioTotal(comanda)),
      currencyFormatter.format(sumDeliveredTotal(comanda?.items)),
      comanda?.codestado?.estado ?? '',
      comanda?.codcli?.ruta?.ruta ?? comanda?.camion?.ruta ?? '',
      comanda?.camionero
        ? `${comanda.camionero?.nombres ?? ''} ${comanda.camionero?.apellidos ?? ''}`.trim()
        : '',
      comanda?.puntoDistribucion ?? comanda?.camion?.camion ?? '',
      comanda?.usuario
        ? `${comanda.usuario?.nombres ?? ''} ${comanda.usuario?.apellidos ?? ''}`.trim()
        : '',
    ]);
    autoTable(doc, {
      startY: 50,
      head,
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185] },
      alternateRowStyles: { fillColor: [243, 246, 249] },
    });
    doc.save(`logistica_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`);
  };

  const handleClearFilters = () => {
    table.resetColumnFilters();
    table.resetSorting();
    setColumnFilters([]);
    setSorting([]);
    setPage(1);
  };

  const handleReload = () => {
    fetchComandas();
  };

  const clienteColumn = table.getColumn('cliente');
  const productoColumn = table.getColumn('producto');
  const fechaColumn = table.getColumn('fecha');
  const rutaColumn = table.getColumn('ruta');
  const camioneroColumn = table.getColumn('camionero');
  const estadoColumn = table.getColumn('estado');
  const usuarioColumn = table.getColumn('usuario');
  const puntoDistribucionColumn = table.getColumn('puntoDistribucion');
  const nroColumn = table.getColumn('nrodecomanda');

  const clienteValue = safeGetFilterValue(clienteColumn);
  const productoValue = safeGetFilterValue(productoColumn);
  const rutaValue = safeGetFilterValue(rutaColumn);
  const camioneroValue = safeGetFilterValue(camioneroColumn);
  const estadoValue = safeGetFilterValue(estadoColumn);
  const usuarioValue = safeGetFilterValue(usuarioColumn);
  const fechaValue = safeGetFilterValue(fechaColumn) || { desde: '', hasta: '' };
  const puntoDistribucionValue = safeGetFilterValue(puntoDistribucionColumn) ?? '';
  const nroValue = safeGetFilterValue(nroColumn) ?? '';

  const estadoOptions = useMemo(
    () => estados.map((estado) => buildOption(estado, (e) => e.estado ?? '—')).filter(Boolean),
    [estados],
  );
  const rutaOptions = useMemo(
    () => rutas.map((ruta) => buildOption(ruta, (r) => r.ruta ?? '—')).filter(Boolean),
    [rutas],
  );
  const camioneroOptions = useMemo(
    () => camioneros.map((camionero) => buildOption(camionero, (u) => `${u.nombres ?? ''} ${u.apellidos ?? ''}`.trim())).filter(Boolean),
    [camioneros],
  );
  const camionOptions = useMemo(
    () => camiones.map((camion) => buildOption(camion, (c) => c.camion ?? '—')).filter(Boolean),
    [camiones],
  );
  const puntoDistribucionOption = puntoDistribucionValue
    ? { id: puntoDistribucionValue, label: puntoDistribucionValue }
    : null;
  const puntoDistribucionOptions = useMemo(
    () => camionOptions.map((option) => ({ id: option.label, label: option.label })),
    [camionOptions],
  );

  const handlePageChange = (_, value) => {
    setPage(value);
  };

  useEffect(() => {
    setPage(1);
  }, [columnFilters]);

  const ensureOptionPresence = useCallback((optionsList, value) => {
    if (!value) return optionsList;
    const exists = optionsList.some((opt) => opt?.id === value?.id);
    return exists ? optionsList : [value, ...optionsList];
  }, []);

  const handleDateChange = (key, newValue) => {
    const current = fechaColumn?.getFilterValue?.() || {};
    const next = { ...current, [key]: newValue || undefined };
    if (!next.desde && !next.hasta) {
      fechaColumn?.setFilterValue(undefined);
    } else {
      fechaColumn?.setFilterValue(next);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">Logística</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCsv}>
            Exportar CSV
          </Button>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={handleExportPdf}>
            Exportar PDF
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleReload}>
            Recargar
          </Button>
          <Button variant="outlined" startIcon={<CleaningServicesIcon />} onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: 'repeat(1, minmax(0, 1fr))',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(15, minmax(0, 1fr))',
            },
          }}
        >
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <TextField
              type="date"
              label="Fecha desde"
              InputLabelProps={{ shrink: true }}
              value={fechaValue?.desde ?? ''}
              onChange={(event) => handleDateChange('desde', event.target.value)}
              fullWidth
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <TextField
              type="date"
              label="Fecha hasta"
              InputLabelProps={{ shrink: true }}
              value={fechaValue?.hasta ?? ''}
              onChange={(event) => handleDateChange('hasta', event.target.value)}
              fullWidth
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <Autocomplete
              sx={{ width: '100%' }}
              value={estadoValue}
              options={ensureOptionPresence(estadoOptions, estadoValue)}
              onChange={(_, value) => estadoColumn?.setFilterValue(value ?? undefined)}
              renderInput={(params) => <TextField {...params} label="Estado" placeholder="Seleccionar estado" />}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <Autocomplete
              sx={{ width: '100%' }}
              value={rutaValue}
              options={ensureOptionPresence(rutaOptions, rutaValue)}
              onChange={(_, value) => rutaColumn?.setFilterValue(value ?? undefined)}
              renderInput={(params) => <TextField {...params} label="Ruta" placeholder="Seleccionar ruta" />}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <Autocomplete
              sx={{ width: '100%' }}
              value={camioneroValue}
              options={ensureOptionPresence(camioneroOptions, camioneroValue)}
              onChange={(_, value) => camioneroColumn?.setFilterValue(value ?? undefined)}
              onInputChange={handleCamioneroInput}
              renderInput={(params) => <TextField {...params} label="Camionero" placeholder="Buscar" />}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <Autocomplete
              sx={{ width: '100%' }}
              value={puntoDistribucionOption}
              options={ensureOptionPresence(puntoDistribucionOptions, puntoDistribucionOption)}
              freeSolo
              onChange={(_, value) =>
                puntoDistribucionColumn?.setFilterValue(typeof value === 'string' ? value : value?.label ?? undefined)
              }
              onInputChange={(_, value) => puntoDistribucionColumn?.setFilterValue(value || undefined)}
              renderInput={(params) => <TextField {...params} label="Punto de distribución" placeholder="Depósito" />}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <TextField
              label="Nro. de comanda"
              value={nroValue}
              onChange={(event) => nroColumn?.setFilterValue(event.target.value || undefined)}
              fullWidth
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <Autocomplete
              sx={{ width: '100%' }}
              value={clienteValue}
              options={ensureOptionPresence(clienteOptions, clienteValue)}
              onChange={(_, value) => clienteColumn?.setFilterValue(value ?? undefined)}
              onInputChange={handleClienteInput}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Cliente" placeholder="Buscar cliente" />}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <Autocomplete
              sx={{ width: '100%' }}
              value={productoValue}
              options={ensureOptionPresence(productoOptions, productoValue)}
              onChange={(_, value) => productoColumn?.setFilterValue(value ?? undefined)}
              onInputChange={handleProductoInput}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Producto" placeholder="Buscar producto" />}
            />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 1', md: 'span 3' } }}>
            <Autocomplete
              sx={{ width: '100%' }}
              value={usuarioValue}
              options={ensureOptionPresence(usuarioOptions, usuarioValue)}
              onChange={(_, value) => usuarioColumn?.setFilterValue(value ?? undefined)}
              onInputChange={handleUsuarioInput}
              renderInput={(params) => <TextField {...params} label="Usuario" placeholder="Buscar usuario" />}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Box>
        </Box>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {selectedComandas.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">
              {selectedComandas.length} comandas seleccionadas
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                startIcon={<LocalShippingIcon />}
                variant="contained"
                color="primary"
                onClick={() => setLogisticsDialog({ open: true, comandas: selectedComandas })}
              >
                Asignar logística
              </Button>
              <Button
                startIcon={<DeleteOutlineIcon />}
                variant="outlined"
                color="error"
                onClick={() => setDeleteDialog({ open: true, comandas: selectedComandas })}
              >
                Eliminar seleccionadas
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Paper sx={{ overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell
                      key={header.id}
                      align={header.column.columnDef.meta?.align ?? 'left'}
                      sx={{ fontWeight: 600, bgcolor: 'grey.100' }}
                    >
                      {header.isPlaceholder
                        ? null
                        : header.column.getCanSort()
                        ? (
                            <TableSortLabel
                              active={!!header.column.getIsSorted()}
                              direction={header.column.getIsSorted() === 'desc' ? 'desc' : 'asc'}
                              onClick={header.column.getToggleSortingHandler()}
                              hideSortIcon={!header.column.getIsSorted()}
                              sx={{
                                justifyContent:
                                  (header.column.columnDef.meta?.align ?? 'left') === 'right'
                                    ? 'flex-end'
                                    : (header.column.columnDef.meta?.align ?? 'left') === 'center'
                                    ? 'center'
                                    : 'flex-start',
                                alignItems: 'center',
                                display: 'flex',
                                width: '100%',
                              }}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </TableSortLabel>
                          )
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {data.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={table.getAllColumns().length} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No se encontraron comandas activas con los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{ bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50' }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} align={cell.column.columnDef.meta?.align ?? 'left'}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Página {page} de {totalPages} — {total} resultados
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              disabled={page <= 1}
              onClick={() => handlePageChange(null, page - 1)}
            >
              Anterior
            </Button>
            <Typography variant="body2">{page}</Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(null, page + 1)}
            >
              Siguiente
            </Button>
          </Stack>
        </Box>
      </Paper>

      <ItemsModal
        open={itemsModal.open}
        comanda={itemsModal.comanda}
        onClose={() => setItemsModal({ open: false, comanda: null })}
      />

      <LogisticsActionDialog
        open={logisticsDialog.open}
        comandas={logisticsDialog.comandas}
        onClose={() => setLogisticsDialog({ open: false, comandas: [] })}
        onSubmit={handleLogisticsSubmit}
        estados={estados}
        camioneros={camioneros}
        camiones={camiones}
        loading={savingLogistics}
      />

      <DeleteConfirmationDialog
        open={deleteDialog.open}
        comandas={deleteDialog.comandas}
        onClose={() => setDeleteDialog({ open: false, comandas: [] })}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
