import React, { useState, useEffect, useCallback } from 'react';
import { carnes } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import Box from '@mui/material/Box'; // Para agrupar os botões e usar flexbox
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper'; // Para o contêiner da tabela e filtros
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip'; // Para o status
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid'; // Para o layout dos filtros


// Função auxiliar para determinar a cor do chip de status do carnê
const getStatusChipColor = (status) => {
    switch (status.toLowerCase()) {
        case 'quitado': return 'success';
        case 'em atraso': return 'error';
        case 'cancelado': return 'default';
        case 'ativo': return 'primary';
        default: return 'info';
    }
};

// Função auxiliar para formatar moeda (do ProdutosPage.jsx)
const formatCurrency = (value) => {
    const num = Number(value);
    if (isNaN(num)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

function CarnesPage() {
    const [carnesList, setCarnesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { id_cliente } = useParams();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const [filterStatus, setFilterStatus] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterSearchQuery, setFilterSearchQuery] = useState('');

    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [carneToDeleteId, setCarneToDeleteId] = useState(null);

    const fetchCarnes = useCallback(async () => {
        try {
            setLoading(true);
            const currentClientId = id_cliente || null;
            const response = await carnes.getAll(currentClientId, filterStatus, filterDateStart, filterDateEnd, filterSearchQuery);
            setCarnesList(response.data || []);
        } catch (err) {
            console.error('Erro ao buscar carnês:', err);
            setGlobalAlert({ message: 'Falha ao carregar carnês.', type: 'error' });
            if (err.response && err.response.status === 401) {
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    }, [id_cliente, filterStatus, filterDateStart, filterDateEnd, filterSearchQuery, setGlobalAlert, navigate]);

    useEffect(() => {
        if (user) {
            fetchCarnes();
        } else {
            setLoading(false);
            setGlobalAlert({ message: 'Faça login para ver os carnês.', type: 'error' });
        }
    }, [user, fetchCarnes]);

    const handleOpenDeleteModal = (id) => {
        setCarneToDeleteId(id);
        setShowDeleteConfirmModal(true);
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirmModal(false);
        setCarneToDeleteId(null);
    };

    const performDeleteCarne = async () => {
        if (!carneToDeleteId) return;
        try {
            await carnes.delete(carneToDeleteId);
            setGlobalAlert({ message: 'Carnê excluído com sucesso!', type: 'success' });
            fetchCarnes();
        } catch (err) {
            const errorMessage = `Falha ao excluir carnê: ${err.response?.data?.detail || err.message || 'Erro desconhecido.'}`;
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setShowDeleteConfirmModal(false);
            setCarneToDeleteId(null);
        }
    };

    const handleClearFilters = () => {
        setFilterStatus('');
        setFilterDateStart('');
        setFilterDateEnd('');
        setFilterSearchQuery('');
    };

    if (loading) {
        return <LoadingSpinner message="Carregando carnês..." />;
    }

    return (
        <Container maxWidth="lg" className="py-8">
            <Box className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <Typography variant="h4" component="h1" className="font-bold text-gray-800 flex-grow">
                    Lista de Carnês
                </Typography>
                {id_cliente ? (
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => navigate(`/carnes/new/${id_cliente}`)}
                        className="py-2 px-4 whitespace-nowrap"
                    >
                        + Adicionar Carnê para este Cliente
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => navigate('/nova-venda')}
                        className="py-2 px-4 whitespace-nowrap"
                    >
                        + Registrar Nova Venda/Carnê
                    </Button>
                )}
            </Box>

            <Paper elevation={3} className="p-6 mb-8 rounded-lg">
                <Typography variant="h6" component="h2" className="mb-4 font-semibold text-gray-700">Filtrar Carnês:</Typography>
                <Grid container spacing={3} alignItems="flex-end">
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="filterStatus-label">Status</InputLabel>
                            <Select
                                labelId="filterStatus-label"
                                id="filterStatus"
                                value={filterStatus}
                                label="Status"
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <MenuItem value="">Todos</MenuItem>
                                <MenuItem value="Ativo">Ativo</MenuItem>
                                <MenuItem value="Quitado">Quitado</MenuItem>
                                <MenuItem value="Em Atraso">Em Atraso</MenuItem>
                                <MenuItem value="Cancelado">Cancelado</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            id="filterDateStart"
                            label="Vencimento De"
                            type="date"
                            value={filterDateStart}
                            onChange={(e) => setFilterDateStart(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            id="filterDateEnd"
                            label="Vencimento Até"
                            type="date"
                            value={filterDateEnd}
                            onChange={(e) => setFilterDateEnd(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            id="filterSearchQuery"
                            label="Descrição ou Cliente"
                            placeholder="Descrição, Nome ou CPF/CNPJ"
                            value={filterSearchQuery}
                            onChange={(e) => setFilterSearchQuery(e.target.value)}
                            variant="outlined"
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} md={4} className="flex gap-2"> {/* Botões de filtro */}
                        <Button
                            variant="contained"
                            onClick={fetchCarnes}
                            className="flex-grow py-2 px-4"
                        >
                            Aplicar Filtros
                        </Button>
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={handleClearFilters}
                            className="flex-grow py-2 px-4"
                        >
                            Limpar Filtros
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {carnesList.length === 0 ? (
                <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                    Nenhum carnê encontrado com os filtros aplicados.
                </Typography>
            ) : (
                <TableContainer component={Paper} elevation={3} className="rounded-lg">
                    <Table>
                        <TableHead className="bg-gray-200">
                            <TableRow>
                                <TableCell>Cliente</TableCell>
                                <TableCell>Descrição</TableCell>
                                <TableCell>Data Venda</TableCell>
                                <TableCell>Valor Total</TableCell>
                                <TableCell>Entrada</TableCell>
                                <TableCell>Nº Parc.</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Ações</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {carnesList.map((carne) => (
                                <TableRow key={carne.id_carne} className="hover:bg-gray-50">
                                    <TableCell>{carne.cliente?.nome || 'N/A'}</TableCell>
                                    <TableCell>{carne.descricao || 'N/A'}</TableCell>
                                    <TableCell>{carne.data_venda ? new Date(carne.data_venda + 'T00:00:00').toLocaleDateString() : 'N/A'}</TableCell>
                                    <TableCell>{formatCurrency(carne.valor_total_original)}</TableCell>
                                    <TableCell>{formatCurrency(carne.valor_entrada || 0)}</TableCell>
                                    <TableCell>{carne.numero_parcelas}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={carne.status_carne.toUpperCase()}
                                            color={getStatusChipColor(carne.status_carne)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box className="flex flex-wrap gap-2"> {/* Usa Box para flexbox e gap */}
                                            <Button
                                                variant="contained"
                                                color="info"
                                                size="small"
                                                onClick={() => navigate(`/carnes/details/${carne.id_carne}`)}
                                            >
                                                Detalhes
                                            </Button>
                                            <Button
                                                variant="contained"
                                                color="warning"
                                                size="small"
                                                onClick={() => navigate(`/carnes/edit/${carne.id_carne}`)}
                                            >
                                                Editar
                                            </Button>
                                            {user?.perfil === 'admin' && (
                                                <Button
                                                    variant="contained"
                                                    color="error"
                                                    size="small"
                                                    onClick={() => handleOpenDeleteModal(carne.id_carne)}
                                                >
                                                    Excluir
                                                </Button>
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <ConfirmationModal
                isOpen={showDeleteConfirmModal}
                title="Confirmar Exclusão de Carnê"
                message="Tem certeza que deseja excluir este carnê e todas as suas parcelas e pagamentos associados? Esta ação não pode ser desfeita."
                onConfirm={performDeleteCarne}
                onCancel={handleCancelDelete}
                confirmText="Sim, Excluir"
                cancelText="Cancelar"
            />
        </Container>
    );
}

export default CarnesPage;