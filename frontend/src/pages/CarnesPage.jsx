import React, { useState, useEffect, useCallback } from 'react';
import { carnes /* Removido 'clients' daqui, pois a busca de todos os clientes agora é em NovaVendaPage */ } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

// Função getStatusStyle (mantenha ou importe de um utils)
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
    const { id_cliente } = useParams(); // id_cliente da URL (para carnês de um cliente específico)
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    // Removidos: clientOptions, clienteSelecionadoParaNovoCarne
    // A função fetchClientOptions também foi removida daqui

    const [filterStatus, setFilterStatus] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterSearchQuery, setFilterSearchQuery] = useState('');

    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [carneToDeleteId, setCarneToDeleteId] = useState(null);

    const fetchCarnes = useCallback(async () => {
        try {
            setLoading(true);
            // Se id_cliente vier da URL, ele será usado. Caso contrário, será null.
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
    }, [user, fetchCarnes]); // fetchCarnes agora é a única dependência de fetch aqui

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
        // fetchCarnes será chamado pelo useEffect quando estas dependências mudarem
        // ou podemos chamar explicitamente fetchCarnes() aqui se o useEffect não tiver os filtros como dep.
    };

    // Removida a função handleAdicionarNovoCarne daqui, pois a lógica de seleção de cliente e navegação
    // para o formulário de carnê foi para NovaVendaPage.jsx
    // No entanto, se estivermos na página de um cliente específico, podemos adicionar um botão
    // que vá direto para o formulário de carnê com esse cliente pré-selecionado.

    if (loading) {
        return <LoadingSpinner message="Carregando carnês..." />;
    }

    return (
        <>
            <div className="table-container">
                <h2 className="text-center">
                    Lista de Carnês
                    {/* Lógica para exibir nome do cliente se id_cliente estiver na URL pode ser adicionada aqui
                        buscando o nome do cliente separadamente ou passando como prop se possível */}
                </h2>
                
                <div className="form-container" style={{maxWidth: 'none', margin: '0 0 20px 0', padding: '20px'}}>
                    <h3>Filtrar Carnês:</h3>
                    {/* Seção de Filtros (mantida como no seu último upload) */}
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'flex-end'}}>
                        <div className="form-group">
                            <label>Status:</label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-select">
                                <option value="">Todos</option>
                                <option value="Ativo">Ativo</option>
                                <option value="Quitado">Quitado</option>
                                <option value="Em Atraso">Em Atraso</option>
                                <option value="Cancelado">Cancelado</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Vencimento De:</label>
                            <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>Vencimento Até:</label>
                            <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>Descrição ou Cliente:</label>
                            <input
                                type="text"
                                placeholder="Descrição, Nome ou CPF/CNPJ"
                                value={filterSearchQuery}
                                onChange={(e) => setFilterSearchQuery(e.target.value)}
                                className="form-input"
                            />
                        </div>
                        <div className="form-group" style={{display: 'flex', gap: '10px'}}>
                            <button onClick={fetchCarnes} className="btn btn-primary" style={{width: '100%'}}>Aplicar Filtros</button>
                            <button onClick={handleClearFilters} className="btn btn-secondary" style={{width: '100%'}}>Limpar Filtros</button>
                        </div>
                    </div>
                </div>

                {/* Botão para ir para a nova página de registrar venda OU para adicionar carnê para cliente específico */}
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
                    <p className="text-center" style={{padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '5px'}}>
                        Nenhum carnê encontrado com os filtros aplicados.
                    </p>
                ) : (
                    <table className="styled-table">
                        {/* Cabeçalho e corpo da tabela como no seu último upload */}
                        <thead>
                            <tr>
                                <th >Cliente</th>
                                <th >Descrição</th>
                                <th >Data Venda</th>
                                <th >Valor Total</th>
                                <th >Entrada</th>
                                <th >Nº Parc.</th>
                                <th >Status</th>
                                <th >Ações</th>
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