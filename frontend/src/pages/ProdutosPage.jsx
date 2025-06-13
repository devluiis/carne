import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { produtos } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';


// Função auxiliar para formatar moeda - CORRIGIDO Intl.NumberFomart para Intl.NumberFormat
const formatCurrency = (value) => {
    const num = Number(value);
    if (isNaN(num)) {
        return 'N/A';
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

function ProdutosPage() {
    const [produtosList, setProdutosList] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategoria, setFilterCategoria] = useState('');
    const [filterMarca, setFilterMarca] = useState('');

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [produtoToDeleteId, setProdutoToDeleteId] = useState(null);

    const fetchProdutos = useCallback(async () => {
        try {
            setLoading(true);
            const response = await produtos.getAll(
                0,
                100,
                searchQuery || null,
                filterCategoria || null,
                filterMarca || null
            );
            setProdutosList(response.data || []);
        } catch (err) {
            console.error('Erro ao buscar produtos:', err);
            setGlobalAlert({ message: 'Falha ao carregar produtos.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [searchQuery, filterCategoria, filterMarca, setGlobalAlert]);

    useEffect(() => {
        if (user) {
            fetchProdutos();
        }
    }, [user, fetchProdutos]);

    const handleClearFilters = () => {
        setSearchQuery('');
        setFilterCategoria('');
        setFilterMarca('');
    };

    const navigateToCreateProduto = () => {
        navigate('/produtos/novo');
    };

    const navigateToEditProduto = (id) => {
        navigate(`/produtos/editar/${id}`);
    };

    const handleOpenDeleteModal = (id) => {
        setProdutoToDeleteId(id);
        setShowDeleteModal(true);
    };

    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setProdutoToDeleteId(null);
    };

    const performDeleteProduto = async () => {
        if (!produtoToDeleteId) return;
        try {
            await produtos.delete(produtoToDeleteId);
            setGlobalAlert({ message: 'Produto excluído com sucesso!', type: 'success' });
            fetchProdutos();
        } catch (err) {
            const errorMessage = `Falha ao excluir produto: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setShowDeleteModal(false);
            setProdutoToDeleteId(null);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Carregando produtos..." />;
    }

    return (
        <>
            <Container maxWidth="lg" className="py-8">
                <Box className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <Typography variant="h4" component="h1" className="font-bold text-gray-800 flex-grow">
                        Gerenciamento de Produtos
                    </Typography>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={navigateToCreateProduto}
                        className="py-2 px-4 whitespace-nowrap"
                    >
                        + Adicionar Novo Produto
                    </Button>
                </Box>

                <Paper elevation={3} className="p-6 mb-8 rounded-lg">
                    <Typography variant="h6" component="h2" className="mb-4 font-semibold text-gray-700">Filtrar Produtos:</Typography>
                    <Grid container spacing={3} alignItems="flex-end" className="mb-4">
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                fullWidth
                                id="searchNome"
                                label="Nome do Produto"
                                type="text"
                                placeholder="Buscar por nome..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                variant="outlined"
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                fullWidth
                                id="searchCategoria"
                                label="Categoria"
                                type="text"
                                placeholder="Filtrar por categoria..."
                                value={filterCategoria}
                                onChange={(e) => setFilterCategoria(e.target.value)}
                                variant="outlined"
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                fullWidth
                                id="searchMarca"
                                label="Marca"
                                type="text"
                                placeholder="Filtrar por marca..."
                                value={filterMarca}
                                onChange={(e) => setFilterMarca(e.target.value)}
                                variant="outlined"
                                size="small"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={2}>
                            <Button
                                fullWidth
                                variant="outlined"
                                color="secondary"
                                onClick={handleClearFilters}
                                className="py-2"
                            >
                                Limpar Filtros
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

                {produtosList.length === 0 ? (
                    <Typography className="text-center p-4 bg-gray-50 rounded-md text-gray-600 italic">
                        Nenhum produto encontrado.
                    </Typography>
                ) : (
                    <TableContainer component={Paper} elevation={3} className="rounded-lg">
                        <Table>
                            <TableHead className="bg-gray-200">
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Nome</TableCell>
                                    <TableCell>Categoria</TableCell>
                                    <TableCell>Marca</TableCell>
                                    <TableCell>Preço Venda</TableCell>
                                    <TableCell>Estoque</TableCell>
                                    <TableCell>Ações</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {produtosList.map((produto) => (
                                    <TableRow key={produto.id_produto} className="hover:bg-gray-50">
                                        <TableCell>{produto.id_produto}</TableCell>
                                        <TableCell>{produto.nome}</TableCell>
                                        <TableCell>{produto.categoria || 'N/A'}</TableCell>
                                        <TableCell>{produto.marca || 'N/A'}</TableCell>
                                        <TableCell>{produto.preco_venda !== null ? formatCurrency(produto.preco_venda) : 'N/A'}</TableCell>
                                        <TableCell>{produto.estoque_atual !== null ? produto.estoque_atual : 'N/A'} {produto.unidade_medida || ''}</TableCell>
                                        <TableCell>
                                            <Box className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="contained"
                                                    color="warning"
                                                    size="small"
                                                    onClick={() => navigateToEditProduto(produto.id_produto)}
                                                >
                                                    Editar
                                                </Button>
                                                {user?.perfil === 'admin' && (
                                                    <Button
                                                        variant="contained"
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleOpenDeleteModal(produto.id_produto)}
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
            </Container>

            <ConfirmationModal
                isOpen={showDeleteModal}
                title="Confirmar Exclusão de Produto"
                message={`Tem certeza que deseja excluir o produto "${produtoToDeleteId ? (produtosList.find(p => p.id_produto === produtoToDeleteId)?.nome || 'este produto') : 'este produto'}"? Esta ação não pode ser desfeita.`}
                onConfirm={performDeleteProduto}
                onCancel={handleCancelDelete}
                confirmText="Sim, Excluir"
                cancelText="Cancelar"
            />
        </>
    );
}

export default ProdutosPage;