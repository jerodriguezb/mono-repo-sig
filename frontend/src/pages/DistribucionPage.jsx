import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import RefreshIcon from '@mui/icons-material/Refresh';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import api from '../api/axios';
import { getCurrentUserFromStorage } from '../utils/auth.js';

const columnHelper = createColumnHelper();

const normalize = (value) =>
  (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const DISTRIBUCION_STATE_NAME = normalize('En distribución');

const quantityFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const priceFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

const stringIncludes = (row, columnId, filterValue) => {
  if (!filterValue) return true;
  const raw = row.getValue(columnId);
  if (raw === undefined || raw === null) return false;
  return raw.toString().toLowerCase().includes(filterValue.toString().toLowerCase());
};

const clampDeliveryValue = (value, max) => {
  if (Number.isNaN(value) || value < 0) return 0;
  if (typeof max === 'number' && max >= 0) {
    return Math.min(value, max);
  }
  return value;
};

const escapeCsvValue = (value) => {
  if (value === undefined || value === null) return '""';
  const stringValue = value.toString().replace(/"/g, '""');
  return `"${stringValue}"`;
};

const transformComandasToRows = (comandas = []) => {
  const rows = [];
  comandas.forEach((comanda) => {
    const items = Array.isArray(comanda?.items) ? comanda.items : [];
    items.forEach((item, index) => {
      if (!item) return;
      const cantidad = Number(item.cantidad ?? 0);
      const monto = Number(item.monto ?? 0);
      const entregada = Number(item.cantidadentregada ?? 0);
      const itemKey = item._id ? item._id.toString() : `${index}`;
      rows.push({
        id: `${comanda?._id ?? 'com'}::${itemKey}`,
        comandaId: comanda?._id ?? null,
        itemKey,
        itemIndex: index,
        nrodecomanda: comanda?.nrodecomanda ?? '',
        clienteNombre: comanda?.codcli?.razonsocial ?? '—',
        productoDescripcion: item?.codprod?.descripcion ?? '—',
        cantidad,
        monto,
        total: cantidad * monto,
        cantidadEntregada: entregada,
        totalEntregado: entregada * monto,
        originalCantidadEntregada: entregada,
      });
    });
  });
  return rows;
};

const buildComandaMap = (comandas = []) => {
  const map = {};
  comandas.forEach((comanda) => {
    if (comanda?._id) {
      map[comanda._id] = comanda;
    }
  });
  return map;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export default function DistribucionPage() {
  const navigate = useNavigate();
  const [accessStatus, setAccessStatus] = useState('checking');
  const [authUser, setAuthUser] = useState(null);
  const [estadoDistribucionId, setEstadoDistribucionId] = useState(null);
  const [rows, setRows] = useState([]);
  const [comandaMap, setComandaMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [pendingUpdates, setPendingUpdates] = useState(() => new Map());
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [exportAnchor, setExportAnchor] = useState(null);
  const [massDialog, setMassDialog] = useState({ open: false, value: '', error: '' });

  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleSnackbarClose = useCallback((_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    const user = getCurrentUserFromStorage();
    if (!user || user.role !== 'USER_CAM') {
      setAccessStatus('denied');
      return;
    }
    setAuthUser(user);
    setAccessStatus('allowed');
  }, []);

  const fetchDistribucionData = useCallback(
    async (currentUser) => {
      setLoading(true);
      try {
        let estadoId = estadoDistribucionId;
        if (!estadoId) {
          const { data: estadosResponse } = await api.get('/estados');
          const estados = estadosResponse?.estados ?? [];
          const estadoDistribucion = estados.find(
            (estado) => normalize(estado?.estado) === DISTRIBUCION_STATE_NAME,
          );
          if (!estadoDistribucion?._id) {
            throw new Error('Estado "En distribución" no encontrado');
          }
          estadoId = estadoDistribucion._id;
          setEstadoDistribucionId(estadoId);
        }

        const params = { estado: estadoId };
        if (currentUser?._id) {
          params.camionero = currentUser._id;
        }

        const { data: comandasResponse } = await api.get('/comandas', { params });
        const comandas = comandasResponse?.comandas ?? [];
        const activas = comandas.filter((comanda) => comanda?.activo !== false);
        setComandaMap(buildComandaMap(activas));
        setRows(transformComandasToRows(activas));
        setRowSelection({});
        setPendingUpdates(() => new Map());
      } catch (error) {
        console.error('Error loading distribution data', error);
        showSnackbar('No se pudieron cargar las comandas en distribución', 'error');
      } finally {
        setLoading(false);
      }
    },
    [estadoDistribucionId, showSnackbar],
  );

  useEffect(() => {
    if (accessStatus !== 'allowed' || !authUser?._id) return;
    fetchDistribucionData(authUser);
  }, [accessStatus, authUser, fetchDistribucionData]);

  const adjustPendingUpdates = useCallback((comandaId, itemKey, newValue, originalValue) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      const key = comandaId ?? 'unknown';
      if (newValue === originalValue) {
        if (!next.has(key)) return next;
        const itemsMap = new Map(next.get(key));
        itemsMap.delete(itemKey);
        if (itemsMap.size === 0) {
          next.delete(key);
        } else {
          next.set(key, itemsMap);
        }
        return next;
      }
      const itemsMap = new Map(next.get(key) ?? []);
      itemsMap.set(itemKey, newValue);
      next.set(key, itemsMap);
      return next;
    });
  }, []);

  const updateDeliveredValue = useCallback(
    (targetRow, rawValue) => {
      if (!targetRow) return;
      const numericValue = Number(rawValue);
      const safeValue = rawValue === '' ? 0 : clampDeliveryValue(numericValue, targetRow.cantidad);
      if (Number.isNaN(safeValue) || safeValue < 0) return;
      setRows((prev) =>
        prev.map((row) => {
          if (row.id !== targetRow.id) return row;
          return {
            ...row,
            cantidadEntregada: safeValue,
            totalEntregado: safeValue * row.monto,
            isDirty: safeValue !== row.originalCantidadEntregada,
          };
        }),
      );
      adjustPendingUpdates(
        targetRow.comandaId,
        targetRow.itemKey,
        safeValue,
        targetRow.originalCantidadEntregada,
      );
    },
    [adjustPendingUpdates],
  );

  const handleDeliveredChange = useCallback(
    (rowData, value) => {
      if (value === undefined || value === null) return;
      if (value === '') {
        updateDeliveredValue(rowData, 0);
        return;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed) || parsed < 0) return;
      updateDeliveredValue(rowData, parsed);
    },
    [updateDeliveredValue],
  );

  const handleMassDialogOpen = useCallback(() => {
    setMassDialog({ open: true, value: '', error: '' });
  }, []);

  const handleMassDialogClose = useCallback(() => {
    setMassDialog({ open: false, value: '', error: '' });
  }, []);

  const tableColumns = useMemo(() => {
    const renderSortableHeader = (column, label) => {
      if (!column.getCanSort()) {
        return (
          <Typography variant="subtitle2" component="span">
            {label}
          </Typography>
        );
      }
      const sorted = column.getIsSorted();
      return (
        <TableSortLabel
          active={!!sorted}
          direction={sorted === 'desc' ? 'desc' : 'asc'}
          onClick={column.getToggleSortingHandler()}
        >
          <Typography variant="subtitle2" component="span">
            {label}
          </Typography>
        </TableSortLabel>
      );
    };

    return [
      columnHelper.display({
        id: 'selection',
        enableSorting: false,
        enableColumnFilter: false,
        meta: { align: 'center' },
        header: ({ table }) => (
          <Checkbox
            indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            inputProps={{ 'aria-label': 'Seleccionar todas las filas' }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            indeterminate={row.getIsSomeSelected()}
            onChange={row.getToggleSelectedHandler()}
            inputProps={{ 'aria-label': `Seleccionar comanda ${row.original.nrodecomanda}` }}
          />
        ),
        size: 48,
      }),
      columnHelper.accessor('nrodecomanda', {
        header: ({ column }) => (
          <Stack spacing={1}>
            {renderSortableHeader(column, 'Com')}
            <TextField
              size="small"
              placeholder="Buscar..."
              value={column.getFilterValue() ?? ''}
              onChange={(event) => column.setFilterValue(event.target.value || undefined)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              variant="outlined"
            />
          </Stack>
        ),
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'stringIncludes',
      }),
      columnHelper.accessor('clienteNombre', {
        header: ({ column }) => (
          <Stack spacing={1}>
            {renderSortableHeader(column, 'Cliente')}
            <TextField
              size="small"
              placeholder="Buscar..."
              value={column.getFilterValue() ?? ''}
              onChange={(event) => column.setFilterValue(event.target.value || undefined)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              variant="outlined"
            />
          </Stack>
        ),
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'stringIncludes',
      }),
      columnHelper.accessor('productoDescripcion', {
        header: ({ column }) => (
          <Stack spacing={1}>
            {renderSortableHeader(column, 'Producto')}
            <TextField
              size="small"
              placeholder="Buscar..."
              value={column.getFilterValue() ?? ''}
              onChange={(event) => column.setFilterValue(event.target.value || undefined)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              variant="outlined"
            />
          </Stack>
        ),
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'stringIncludes',
      }),
      columnHelper.accessor('cantidad', {
        header: ({ column }) => renderSortableHeader(column, 'Cant'),
        cell: (info) => quantityFormatter.format(Number(info.getValue() ?? 0)),
        meta: { align: 'right' },
        enableColumnFilter: false,
      }),
      columnHelper.accessor('monto', {
        header: ({ column }) => renderSortableHeader(column, 'Precio unitario'),
        cell: (info) => priceFormatter.format(Number(info.getValue() ?? 0)),
        meta: { align: 'right' },
        enableColumnFilter: false,
      }),
      columnHelper.accessor('total', {
        header: ({ column }) => renderSortableHeader(column, 'Total'),
        cell: (info) => currencyFormatter.format(Number(info.getValue() ?? 0)),
        meta: { align: 'right' },
        enableColumnFilter: false,
      }),
      columnHelper.display({
        id: 'cantidadEntregada',
        header: ({ column }) => renderSortableHeader(column, 'Cant entreg'),
        enableSorting: true,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <TextField
            size="small"
            type="number"
            value={row.original.cantidadEntregada}
            onChange={(event) => handleDeliveredChange(row.original, event.target.value)}
            inputProps={{ min: 0, max: row.original.cantidad, step: '0.01' }}
            sx={{
              maxWidth: 140,
              '& .MuiInputBase-input': { textAlign: 'right' },
              ...(row.original.isDirty
                ? {
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(25, 118, 210, 0.08)',
                    },
                  }
                : {}),
            }}
          />
        ),
      }),
      columnHelper.accessor('totalEntregado', {
        header: ({ column }) => renderSortableHeader(column, 'Total entreg'),
        cell: (info) => currencyFormatter.format(Number(info.getValue() ?? 0)),
        meta: { align: 'right' },
        enableColumnFilter: false,
      }),
    ];
  }, [handleDeliveredChange]);

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { columnFilters, sorting, rowSelection },
    enableRowSelection: true,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    filterFns: { stringIncludes },
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const visibleRows = table.getRowModel().rows;

  const totalVisibleRecords = visibleRows.length;
  const totalDeliveredUnits = visibleRows.reduce(
    (acc, row) => acc + Number(row.original.cantidadEntregada ?? 0),
    0,
  );
  const totalDeliveredAmount = visibleRows.reduce(
    (acc, row) => acc + Number(row.original.totalEntregado ?? 0),
    0,
  );

  const handleExportCsv = useCallback(() => {
    if (!visibleRows.length) {
      showSnackbar('No hay datos para exportar', 'warning');
      return;
    }
    const headers = [
      'Com',
      'Cliente',
      'Producto',
      'Cant',
      'Precio unitario',
      'Total',
      'Cant entreg',
      'Total entreg',
    ];
    const dataRows = visibleRows.map((row) => {
      const item = row.original;
      return [
        escapeCsvValue(item.nrodecomanda ?? ''),
        escapeCsvValue(item.clienteNombre ?? ''),
        escapeCsvValue(item.productoDescripcion ?? ''),
        escapeCsvValue(quantityFormatter.format(Number(item.cantidad ?? 0))),
        escapeCsvValue(priceFormatter.format(Number(item.monto ?? 0))),
        escapeCsvValue(currencyFormatter.format(Number(item.total ?? 0))),
        escapeCsvValue(quantityFormatter.format(Number(item.cantidadEntregada ?? 0))),
        escapeCsvValue(currencyFormatter.format(Number(item.totalEntregado ?? 0))),
      ].join(',');
    });
    const csvContent = [headers.map(escapeCsvValue).join(','), ...dataRows].join('\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `comandas_en_distribucion_${new Date().toISOString().split('T')[0]}.csv`);
  }, [showSnackbar, visibleRows]);

  const handleExportExcel = useCallback(() => {
    if (!visibleRows.length) {
      showSnackbar('No hay datos para exportar', 'warning');
      return;
    }
    const headers = [
      'Com',
      'Cliente',
      'Producto',
      'Cant',
      'Precio unitario',
      'Total',
      'Cant entreg',
      'Total entreg',
    ];
    const rowsContent = visibleRows
      .map((row) => {
        const item = row.original;
        return [
          item.nrodecomanda ?? '',
          item.clienteNombre ?? '',
          item.productoDescripcion ?? '',
          quantityFormatter.format(Number(item.cantidad ?? 0)),
          priceFormatter.format(Number(item.monto ?? 0)),
          currencyFormatter.format(Number(item.total ?? 0)),
          quantityFormatter.format(Number(item.cantidadEntregada ?? 0)),
          currencyFormatter.format(Number(item.totalEntregado ?? 0)),
        ]
          .map((cell) => cell.toString().replace(/\t/g, ' '))
          .join('\t');
      })
      .join('\n');

    const excelContent = `${headers.join('\t')}\n${rowsContent}`;
    const blob = new Blob([`\ufeff${excelContent}`], {
      type: 'application/vnd.ms-excel',
    });
    downloadBlob(blob, `comandas_en_distribucion_${new Date().toISOString().split('T')[0]}.xls`);
  }, [visibleRows, showSnackbar]);

  const handleExportPdf = useCallback(() => {
    if (!visibleRows.length) {
      showSnackbar('No hay datos para exportar', 'warning');
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(18);
    doc.text('En distribución', 14, 20);
    doc.setFontSize(11);
    doc.text(`Registros: ${totalVisibleRecords}`, 14, 30);
    doc.text(
      `Total bultos entregados: ${quantityFormatter.format(totalDeliveredUnits)}`,
      14,
      36,
    );
    doc.text(
      `Importe entregado: ${currencyFormatter.format(totalDeliveredAmount)}`,
      14,
      42,
    );

    autoTable(doc, {
      startY: 50,
      head: [
        [
          'Com',
          'Cliente',
          'Producto',
          'Cant',
          'Precio unitario',
          'Total',
          'Cant entreg',
          'Total entreg',
        ],
      ],
      body: visibleRows.map((row) => {
        const item = row.original;
        return [
          item.nrodecomanda ?? '',
          item.clienteNombre ?? '',
          item.productoDescripcion ?? '',
          quantityFormatter.format(Number(item.cantidad ?? 0)),
          priceFormatter.format(Number(item.monto ?? 0)),
          currencyFormatter.format(Number(item.total ?? 0)),
          quantityFormatter.format(Number(item.cantidadEntregada ?? 0)),
          currencyFormatter.format(Number(item.totalEntregado ?? 0)),
        ];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [21, 101, 192] },
    });

    doc.save(`comandas_en_distribucion_${new Date().toISOString().split('T')[0]}.pdf`);
  }, [visibleRows, totalVisibleRecords, totalDeliveredUnits, totalDeliveredAmount, showSnackbar]);

  const handleSaveChanges = useCallback(async () => {
    if (pendingUpdates.size === 0 || saving) {
      if (pendingUpdates.size === 0) {
        showSnackbar('No hay cambios pendientes para guardar', 'info');
      }
      return;
    }

    setSaving(true);
    try {
      const updatePromises = [];
      pendingUpdates.forEach((itemsMap, comandaId) => {
        const comanda = comandaMap[comandaId];
        if (!comanda) return;
        const items = (Array.isArray(comanda.items) ? comanda.items : []).map((item, index) => {
          const key = item?._id ? item._id.toString() : `${index}`;
          const newDelivered = itemsMap.has(key)
            ? itemsMap.get(key)
            : Number(item?.cantidadentregada ?? 0);
          const cantidad = Number(item?.cantidad ?? 0);
          return {
            _id: item?._id,
            lista: item?.lista?._id ?? item?.lista ?? null,
            codprod: item?.codprod?._id ?? item?.codprod ?? null,
            cantidad,
            monto: Number(item?.monto ?? 0),
            cantidadentregada: newDelivered,
            entregado: newDelivered >= cantidad,
          };
        });
        updatePromises.push(api.put(`/comandas/${comandaId}`, { items }));
      });

      if (!updatePromises.length) {
        showSnackbar('No hay cambios válidos para guardar', 'info');
        setSaving(false);
        return;
      }

      await Promise.all(updatePromises);
      showSnackbar('Entregas actualizadas correctamente', 'success');
      setPendingUpdates(() => new Map());
      if (authUser) {
        await fetchDistribucionData(authUser);
      }
    } catch (error) {
      console.error('Error saving deliveries', error);
      showSnackbar('No se pudieron guardar los cambios de entrega', 'error');
    } finally {
      setSaving(false);
    }
  }, [pendingUpdates, saving, showSnackbar, comandaMap, authUser, fetchDistribucionData]);

  const handleMassApply = useCallback(() => {
    if (massDialog.value === '') {
      setMassDialog((prev) => ({ ...prev, error: 'Ingresá una cantidad válida' }));
      return;
    }
    const numericValue = Number(massDialog.value);
    if (Number.isNaN(numericValue) || numericValue < 0) {
      setMassDialog((prev) => ({ ...prev, error: 'La cantidad debe ser un número mayor o igual a 0' }));
      return;
    }
    if (!selectedRows.length) {
      setMassDialog((prev) => ({ ...prev, error: 'Seleccioná al menos una fila' }));
      return;
    }
    selectedRows.forEach((row) => {
      updateDeliveredValue(row.original, numericValue);
    });
    showSnackbar('Se actualizaron las entregas seleccionadas', 'success');
    setMassDialog({ open: false, value: '', error: '' });
  }, [massDialog.value, selectedRows, updateDeliveredValue, showSnackbar]);

  const handleRefresh = useCallback(() => {
    if (authUser) {
      fetchDistribucionData(authUser);
    }
  }, [authUser, fetchDistribucionData]);

  if (accessStatus === 'checking') {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 320 }} spacing={2}>
        <LinearProgress sx={{ width: '100%', maxWidth: 320 }} />
        <Typography variant="body2" color="text.secondary">
          Verificando acceso…
        </Typography>
      </Stack>
    );
  }

  if (accessStatus === 'denied') {
    return (
      <Paper sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h4" color="error.main">
            Acceso restringido
          </Typography>
          <Typography variant="body1">
            Solo los usuarios con rol USER_CAM pueden ingresar a la pantalla de distribución.
          </Typography>
          <Box>
            <Button variant="contained" onClick={() => navigate('/')}>Regresar al inicio</Button>
          </Box>
        </Stack>
      </Paper>
    );
  }

  const selectedCount = selectedRows.length;
  const parsedMassValue = Number(massDialog.value);
  const normalizedMassValue =
    massDialog.value === '' || Number.isNaN(parsedMassValue)
      ? 0
      : clampDeliveryValue(parsedMassValue, Number.MAX_SAFE_INTEGER);
  const massPreviewRows = selectedRows.map((row) => {
    const safeValue = clampDeliveryValue(normalizedMassValue, row.original.cantidad);
    return {
      id: row.id,
      comanda: row.original.nrodecomanda,
      cliente: row.original.clienteNombre,
      producto: row.original.productoDescripcion,
      previo: row.original.cantidadEntregada,
      nuevo: safeValue,
    };
  });

  return (
    <Stack spacing={3}>
      <Paper
        sx={{
          p: 3,
          backgroundColor: (theme) => theme.palette.primary.dark,
          color: (theme) => theme.palette.primary.contrastText,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="h4">En distribución</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Exportar CSV o Excel">
              <span>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<FileDownloadIcon />}
                  onClick={(event) => setExportAnchor(event.currentTarget)}
                  disabled={!visibleRows.length}
                >
                  CSV / Excel
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Exportar PDF">
              <span>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<PictureAsPdfIcon />}
                  onClick={handleExportPdf}
                  disabled={!visibleRows.length}
                >
                  PDF
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            startIcon={<PlaylistAddCheckIcon />}
            onClick={handleMassDialogOpen}
            disabled={!selectedCount}
          >
            Entrega masiva{selectedCount ? ` (${selectedCount})` : ''}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Actualizar
          </Button>
        </Stack>
        <Button
          variant="contained"
          color="success"
          onClick={handleSaveChanges}
          disabled={saving || pendingUpdates.size === 0}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Stack>

      <Paper elevation={3}>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell
                      key={header.id}
                      align={header.column.columnDef.meta?.align ?? 'left'}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  selected={row.getIsSelected()}
                  onClick={(event) => {
                    if (event.target.closest('input') || event.target.closest('button')) return;
                    row.toggleSelected();
                  }}
                  sx={{
                    cursor: 'pointer',
                    ...(row.original.isDirty && !row.getIsSelected()
                      ? { backgroundColor: 'rgba(25, 118, 210, 0.04)' }
                      : {}),
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
              {!visibleRows.length && !loading && (
                <TableRow>
                  <TableCell colSpan={tableColumns.length} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No se encontraron comandas en distribución para mostrar.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography variant="body2">
                    Registros: <strong>{totalVisibleRecords}</strong>
                  </Typography>
                </TableCell>
                <TableCell colSpan={3}>
                  <Typography variant="body2">
                    Total bultos entregados:{' '}
                    <strong>{quantityFormatter.format(totalDeliveredUnits)}</strong>
                  </Typography>
                </TableCell>
                <TableCell colSpan={3} align="right">
                  <Typography variant="body2">
                    Total entregado:{' '}
                    <strong>{currencyFormatter.format(totalDeliveredAmount)}</strong>
                  </Typography>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </Paper>

      <Menu
        anchorEl={exportAnchor}
        open={Boolean(exportAnchor)}
        onClose={() => setExportAnchor(null)}
        keepMounted
      >
        <MenuItem
          onClick={() => {
            handleExportCsv();
            setExportAnchor(null);
          }}
        >
          Exportar CSV
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleExportExcel();
            setExportAnchor(null);
          }}
        >
          Exportar Excel
        </MenuItem>
      </Menu>

      <Dialog open={massDialog.open} onClose={handleMassDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Entrega masiva</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <DialogContentText>
              Ingresá la cantidad entregada a aplicar sobre las {selectedCount} filas seleccionadas.
            </DialogContentText>
            <TextField
              label="Cantidad entregada"
              type="number"
              value={massDialog.value}
              onChange={(event) =>
                setMassDialog((prev) => ({ ...prev, value: event.target.value, error: '' }))
              }
              inputProps={{ min: 0, step: '0.01' }}
              error={Boolean(massDialog.error)}
              helperText={
                massDialog.error ||
                'La cantidad se ajustará automáticamente al máximo permitido por cada ítem.'
              }
            />
            {selectedCount > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Resumen de cambios
                </Typography>
                <Stack component="ul" spacing={1} sx={{ pl: 2, listStyle: 'none' }}>
                  {massPreviewRows.map((preview) => (
                    <Box component="li" key={preview.id}>
                      <Typography variant="body2">
                        Com {preview.comanda} — {preview.cliente} / {preview.producto}:{' '}
                        {quantityFormatter.format(preview.previo)} →{' '}
                        {quantityFormatter.format(preview.nuevo)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMassDialogClose}>Cancelar</Button>
          <Button onClick={handleMassApply} variant="contained" disabled={!selectedCount}>
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
