import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import AppOrdenAPrepararReactTable from '../components/AppOrdenAPrepararReactTable.jsx';
import AppCamionReactTable from '../components/AppCamionReactTable.jsx';
import AppGestionReactTable from '../components/AppGestionReactTable.jsx';
import AppComandaReactTable from '../components/AppComandaReactTable.jsx';
import ModalFormAsignar from '../components/ModalFormAsignar.jsx';
import ModalFormCamion from '../components/ModalFormCamion.jsx';
import api from '../api/axios.js';
import { getUsuarios } from '../api/rutaUsuarios.js';

export default function LogisticsPage() {
  const [comandas, setComandas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [camiones, setCamiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsignacion, setSelectedAsignacion] = useState(null);
  const [selectedEntrega, setSelectedEntrega] = useState(null);

  const fetchComandas = useCallback(async () => {
    try {
      const { data } = await api.get('/comandas');
      setComandas(data.comandas || []);
    } catch (error) {
      console.error('Error obteniendo comandas', error);
    }
  }, []);

  const fetchUsuarios = useCallback(async () => {
    try {
      const resp = await getUsuarios();
      if (resp?.usuarios) setUsuarios(resp.usuarios);
    } catch (error) {
      console.warn('No se pudieron cargar los usuarios', error);
    }
  }, []);

  const fetchCamiones = useCallback(async () => {
    try {
      const { data } = await api.get('/camiones');
      setCamiones(data.camiones || []);
    } catch (error) {
      console.warn('No se pudieron cargar los camiones', error);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setLoading(true);
      await Promise.all([fetchComandas(), fetchUsuarios(), fetchCamiones()]);
      if (activo) setLoading(false);
    };
    cargar();
    return () => {
      activo = false;
    };
  }, [fetchCamiones, fetchComandas, fetchUsuarios]);

  const handleRefresh = useCallback(() => {
    fetchComandas();
  }, [fetchComandas]);

  const handleCloseAsignacion = () => setSelectedAsignacion(null);
  const handleCloseEntrega = () => setSelectedEntrega(null);

  const resumenCantidad = useMemo(() => comandas.length, [comandas.length]);

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Logística y depósito
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Gestión integral de preparación, control de carga, despacho y seguimiento de entregas.
          {resumenCantidad ? ` Se están monitoreando ${resumenCantidad} comandas.` : ''}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
          <CircularProgress size={48} />
        </Box>
      ) : (
        <>
          <AppOrdenAPrepararReactTable
            usuarios={usuarios}
            camiones={camiones}
            onComandaChange={handleRefresh}
            onOpenAsignar={(comanda) => setSelectedAsignacion(comanda)}
          />

          <AppCamionReactTable
            comandas={comandas}
            onSelectEntrega={(comanda) => setSelectedEntrega(comanda)}
            onChange={handleRefresh}
          />

          <AppGestionReactTable
            comandas={comandas}
            camiones={camiones}
          />

          <AppComandaReactTable comandas={comandas} />
        </>
      )}

      <ModalFormAsignar
        open={Boolean(selectedAsignacion)}
        comanda={selectedAsignacion}
        usuarios={usuarios}
        camiones={camiones}
        onClose={handleCloseAsignacion}
        onUpdated={() => {
          handleCloseAsignacion();
          handleRefresh();
        }}
      />

      <ModalFormCamion
        open={Boolean(selectedEntrega)}
        comanda={selectedEntrega}
        onClose={handleCloseEntrega}
        onUpdated={() => {
          handleCloseEntrega();
          handleRefresh();
        }}
      />
    </Stack>
  );
}
