import React, { useState, useEffect, useCallback } from 'react';
import { clients } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx'; // Importar useGlobalAlert
import LoadingSpinner from './LoadingSpinner.jsx'; // Importar LoadingSpinner
import ConfirmationModal from './ConfirmationModal.jsx'; // Importar ConfirmationModal

function ClientList() { // Sugestão: Se este for o arquivo antigo, pode renomeá-lo ou usar apenas ClientsPage.jsx
    const [clientList, setClientList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert(); // Usar o contexto de alerta global

    // Estados para o modal de confirmação de exclusão de cliente
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
        if (user) { // Garante que o usuário está logado para buscar
            fetchClients(searchQuery); 
        } else {
            setLoading(false);
            setGlobalAlert({ message: 'Faça login para ver os clientes.', type: 'error' }); // Mensagem de alerta global
        }
    }, [user, fetchClients, searchQuery]);


    const handleSearch = () => {
        fetchClients(searchQuery); 
    };

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    // NOVAS FUNÇÕES PARA O MODAL DE EXCLUSÃO DE CLIENTE
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
                <h2 className="text-center">Lista de Clientes</h2>
                
                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}> {/* Adicionado flexWrap */}
                    <input
                        type="text"
                        placeholder="Buscar por nome ou CPF/CNPJ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                        style={{ flexGrow: 1 }}
                    />
                    <button
                        onClick={handleSearch}
                        className="btn btn-primary"
                        style={{ width: 'auto' }} /* Reduzir largura do botão */
                    >
                        Buscar
                    </button>
                    <button
                        onClick={handleClearSearch}
                        className="btn btn-secondary"
                        style={{ width: 'auto' }} /* Reduzir largura do botão */
                    >
                        Limpar
                    </button>
                </div>

                <button onClick={() => navigate('/clients/new')} className="btn btn-success" style={{width: 'auto', marginBottom: '20px'}}>
                    Adicionar Novo Cliente
                </button>
                
                {clientList.length === 0 && !searchQuery ? (
                    <p className="text-center">Nenhum cliente cadastrado.</p>
                ) : clientList.length === 0 && searchQuery ? (
                    <p className="text-center">Nenhum cliente encontrado para a busca "{searchQuery}".</p>
                ) : (
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
                            {clientList.map((client) => (
                                <tr key={client.id_cliente}>
                                    <td data-label="Nome">{client.nome}</td>
                                    <td data-label="CPF/CNPJ">{client.cpf_cnpj}</td>
                                    <td data-label="Telefone">{client.telefone || 'N/A'}</td>
                                    <td data-label="Ações">
                                        <div className="table-actions">
                                            <button onClick={() => navigate(`/clients/edit/${client.id_cliente}`)} className="btn btn-warning btn-sm">Editar</button>
                                            {user && user.perfil === 'admin' && (
                                                <button onClick={() => handleOpenDeleteClientModal(client.id_cliente)} className="btn btn-danger btn-sm">Excluir</button>
                                            )}
                                            <button onClick={() => navigate(`/clients/${client.id_cliente}/carnes`)} className="btn btn-secondary btn-sm">Ver Carnês</button>
                                            <button onClick={() => navigate(`/clients/details/${client.id_cliente}`)} className="btn btn-info btn-sm">Resumo</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
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

export default ClientList;