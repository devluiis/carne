import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { produtos } from '../api';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

const formatCurrency = (value) => {
    const num = Number(value);
    if (isNaN(num)) {
        return 'N/A';
    }
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
            <div className="table-container">
                <h2 className="text-center">Gerenciamento de Produtos</h2>

                <div className="form-container filter-section">
                    <h3>Filtrar Produtos:</h3>
                    <div className="filter-grid">
                        <div className="form-group">
                            <label htmlFor="searchNome">Nome do Produto:</label>
                            <input
                                id="searchNome"
                                type="text"
                                placeholder="Buscar por nome..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="searchCategoria">Categoria:</label>
                            <input
                                id="searchCategoria"
                                type="text"
                                placeholder="Filtrar por categoria..."
                                value={filterCategoria}
                                onChange={(e) => setFilterCategoria(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="searchMarca">Marca:</label>
                            <input
                                id="searchMarca"
                                type="text"
                                placeholder="Filtrar por marca..."
                                value={filterMarca}
                                onChange={(e) => setFilterMarca(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group filter-buttons">
                            <button onClick={handleClearFilters} className="btn btn-secondary">Limpar Filtros</button>
                        </div>
                    </div>
                </div>

                <button onClick={navigateToCreateProduto} className="btn btn-success" style={{width: 'auto', marginBottom: '20px'}}>
                    + Adicionar Novo Produto
                </button>

                {produtosList.length === 0 ? (
                    <p className="text-center no-data-message">
                        Nenhum produto encontrado.
                    </p>
                ) : (
                    <table className="styled-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nome</th>
                                <th>Categoria</th>
                                <th>Marca</th>
                                <th>Preço Venda</th>
                                <th>Estoque</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {produtosList.map((produto) => (
                                <tr key={produto.id_produto}>
                                    <td>{produto.id_produto}</td>
                                    <td>{produto.nome}</td>
                                    <td>{produto.categoria || 'N/A'}</td>
                                    <td>{produto.marca || 'N/A'}</td>
                                    <td>{produto.preco_venda !== null ? formatCurrency(produto.preco_venda) : 'N/A'}</td>
                                    <td>{produto.estoque_atual !== null ? produto.estoque_atual : 'N/A'} {produto.unidade_medida || ''}</td>
                                    <td>
                                        <div className="table-actions">
                                            <button 
                                                onClick={() => navigateToEditProduto(produto.id_produto)} 
                                                className="btn btn-warning btn-sm"
                                            >
                                                Editar
                                            </button>
                                            {user?.perfil === 'admin' && (
                                                <button 
                                                    onClick={() => handleOpenDeleteModal(produto.id_produto)} 
                                                    className="btn btn-danger btn-sm"
                                                >
                                                    Excluir
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

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