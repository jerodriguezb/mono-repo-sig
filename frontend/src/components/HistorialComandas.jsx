import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import PrintIcon from '@mui/icons-material/Print';
import api from '../api/axios.js';
import ComandaPrintView from './ComandaPrintView.jsx';
import { useNavigate } from 'react-router-dom';

const ESTADO_A_PREPARAR = '62200265c811f41820d8bda9';

export default function HistorialComandas() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/comandas');
      const flat = (data.comandas ?? []).map((c) => ({
        ...c,
        estadoNombre: c.codestado?.estado ?? '',
        total: c.items.reduce((sum, i) => sum + i.cantidad * i.monto, 0),
      }));
      setRows(flat);
    } catch (err) {
      console.error('Error obteniendo comandas', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleView = (row) => setSelected(row);
  const handleClose = () => setSelected(null);
  const handleEdit = (row) => navigate(`/comandas/${row._id}`);
  const handleCancel = async (row) => {
    if (!window.confirm('¿Anular comanda?')) return;
    try {
      await api.delete(`/comandas/${row._id}`);
      fetchData();
    } catch (err) {
      console.error('Error anulando comanda', err);
    }
  };
  const handlePrint = (row) => {
    handleView(row);
    setTimeout(() => window.print(), 100);
  };

  const toPrintItems = (com) =>
    com.items.map((i) => ({
      codprod: i.codprod?._id ?? i.codprod,
      descripcion: i.codprod?.descripcion ?? '',
      precio: i.monto,
      cantidad: i.cantidad,
    }));

  const columns = [
    { field: 'nrodecomanda', headerName: 'Número', width: 100 },
    {
      field: 'fecha',
      headerName: 'Fecha',
      width: 140,
      valueGetter: (params) => new Date(params.value).toLocaleDateString('es-AR'),
    },
    { field: 'estadoNombre', headerName: 'Estado', flex: 1, minWidth: 120 },
    {
      field: 'total',
      headerName: 'Total',
      width: 120,
      type: 'number',
      valueFormatter: (p) => currencyFormatter.format(p.value),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Acciones',
      width: 120,
      getActions: (params) => {
        const actions = [
          <GridActionsCellItem
            key="view"
            icon={<VisibilityIcon />}
            label="Ver"
            onClick={() => handleView(params.row)}
          />, 
          params.row.codestado?._id === ESTADO_A_PREPARAR && (
            <GridActionsCellItem
              key="edit"
              icon={<EditIcon />}
              label="Editar"
              onClick={() => handleEdit(params.row)}
            />
          ),
          <GridActionsCellItem
            key="cancel"
            icon={<CancelIcon />}
            label="Anular"
            onClick={() => handleCancel(params.row)}
          />, 
          <GridActionsCellItem
            key="print"
            icon={<PrintIcon />}
            label="Imprimir"
            onClick={() => handlePrint(params.row)}
          />,
        ];
        return actions.filter(Boolean);
      },
    },
  ];

  return (
    <Box sx={{ height: 600, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={(r) => r._id}
        disableRowSelectionOnClick
      />
      <Dialog open={!!selected} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>Comanda {selected?.nrodecomanda}</DialogTitle>
        <DialogContent>
          {selected && <ComandaPrintView items={toPrintItems(selected)} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => window.print()} startIcon={<PrintIcon />}>Imprimir</Button>
          <Button onClick={handleClose}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

