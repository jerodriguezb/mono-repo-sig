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
  IconButton,
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
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import dayjs from 'dayjs';
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
  if (Number.isFinite(max)) {
    return Math.min(sanitized, max);
  }
  return sanitized;
};

const buildRowId = (comandaId, itemId, index) => {
  if (itemId) return `${comandaId}-${itemId}`;
  return `${comandaId}-item-${index}`;
};

export default function DistribucionPage() {
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
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [saving, setSaving] = useState(false);

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
        const cantidad = Number(item?.cantidad ?? 0);
        const monto = Number(item?.monto ?? 0);
        const cantidadEntregada = Number(item?.cantidadentregada ?? 0);
        result.push({
          rowId,
          comandaId: comanda?._id ?? null,
          itemId: itemId ?? `item-${index}`,
          nrodecomanda: comanda?.nrodecomanda ?? '',
          clienteNombre,
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
        const cantidad = Number(update.cantidad ?? 0);
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
        const cantidad = Number(update.cantidad ?? 0);
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
      return;
    }

    const numeric = Number(massDialog.value);
    if (Number.isNaN(numeric) || numeric < 0) {
      setMassDialog((prev) => ({ ...prev, error: 'Ingresa un valor válido (≥ 0).' }));
      return;
    }

    const updates = new Map();
    selectedRows.forEach((tableRow) => {
      const row = tableRow.original;
      const cantidad = clampDelivered(numeric, row.cantidad);
      updates.set(row.rowId, { cantidad });
    });

    applyDeliveredValue(updates);
    setMassDialog({ open: false, value: '', error: '' });
    showSnackbar('Entrega masiva aplicada correctamente. Recuerda guardar los cambios.', 'success');
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

  const filterFns = useMemo(
    () => ({
      includesString: (row, columnId, value) => {
        if (!value && value !== 0) return true;
        const rowValue = row.getValue(columnId);
        return String(rowValue ?? '')
          .toLowerCase()
          .includes(String(value ?? '').toLowerCase());
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
      columnHelper.accessor('productoDescripcion', {
        header: 'Producto',
        cell: (info) => info.getValue() ?? '—',
        filterFn: 'includesString',
        meta: { filterLabel: 'producto' },
      }),
      columnHelper.accessor('cantidad', {
        header: 'Cant',
        cell: (info) => quantityFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        meta: { filterLabel: 'cantidad', align: 'right' },
      }),
      columnHelper.accessor('monto', {
        header: 'Precio unitario',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        meta: { filterLabel: 'precio', align: 'right' },
      }),
      columnHelper.accessor('total', {
        header: 'Total',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
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
              size="small"
              onChange={(event) => handleCantidadEntregadaChange(row, event.target.value)}
              inputProps={{ min: 0, max: row.cantidad, step: '0.01' }}
              sx={{ maxWidth: 120 }}
            />
          );
        },
        filterFn: 'includesString',
        meta: { filterLabel: 'cantidad entregada', align: 'right' },
      }),
      columnHelper.accessor('totalEntregado', {
        header: 'Total entreg',
        cell: (info) => decimalFormatter.format(Number(info.getValue() ?? 0)),
        filterFn: 'includesString',
        meta: { filterLabel: 'total entregado', align: 'right' },
      }),
    ],
    [handleCantidadEntregadaChange],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      columnFilters,
      sorting,
      rowSelection,
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    filterFns,
    getRowId: (row) => row.rowId,
  });

  const renderColumnFilter = (column) => {
    if (!column.getCanFilter()) return null;
    const value = column.getFilterValue() ?? '';
    return (
      <TextField
        size="small"
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

  const selectedRows = table.getSelectedRowModel().rows;
  const hasEditedRows = Object.keys(editedRows).length > 0;
  const totalRows = table.getRowModel().rows;
  const totalRegistros = totalRows.length;
  let totalCantidadEntregada = 0;
  let totalMontoEntregado = 0;
  totalRows.forEach((row) => {
    totalCantidadEntregada += Number(row.original?.cantidadEntregada ?? 0);
    totalMontoEntregado += Number(row.original?.totalEntregado ?? 0);
  });

  const handleExportMenuOpen = (event) => {
    setExportMenuAnchor(event.currentTarget);
  };

  const handleExportMenuClose = () => {
    setExportMenuAnchor(null);
  };

  const buildExportMatrix = () => {
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

    const body = totalRows.map((row) => {
      const original = row.original;
      return [
        original.nrodecomanda ?? '',
        original.clienteNombre ?? '',
        original.productoDescripcion ?? '',
        quantityFormatter.format(Number(original.cantidad ?? 0)),
        decimalFormatter.format(Number(original.monto ?? 0)),
        decimalFormatter.format(Number(original.total ?? 0)),
        quantityFormatter.format(Number(original.cantidadEntregada ?? 0)),
        decimalFormatter.format(Number(original.totalEntregado ?? 0)),
      ];
    });

    return { headers, body };
  };

  const handleExportCsv = () => {
    const { headers, body } = buildExportMatrix();
    const content = [headers, ...body]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `distribucion_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    handleExportMenuClose();
  };

  const handleExportExcel = () => {
    const { headers, body } = buildExportMatrix();
    const tableHtml = `\uFEFF<table><thead><tr>${headers
      .map((header) => `<th>${header}</th>`)
      .join('')}</tr></thead><tbody>${body
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;

    const blob = new Blob([tableHtml], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `distribucion_${dayjs().format('YYYYMMDD_HHmmss')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    handleExportMenuClose();
  };

  const handleExportPdf = () => {
    const { headers, body } = buildExportMatrix();
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.text('En distribución', 14, 18);
    doc.setFontSize(11);
    doc.text(`Registros: ${totalRegistros}`, 14, 26);
    doc.text(
      `Total bultos entregados: ${quantityFormatter.format(totalCantidadEntregada)}`,
      14,
      33,
    );

    autoTable(doc, {
      startY: 40,
      head: [headers],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [21, 101, 192] },
    });

    doc.save(`distribucion_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`);
  };

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
  const massPreviewValue = Number(massDialog.value);
  const hasMassValue = !Number.isNaN(massPreviewValue);

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          p: 3,
          borderRadius: 3,
          bgcolor: 'primary.dark',
          color: 'common.white',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            En distribución
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              variant="contained"
              color="secondary"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportMenuOpen}
            >
              Exportar CSV/Excel
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleExportPdf}
            >
              Exportar PDF
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Menu anchorEl={exportMenuAnchor} open={Boolean(exportMenuAnchor)} onClose={handleExportMenuClose}>
        <MenuItem onClick={handleExportCsv}>CSV</MenuItem>
        <MenuItem onClick={handleExportExcel}>Excel</MenuItem>
      </Menu>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<DoneAllIcon />}
            onClick={handleMassiveDialogOpen}
            disabled={selectedCount === 0}
          >
            Entrega Masiva
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleReload}>
            Recargar
          </Button>
        </Stack>
        <Button
          variant="contained"
          color="success"
          startIcon={<SaveIcon />}
          onClick={handleSaveChanges}
          disabled={!hasEditedRows || saving}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Stack>

      <Paper sx={{ position: 'relative' }}>
        {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
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
              {table.getRowModel().rows.map((row) => (
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
              {!loading && table.getRowModel().rows.length === 0 && (
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
      </Paper>

      <Paper sx={{ mt: 2, p: 2 }} variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Total de registros: {totalRegistros}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Suma Cant entreg: {quantityFormatter.format(totalCantidadEntregada)}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Suma Total entreg: {decimalFormatter.format(totalMontoEntregado)}
          </Typography>
        </Stack>
      </Paper>

      <Dialog open={massDialog.open} onClose={handleMassDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>Entrega Masiva</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2 }}>
            Ingresa la cantidad entregada que deseas asignar a las {selectedCount}{' '}
            {selectedCount === 1 ? 'fila seleccionada' : 'filas seleccionadas'}. El valor se
            ajustará automáticamente para no superar la cantidad solicitada de cada producto.
          </DialogContentText>
          <TextField
            label="Cantidad entregada"
            type="number"
            fullWidth
            value={massDialog.value}
            onChange={(event) => setMassDialog((prev) => ({ ...prev, value: event.target.value }))}
            inputProps={{ min: 0, step: '0.01' }}
            error={Boolean(massDialog.error)}
            helperText={massDialog.error || 'Ingresa un número mayor o igual a 0.'}
            sx={{ mb: 3 }}
          />
          {selectedCount > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Resumen (primeras {Math.min(selectedCount, 5)} filas):
              </Typography>
              {selectedRows.slice(0, 5).map((row) => {
                const original = row.original;
                const preview = hasMassValue
                  ? clampDelivered(massPreviewValue, original.cantidad)
                  : '—';
                return (
                  <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Comanda {original.nrodecomanda ?? '—'} — {original.productoDescripcion ?? '—'}
                    </Typography>
                    <Typography variant="body2">
                      Actual: {quantityFormatter.format(Number(original.cantidadEntregada ?? 0))} |{' '}
                      Nuevo: {typeof preview === 'number' ? quantityFormatter.format(preview) : '—'}
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
