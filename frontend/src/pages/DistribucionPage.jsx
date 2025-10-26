import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Grid,
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
  TablePagination,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';

const columnHelper = createColumnHelper();

const quantityFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

const normalizeText = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const decodeJwtPayload = (token) => {
  if (!token) return null;
  try {
    const [, payload = ''] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('No se pudo decodificar el token JWT', error);
    return null;
  }
};

const clampDelivered = (value, max) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  const sanitized = Math.max(numeric, 0);
  const integerValue = Math.trunc(sanitized);
  const limitValue = Number(max);
  if (!Number.isFinite(limitValue)) {
    return integerValue;
  }
  const limit = Math.trunc(Math.max(limitValue, 0));
  return Math.min(integerValue, limit);
};

const buildRowId = (comandaId, itemId, index) => {
  if (itemId) return `${comandaId}-${itemId}`;
  return `${comandaId}-item-${index}`;
};

export default function DistribucionPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTabletDown = useMediaQuery(theme.breakpoints.down('md'));
  const [authState, setAuthState] = useState({ checking: true, role: null, userId: null });
  const [estadoDistribucionId, setEstadoDistribucionId] = useState(null);
  const [rows, setRows] = useState([]);
  const [comandasById, setComandasById] = useState({});
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [editedRows, setEditedRows] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [massDialog, setMassDialog] = useState({ open: false, value: '', error: '' });
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [clienteSeleccionadoKey, setClienteSeleccionadoKey] = useState(null);
  const [pdfDialogState, setPdfDialogState] = useState({ open: false, data: null });
  const [pdfShareState, setPdfShareState] = useState({
    open: false,
    fileName: '',
    data: null,
  });
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setAuthState({ checking: false, role: null, userId: null });
      return;
    }
    const cleanedToken = storedToken.replace(/^"|"$/g, '');
    const payload = decodeJwtPayload(cleanedToken);
    if (!payload?._id || !payload?.role) {
      setAuthState({ checking: false, role: null, userId: null });
      return;
    }
    setAuthState({ checking: false, role: payload.role, userId: payload._id });
  }, []);

  const transformComandas = useCallback((comandas = []) => {
    const result = [];
    comandas.forEach((comanda) => {
      const clienteNombre = comanda?.codcli?.razonsocial ?? '';
      const items = Array.isArray(comanda?.items) ? comanda.items : [];
      items.forEach((item, index) => {
        const itemId = item?._id ? String(item._id) : null;
        const rowId = buildRowId(comanda?._id ?? `comanda-${index}`, itemId, index);
        const cantidad = Math.trunc(Math.max(Number(item?.cantidad ?? 0), 0));
        const monto = Number(item?.monto ?? 0);
        const cantidadEntregada = clampDelivered(item?.cantidadentregada ?? 0, cantidad);
        const clienteId = comanda?.codcli?._id ? String(comanda.codcli._id) : null;
        const clienteSearchValue = normalizeText(clienteNombre);
        result.push({
          rowId,
          comandaId: comanda?._id ?? null,
          itemId: itemId ?? `item-${index}`,
          nrodecomanda: comanda?.nrodecomanda ?? '',
          clienteNombre,
          clienteId,
          clienteSearchValue,
          productoDescripcion: item?.codprod?.descripcion ?? '',
          cantidad,
          monto,
          total: cantidad * monto,
          cantidadEntregada,
          cantidadEntregadaOriginal: cantidadEntregada,
          totalEntregado: cantidadEntregada * monto,
        });
      });
    });
    return result;
  }, []);

  const fetchEstadoDistribucion = useCallback(async () => {
    const { data } = await api.get('/estados');
    const estados = Array.isArray(data) ? data : data?.estados ?? [];
    const target = estados.find((estado) => normalizeText(estado?.estado ?? estado?.descripcion ?? '') === 'en distribucion');
    if (!target?._id) {
      throw new Error('No se encontró el estado "En distribución".');
    }
    return target._id;
  }, []);

  const fetchComandas = useCallback(async (estadoId, camioneroId) => {
    if (!estadoId || !camioneroId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/comandas', {
        params: { estado: estadoId, camionero: camioneroId },
      });
      const comandas = data?.comandas ?? [];
      const mapped = {};
      comandas.forEach((comanda) => {
        if (comanda?._id) mapped[comanda._id] = comanda;
      });
      setComandasById(mapped);
      setRows(transformComandas(comandas));
      setEditedRows({});
      setRowSelection({});
    } catch (requestError) {
      console.error('Error obteniendo comandas en distribución', requestError);
      const message =
        requestError?.response?.data?.err?.message ||
        requestError?.response?.data?.message ||
        'No se pudieron obtener las comandas en distribución.';
      setError(message);
      setRows([]);
      setEditedRows({});
    } finally {
      setLoading(false);
    }
  }, [transformComandas]);

  useEffect(() => {
    if (authState.checking) return;
    if (authState.role !== 'USER_CAM') return;

    let cancelled = false;
    const loadEstado = async () => {
      try {
        const estadoId = await fetchEstadoDistribucion();
        if (cancelled) return;
        setEstadoDistribucionId(estadoId);
      } catch (stateError) {
        console.error('Error obteniendo estados', stateError);
        if (cancelled) return;
        const message = stateError?.message || 'No se pudieron obtener los estados activos.';
        setError(message);
      }
    };

    loadEstado();

    return () => {
      cancelled = true;
    };
  }, [authState.checking, authState.role, fetchEstadoDistribucion]);

  useEffect(() => {
    if (authState.role !== 'USER_CAM') return;
    if (!estadoDistribucionId || !authState.userId) return;
    fetchComandas(estadoDistribucionId, authState.userId);
  }, [authState.role, authState.userId, estadoDistribucionId, fetchComandas]);

  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const applyDeliveredValue = useCallback((rowUpdates) => {
    if (!rowUpdates || rowUpdates.size === 0) return;

    setRows((prev) =>
      prev.map((row) => {
        const update = rowUpdates.get(row.rowId);
        if (!update) return row;
        const cantidad = Math.trunc(Number(update.cantidad ?? 0));
        return {
          ...row,
          cantidadEntregada: cantidad,
          totalEntregado: cantidad * row.monto,
        };
      }),
    );

    setEditedRows((prev) => {
      const next = { ...prev };
      rowUpdates.forEach((update, rowId) => {
        const baseRow = rows.find((row) => row.rowId === rowId);
        if (!baseRow) return;
        const cantidad = Math.trunc(Number(update.cantidad ?? 0));
        if (cantidad === baseRow.cantidadEntregadaOriginal) {
          delete next[rowId];
        } else {
          next[rowId] = {
            comandaId: baseRow.comandaId,
            itemId: baseRow.itemId,
            cantidadentregada: cantidad,
          };
        }
      });
      return next;
    });
  }, [rows]);

  const handleCantidadEntregadaChange = useCallback((row, rawValue) => {
    const cantidad = clampDelivered(rawValue, row.cantidad);
    const updates = new Map([[row.rowId, { cantidad }]]);
    applyDeliveredValue(updates);
  }, [applyDeliveredValue]);

  const handleMassiveDialogOpen = () => {
    if (table.getSelectedRowModel().rows.length === 0) {
      showSnackbar('Selecciona al menos una fila para aplicar la entrega masiva.', 'info');
      return;
    }
    setMassDialog({ open: true, value: '', error: '' });
  };

  const handleMassDialogClose = () => {
    setMassDialog({ open: false, value: '', error: '' });
  };

  const handleMassDialogConfirm = () => {
    const selectedRows = table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      setMassDialog({ open: false, value: '', error: '' });
      showSnackbar('Selecciona al menos una fila para aplicar la entrega masiva.', 'info');
      return;
    }

    const updates = new Map();
    selectedRows.forEach((tableRow) => {
      const row = tableRow.original;
      const cantidad = clampDelivered(row.cantidad, row.cantidad);
      updates.set(row.rowId, { cantidad });
    });

    applyDeliveredValue(updates);
    setMassDialog({ open: false, value: '', error: '' });
    showSnackbar('Entrega completa aplicada correctamente. Recuerda guardar los cambios.', 'success');
  };

  const handleSaveChanges = async () => {
    const entries = Object.entries(editedRows);
    if (!entries.length) {
      showSnackbar('No hay cambios para guardar.', 'info');
      return;
    }

    const updatesByComanda = new Map();
    entries.forEach(([, value]) => {
      if (!value?.comandaId) return;
      const comandaKey = String(value.comandaId);
      if (!updatesByComanda.has(comandaKey)) {
        updatesByComanda.set(comandaKey, new Map());
      }
      updatesByComanda.get(comandaKey).set(String(value.itemId), Number(value.cantidadentregada ?? 0));
    });

    const rowLookup = new Map(
      rows.map((row) => [`${row.comandaId ?? ''}__${row.itemId ?? ''}`, row]),
    );

    setSaving(true);

    try {
      for (const [comandaId, itemUpdates] of updatesByComanda.entries()) {
        const comanda = comandasById[comandaId];
        if (!comanda) continue;
        const items = Array.isArray(comanda.items) ? comanda.items : [];
        const updatedItems = items.map((item) => {
          const itemId = String(item?._id ?? '');
          const override = itemUpdates.get(itemId);
          let cantidadEntregada = override;
          if (cantidadEntregada === undefined) {
            const rowKey = `${comandaId}__${itemId}`;
            const row = rowLookup.get(rowKey);
            if (row) {
              cantidadEntregada = Number(row.cantidadEntregada ?? 0);
            } else {
              cantidadEntregada = Number(item?.cantidadentregada ?? 0);
            }
          }
          if (cantidadEntregada === undefined) cantidadEntregada = Number(item?.cantidadentregada ?? 0);
          const cantidad = Number(item?.cantidad ?? 0);
          return {
            ...item,
            cantidadentregada: cantidadEntregada,
            entregado: cantidad > 0 ? cantidadEntregada >= cantidad : Boolean(item?.entregado),
          };
        });

        await api.put(`/comandas/${comandaId}`, { items: updatedItems });
      }

      showSnackbar('Entregas actualizadas correctamente.', 'success');
      setEditedRows({});
      if (estadoDistribucionId && authState.userId) {
        fetchComandas(estadoDistribucionId, authState.userId);
      }
    } catch (requestError) {
      console.error('Error actualizando entregas', requestError);
      const message =
        requestError?.response?.data?.err?.message ||
        requestError?.response?.data?.message ||
        'No se pudieron actualizar las entregas.';
      showSnackbar(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReload = () => {
    if (estadoDistribucionId && authState.userId) {
      fetchComandas(estadoDistribucionId, authState.userId);
    }
  };

  const buildClienteComprobanteData = useCallback((cliente) => {
    if (!cliente) return null;
    const comandasSet = new Set();
    const rowsData = (cliente.items ?? []).map((item) => {
      if (item?.nrodecomanda) {
        comandasSet.add(item.nrodecomanda);
      }
      const cantidadEntregada = Math.max(Number(item?.cantidadEntregada ?? 0), 0);
      const monto = Number(item?.monto ?? 0);
      const subtotal = cantidadEntregada * monto;
      return {
        productoDescripcion: item?.productoDescripcion ?? '—',
        cantidadEntregada,
        monto,
        subtotal,
      };
    });
    const totalCantidadEntregada = rowsData.reduce(
      (acc, row) => acc + Number(row.cantidadEntregada ?? 0),
      0,
    );
    const total = rowsData.reduce((acc, row) => acc + Number(row.subtotal ?? 0), 0);
    return {
      clienteNombre: cliente.clienteNombre ?? '—',
      comandas: Array.from(comandasSet),
      rows: rowsData,
      total,
      totalCantidadEntregada,
    };
  }, []);

  const buildDeliveryPdf = useCallback((payload) => {
    const doc = new jsPDF({ orientation: 'portrait' });
    const safeCliente = payload?.clienteNombre ?? 'Cliente';
    doc.setFontSize(16);
    doc.text(`Comprobante de entrega — ${safeCliente}`, 40, 40);

    const comandaDisplay = payload?.comandas?.length
      ? payload.comandas.length === 1
        ? payload.comandas[0]
        : payload.comandas.join(', ')
      : '—';

    doc.setFontSize(12);
    doc.text(`Cliente: ${safeCliente}`, 40, 62);
    doc.text(`Comanda(s): ${comandaDisplay}`, 40, 78);

    const body = (payload?.rows ?? []).map((row) => [
      row.productoDescripcion,
      numberFormatter.format(Number(row.cantidadEntregada ?? 0)),
      currencyFormatter.format(Number(row.monto ?? 0)),
      currencyFormatter.format(Number(row.subtotal ?? 0)),
    ]);

    autoTable(doc, {
      startY: 100,
      head: [['Producto', 'Cantidad entregada', 'Precio unitario', 'Subtotal']],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
      margin: { left: 40, right: 40 },
    });

    const finalY = doc.lastAutoTable?.finalY ?? 100;
    doc.setFontSize(12);
    doc.text(`Total: ${currencyFormatter.format(Number(payload?.total ?? 0))}`, 40, finalY + 24);

    return doc;
  }, []);

  const resetPdfShareState = useCallback((updater) => {
    setPdfShareState((prev) => {
      if (typeof updater === 'function') {
        return updater(prev);
      }
      return {
        open: false,
        fileName: '',
        data: null,
      };
    });
  }, []);

  const handleShareDialogClose = useCallback(() => {
     resetPdfShareState();
  }, [resetPdfShareState]);

  const handleOpenPdfDialog = () => {
    if (!clienteSeleccionadoData) {
      showSnackbar('Selecciona un cliente para generar el comprobante.', 'info');
      return;
    }

    if (!clienteTieneEntregas) {
      showSnackbar('No hay entregas registradas para el cliente seleccionado.', 'info');
      return;
    }

    const payload = buildClienteComprobanteData(clienteSeleccionadoData);
    if (!payload) return;
    setPdfDialogState({ open: true, data: payload });
  };

  const handlePdfDialogClose = () => {
    if (pdfGenerating) return;
    setPdfDialogState({ open: false, data: null });
  };

  const handleGeneratePdf = () => {
    if (!pdfDialogState.data) return;
    setPdfGenerating(true);
    try {
      const timestamp = (() => {
        const now = new Date();
        const parts = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
        ];
        const time = [
          String(now.getHours()).padStart(2, '0'),
          String(now.getMinutes()).padStart(2, '0'),
          String(now.getSeconds()).padStart(2, '0'),
        ].join('');
        return `${parts.join('')}_${time}`;
      })();

      const sanitizeFileName = (value) => {
        if (!value) return 'cliente';
        return value
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .toLowerCase() || 'cliente';
      };

      const doc = buildDeliveryPdf(pdfDialogState.data);
      const fileName = `comprobante_${sanitizeFileName(pdfDialogState.data.clienteNombre)}_${timestamp}.pdf`;
      doc.save(fileName);

      resetPdfShareState(() => ({
        open: true,
        fileName,
        data: pdfDialogState.data,
      }));
      setPdfDialogState({ open: false, data: null });
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadPdfAgain = () => {
    if (!pdfShareState?.data) return;
    const doc = buildDeliveryPdf(pdfShareState.data);
    const fileName = pdfShareState.fileName || 'comprobante_entrega.pdf';
    doc.save(fileName);
  };

  const clientesData = useMemo(() => {
    if (!rows.length) return [];

    const grouped = new Map();
    rows.forEach((row) => {
      const key = row.clienteId
        ? `id:${row.clienteId}`
        : `name:${row.clienteSearchValue ?? normalizeText(row.clienteNombre ?? '')}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          clienteKey: key,
          clienteId: row.clienteId ?? null,
          clienteNombre: row.clienteNombre ?? '',
          searchValue: row.clienteSearchValue ?? normalizeText(row.clienteNombre ?? ''),
          items: [],
          totalBultos: 0,
          totalEntregado: 0,
        });
      }

      const entry = grouped.get(key);
      entry.items.push(row);
      entry.totalBultos += Math.trunc(Number(row.cantidad ?? 0));
      entry.totalEntregado += Math.trunc(Number(row.cantidadEntregada ?? 0));
    });

    return Array.from(grouped.values()).map((entry) => {
      const totalSolicitado = Math.max(entry.totalBultos, 0);
      const totalEntregado = Math.max(entry.totalEntregado, 0);
      const faltante = Math.max(totalSolicitado - totalEntregado, 0);

      let estado = 'pendiente';
      if (totalEntregado === 0) {
        estado = 'pendiente';
      } else if (faltante === 0) {
        estado = 'completo';
      } else {
        estado = 'parcial';
      }

      return {
        ...entry,
        totalBultos: totalSolicitado,
        totalEntregado,
        faltante,
        estado,
      };
    });
  }, [rows]);

  const clienteEstadoMap = useMemo(() => {
    const map = new Map();
    clientesData.forEach((cliente) => {
      map.set(cliente.clienteKey, cliente.estado);
    });
    return map;
  }, [clientesData]);

  const clientesPendientesCount = useMemo(
    () => clientesData.reduce((count, cliente) => count + (cliente.estado === 'pendiente' ? 1 : 0), 0),
    [clientesData],
  );

  const clientesOptions = useMemo(
    () =>
      clientesData.map((cliente) => ({
        key: cliente.clienteKey,
        clienteId: cliente.clienteId,
        clienteNombre: cliente.clienteNombre || '—',
        searchValue: cliente.searchValue,
        estado: cliente.estado,
        pendientes: cliente.faltante,
      })),
    [clientesData],
  );

  const clienteSeleccionadoOption = useMemo(() => {
    if (!clienteSeleccionadoKey) return null;
    return clientesOptions.find((option) => option.key === clienteSeleccionadoKey) ?? null;
  }, [clienteSeleccionadoKey, clientesOptions]);

  const clienteSeleccionadoData = useMemo(() => {
    if (!clienteSeleccionadoKey) return null;
    return clientesData.find((cliente) => cliente.clienteKey === clienteSeleccionadoKey) ?? null;
  }, [clienteSeleccionadoKey, clientesData]);

  const clienteTieneEntregas = useMemo(() => {
    if (!clienteSeleccionadoData) return false;
    return clienteSeleccionadoData.items.some((item) => Number(item.cantidadEntregada ?? 0) > 0);
  }, [clienteSeleccionadoData]);

  const canGenerateComprobante = Boolean(clienteSeleccionadoData && clienteTieneEntregas);

  useEffect(() => {
    if (!clienteSeleccionadoKey) return;
    const exists = clientesOptions.some((option) => option.key === clienteSeleccionadoKey);
    if (!exists) {
      setClienteSeleccionadoKey(null);
    }
  }, [clienteSeleccionadoKey, clientesOptions]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    setRowSelection({});
  }, [clienteSeleccionadoKey]);

  const tableData = useMemo(() => {
    const keyMatch = clienteSeleccionadoKey;

    return rows
      .filter((row) => {
        if (!keyMatch) return true;
        const rowKey = row.clienteId
          ? `id:${row.clienteId}`
          : `name:${row.clienteSearchValue ?? normalizeText(row.clienteNombre ?? '')}`;
        return rowKey === keyMatch;
      })
      .map((row) => {
        const rowKey = row.clienteId
          ? `id:${row.clienteId}`
          : `name:${row.clienteSearchValue ?? normalizeText(row.clienteNombre ?? '')}`;
        const estado = clienteEstadoMap.get(rowKey) ?? 'pendiente';
        const cantidad = Math.trunc(Math.max(Number(row.cantidad ?? 0), 0));
        const cantidadEntregada = Math.trunc(Math.max(Number(row.cantidadEntregada ?? 0), 0));
        const faltante = Math.max(cantidad - cantidadEntregada, 0);
        let itemEstado = 'pendiente';
        if (cantidadEntregada === 0) {
          itemEstado = 'pendiente';
        } else if (faltante === 0) {
          itemEstado = 'completo';
        } else {
          itemEstado = 'parcial';
        }
        return { ...row, clienteEstado: estado, itemEstado };
      });
  }, [rows, clienteSeleccionadoKey, clienteEstadoMap]);

  const filterClientesOptions = useCallback((options, { inputValue }) => {
    const normalizedValue = normalizeText(inputValue ?? '');
    if (!normalizedValue) {
      return options.slice(0, 15);
    }
    return options.filter((option) => option.searchValue.includes(normalizedValue)).slice(0, 15);
  }, []);

  const renderEstadoDisplay = useCallback((estado, size = 'small') => {
    if (estado === 'parcial') {
      return (
        <Chip
          label="Parcial"
          size={size}
          color="warning"
          variant="outlined"
          icon={<WarningAmberRoundedIcon fontSize="small" />}
          sx={{ '& .MuiChip-icon': { mr: 0 } }}
        />
      );
    }

    if (estado === 'completo') {
      return (
        <Typography
          variant={size === 'small' ? 'body2' : 'body1'}
          sx={{ fontWeight: 600, color: 'success.main' }}
        >
          Completo
        </Typography>
      );
    }

    return (
      <Typography variant={size === 'small' ? 'body2' : 'body1'} sx={{ color: 'text.secondary' }}>
        Pendiente
      </Typography>
    );
  }, []);

  const filterFns = useMemo(
    () => ({
      includesString: (row, columnId, value) => {
        if (!value && value !== 0) return true;
        const rowValue = row.getValue(columnId);
        const normalizedRow = normalizeText(String(rowValue ?? ''));
        const normalizedFilter = normalizeText(String(value ?? ''));
        return normalizedRow.includes(normalizedFilter);
      },
    }),
    [],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table: tbl }) => (
          <Checkbox
            checked={tbl.getIsAllPageRowsSelected()}
            indeterminate={tbl.getIsSomePageRowsSelected()}
            onChange={tbl.getToggleAllPageRowsSelectedHandler()}
            inputProps={{ 'aria-label': 'Seleccionar todas las filas' }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            indeterminate={row.getIsSomeSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            inputProps={{ 'aria-label': `Seleccionar comanda ${row.original.nrodecomanda}` }}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: 'center' },
      }),
      columnHelper.accessor('nrodecomanda', {
        header: 'Com',
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'includesString',
        meta: { filterLabel: 'comanda', align: 'right' },
      }),
      columnHelper.accessor('clienteNombre', {
        header: 'Cliente',
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'includesString',
        meta: { filterLabel: 'cliente' },
      }),
      columnHelper.accessor('clienteEstado', {
        header: 'Estado',
        cell: (info) => renderEstadoDisplay(info.getValue()),
        enableColumnFilter: false,
        enableSorting: false,
        meta: { align: 'center' },
      }),
      columnHelper.accessor('productoDescripcion', {
        header: 'Producto',
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'producto' },
      }),
      columnHelper.accessor('cantidad', {
        header: 'Cant',
        cell: (info) => quantityFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'cantidad', align: 'right' },
      }),
      columnHelper.accessor('monto', {
        header: 'Precio unitario',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'precio', align: 'right' },
      }),
      columnHelper.accessor('total', {
        header: 'Total',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'total', align: 'right' },
      }),
      columnHelper.accessor('cantidadEntregada', {
        header: 'Cant entreg',
        cell: (info) => {
          const row = info.row.original;
          return (
            <TextField
              value={row.cantidadEntregada}
              type="number"
              size={isTabletDown ? 'medium' : 'small'}
              onChange={(event) => handleCantidadEntregadaChange(row, event.target.value)}
              inputProps={{
                min: 0,
                max: row.cantidad,
                step: 1,
                inputMode: 'numeric',
                pattern: '[0-9]*',
              }}
              fullWidth={isTabletDown}
              sx={{ maxWidth: isTabletDown ? '100%' : 120 }}
            />
          );
        },
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'cantidad entregada', align: 'right' },
      }),
      columnHelper.accessor('totalEntregado', {
        header: 'Total entreg',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        enableColumnFilter: false,
        meta: { filterLabel: 'total entregado', align: 'right' },
      }),
    ],
    [handleCantidadEntregadaChange, isTabletDown, renderEstadoDisplay],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      columnFilters,
      sorting,
      rowSelection,
      pagination,
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    filterFns,
    getRowId: (row) => row.rowId,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  });

  const renderColumnFilter = (column) => {
    if (!column.getCanFilter()) return null;
    const value = column.getFilterValue() ?? '';
    return (
      <TextField
        size="small"
        fullWidth
        value={value}
        onChange={(event) => {
          const newValue = event.target.value;
          column.setFilterValue(newValue || undefined);
        }}
        placeholder={`Buscar ${column.columnDef.meta?.filterLabel ?? ''}`.trim()}
        InputProps={{ sx: { fontSize: 13 } }}
      />
    );
  };

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  const selectedRows = table.getSelectedRowModel().rows;
  const hasEditedRows = Object.keys(editedRows).length > 0;
  const pageRows = table.getRowModel().rows;
  const filteredRows = table.getFilteredRowModel().rows;
  const totalRegistros = filteredRows.length;
  let totalCantidadEntregada = 0;
  let totalMontoEntregado = 0;
  let totalBultos = 0;
  let valorTotal = 0;
  filteredRows.forEach((row) => {
    totalCantidadEntregada += Number(row.original?.cantidadEntregada ?? 0);
    totalMontoEntregado += Number(row.original?.totalEntregado ?? 0);
    totalBultos += Number(row.original?.cantidad ?? 0);
    valorTotal += Number(row.original?.total ?? 0);
  });

  if (authState.checking) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <LinearProgress sx={{ width: { xs: '100%', sm: '60%' } }} />
      </Box>
    );
  }

  if (authState.role !== 'USER_CAM') {
    return (
      <Alert severity="warning">
        Acceso restringido. Esta sección está disponible únicamente para usuarios con rol
        USER_CAM.
      </Alert>
    );
  }

  const selectedCount = selectedRows.length;
  const filterableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanFilter());
  const isSmallScreen = isMobile;

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pb: 4 }}>
      <Box
        sx={{
          mb: 3,
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          bgcolor: 'primary.dark',
          color: 'common.white',
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant={isSmallScreen ? 'h5' : 'h4'} sx={{ fontWeight: 600 }}>
            En distribución
          </Typography>
          {/* <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Gestiona tus comandas y actualiza las entregas con una interfaz preparada para
            pantallas táctiles.
          </Typography> */}
        </Stack>
      </Box>

      {isSmallScreen && filterableColumns.length > 0 && (
        <Paper sx={{ mb: 2, p: 2, borderRadius: 2 }} variant="outlined">
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Buscar comandas
            </Typography>
            {filterableColumns.map((column) => {
              const value = column.getFilterValue() ?? '';
              const label =
                typeof column.columnDef.header === 'string'
                  ? column.columnDef.header
                  : column.columnDef.meta?.filterLabel || 'Filtro';
              return (
                <TextField
                  key={column.id}
                  label={label}
                  value={value}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    column.setFilterValue(newValue || undefined);
                  }}
                  type="text"
                  size="medium"
                  fullWidth
                />
              );
            })}
          </Stack>
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.5, md: 2 }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Autocomplete
          fullWidth
          value={clienteSeleccionadoOption}
          options={clientesOptions}
          onChange={(_, value) => setClienteSeleccionadoKey(value?.key ?? null)}
          isOptionEqualToValue={(option, value) => option.key === (value?.key ?? '')}
          getOptionLabel={(option) => option?.clienteNombre ?? ''}
          filterOptions={filterClientesOptions}
          clearOnEscape
          includeInputInList
          ListboxProps={{ style: { maxHeight: 320 } }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Filtrar por cliente"
              placeholder="Buscar cliente"
              size={isTabletDown ? 'medium' : 'small'}
            />
          )}
          renderOption={(props, option) => (
            <li {...props} key={option.key}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {option.clienteNombre}
                </Typography>
                {option.estado !== 'completo' && option.pendientes > 0 && (
                  <Typography variant="caption" color="warning.main">
                    Pend: {quantityFormatter.format(Number(option.pendientes ?? 0))}
                  </Typography>
                )}
              </Stack>
            </li>
          )}
          noOptionsText="No se encontraron clientes"
          sx={{
            minWidth: { md: 300 },
          }}
        />
        <Paper
          variant="outlined"
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 1, sm: 1.25 },
            borderRadius: 2,
            bgcolor: 'background.paper',
            width: { xs: '100%', md: 'auto' },
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, textAlign: { xs: 'center', md: 'left' } }}>
            Pendientes comandas x gestión: <Box component="span" color="warning.main">{clientesPendientesCount}</Box>
          </Typography>
        </Paper>
      </Stack>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.5, md: 2 }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 1 }}
          flexWrap="wrap"
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button
            variant="contained"
            startIcon={<DoneAllIcon />}
            onClick={handleMassiveDialogOpen}
            disabled={selectedCount === 0}
            fullWidth={isTabletDown}
            sx={{ minHeight: 48, borderRadius: 2, px: 2 }}
          >
            Entrega Masiva
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReload}
            fullWidth={isTabletDown}
            sx={{ minHeight: 48, borderRadius: 2, px: 2 }}
          >
            Recargar
          </Button>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleOpenPdfDialog}
            disabled={!canGenerateComprobante || pdfGenerating}
            fullWidth={isTabletDown}
            sx={{ minHeight: 48, borderRadius: 2, px: 2, width: { xs: '100%', sm: 'auto' } }}
          >
            Comprobante
          </Button>
        </Stack>
        <Button
          variant="contained"
          color="success"
          startIcon={<SaveIcon />}
          onClick={handleSaveChanges}
          disabled={!hasEditedRows || saving}
          fullWidth={isTabletDown}
          size="large"
          sx={{ minHeight: 56, borderRadius: 2.5, px: 3, fontWeight: 600 }}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Stack>

      <Paper
        sx={{ position: 'relative', p: isSmallScreen ? 1.5 : 0 }}
        variant="outlined"
      >
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        {isSmallScreen ? (
          <Stack spacing={1.5} sx={{ py: 0.5 }}>
            {pageRows.length > 0 &&
              pageRows.map((row) => {
                const original = row.original;
                const isEdited = Boolean(editedRows[original.rowId]);
                return (
                  <Box
                    key={row.id}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: isEdited ? 'primary.main' : 'divider',
                      bgcolor: isEdited ? 'action.hover' : 'background.paper',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Com {original.nrodecomanda ?? '—'}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="body2" color="text.secondary">
                            {original.clienteNombre ?? '—'}
                          </Typography>
                          {original.itemEstado === 'parcial' && (
                            <Box sx={{ mt: { xs: 0.25, sm: 0 } }}>{renderEstadoDisplay('parcial', 'small')}</Box>
                          )}
                          {original.itemEstado === 'completo' && (
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 600, color: 'success.main', mt: { xs: 0.25, sm: 0 } }}
                            >
                              Completo
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                      <Checkbox
                        checked={row.getIsSelected()}
                        indeterminate={row.getIsSomeSelected()}
                        disabled={!row.getCanSelect()}
                        onChange={row.getToggleSelectedHandler()}
                        size="medium"
                        inputProps={{
                          'aria-label': `Seleccionar comanda ${original.nrodecomanda ?? ''}`,
                        }}
                      />
                    </Stack>
                    <Grid container spacing={1.5} alignItems="flex-start">
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Producto
                        </Typography>
                        <Typography variant="body2">
                          {original.productoDescripcion ?? '—'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Cantidad
                        </Typography>
                        <Typography variant="body2">
                          {quantityFormatter.format(Number(original.cantidad ?? 0))}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Total
                        </Typography>
                        <Typography variant="body2">
                          {decimalFormatter.format(Number(original.total ?? 0))}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Precio unitario
                        </Typography>
                        <Typography variant="body2">
                          {decimalFormatter.format(Number(original.monto ?? 0))}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Cantidad entregada
                        </Typography>
                        <TextField
                          value={original.cantidadEntregada}
                          type="number"
                          size="medium"
                          fullWidth
                          onChange={(event) =>
                            handleCantidadEntregadaChange(original, event.target.value)
                          }
                          inputProps={{
                            min: 0,
                            max: original.cantidad,
                            step: 1,
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Typography variant="caption" color="text.secondary">
                          Total entregado
                        </Typography>
                        <Typography variant="body2">
                          {decimalFormatter.format(Number(original.totalEntregado ?? 0))}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                );
              })}
            {!loading && pageRows.length === 0 && (
              <Typography align="center" sx={{ py: 3 }}>
                No se encontraron comandas en distribución para el usuario actual.
              </Typography>
            )}
          </Stack>
        ) : (
          <TableContainer
            sx={{
              maxHeight: isTabletDown ? '60vh' : 600,
              overflowX: 'auto',
            }}
          >
            <Table
              stickyHeader
              size="small"
              sx={{
                minWidth: isTabletDown ? 720 : 1020,
                '& .MuiTableCell-root': {
                  px: { xs: 1, sm: 1.5 },
                  py: { xs: 1, sm: 1.5 },
                },
              }}
            >
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableCell
                        key={header.id}
                        align={header.column.columnDef.meta?.align ?? 'left'}
                        sx={{ bgcolor: 'background.paper' }}
                      >
                        {header.isPlaceholder ? null : (
                          <Stack spacing={1}>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              {header.column.getCanSort() ? (
                                <TableSortLabel
                                  active={!!header.column.getIsSorted()}
                                  direction={header.column.getIsSorted() === 'desc' ? 'desc' : 'asc'}
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </TableSortLabel>
                              ) : (
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </Typography>
                              )}
                            </Stack>
                            {renderColumnFilter(header.column)}
                          </Stack>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    sx={{
                      bgcolor: editedRows[row.original.rowId] ? 'action.hover' : undefined,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        align={cell.column.columnDef.meta?.align ?? 'left'}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {!loading && pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <Typography align="center" sx={{ py: 3 }}>
                        No se encontraron comandas en distribución para el usuario actual.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ mt: 2, p: { xs: 2, sm: 2.5 } }} variant="outlined">
        <Stack spacing={{ xs: 2, md: 1.5 }}>
          <Grid container spacing={{ xs: 1.5, md: 2 }}>
            <Grid item xs={12} md={4} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total de registros: {totalRegistros}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total de bultos: {quantityFormatter.format(totalBultos)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Valor total $: {decimalFormatter.format(valorTotal)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Suma Cant entreg: {quantityFormatter.format(totalCantidadEntregada)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Suma Total entreg: {decimalFormatter.format(totalMontoEntregado)}
              </Typography>
            </Grid>
          </Grid>
          <TablePagination
            component="div"
            count={totalRegistros}
            page={table.getState().pagination.pageIndex}
            onPageChange={(_, newPage) => table.setPageIndex(newPage)}
            rowsPerPage={table.getState().pagination.pageSize}
            onRowsPerPageChange={(event) => {
              const newSize = Number(event.target.value) || 10;
              table.setPageSize(newSize);
              table.setPageIndex(0);
            }}
            rowsPerPageOptions={[10]}
            showFirstButton
            showLastButton
          />
        </Stack>
      </Paper>

      <Dialog
        open={pdfDialogState.open}
        onClose={handlePdfDialogClose}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Generar comprobante</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {pdfDialogState.data?.clienteNombre ?? '—'}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Comanda(s)
              </Typography>
              <Typography variant="body1">
                {pdfDialogState.data?.comandas?.length
                  ? pdfDialogState.data.comandas.join(', ')
                  : '—'}
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 1, sm: 3 }}
              justifyContent="space-between"
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total bultos entregados:{' '}
                {numberFormatter.format(
                  Number(pdfDialogState.data?.totalCantidadEntregada ?? 0),
                )}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Total a entregar:{' '}
                {currencyFormatter.format(Number(pdfDialogState.data?.total ?? 0))}
              </Typography>
            </Stack>
            <DialogContentText>
              ¿Deseas generar el comprobante de entrega en PDF para el cliente seleccionado?
            </DialogContentText>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePdfDialogClose} disabled={pdfGenerating}>
            Cancelar
          </Button>
          <Button
            onClick={handleGeneratePdf}
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            disabled={pdfGenerating}
          >
            {pdfGenerating ? 'Generando…' : 'Generar PDF'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={pdfShareState.open}
        onClose={handleShareDialogClose}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Comprobante generado</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {pdfShareState.data?.clienteNombre ?? '—'}
            </Typography>
            <Typography variant="body2">
              Total entregado:{' '}
              {currencyFormatter.format(Number(pdfShareState.data?.total ?? 0))}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Descarga el comprobante y compártelo por WhatsApp adjuntando el PDF guardado en tu
              dispositivo. También puedes conservarlo para enviarlo por otro medio.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: { xs: 1, sm: 1 },
            px: { xs: 3, sm: 2 },
            pb: { xs: 2.5, sm: 1.5 },
          }}
        >
          <Button
            onClick={handleDownloadPdfAgain}
            startIcon={<PictureAsPdfIcon />}
            variant="outlined"
            fullWidth={isTabletDown}
          >
            Descargar PDF
          </Button>
          <Button onClick={handleShareDialogClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={massDialog.open} onClose={handleMassDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>Entrega Masiva</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2 }}>
            Esta acción marcará como entregados todos los bultos de los productos seleccionados
            (Cantidad entregada = Cantidad total). ¿Deseas continuar?
          </DialogContentText>
          {selectedCount > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Resumen (primeras {Math.min(selectedCount, 5)} filas):
              </Typography>
              {selectedRows.slice(0, 5).map((row) => {
                const original = row.original;
                const preview = clampDelivered(original.cantidad, original.cantidad);
                return (
                  <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Comanda {original.nrodecomanda ?? '—'} — {original.productoDescripcion ?? '—'}
                    </Typography>
                    <Typography variant="body2">
                      Actual: {quantityFormatter.format(Number(original.cantidadEntregada ?? 0))} |{' '}
                      Nuevo: {quantityFormatter.format(preview)}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMassDialogClose}>Cancelar</Button>
          <Button onClick={handleMassDialogConfirm} variant="contained">
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={handleSnackbarClose}
              aria-label="Cerrar"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
