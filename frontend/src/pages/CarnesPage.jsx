import React, { useState, useEffect, useCallback } from 'react';
import { carnes } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

const getStatusStyle = (status) => {
    switch (status) {
        case 'Quitado': return { color: '#28a745', fontWeight: 'bold' };
        case 'Em Atraso': return { color: '#dc3545', fontWeight: 'bold' };
        case 'Cancelado': return { color: '#6c757d', fontWeight: 'bold' };
        case 'Ativo': default: return { color: '#007bff', fontWeight: 'bold' };
    }
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
        <>
            <div className="table-container">
                <h2 className="text-center">
                    Lista de Carnês
                </h2>
                
                <div className="form-container filter-section"> {/* Nova classe para a seção de filtros */}
                    <h3>Filtrar Carnês:</h3>
                    <div className="filter-grid"> {/* Nova classe para o grid de filtros */}
                        <div className="form-group">
                            <label htmlFor="filterStatus">Status:</label>
                            <select id="filterStatus" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select">
                                <option value="">Todos</option>
                                <option value="Ativo">Ativo</option>
                                <option value="Quitado">Quitado</option>
                                <option value="Em Atraso">Em Atraso</option>
                                <option value="Cancelado">Cancelado</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="filterDateStart">Vencimento De:</label>
                            <input type="date" id="filterDateStart" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="filterDateEnd">Vencimento Até:</label>
                            <input type="date" id="filterDateEnd" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="filterSearchQuery">Descrição ou Cliente:</label>
                            <input
                                type="text"
                                id="filterSearchQuery"
                                placeholder="Descrição, Nome ou CPF/CNPJ"
                                value={filterSearchQuery}
                                onChange={(e) => setFilterSearchQuery(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group filter-buttons"> {/* Nova classe para os botões de filtro */}
                            <button onClick={fetchCarnes} className="btn btn-primary">Aplicar Filtros</button>
                            <button onClick={handleClearFilters} className="btn btn-secondary">Limpar Filtros</button>
                        </div>
                    </div>
                </div>

                {id_cliente ? (
                     <button onClick={() => navigate(`/carnes/new/${id_cliente}`)} className="btn btn-success" style={{width: 'auto', marginBottom: '20px'}}>
                        + Adicionar Carnê para este Cliente
                    </button>
                ) : (
                    <button onClick={() => navigate('/nova-venda')} className="btn btn-success" style={{width: 'auto', marginBottom: '20px'}}>
                        + Registrar Nova Venda/Carnê
                    </button>
                )}

                {carnesList.length === 0 ? (
                    <p className="text-center no-data-message">
                        Nenhum carnê encontrado com os filtros aplicados.
                    </p>
                ) : (
                    <table className="styled-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Descrição</th>
                                <th>Data Venda</th>
                                <th>Valor Total</th>
                                <th>Entrada</th>
                                <th>Nº Parc.</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {carnesList.map((carne) => (
                                <tr key={carne.id_carne}>
                                    <td>{carne.cliente?.nome || 'N/A'}</td>
                                    <td>{carne.descricao || 'N/A'}</td>
                                    <td>{carne.data_venda ? new Date(carne.data_venda + 'T00:00:00').toLocaleDateString() : 'N/A'}</td>
                                    <td>R$ {Number(carne.valor_total_original).toFixed(2)}</td>
                                    <td>R$ {Number(carne.valor_entrada || 0).toFixed(2)}</td>
                                    <td>{carne.numero_parcelas}</td>
                                    <td>
                                        <span style={getStatusStyle(carne.status_carne)}>
                                            {carne.status_carne}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="table-actions">
                                            <button onClick={() => navigate(`/carnes/details/${carne.id_carne}`)} className="btn btn-info btn-sm">Detalhes</button>
                                            <button onClick={() => navigate(`/carnes/edit/${carne.id_carne}`)} className="btn btn-warning btn-sm">Editar</button>
                                            {user?.perfil === 'admin' && 
                                                <button onClick={() => handleOpenDeleteModal(carne.id_carne)} className="btn btn-danger btn-sm">Excluir</button>
                                            }
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirmModal}
                title="Confirmar Exclusão de Carnê"
                message="Tem certeza que deseja excluir este carnê e todas as suas parcelas e pagamentos associados? Esta ação não pode ser desfeita."
                onConfirm={performDeleteCarne}
                onCancel={handleCancelDelete}
                confirmText="Sim, Excluir"
                cancelText="Cancelar"
            />
        </>
    );
}

export default CarnesPage;