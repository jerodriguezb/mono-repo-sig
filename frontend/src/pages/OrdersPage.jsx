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
  TablePagination,
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
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/axios';

const PAGE_SIZE = 20;
const columnHelper = createColumnHelper();

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const GROUPABLE_COLUMNS = new Set(['nrodecomanda', 'cliente', 'ruta', 'producto', 'rubro', 'camion']);
const GROUP_LABELS = {
  nrodecomanda: 'Nro. comanda',
  cliente: 'Cliente',
  ruta: 'Ruta',
  producto: 'Productos',
  rubro: 'Rubro',
  camion: 'Camión',
};

const sumCantidad = (items = []) =>
  items.reduce((acc, item) => acc + Number(item?.cantidad ?? 0), 0);

const formatProductsSummary = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return '—';

  const summaries = items
    .map((item) => {
      const descripcionValue = item?.codprod?.descripcion;
      const presentacionValue = item?.codprod?.presentacion;
      const descripcion = typeof descripcionValue === 'string' ? descripcionValue.trim() : '';
      const presentacion =
        typeof presentacionValue === 'string' ? presentacionValue.trim() : '';
      const cantidadText = String(item?.cantidad ?? '').trim();
      const label = [descripcion, presentacion].filter(Boolean).join(' ').trim();
      if (!label || !cantidadText) return '';
      return `${label} (${cantidadText})`;
    })
    .filter(Boolean);

  return summaries.length ? summaries.join(' - ') : '—';
};

const aggregateGroupProducts = (orders = []) => {
  const map = new Map();
  orders.forEach((order) => {
    (order?.items ?? []).forEach((item) => {
      const descripcion = typeof item?.codprod?.descripcion === 'string' ? item.codprod.descripcion.trim() : '';
      const presentacion = typeof item?.codprod?.presentacion === 'string' ? item.codprod.presentacion.trim() : '';
      const label = [descripcion, presentacion].filter(Boolean).join(' ').trim();
      if (!label) return;
      const cantidad = Number(item?.cantidad ?? 0);
      const current = map.get(label) ?? 0;
      map.set(label, current + (Number.isFinite(cantidad) ? cantidad : 0));
    });
  });
  const entries = Array.from(map.entries()).map(([label, quantity]) => ({ label, quantity }));
  const summary = entries.length
    ? entries
        .map(({ label, quantity }) => `${label} (${numberFormatter.format(quantity)})`)
        .join(' - ')
    : '—';
  return { entries, summary };
};

const buildGroupTitle = (groupBy, values = {}) => {
  if (!Array.isArray(groupBy) || !groupBy.length) return '';
  return groupBy
    .map((field) => {
      const label = GROUP_LABELS[field] ?? field;
      const value = values[field] ?? '—';
      return `${label}: ${value}`;
    })
    .join(' • ');
};

