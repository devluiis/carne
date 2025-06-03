import React, { useState, useEffect } from 'react';
import { clients } from '../api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function ClientsPage() {
    const [clientList, setClientList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async (query = '') => {
        try {
            setLoading(true);
            const response = await clients.getAll(query);
            setClientList(response.data);
            setError('');
        } catch (err) {
            console.error('Erro ao buscar clientes:', err);
            setError('Falha ao carregar clientes. Faça login novamente.');
            setGlobalAlert({ message: 'Falha ao carregar clientes. Faça login novamente.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        fetchClients(searchQuery);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este cliente? Isso removerá todos os carnês e pagamentos associados.')) {
            try {
                await clients.delete(id);
                setGlobalAlert({ message: 'Cliente excluído com sucesso!', type: 'success' });
                fetchClients(searchQuery);
            } catch (err) {
                console.error('Erro ao excluir cliente:', err);
                const errorMessage = `Falha ao excluir cliente: ${err.response?.data?.detail || err.message || 'Erro desconhecido.'}`;
                setError(errorMessage);
                setGlobalAlert({ message: errorMessage, type: 'error' });
            }
        }
    };

    if (loading) {
        return <LoadingSpinner message="Carregando clientes..." />;
    }

    if (error && clientList.length === 0) {
        return <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>;
    }

    return (
        <div style={{ maxWidth: '800px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Lista de Clientes</h2>
            
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Buscar por nome ou CPF/CNPJ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flexGrow: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button
                    onClick={handleSearch}
                    style={{ padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Buscar
                </button>
                <button
                    onClick={() => { setSearchQuery(''); fetchClients(''); }}
                    style={{ padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Limpar
                </button>
            </div>

            <button
                onClick={() => navigate('/clients/new')}
                style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}
            >
                Adicionar Novo Cliente
            </button>
            {clientList.length === 0 && !searchQuery ? (
                <p>Nenhum cliente cadastrado.</p>
            ) : clientList.length === 0 && searchQuery ? (
                <p>Nenhum cliente encontrado para a busca "{searchQuery}".</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={tableHeaderStyle}>Nome</th>
                            <th style={tableHeaderStyle}>CPF/CNPJ</th>
                            <th style={tableHeaderStyle}>Telefone</th>
                            <th style={tableHeaderStyle}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clientList.map((client) => (
                            <tr key={client.id_cliente}>
                                <td style={tableCellStyle}>{client.nome}</td>
                                <td style={tableCellStyle}>{client.cpf_cnpj}</td>
                                <td style={tableCellStyle}>{client.telefone || 'N/A'}</td>
                                <td style={tableCellStyle}>
                                    <button
                                        onClick={() => navigate(`/clients/edit/${client.id_cliente}`)}
                                        style={{ padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}
                                    >
                                        Editar
                                    </button>
                                    {user && user.perfil === 'admin' && (
                                        <button
                                            onClick={() => handleDelete(client.id_cliente)}
                                            style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Excluir
                                        </button>
                                    )}
                                    <button
                                        onClick={() => navigate(`/clients/${client.id_cliente}/carnes`)}
                                        style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '5px' }}
                                    >
                                        Ver Carnês
                                    </button>
                                    <button
                                        onClick={() => navigate(`/clients/details/${client.id_cliente}`)}
                                        style={{ ...actionButtonStyle, backgroundColor: '#17a2b8', marginLeft: '5px' }}
                                    >
                                        Resumo
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

const tableHeaderStyle = {
    borderBottom: '1px solid #ddd',
    padding: '10px',
    textAlign: 'left',
    backgroundColor: '#f2f2f2'
};
const tableCellStyle = {
    borderBottom: '1px solid #eee',
    padding: '10px'
};
const actionButtonStyle = {
    padding: '5px 10px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '5px'
};

export default ClientsPage;