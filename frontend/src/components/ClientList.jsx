import React, { useState, useEffect, useCallback } from 'react';
import { clients } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';

function ClientList() {
    const [clientList, setClientList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchClients = useCallback(async (query = '') => {
        try {
            setLoading(true);
            const response = await clients.getAll(query);
            setClientList(response.data);
            // Removido setError, useGlobalAlert é o suficiente
        } catch (err) {
            console.error('Erro ao buscar clientes:', err);
            setGlobalAlert({ message: 'Falha ao carregar clientes. Faça login novamente.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        fetchClients(searchQuery);
    }, [fetchClients, searchQuery]); // Re-fetch quando searchQuery muda

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este cliente? Isso removerá todos os carnês e pagamentos associados. Esta ação é irreversível.')) {
            try {
                await clients.delete(id);
                setGlobalAlert({ message: 'Cliente excluído com sucesso!', type: 'success' });
                fetchClients(searchQuery);
            } catch (err) {
                console.error('Erro ao excluir cliente:', err);
                setGlobalAlert({ message: `Falha ao excluir cliente: ${err.response?.data?.detail || err.message || 'Erro desconhecido.'}`, type: 'error' });
            }
        }
    };

    if (loading) return <LoadingSpinner message="Carregando clientes..." />;

    return (
        <div className="table-container">
            <h2 className="text-center">Lista de Clientes</h2>
            
            <div className="search-filter-container"> {/* Nova classe para os elementos de busca */}
                <input
                    type="text"
                    placeholder="Buscar por nome ou CPF/CNPJ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input search-input"
                />
                <button
                    onClick={handleClearSearch}
                    className="btn btn-secondary btn-sm"
                >
                    Limpar
                </button>
            </div>

            <button
                onClick={() => navigate('/clients/new')}
                className="btn btn-success" style={{width: 'auto', marginBottom: '20px'}}
            >
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
                                <td>{client.nome}</td>
                                <td>{client.cpf_cnpj}</td>
                                <td>{client.telefone || 'N/A'}</td>
                                <td>
                                    <div className="table-actions">
                                        <button
                                            onClick={() => navigate(`/clients/edit/${client.id_cliente}`)}
                                            className="btn btn-warning btn-sm"
                                        >
                                            Editar
                                        </button>
                                        {user && user.perfil === 'admin' && (
                                            <button
                                                onClick={() => handleDelete(client.id_cliente)}
                                                className="btn btn-danger btn-sm"
                                            >
                                                Excluir
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate(`/clients/${client.id_cliente}/carnes`)}
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Ver Carnês
                                        </button>
                                        <button
                                            onClick={() => navigate(`/clients/details/${client.id_cliente}`)}
                                            className="btn btn-info btn-sm"
                                        >
                                            Resumo
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default ClientList;