const buildOption = (id, label, raw = null) => {
  if (!id || !label) return null;
  return { id, label, raw };
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
  const [tableData, setTableData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [page, setPage] = useState(0);
  const [estadoId, setEstadoId] = useState(null);
  const [groupBy, setGroupBy] = useState([]);
  const [groupedData, setGroupedData] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  const [clienteOptions, setClienteOptions] = useState([]);
  const [rutaOptions, setRutaOptions] = useState([]);
  const [productoOptions, setProductoOptions] = useState([]);
  const [rubroOptions, setRubroOptions] = useState([]);
  const [camionOptions, setCamionOptions] = useState([]);

  const refreshOptions = useCallback((comandas = []) => {
    const clienteMap = new Map();
    const rutaMap = new Map();
    const productoMap = new Map();
    const rubroMap = new Map();
    const camionMap = new Map();

    comandas.forEach((comanda) => {
      const clienteId = comanda?.codcli?._id ?? null;
      const clienteLabel = comanda?.codcli?.razonsocial ?? '';
      const rutaId = comanda?.codcli?.ruta?._id ?? comanda?.camion?.rutaId ?? null;
      const rutaLabel = comanda?.codcli?.ruta?.ruta ?? comanda?.camion?.ruta ?? '';
      const camionId = comanda?.camion?._id ?? null;
      const camionLabel = comanda?.camion?.camion ?? '';

      if (clienteId && clienteLabel && !clienteMap.has(clienteId)) {
        clienteMap.set(clienteId, buildOption(clienteId, clienteLabel, comanda?.codcli ?? null));
      }
      if (rutaLabel && !rutaMap.has(rutaLabel)) {
        rutaMap.set(rutaLabel, buildOption(rutaId ?? rutaLabel, rutaLabel));
      }
      if (camionLabel && !camionMap.has(camionLabel)) {
        camionMap.set(camionLabel, buildOption(camionId ?? camionLabel, camionLabel));
      }

      (comanda?.items ?? []).forEach((item) => {
        const productoId = item?.codprod?._id ?? null;
        const productoLabel = item?.codprod?.descripcion ?? '';
        const rubroId = item?.codprod?.rubro?._id ?? null;
        const rubroLabel = item?.codprod?.rubro?.descripcion ?? '';

        if (productoId && productoLabel && !productoMap.has(productoId)) {
          productoMap.set(productoId, buildOption(productoId, productoLabel, item?.codprod ?? null));
        }
        if (rubroId && rubroLabel && !rubroMap.has(rubroId)) {
          rubroMap.set(rubroId, buildOption(rubroId, rubroLabel));
        }
      });
    });

    setClienteOptions(Array.from(clienteMap.values()));
    setRutaOptions(Array.from(rutaMap.values()));
    setProductoOptions(Array.from(productoMap.values()));
    setRubroOptions(Array.from(rubroMap.values()));
    setCamionOptions(Array.from(camionMap.values()));
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
    async (paramsEstadoId, currentPage, currentGroupBy) => {
      if (!paramsEstadoId) return;
      setLoading(true);
      try {
        const { data: response } = await api.get('/comandas/logistica', {
          params: {
            estado: paramsEstadoId,
            page: currentPage + 1,
            limit: PAGE_SIZE,
            groupBy: currentGroupBy,
          },
        });
        const comandas = response?.comandas ?? [];
        const grouped = Array.isArray(response?.grouped?.buckets) ? response.grouped : null;
        const ordersForTable = Array.isArray(currentGroupBy) && currentGroupBy.length && grouped
          ? grouped.buckets.flatMap((bucket) => bucket?.orders ?? [])
          : comandas;
        setTableData(ordersForTable);
        setGroupedData(grouped);
        setTotal(response?.total ?? ordersForTable.length);
        setRowSelection({});
        refreshOptions(ordersForTable);
      } catch (error) {
        console.error('Error obteniendo órdenes', error);
        setTableData([]);
        setTotal(0);
        refreshOptions([]);
        setGroupedData(null);
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
    if (estadoId) {
      fetchOrders(estadoId, page, groupBy);
    }
  }, [estadoId, fetchOrders, page, groupBy]);

  useEffect(() => {
    if (!groupBy.length || !groupedData) {
      setExpandedGroups({});
      return;
    }
    setExpandedGroups((prev) => {
      const next = {};
      groupedData.buckets.forEach((bucket) => {
        const key = bucket?.key ?? '';
        if (!key) return;
        next[key] = typeof prev[key] === 'boolean' ? prev[key] : true;
      });
      return next;
    });
  }, [groupBy, groupedData]);

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
      columnHelper.accessor((row) => formatProductsSummary(row?.items), {
        id: 'producto',
        header: 'Productos',
        cell: (info) => info.getValue() || '—',
        enableSorting: false,
        enableGrouping: true,
        filterFn: (row, columnId, value) => {
          if (!value?.id) return true;
          return (row.original?.items ?? []).some((item) => (item?.codprod?._id ?? '') === value.id);
        },
      }),
      columnHelper.accessor((row) => row?.items?.[0]?.codprod?.rubro?.descripcion ?? '', {
        id: 'rubro',
        header: 'Rubro',
        cell: (info) => info.getValue() || '—',
        enableSorting: true,
        enableGrouping: true,
        filterFn: (row, columnId, value) => {
          if (!value?.id) return true;
          return (row.original?.items ?? []).some(
            (item) => (item?.codprod?.rubro?._id ?? '') === value.id,
          );
        },
      }),
      columnHelper.accessor((row) => row?.camion?.camion ?? '', {
        id: 'camion',
        header: 'Camión',
        cell: (info) => info.getValue() || '—',
        enableSorting: true,
        enableGrouping: true,
        filterFn: (row, columnId, value) => {
          if (!value?.label) return true;
          return (row.original?.camion?.camion ?? '') === value.label;
        },
      }),
      columnHelper.accessor((row) => sumCantidad(row?.items), {
        id: 'cantidadTotal',
        header: 'Cantidad total',
        cell: (info) => numberFormatter.format(info.getValue() ?? 0),
        aggregatedCell: (info) => numberFormatter.format(info.getValue() ?? 0),
        footer: (info) => {
          const totalCantidad = info.table
            .getFilteredRowModel()
            .flatRows.reduce((acc, row) => acc + sumCantidad(row.original?.items), 0);
          return numberFormatter.format(totalCantidad);
        },
        aggregationFn: 'sum',
        enableSorting: true,
        enableGrouping: true,
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: tableData,
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
  });

  const filteredRows = table.getFilteredRowModel().flatRows;
  const totalRegistros = filteredRows.length;
  const totalBultos = filteredRows.reduce(
    (acc, row) => acc + sumCantidad(row.original?.items),
    0,
  );

  const filteredRowMap = useMemo(() => {
    const map = new Map();
    filteredRows.forEach((row) => {
      const id = row.original?._id ?? row.id;
      if (id) {
        map.set(String(id), row);
      }
    });
    return map;
  }, [filteredRows]);

  const visibleGroupedBuckets = useMemo(() => {
    if (!groupBy.length || !groupedData) return [];
    return (groupedData.buckets ?? [])
      .map((bucket) => {
        const rows = (bucket?.orders ?? [])
          .map((order) => filteredRowMap.get(String(order?._id)))
          .filter(Boolean);
        if (!rows.length) return null;
        const orders = rows.map((row) => row.original);
        const totalCantidadGrupo = orders.reduce(
          (acc, order) => acc + sumCantidad(order?.items),
          0,
        );
        const { summary } = aggregateGroupProducts(orders);
        return {
          key: bucket?.key ?? rows[0].id,
          title: buildGroupTitle(groupBy, bucket?.groupValues ?? {}),
          groupValues: bucket?.groupValues ?? {},
          rows,
          count: orders.length,
          totalCantidad: totalCantidadGrupo,
          productosResumen: summary,
        };
      })
      .filter(Boolean);
  }, [groupBy, groupedData, filteredRowMap]);

  const handleToggleGroup = useCallback((columnId) => {
    if (!GROUPABLE_COLUMNS.has(columnId)) return;
    setGroupBy((prev) => {
      const exists = prev.includes(columnId);
      const next = exists ? prev.filter((id) => id !== columnId) : [...prev, columnId];
      setPage(0);
      return next;
    });
  }, []);

  const handleFilterChange = useCallback(
    (id) => (event, value) => {
      setColumnFilters(buildFiltersUpdater(id, value));
      setPage(0);
    },
    [],
  );

  const handleExportCsv = useCallback(() => {
    if (!filteredRows.length) return;
    const headers = [
      'Nro. comanda',
      'Cliente',
      'Ruta',
      'Productos',
      'Rubro',
      'Camión',
      'Cantidad total',
    ];
    const rows = filteredRows.map((row) => {
      const comanda = row.original;
      return [
        comanda?.nrodecomanda ?? '',
        comanda?.codcli?.razonsocial ?? '',
        comanda?.codcli?.ruta?.ruta ?? comanda?.camion?.ruta ?? '',
        formatProductsSummary(comanda?.items),
        comanda?.items?.[0]?.codprod?.rubro?.descripcion ?? '',
        comanda?.camion?.camion ?? '',
        numberFormatter.format(sumCantidad(comanda?.items)),
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
      const comanda = row.original;
      return [
        comanda?.nrodecomanda ?? '',
        comanda?.codcli?.razonsocial ?? '',
        comanda?.codcli?.ruta?.ruta ?? comanda?.camion?.ruta ?? '',
        formatProductsSummary(comanda?.items),
        comanda?.items?.[0]?.codprod?.rubro?.descripcion ?? '',
        comanda?.camion?.camion ?? '',
        numberFormatter.format(sumCantidad(comanda?.items)),
      ];
    });
    autoTable(doc, {
      head: [[
        'Nro. comanda',
        'Cliente',
        'Ruta',
        'Productos',
        'Rubro',
        'Camión',
        'Cantidad total',
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
                          {GROUPABLE_COLUMNS.has(header.column.id) && (
                            <Tooltip
                              title={
                                groupBy.includes(header.column.id)
                                  ? 'Quitar agrupación'
                                  : 'Agrupar por esta columna'
                              }
                            >
                              <IconButton
                                size="small"
                                color={groupBy.includes(header.column.id) ? 'primary' : 'default'}
                                onClick={() => handleToggleGroup(header.column.id)}
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
              {groupBy.length === 0
                ? table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : visibleGroupedBuckets.map((bucket) => (
                    <React.Fragment key={bucket.key}>
                      <TableRow>
                        {table.getVisibleLeafColumns().map((column) => {
                          let content = '—';
                          if (column.id === 'nrodecomanda') {
                            content = (
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setExpandedGroups((prev) => ({
                                      ...prev,
                                      [bucket.key]: !prev[bucket.key],
                                    }))
                                  }
                                >
                                  {expandedGroups[bucket.key] ? (
                                    <ExpandLessIcon fontSize="inherit" />
                                  ) : (
                                    <ExpandMoreIcon fontSize="inherit" />
                                  )}
                                </IconButton>
                                <Stack spacing={0.5}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {bucket.title || 'Grupo'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {bucket.count} órdenes
                                  </Typography>
                                </Stack>
                              </Stack>
                            );
                          } else if (column.id === 'producto') {
                            content = bucket.productosResumen ?? '—';
                          } else if (column.id === 'cantidadTotal') {
                            content = numberFormatter.format(bucket.totalCantidad ?? 0);
                          } else if (GROUPABLE_COLUMNS.has(column.id) && bucket.groupValues[column.id]) {
                            content = bucket.groupValues[column.id];
                          }
                          return (
                            <TableCell key={column.id}>
                              <Typography variant="body2">{content}</Typography>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      {expandedGroups[bucket.key] &&
                        bucket.rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                    </React.Fragment>
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
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
        />
      </Paper>

      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Total registros: {totalRegistros} — Total bultos: {numberFormatter.format(totalBultos)}
        </Typography>
      </Box>
    </Stack>
  );
}
