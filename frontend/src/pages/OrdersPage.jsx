import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';

const columnHelper = createColumnHelper();

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const buildOption = (id, label, raw = null) => {
  if (!id || !label) return null;
  return { id, label, raw };
};

const mergeOptions = (prev = [], next = []) => {
  const map = new Map();
  [...prev, ...next].forEach((option) => {
    if (!option) return;
    const key = option.id ?? option.label;
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, option);
    }
  });
  return Array.from(map.values());
};

const findFilterValue = (filters, id) => filters.find((filter) => filter.id === id)?.value ?? null;

const buildFiltersUpdater = (id, value) => (prev) => {
  const next = prev.filter((filter) => filter.id !== id);
  if (value) {
    next.push({ id, value });
  }
  return next;
};

export default function OrdersPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [estadoId, setEstadoId] = useState(null);

  const [clienteOptions, setClienteOptions] = useState([]);
  const [rutaOptions, setRutaOptions] = useState([]);
  const [productoOptions, setProductoOptions] = useState([]);
  const [rubroOptions, setRubroOptions] = useState([]);
  const [camionOptions, setCamionOptions] = useState([]);

  const refreshOptions = useCallback((comandas = []) => {
    const clienteMap = new Map();
    const productoMap = new Map();
    const camionMap = new Map();

    comandas.forEach((comanda) => {
      const clienteId = comanda?.codcli?._id ?? null;
      const clienteLabel = comanda?.codcli?.razonsocial ?? '';
      const camionId = comanda?.camion?._id ?? null;
      const camionLabel = comanda?.camion?.camion ?? '';

      if (clienteId && clienteLabel && !clienteMap.has(clienteId)) {
        clienteMap.set(clienteId, buildOption(clienteId, clienteLabel, comanda?.codcli ?? null));
      }
      if (camionLabel && !camionMap.has(camionLabel)) {
        camionMap.set(camionLabel, buildOption(camionId ?? camionLabel, camionLabel));
      }

      (comanda?.items ?? []).forEach((item) => {
        const productoId = item?.codprod?._id ?? null;
        const productoLabel = item?.codprod?.descripcion ?? '';

        if (productoId && productoLabel && !productoMap.has(productoId)) {
          productoMap.set(productoId, buildOption(productoId, productoLabel, item?.codprod ?? null));
        }
      });
    });

    setClienteOptions(Array.from(clienteMap.values()));
    setProductoOptions(Array.from(productoMap.values()));
    setCamionOptions(Array.from(camionMap.values()));
  }, []);

  const fetchRutas = useCallback(async () => {
    try {
      const { data: response } = await api.get('/rutas');
      const rutas = Array.isArray(response) ? response : response?.rutas ?? [];
      const options = rutas
        .map((ruta) => {
          const id = ruta?._id ?? ruta?.ruta ?? '';
          const label = ruta?.ruta ?? ruta?.descripcion ?? '';
          if (!id || !label) return null;
          return { id, label };
        })
        .filter(Boolean);
      setRutaOptions((prev) => mergeOptions(prev, options));
    } catch (error) {
      console.error('Error obteniendo rutas', error);
    }
  }, []);

  const fetchRubros = useCallback(async () => {
    try {
      const { data: response } = await api.get('/rubros');
      const rubros = Array.isArray(response) ? response : response?.rubros ?? [];
      const options = rubros
        .map((rubro) =>
          buildOption(
            rubro?._id ?? rubro?.codrubro ?? '',
            rubro?.rubro ?? rubro?.descripcion ?? '',
            rubro ?? null,
          ),
        )
        .filter(Boolean);
      setRubroOptions((prev) => mergeOptions(prev, options));
    } catch (error) {
      console.error('Error obteniendo rubros', error);
    }
  }, []);

  const fetchEstados = useCallback(async () => {
    try {
      const { data: response } = await api.get('/estados');
      const estados = Array.isArray(response) ? response : response?.estados ?? [];
      const aPreparar = estados.find((estado) => {
        const label = estado?.estado ?? estado?.descripcion ?? '';
        return label.trim().toLowerCase() === 'a preparar';
      });
      if (aPreparar?._id) {
        setEstadoId(aPreparar._id);
      }
    } catch (error) {
      console.error('Error obteniendo estados', error);
    }
  }, []);

  const fetchOrders = useCallback(
    async (paramsEstadoId) => {
      if (!paramsEstadoId) return;
      setLoading(true);
      try {
        const { data: response } = await api.get('/comandas', {
          params: { estado: paramsEstadoId },
        });
        const comandas = response?.comandas ?? [];
        const items = comandas.flatMap((comanda) => {
          const comandaItems = Array.isArray(comanda?.items) ? comanda.items : [];
          if (!comandaItems.length) {
            return [
              {
                comandaId: comanda?._id ?? null,
                nrodecomanda: comanda?.nrodecomanda ?? '',
                codcli: comanda?.codcli ?? null,
                camion: comanda?.camion ?? null,
                cantidad: 0,
                codprod: null,
                showCamion: true,
              },
            ];
          }
          return comandaItems.map((item, index) => ({
            ...item,
            comandaId: comanda?._id ?? null,
            nrodecomanda: comanda?.nrodecomanda ?? '',
            codcli: comanda?.codcli ?? null,
            camion: comanda?.camion ?? null,
            showCamion: index === 0,
          }));
        });
        setData(items);
        setRowSelection({});
        refreshOptions(comandas);
      } catch (error) {
        console.error('Error obteniendo órdenes', error);
        setData([]);
        refreshOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [refreshOptions],
  );

  useEffect(() => {
    fetchEstados();
  }, [fetchEstados]);

  useEffect(() => {
    fetchRutas();
    fetchRubros();
  }, [fetchRutas, fetchRubros]);

  useEffect(() => {
    if (estadoId) {
      fetchOrders(estadoId);
    }
  }, [estadoId, fetchOrders]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('nrodecomanda', {
        header: 'Nro. comanda',
        cell: (info) => info.getValue() ?? '—',
        aggregatedCell: () => '—',
        enableSorting: true,
        enableGrouping: true,
        sortingFn: 'alphanumeric',
      }),
      columnHelper.accessor((row) => row?.codcli?.razonsocial ?? '', {
        id: 'cliente',
        header: 'Cliente',
        cell: (info) => info.getValue() || '—',
        enableSorting: true,
        enableGrouping: true,
        filterFn: (row, columnId, value) => {
          if (!value?.id) return true;
          return (row.original?.codcli?._id ?? '') === value.id;
        },
      }),
      columnHelper.accessor((row) => row?.codcli?.ruta?.ruta ?? row?.camion?.ruta ?? '', {
        id: 'ruta',
        header: 'Ruta',
        cell: (info) => info.getValue() || '—',
        enableSorting: true,
        enableGrouping: true,
        filterFn: (row, columnId, value) => {
          if (!value?.label) return true;
          const ruta = row.original?.codcli?.ruta?.ruta ?? row.original?.camion?.ruta ?? '';
          return ruta === value.label;
        },
      }),
      columnHelper.accessor((row) => row?.codprod?.descripcion ?? '', {
        id: 'producto',
        header: 'Producto',
        cell: (info) => info.getValue() || '—',
        enableSorting: true,
        enableGrouping: true,
        sortingFn: 'alphanumeric',
        filterFn: (row, columnId, value) => {
          if (!value?.id) return true;
          return (row.original?.codprod?._id ?? '') === value.id;
        },
      }),
      columnHelper.accessor((row) => row?.codprod?.rubro?.descripcion ?? '', {
        id: 'rubro',
        header: 'Rubro',
        cell: (info) => info.getValue() || '—',
        enableSorting: true,
        enableGrouping: true,
        sortingFn: 'alphanumeric',
        filterFn: (row, columnId, value) => {
          if (!value?.id) return true;
          return (row.original?.codprod?.rubro?._id ?? '') === value.id;
        },
      }),
      columnHelper.accessor((row) => row?.camion?.camion ?? '', {
        id: 'camion',
        header: 'Camión',
        cell: (info) => (info.row.original?.showCamion ? info.getValue() || '—' : ''),
        aggregatedCell: () => '—',
        enableSorting: true,
        enableGrouping: true,
        sortingFn: 'alphanumeric',
        filterFn: (row, columnId, value) => {
          if (!value?.label) return true;
          return (row.original?.camion?.camion ?? '') === value.label;
        },
      }),
      columnHelper.accessor((row) => Number(row?.cantidad ?? 0), {
        id: 'cantidad',
        header: 'Cantidad',
        cell: (info) => numberFormatter.format(info.getValue() ?? 0),
        aggregatedCell: (info) => numberFormatter.format(info.getValue() ?? 0),
        footer: (info) => {
          const totalCantidad = info.table
            .getFilteredRowModel()
            .flatRows.reduce((acc, row) => acc + Number(row.original?.cantidad ?? 0), 0);
          return numberFormatter.format(totalCantidad);
        },
        aggregationFn: 'sum',
        enableSorting: true,
        enableGrouping: true,
        sortingFn: (rowA, rowB) => {
          const a = Number(rowA.original?.cantidad ?? 0);
          const b = Number(rowB.original?.cantidad ?? 0);
          return a === b ? 0 : a > b ? 1 : -1;
        },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      sorting,
      rowSelection,
    },
    enableGrouping: true,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredRows = table.getFilteredRowModel().flatRows;

  const { totalRegistros, totalBultos } = useMemo(() => {
    const totalCantidad = filteredRows.reduce(
      (acc, row) => acc + Number(row.original?.cantidad ?? 0),
      0,
    );

    return {
      totalRegistros: filteredRows.length,
      totalBultos: totalCantidad,
    };
  }, [filteredRows]);

  const handleFilterChange = useCallback(
    (id) => (event, value) => {
      setColumnFilters(buildFiltersUpdater(id, value));
    },
    [],
  );

  const handleExportCsv = useCallback(() => {
    if (!filteredRows.length) return;
    const headers = [
      'Nro. comanda',
      'Cliente',
      'Ruta',
      'Producto',
      'Rubro',
      'Camión',
      'Cantidad',
    ];
    const rows = filteredRows.map((row) => {
      const item = row.original;
      return [
        item?.nrodecomanda ?? '',
        item?.codcli?.razonsocial ?? '',
        item?.codcli?.ruta?.ruta ?? item?.camion?.ruta ?? '',
        item?.codprod?.descripcion ?? '',
        item?.codprod?.rubro?.descripcion ?? '',
        item?.showCamion ? item?.camion?.camion ?? '' : '',
        numberFormatter.format(Number(item?.cantidad ?? 0)),
      ];
    });
    const content = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ordenes_a_preparar_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  const handleExportPdf = useCallback(() => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Órdenes – A preparar', 14, 18);
    const body = filteredRows.map((row) => {
      const item = row.original;
      return [
        item?.nrodecomanda ?? '',
        item?.codcli?.razonsocial ?? '',
        item?.codcli?.ruta?.ruta ?? item?.camion?.ruta ?? '',
        item?.codprod?.descripcion ?? '',
        item?.codprod?.rubro?.descripcion ?? '',
        item?.showCamion ? item?.camion?.camion ?? '' : '',
        numberFormatter.format(Number(item?.cantidad ?? 0)),
      ];
    });
    autoTable(doc, {
      head: [[
        'Nro. comanda',
        'Cliente',
        'Ruta',
        'Producto',
        'Rubro',
        'Camión',
        'Cantidad',
      ]],
      body,
      startY: 24,
    });
    doc.save('ordenes_a_preparar.pdf');
  }, [filteredRows]);

  return (
    <Stack spacing={3} sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">Órdenes — A preparar</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCsv}
            disabled={!filteredRows.length}
          >
            Exportar CSV
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleExportPdf}
            disabled={!filteredRows.length}
          >
            Exportar PDF
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
          <Autocomplete
            options={clienteOptions}
            value={findFilterValue(columnFilters, 'cliente')}
            onChange={handleFilterChange('cliente')}
            getOptionLabel={(option) => option?.label ?? ''}
            renderInput={(params) => <TextField {...params} label="Cliente" size="small" />}
            sx={{ minWidth: { xs: '100%', md: 240 } }}
          />
          <Autocomplete
            options={rutaOptions}
            value={findFilterValue(columnFilters, 'ruta')}
            onChange={handleFilterChange('ruta')}
            getOptionLabel={(option) => option?.label ?? ''}
            renderInput={(params) => <TextField {...params} label="Ruta" size="small" />}
            sx={{ minWidth: { xs: '100%', md: 200 } }}
          />
          <Autocomplete
            options={productoOptions}
            value={findFilterValue(columnFilters, 'producto')}
            onChange={handleFilterChange('producto')}
            getOptionLabel={(option) => option?.label ?? ''}
            renderInput={(params) => <TextField {...params} label="Producto" size="small" />}
            sx={{ minWidth: { xs: '100%', md: 240 } }}
          />
          <Autocomplete
            options={rubroOptions}
            value={findFilterValue(columnFilters, 'rubro')}
            onChange={handleFilterChange('rubro')}
            getOptionLabel={(option) => option?.label ?? ''}
            renderInput={(params) => <TextField {...params} label="Rubro" size="small" />}
            sx={{ minWidth: { xs: '100%', md: 200 } }}
          />
          <Autocomplete
            options={camionOptions}
            value={findFilterValue(columnFilters, 'camion')}
            onChange={handleFilterChange('camion')}
            getOptionLabel={(option) => option?.label ?? ''}
            renderInput={(params) => <TextField {...params} label="Camión" size="small" />}
            sx={{ minWidth: { xs: '100%', md: 200 } }}
          />
        </Stack>
      </Paper>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableCell key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : (
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {header.column.getCanGroup() && (
                            <Tooltip
                              title={
                                header.column.getIsGrouped()
                                  ? 'Quitar agrupación'
                                  : 'Agrupar por esta columna'
                              }
                            >
                              <IconButton
                                size="small"
                                onClick={header.column.getToggleGroupingHandler()}
                              >
                                <GroupWorkIcon fontSize="inherit" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </Typography>
                        </Stack>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {cell.getIsGrouped() ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <IconButton size="small" onClick={row.getToggleExpandedHandler()}>
                            {row.getIsExpanded() ? (
                              <ExpandLessIcon fontSize="inherit" />
                            ) : (
                              <ExpandMoreIcon fontSize="inherit" />
                            )}
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                              ({row.subRows.length})
                            </Typography>
                          </Typography>
                        </Stack>
                      ) : cell.getIsAggregated() ? (
                        flexRender(cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell, cell.getContext())
                      ) : cell.getIsPlaceholder() ? null : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell align="right" colSpan={columns.length - 1} sx={{ fontWeight: 600 }}>
                  Total visibles
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {numberFormatter.format(totalBultos)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {loading && <LinearProgress />}
        </TableContainer>
      </Paper>

      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Total registros: {totalRegistros} — Total bultos: {numberFormatter.format(totalBultos)}
        </Typography>
      </Box>
    </Stack>
  );
}
