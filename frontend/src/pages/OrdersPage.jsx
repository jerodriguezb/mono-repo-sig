import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import dayjs from 'dayjs';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '@mui/material/Pagination';
import api from '../api/axios';

const PAGE_SIZE = 20;
const columnHelper = createColumnHelper();

const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const normalize = (value) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const sumRequestedQuantity = (items = []) =>
  items.reduce((acc, item) => acc + Number(item?.cantidad ?? 0), 0);

const buildProductList = (items = []) => {
  const names = new Set();
  items.forEach((item) => {
    const name = item?.codprod?.descripcion;
    if (name) names.add(name);
  });
  return Array.from(names).join(', ');
};

const resolveRubro = (items = []) => {
  const rubros = new Set();
  items.forEach((item) => {
    const rubro = item?.codprod?.codrubro?.descripcion;
    if (rubro) rubros.add(rubro);
  });
  return Array.from(rubros).join(', ');
};

const buildOption = (id, label, raw = null) => ({ id, label, raw });

export default function OrdersPage() {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [estadoAPrepararId, setEstadoAPrepararId] = useState(null);
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [grouping, setGrouping] = useState(['ruta']);
  const [expanded, setExpanded] = useState({});

  const collator = useMemo(() => new Intl.Collator('es', { sensitivity: 'base', numeric: true }), []);

  const routeFilter = useMemo(
    () => columnFilters.find((filter) => filter.id === 'ruta')?.value ?? null,
    [columnFilters],
  );
  const rubroFilter = useMemo(
    () => columnFilters.find((filter) => filter.id === 'rubro')?.value ?? null,
    [columnFilters],
  );
  const camionFilter = useMemo(
    () => columnFilters.find((filter) => filter.id === 'camion')?.value ?? null,
    [columnFilters],
  );

  const handlePageChange = (_, value) => {
    setPage(value);
  };

  useEffect(() => {
    const fetchEstados = async () => {
      try {
        const { data: response } = await api.get('/estados', { params: { limit: 200 } });
        const estadosList = response?.estados ?? [];
        const target = estadosList.find((estado) => normalize(estado?.estado) === 'a preparar');
        if (target?._id) {
          setEstadoAPrepararId(target._id);
        } else {
          setError('No se encontró el estado "A preparar".');
        }
      } catch (err) {
        console.error('Error obteniendo estados', err);
        setError('No se pudieron obtener los estados disponibles.');
      }
    };

    fetchEstados();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [routeFilter?.id]);

  const fetchOrders = useCallback(async () => {
    if (!estadoAPrepararId) return;
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        estado: estadoAPrepararId,
      };
      if (routeFilter?.id) {
        params.ruta = routeFilter.id;
      }
      const { data: response } = await api.get('/comandas/logistica', { params });
      setData(response?.comandas ?? []);
      setTotal(response?.total ?? 0);
      setPageCount(response?.totalPages ?? 0);
      setRowSelection({});
    } catch (err) {
      console.error('Error obteniendo órdenes', err);
      setError('No se pudieron obtener las órdenes para logística.');
    } finally {
      setLoading(false);
    }
  }, [estadoAPrepararId, page, routeFilter?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredData = useMemo(() => {
    return data.filter((order) => {
      if (rubroFilter?.label) {
        const rubroValue = normalize(rubroFilter.label);
        const hasRubro = (order?.items ?? []).some((item) => normalize(item?.codprod?.codrubro?.descripcion) === rubroValue);
        if (!hasRubro) return false;
      }
      if (camionFilter?.label) {
        const camionValue = normalize(camionFilter.label);
        const camionNombre = normalize(order?.camion?.camion ?? order?.puntoDistribucion);
        if (camionNombre !== camionValue) return false;
      }
      return true;
    });
  }, [data, camionFilter, rubroFilter]);

  const sortedData = useMemo(() => {
    if (!sorting.length) return filteredData;
    const [current] = sorting;
    const sorted = [...filteredData].sort((a, b) => {
      const direction = current.desc ? -1 : 1;
      switch (current.id) {
        case 'nrodecomanda': {
          const aValue = Number(a?.nrodecomanda ?? 0);
          const bValue = Number(b?.nrodecomanda ?? 0);
          return aValue === bValue ? 0 : aValue > bValue ? direction : -direction;
        }
        case 'cliente': {
          return (
            collator.compare(a?.codcli?.razonsocial ?? '', b?.codcli?.razonsocial ?? '') * direction
          );
        }
        case 'ruta': {
          const aRuta = a?.codcli?.ruta?.ruta ?? a?.camion?.ruta ?? '';
          const bRuta = b?.codcli?.ruta?.ruta ?? b?.camion?.ruta ?? '';
          return collator.compare(aRuta, bRuta) * direction;
        }
        case 'productos': {
          return collator.compare(buildProductList(a?.items), buildProductList(b?.items)) * direction;
        }
        case 'rubro': {
          return collator.compare(resolveRubro(a?.items), resolveRubro(b?.items)) * direction;
        }
        case 'camion': {
          const aCamion = a?.camion?.camion ?? a?.puntoDistribucion ?? '';
          const bCamion = b?.camion?.camion ?? b?.puntoDistribucion ?? '';
          return collator.compare(aCamion, bCamion) * direction;
        }
        case 'cantidadTotal': {
          const aCantidad = sumRequestedQuantity(a?.items);
          const bCantidad = sumRequestedQuantity(b?.items);
          return aCantidad === bCantidad ? 0 : aCantidad > bCantidad ? direction : -direction;
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [collator, filteredData, sorting]);

  const totalQuantity = useMemo(
    () => sortedData.reduce((acc, order) => acc + sumRequestedQuantity(order?.items), 0),
    [sortedData],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('nrodecomanda', {
        id: 'nrodecomanda',
        header: 'Nro. Comanda',
        cell: (info) => info.getValue() ?? '—',
        enableGrouping: false,
        aggregationFn: 'count',
        aggregatedCell: (info) => `${info.getValue()} órdenes`,
        meta: { align: 'left' },
      }),
      columnHelper.accessor((row) => row?.codcli?.razonsocial ?? '', {
        id: 'cliente',
        header: 'Cliente',
        cell: (info) => info.getValue() || '—',
        aggregationFn: () => null,
        aggregatedCell: () => '—',
      }),
      columnHelper.accessor((row) => row?.codcli?.ruta?.ruta ?? row?.camion?.ruta ?? '', {
        id: 'ruta',
        header: 'Ruta',
        cell: (info) => info.getValue() || '—',
        enableGrouping: true,
        aggregationFn: () => null,
        aggregatedCell: () => '—',
      }),
      columnHelper.accessor((row) => buildProductList(row?.items), {
        id: 'productos',
        header: 'Productos',
        cell: (info) => info.getValue() || '—',
        aggregationFn: () => null,
        aggregatedCell: () => '—',
      }),
      columnHelper.accessor((row) => resolveRubro(row?.items), {
        id: 'rubro',
        header: 'Rubro',
        cell: (info) => info.getValue() || '—',
        aggregationFn: () => null,
        aggregatedCell: () => '—',
        enableGrouping: true,
      }),
      columnHelper.accessor((row) => row?.camion?.camion ?? row?.puntoDistribucion ?? '', {
        id: 'camion',
        header: 'Camión',
        cell: (info) => info.getValue() || '—',
        aggregationFn: () => null,
        aggregatedCell: () => '—',
        enableGrouping: true,
      }),
      columnHelper.accessor((row) => sumRequestedQuantity(row?.items), {
        id: 'cantidadTotal',
        header: 'Cantidad total',
        cell: (info) => numberFormatter.format(info.getValue() ?? 0),
        aggregationFn: 'sum',
        aggregatedCell: (info) => numberFormatter.format(info.getValue() ?? 0),
        meta: { align: 'right' },
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: sortedData,
    columns,
    state: { sorting, columnFilters, rowSelection, grouping, expanded },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false,
  });

  const rutaColumn = table.getColumn('ruta');
  const rubroColumn = table.getColumn('rubro');
  const camionColumn = table.getColumn('camion');

  const rutaValue = rutaColumn?.getFilterValue?.() ?? null;
  const rubroValue = rubroColumn?.getFilterValue?.() ?? null;
  const camionValue = camionColumn?.getFilterValue?.() ?? null;

  const routeOptions = useMemo(() => {
    const map = new Map();
    data.forEach((order) => {
      const ruta = order?.codcli?.ruta;
      if (ruta?._id) {
        map.set(ruta._id, buildOption(ruta._id, ruta?.ruta ?? '—', ruta));
      }
    });
    return Array.from(map.values());
  }, [data]);

  const rubroOptions = useMemo(() => {
    const map = new Map();
    data.forEach((order) => {
      (order?.items ?? []).forEach((item) => {
        const rubro = item?.codprod?.codrubro;
        if (rubro?.descripcion) {
          map.set(rubro.descripcion, buildOption(rubro.descripcion, rubro.descripcion, rubro));
        }
      });
    });
    return Array.from(map.values());
  }, [data]);

  const camionOptions = useMemo(() => {
    const map = new Map();
    data.forEach((order) => {
      const camion = order?.camion?.camion ?? order?.puntoDistribucion;
      if (camion) {
        map.set(camion, buildOption(camion, camion));
      }
    });
    return Array.from(map.values());
  }, [data]);

  const ensureOptionPresence = useCallback((optionsList, value) => {
    if (!value) return optionsList;
    const exists = optionsList.some((option) => option.id === value.id);
    return exists ? optionsList : [value, ...optionsList];
  }, []);

  const handleReload = () => {
    fetchOrders();
  };

  const buildCsvContent = (rows) =>
    rows
      .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

  const handleExportCsv = () => {
    const headers = [
      'Nro Comanda',
      'Cliente',
      'Ruta',
      'Productos',
      'Rubro',
      'Camión',
      'Cantidad total',
    ];

    const rows = sortedData.map((order) => [
      order?.nrodecomanda ?? '',
      order?.codcli?.razonsocial ?? '',
      order?.codcli?.ruta?.ruta ?? order?.camion?.ruta ?? '',
      buildProductList(order?.items),
      resolveRubro(order?.items),
      order?.camion?.camion ?? order?.puntoDistribucion ?? '',
      numberFormatter.format(sumRequestedQuantity(order?.items)),
    ]);

    rows.push([
      'Totales',
      '',
      '',
      '',
      '',
      '',
      numberFormatter.format(totalQuantity),
    ]);

    const blob = new Blob([buildCsvContent([headers, ...rows])], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ordenes_${dayjs().format('YYYYMMDD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Órdenes en logística — A preparar', 20, 20);
    const head = [[
      'Nro',
      'Cliente',
      'Ruta',
      'Productos',
      'Rubro',
      'Camión',
      'Cantidad total',
    ]];
    const body = sortedData.map((order) => [
      order?.nrodecomanda ?? '',
      order?.codcli?.razonsocial ?? '',
      order?.codcli?.ruta?.ruta ?? order?.camion?.ruta ?? '',
      buildProductList(order?.items),
      resolveRubro(order?.items),
      order?.camion?.camion ?? order?.puntoDistribucion ?? '',
      numberFormatter.format(sumRequestedQuantity(order?.items)),
    ]);

    body.push([
      'Totales',
      '',
      '',
      '',
      '',
      '',
      numberFormatter.format(totalQuantity),
    ]);

    autoTable(doc, {
      startY: 30,
      head,
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 150, 243] },
      alternateRowStyles: { fillColor: [245, 248, 252] },
    });
    doc.save(`ordenes_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">Órdenes</Typography>
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
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
          <Autocomplete
            sx={{ minWidth: 240 }}
            value={rutaValue ?? null}
            options={ensureOptionPresence(routeOptions, rutaValue)}
            onChange={(_, value) => rutaColumn?.setFilterValue(value ?? undefined)}
            renderInput={(params) => <TextField {...params} label="Ruta" placeholder="Seleccionar ruta" />}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
          <Autocomplete
            sx={{ minWidth: 240 }}
            value={rubroValue ?? null}
            options={ensureOptionPresence(rubroOptions, rubroValue)}
            onChange={(_, value) => rubroColumn?.setFilterValue(value ?? undefined)}
            renderInput={(params) => <TextField {...params} label="Rubro" placeholder="Seleccionar rubro" />}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
          <Autocomplete
            sx={{ minWidth: 240 }}
            value={camionValue ?? null}
            options={ensureOptionPresence(camionOptions, camionValue)}
            onChange={(_, value) => camionColumn?.setFilterValue(value ?? undefined)}
            renderInput={(params) => <TextField {...params} label="Camión" placeholder="Seleccionar camión" />}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 0 }}>
        {loading ? <LinearProgress /> : null}
        <TableContainer>
          <Table size="small">
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort?.();
                    const sortingState = header.column.getIsSorted?.();
                    const align = header.column.columnDef.meta?.align ?? 'left';
                    return (
                      <TableCell key={header.id} align={align} sx={{ fontWeight: 600 }}>
                        {header.isPlaceholder ? null : canSort ? (
                          <TableSortLabel
                            active={Boolean(sortingState)}
                            direction={sortingState === 'desc' ? 'desc' : 'asc'}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </TableSortLabel>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell) => {
                    const align = cell.column.columnDef.meta?.align ?? 'left';
                    let content = null;
                    if (cell.getIsGrouped?.()) {
                      content = (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <IconButton
                            size="small"
                            onClick={row.getToggleExpandedHandler()}
                            sx={{ mr: 0.5 }}
                          >
                            {row.getIsExpanded() ? (
                              <ExpandLessIcon fontSize="inherit" />
                            ) : (
                              <ExpandMoreIcon fontSize="inherit" />
                            )}
                          </IconButton>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({row.subRows.length} órdenes)
                          </Typography>
                        </Stack>
                      );
                    } else if (cell.getIsAggregated?.()) {
                      content = flexRender(
                        cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                        cell.getContext(),
                      );
                    } else if (cell.getIsPlaceholder?.()) {
                      content = null;
                    } else {
                      content = flexRender(cell.column.columnDef.cell, cell.getContext());
                    }
                    return (
                      <TableCell key={cell.id} align={align}>
                        {content ?? '—'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {!table.getRowModel().rows.length && !loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                    No se encontraron órdenes para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          sx={{ p: 2 }}
        >
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Total de órdenes: {total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cantidad total solicitada: {numberFormatter.format(totalQuantity)}
            </Typography>
          </Stack>
          <Pagination color="primary" count={pageCount || 1} page={page} onChange={handlePageChange} />
        </Stack>
      </Paper>
    </Box>
  );
}
