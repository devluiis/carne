import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { produtos } from '../api';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Importações do Material-UI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid'; // Para alinhar campos em 2 colunas

function ProdutoFormPage() {
    const navigate = useNavigate();
    const { id: produtoId } = useParams();
    const { setGlobalAlert } = useGlobalAlert();

    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [categoria, setCategoria] = useState('');
    const [marca, setMarca] = useState('');
    const [imei, setImei] = useState('');
    const [codigoSku, setCodigoSku] = useState('');
    const [precoVenda, setPrecoVenda] = useState('');
    const [precoCusto, setPrecoCusto] = useState('');
    const [estoqueAtual, setEstoqueAtual] = useState('0');
    const [unidadeMedida, setUnidadeMedida] = useState('unidade');

    const [loadingInitial, setLoadingInitial] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [formError, setFormError] = useState('');

    const isEditing = Boolean(produtoId);

    const fetchProdutoData = useCallback(async () => {
        if (isEditing) {
            setLoadingInitial(true);
            try {
                const response = await produtos.getById(produtoId);
                const produto = response.data;
                setNome(produto.nome || '');
                setDescricao(produto.descricao || '');
                setCategoria(produto.categoria || '');
                setMarca(produto.marca || '');
                setImei(produto.imei || '');
                setCodigoSku(produto.codigo_sku || '');
                setPrecoVenda(produto.preco_venda !== null ? String(produto.preco_venda) : '');
                setPrecoCusto(produto.preco_custo !== null ? String(produto.preco_custo) : '');
                setEstoqueAtual(produto.estoque_atual !== null ? String(produto.estoque_atual) : '0');
                setUnidadeMedida(produto.unidade_medida || 'unidade');
            } catch (error) {
                console.error("Erro ao carregar produto para edição:", error);
                setGlobalAlert({ message: `Erro ao carregar produto: ${error.response?.data?.detail || error.message}`, type: 'error' });
                navigate('/produtos');
            } finally {
                setLoadingInitial(false);
            }
        }
    }, [isEditing, produtoId, navigate, setGlobalAlert]);

    useEffect(() => {
        fetchProdutoData();
    }, [fetchProdutoData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setSubmitLoading(true);

        if (!nome.trim()) {
            setFormError('O nome do produto é obrigatório.');
            setGlobalAlert({ message: 'O nome do produto é obrigatório.', type: 'warning' });
            setSubmitLoading(false);
            return;
        }

        const produtoData = {
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            categoria: categoria.trim() || null,
            marca: marca.trim() || null,
            imei: imei.trim() || null,
            codigo_sku: codigoSku.trim() || null,
            preco_venda: precoVenda !== '' ? parseFloat(precoVenda) : null,
            preco_custo: precoCusto !== '' ? parseFloat(precoCusto) : null,
            estoque_atual: estoqueAtual !== '' ? parseInt(estoqueAtual, 10) : 0,
            unidade_medida: unidadeMedida.trim() || 'unidade',
        };

        try {
            if (isEditing) {
                await produtos.update(produtoId, produtoData);
                setGlobalAlert({ message: 'Produto atualizado com sucesso!', type: 'success' });
            } else {
                await produtos.create(produtoData);
                setGlobalAlert({ message: 'Produto cadastrado com sucesso!', type: 'success' });
            }
            navigate('/produtos');
        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            const errorMsg = error.response?.data?.detail || error.message || "Ocorreu um erro desconhecido.";
            setFormError(errorMsg);
            setGlobalAlert({ message: `Erro ao salvar produto: ${errorMsg}`, type: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loadingInitial) {
        return <LoadingSpinner message={isEditing ? "Carregando dados do produto..." : "Preparando formulário..."} />;
    }

    return (
        <Container component="main" maxWidth="md" className="flex items-center justify-center min-h-screen py-8">
            <Box
                sx={{
                    p: 4, // padding-4
                    borderRadius: 2, // rounded-lg
                    boxShadow: 3, // shadow-md
                    bgcolor: 'background.paper', // bg-white
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
                className="w-full max-w-2xl mx-auto" // Tailwind classes (increased max-width for more fields)
            >
                <Typography component="h1" variant="h5" className="mb-6 font-bold text-gray-800">
                    {isEditing ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                </Typography>
                {formError && <Typography color="error" className="mb-4 text-center">{formError}</Typography>}
                
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }} className="w-full">
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="nome"
                        label="Nome do Produto"
                        name="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        inputProps={{ maxLength: 255 }}
                        className="mb-4"
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="descricao"
                        label="Descrição"
                        name="descricao"
                        multiline
                        rows={3}
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        className="mb-4"
                    />

                    <Grid container spacing={2} className="mb-4"> {/* Replaces form-row */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="categoria"
                                label="Categoria"
                                name="categoria"
                                value={categoria}
                                onChange={(e) => setCategoria(e.target.value)}
                                inputProps={{ maxLength: 100 }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="marca"
                                label="Marca"
                                name="marca"
                                value={marca}
                                onChange={(e) => setMarca(e.target.value)}
                                inputProps={{ maxLength: 100 }}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2} className="mb-4">
                        <Grid item xs={12} sm={6}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="imei"
                                label="IMEI (para celulares)"
                                name="imei"
                                value={imei}
                                onChange={(e) => setImei(e.target.value)}
                                inputProps={{ maxLength: 50 }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="codigoSku"
                                label="Código SKU"
                                name="codigoSku"
                                value={codigoSku}
                                onChange={(e) => setCodigoSku(e.target.value)}
                                inputProps={{ maxLength: 50 }}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2} className="mb-4">
                        <Grid item xs={12} sm={6}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="precoVenda"
                                label="Preço de Venda (R$)"
                                name="precoVenda"
                                type="number"
                                value={precoVenda}
                                onChange={(e) => setPrecoVenda(e.target.value)}
                                inputProps={{ step: "0.01", min: "0" }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="precoCusto"
                                label="Preço de Custo (R$)"
                                name="precoCusto"
                                type="number"
                                value={precoCusto}
                                onChange={(e) => setPrecoCusto(e.target.value)}
                                inputProps={{ step: "0.01", min: "0" }}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2} className="mb-6">
                        <Grid item xs={12} sm={6}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="estoqueAtual"
                                label="Estoque Atual"
                                name="estoqueAtual"
                                type="number"
                                value={estoqueAtual}
                                onChange={(e) => setEstoqueAtual(e.target.value)}
                                inputProps={{ step: "1", min: "0" }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                margin="normal"
                                fullWidth
                                id="unidadeMedida"
                                label="Unidade de Medida"
                                name="unidadeMedida"
                                value={unidadeMedida}
                                onChange={(e) => setUnidadeMedida(e.target.value)}
                                inputProps={{ maxLength: 20 }}
                                placeholder="Ex: unidade, pç, kg"
                            />
                        </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }} className="w-full flex-col sm:flex-row">
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={submitLoading}
                            className="py-3 text-lg font-semibold flex-grow sm:flex-grow-0"
                        >
                            {submitLoading ? <CircularProgress size={24} color="inherit" /> : (isEditing ? 'Atualizar Produto' : 'Cadastrar Produto')}
                        </Button>
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => navigate('/produtos')}
                            className="py-3 text-lg font-semibold flex-grow sm:flex-grow-0"
                        >
                            Cancelar
                        </Button>
                    </Box>
                </Box>
            </Box>
        </Container>
    );
}

export default ProdutoFormPage;