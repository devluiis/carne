import React, { useState, useEffect, useCallback } from 'react';
import { clients } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import ConfirmationModal from '../components/ConfirmationModal.jsx';

function ClientsPage() {
    const [clientList, setClientList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const [showDeleteClientModal, setShowDeleteClientModal] = useState(false);
    const [clientToDeleteId, setClientToDeleteId] = useState(null);

    const fetchClients = useCallback(async (query = '') => {
        try {
            setLoading(true);
            const response = await clients.getAll(query);
            setClientList(response.data || []);
        } catch (err) {
            console.error('Erro ao buscar clientes:', err);
            setGlobalAlert({ message: 'Falha ao carregar clientes.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        fetchClients(searchQuery);
    }, [fetchClients, searchQuery]);

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    const handleOpenDeleteClientModal = (id) => {
        setClientToDeleteId(id);
        setShowDeleteClientModal(true);
    };

    const handleCancelDeleteClient = () => {
        setShowDeleteClientModal(false);
        setClientToDeleteId(null);
    };

    const performDeleteClient = async () => {
        if (!clientToDeleteId) return;
        try {
            await clients.delete(clientToDeleteId);
            setGlobalAlert({ message: 'Cliente excluído com sucesso!', type: 'success' });
            fetchClients(searchQuery);
        } catch (err) {
            const errorMessage = `Falha ao excluir cliente: ${err.response?.data?.detail || err.message}`;
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setShowDeleteClientModal(false);
            setClientToDeleteId(null);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Carregando clientes..." />;
    }

    return (
        <>
            <div className="table-container">
                <h2 className="text-center">Gerenciamento de Clientes</h2>
                <div className="search-filter-container" style={{marginBottom: '20px'}}>
                    <input
                        type="text"
                        placeholder="Buscar por nome ou CPF/CNPJ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input search-input"
                    />
                    <button onClick={handleClearSearch} className="btn btn-secondary btn-sm">Limpar Busca</button>
                </div>
                <button onClick={() => navigate('/clients/new')} className="btn btn-success" style={{width: 'auto', marginBottom: '20px'}}>
                    + Novo Cliente
                </button>
                
                <table className="styled-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>CPF/CNPJ</th>
                            <th>Telefone</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clientList.length > 0 ? clientList.map((client) => (
                            <tr key={client.id_cliente}>
                                <td>{client.nome}</td>
                                <td>{client.cpf_cnpj}</td>
                                <td>{client.telefone || 'N/A'}</td>
                                <td>
                                    <div className="table-actions">
                                        <button onClick={() => navigate(`/clients/details/${client.id_cliente}`)} className="btn btn-info btn-sm">Resumo</button>
                                        <button onClick={() => navigate(`/clients/edit/${client.id_cliente}`)} className="btn btn-warning btn-sm">Editar</button>
                                        {user?.perfil === 'admin' && (
                                            <button 
                                                onClick={() => handleOpenDeleteClientModal(client.id_cliente)}
                                                className="btn btn-danger btn-sm"
                                            >
                                                Excluir
                                            </button>
                                        )}
                                        <button onClick={() => navigate(`/clients/${client.id_cliente}/carnes`)} className="btn btn-secondary btn-sm">Ver Carnês</button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" className="text-center no-data-message">
                                    {searchQuery ? `Nenhum cliente encontrado para "${searchQuery}".` : "Nenhum cliente cadastrado."}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmationModal
                isOpen={showDeleteClientModal}
                title="Confirmar Exclusão de Cliente"
                message="Tem certeza que deseja excluir este cliente? Todos os carnês e pagamentos associados a ele também serão removidos. Esta ação não pode ser desfeita."
                onConfirm={performDeleteClient}
                onCancel={handleCancelDeleteClient}
                confirmText="Sim, Excluir Cliente"
                cancelText="Cancelar"
            />
        </>
    );
}

export default ClientsPage;