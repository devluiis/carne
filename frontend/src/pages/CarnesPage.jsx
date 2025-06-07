import React, { useState, useEffect, useCallback } from 'react';
import { carnes } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Quitado': return 'success';
        case 'Em Atraso': return 'danger';
        case 'Cancelado': return 'secondary';
        case 'Ativo': default: return 'primary';
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
            <div className="container table-container"> {/* container do Bootstrap */}
                <h2 className="text-center mb-4">Lista de Carnês</h2>
                
                <div className="card mb-4 p-3"> {/* card mb-4 p-3 do Bootstrap */}
                    <h3>Filtrar Carnês:</h3>
                    <div className="row g-3 align-items-end"> {/* row g-3 do Bootstrap */}
                        <div className="col-md-3 col-sm-6"> {/* col-md-3 col-sm-6 do Bootstrap */}
                            <label htmlFor="filterStatus" className="form-label">Status:</label> {/* form-label do Bootstrap */}
                            <select id="filterStatus" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select"> {/* form-select do Bootstrap */}
                                <option value="">Todos</option>
                                <option value="Ativo">Ativo</option>
                                <option value="Quitado">Quitado</option>
                                <option value="Em Atraso">Em Atraso</option>
                                <option value="Cancelado">Cancelado</option>
                            </select>
                        </div>
                        <div className="col-md-3 col-sm-6">
                            <label htmlFor="filterDateStart" className="form-label">Vencimento De:</label>
                            <input type="date" id="filterDateStart" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="form-control" /> {/* form-control do Bootstrap */}
                        </div>
                        <div className="col-md-3 col-sm-6">
                            <label htmlFor="filterDateEnd" className="form-label">Vencimento Até:</label>
                            <input type="date" id="filterDateEnd" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="form-control" />
                        </div>
                        <div className="col-md-3 col-sm-6">
                            <label htmlFor="filterSearchQuery" className="form-label">Descrição ou Cliente:</label>
                            <input
                                type="text"
                                id="filterSearchQuery"
                                placeholder="Descrição, Nome ou CPF/CNPJ"
                                value={filterSearchQuery}
                                onChange={(e) => setFilterSearchQuery(e.target.value)}
                                className="form-control"
                            />
                        </div>
                        <div className="col-12 d-flex gap-2"> {/* col-12 d-flex gap-2 do Bootstrap */}
                            <button onClick={fetchCarnes} className="btn btn-primary flex-fill">Aplicar Filtros</button> {/* flex-fill para ocupar espaço */}
                            <button onClick={handleClearFilters} className="btn btn-secondary flex-fill">Limpar Filtros</button>
                        </div>
                    </div>
                </div>

                {id_cliente ? (
                     <button onClick={() => navigate(`/carnes/new/${id_cliente}`)} className="btn btn-success mb-3"> {/* mb-3 do Bootstrap */}
                        + Adicionar Carnê para este Cliente
                    </button>
                ) : (
                    <button onClick={() => navigate('/nova-venda')} className="btn btn-success mb-3">
                        + Registrar Nova Venda/Carnê
                    </button>
                )}

                {carnesList.length === 0 ? (
                    <p className="text-center p-3 bg-light rounded">
                        Nenhum carnê encontrado com os filtros aplicados.
                    </p>
                ) : (
                    <div className="table-responsive"> {/* table-responsive do Bootstrap */}
                        <table className="table table-striped table-hover"> {/* Classes de tabela do Bootstrap */}
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
                                        <td data-label="Cliente">{carne.cliente?.nome || 'N/A'}</td>
                                        <td data-label="Descrição">{carne.descricao || 'N/A'}</td>
                                        <td data-label="Data Venda">{carne.data_venda ? new Date(carne.data_venda + 'T00:00:00').toLocaleDateString() : 'N/A'}</td>
                                        <td data-label="Valor Total">R$ {Number(carne.valor_total_original).toFixed(2)}</td>
                                        <td data-label="Entrada">R$ {Number(carne.valor_entrada || 0).toFixed(2)}</td>
                                        <td data-label="Nº Parc.">{carne.numero_parcelas}</td>
                                        <td data-label="Status">
                                            <span className={`badge bg-${getStatusBadgeClass(carne.status_carne)}`}> {/* Classe para badge do Bootstrap */}
                                                {carne.status_carne}
                                            </span>
                                        </td>
                                        <td data-label="Ações">
                                            <div className="d-flex flex-wrap gap-2"> {/* d-flex flex-wrap gap-2 do Bootstrap */}
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
                    </div>
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