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
  prev.forEach((option) => {
    if (!option) return;
    const key = option.id ?? option.label;
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, option);
    }
  });

  const initialSize = map.size;

  next.forEach((option) => {
    if (!option) return;
    const key = option.id ?? option.label;
    if (!key || map.has(key)) return;
    map.set(key, option);
  });

  if (map.size === initialSize) {
    return prev;
  }

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

  const rutaById = useMemo(() => {
    const map = new Map();
    rutaOptions.forEach((option) => {
      if (!option?.id || map.has(option.id)) return;
      map.set(option.id, option);
    });
    return map;
  }, [rutaOptions]);

  const rubroById = useMemo(() => {
    const map = new Map();
    rubroOptions.forEach((option) => {
      if (!option?.id || map.has(option.id)) return;
      map.set(option.id, option);
    });
    return map;
  }, [rubroOptions]);

  const loadCatalogues = useCallback(async () => {
    try {
      const [{ data: rutasResponse }, { data: rubrosResponse }] = await Promise.all([
        api.get('/rutas'),
        api.get('/rubros'),
      ]);

      const rutas = Array.isArray(rutasResponse)
        ? rutasResponse
        : rutasResponse?.rutas ?? [];
      const rubros = Array.isArray(rubrosResponse)
        ? rubrosResponse
        : rubrosResponse?.rubros ?? [];

      const rutaOptionsFromApi = rutas
        .map((ruta) =>
          buildOption(
            ruta?._id ?? ruta?.ruta ?? '',
            ruta?.ruta ?? ruta?.descripcion ?? '',
            ruta ?? null,
          ),
        )
        .filter(Boolean);

      const rubroOptionsFromApi = rubros
        .map((rubro) =>
          buildOption(
            rubro?._id ?? rubro?.codrubro ?? '',
            rubro?.rubro ?? rubro?.descripcion ?? '',
            rubro ?? null,
          ),
        )
        .filter(Boolean);

      setRutaOptions((prev) => mergeOptions(prev, rutaOptionsFromApi));
      setRubroOptions((prev) => mergeOptions(prev, rubroOptionsFromApi));
    } catch (error) {
      console.error('Error obteniendo catálogos de rutas/rubros', error);
    }
  }, []);

  const getRutaId = useCallback((row) => {
    if (!row) return null;
    const rutaValue = row?.codcli?.ruta;
    if (rutaValue && typeof rutaValue === 'object') {
      return rutaValue?._id ?? rutaValue?.id ?? null;
    }
    if (typeof rutaValue === 'string') {
      return rutaValue;
    }
    const camionRutaId = row?.camion?.rutaId;
    if (camionRutaId) return camionRutaId;
    return null;
  }, []);

  const getRutaLabel = useCallback(
    (row) => {
      if (!row) return '';
      const rutaValue = row?.codcli?.ruta;
      if (rutaValue && typeof rutaValue === 'object') {
        return rutaValue?.ruta ?? rutaValue?.descripcion ?? '';
      }

      const rutaId = getRutaId(row);
      if (rutaId && rutaById.has(rutaId)) {
        return rutaById.get(rutaId)?.label ?? '';
      }

      return row?.camion?.ruta ?? '';
    },
    [getRutaId, rutaById],
  );

  const getRubroId = useCallback((row) => {
    if (!row) return null;
    const rubroValue = row?.codprod?.rubro;
    if (rubroValue && typeof rubroValue === 'object') {
      return rubroValue?._id ?? rubroValue?.id ?? rubroValue?.codrubro ?? null;
    }
    if (typeof rubroValue === 'string') {
      return rubroValue;
    }
    return null;
  }, []);

  const getRubroLabel = useCallback(
    (row) => {
      if (!row) return '';
      const rubroValue = row?.codprod?.rubro;
      if (rubroValue && typeof rubroValue === 'object') {
        return rubroValue?.descripcion ?? rubroValue?.rubro ?? '';
      }

      const rubroId = getRubroId(row);
      if (rubroId && rubroById.has(rubroId)) {
        return rubroById.get(rubroId)?.label ?? '';
      }

      return '';
    },
    [getRubroId, rubroById],
  );

  const refreshOptions = useCallback(
    (comandas = []) => {
      const clienteMap = new Map();
      const productoMap = new Map();
      const camionMap = new Map();
      const rutaMap = new Map();
      const rubroMap = new Map();

      comandas.forEach((comanda) => {
        const clienteId = comanda?.codcli?._id ?? null;
        const clienteLabel = comanda?.codcli?.razonsocial ?? '';
        const camionId = comanda?.camion?._id ?? null;
        const camionLabel = comanda?.camion?.camion ?? '';
        const rutaId = getRutaId(comanda);
        const rutaLabel = getRutaLabel(comanda);

        if (clienteId && clienteLabel && !clienteMap.has(clienteId)) {
          clienteMap.set(
            clienteId,
            buildOption(clienteId, clienteLabel, comanda?.codcli ?? null),
          );
        }

        if ((rutaId || rutaLabel) && !rutaMap.has(rutaId ?? rutaLabel)) {
          const label = rutaLabel || rutaById.get(rutaId)?.label || '';
          if (label) {
            rutaMap.set(rutaId ?? label, buildOption(rutaId ?? label, label));
          }
        }

        if (camionLabel && !camionMap.has(camionLabel)) {
          camionMap.set(camionLabel, buildOption(camionId ?? camionLabel, camionLabel));
        }

        (comanda?.items ?? []).forEach((item) => {
          const productoId = item?.codprod?._id ?? null;
          const productoLabel = item?.codprod?.descripcion ?? '';
          const rubroId = getRubroId(item);
          const rubroLabel = getRubroLabel(item);

          if (productoId && productoLabel && !productoMap.has(productoId)) {
            productoMap.set(
              productoId,
              buildOption(productoId, productoLabel, item?.codprod ?? null),
            );
          }

          if ((rubroId || rubroLabel) && !rubroMap.has(rubroId ?? rubroLabel)) {
            const label = rubroLabel || rubroById.get(rubroId)?.label || '';
            if (label) {
              rubroMap.set(rubroId ?? label, buildOption(rubroId ?? label, label));
            }
          }
        });
      });

      setClienteOptions(Array.from(clienteMap.values()));
      setProductoOptions(Array.from(productoMap.values()));
      setCamionOptions(Array.from(camionMap.values()));

      const rutaExtras = Array.from(rutaMap.values());
      if (rutaExtras.length) {
        setRutaOptions((prev) => mergeOptions(prev, rutaExtras));
      }

      const rubroExtras = Array.from(rubroMap.values());
      if (rubroExtras.length) {
        setRubroOptions((prev) => mergeOptions(prev, rubroExtras));
      }
    },
    [getRutaId, getRutaLabel, getRubroId, getRubroLabel, rutaById, rubroById],
  );

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
    loadCatalogues();
  }, [loadCatalogues]);

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
      columnHelper.accessor((row) => getRutaLabel(row), {
        id: 'ruta',
        header: 'Ruta',
        cell: (info) => info.getValue() || '—',
        enableSorting: true,
        enableGrouping: true,
        filterFn: (row, columnId, value) => {
          if (!value?.id) return true;
          return getRutaId(row.original) === value.id;
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
      columnHelper.accessor((row) => getRubroLabel(row), {
        id: 'rubro',
        header: 'Rubro',
        cell: (info) => info.getValue() || '—',
        enableSorting: true,
        enableGrouping: true,
        sortingFn: 'alphanumeric',
        filterFn: (row, columnId, value) => {
          if (!value?.id) return true;
          return getRubroId(row.original) === value.id;
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
    [
      getRutaId,
      getRutaLabel,
      getRubroId,
      getRubroLabel,
      rutaById,
      rubroById,
      rutaOptions,
      rubroOptions,
    ],
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
        getRutaLabel(item),
        item?.codprod?.descripcion ?? '',
        getRubroLabel(item),
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
  }, [filteredRows, getRutaLabel, getRubroLabel]);

  const handleExportPdf = useCallback(() => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Órdenes – A preparar', 14, 18);
    const body = filteredRows.map((row) => {
      const item = row.original;
      return [
        item?.nrodecomanda ?? '',
        item?.codcli?.razonsocial ?? '',
        getRutaLabel(item),
        item?.codprod?.descripcion ?? '',
        getRubroLabel(item),
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
  }, [filteredRows, getRutaLabel, getRubroLabel]);

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
