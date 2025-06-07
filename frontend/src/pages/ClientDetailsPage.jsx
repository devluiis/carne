import React, { useState, useEffect } from 'react';
import { clients, carnes } from '../api'; // Importar 'clients'
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx'; // Importar LoadingSpinner

function ClientDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = useState(null); // Estado para os detalhes do cliente
    const [carnesDoCliente, setCarnesDoCliente] = useState([]); // Estado para os carnês do cliente
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const { user } = useAuth(); // Para verificar permissões se necessário
    const { setGlobalAlert } = useGlobalAlert();

    useEffect(() => {
        const fetchClientAndCarnes = async () => {
            try {
                setLoading(true);
                // Busca os detalhes do cliente
                const clientResponse = await clients.getById(id);
                setClient(clientResponse.data);

                // Busca os carnês associados a este cliente
                const carnesResponse = await carnes.getAll(id); // Passa o ID do cliente para filtrar
                setCarnesDoCliente(carnesResponse.data || []);
                setError('');
            } catch (err) {
                console.error('Erro ao carregar detalhes do cliente ou carnês:', err);
                setError('Falha ao carregar dados do cliente. Verifique o ID ou faça login novamente.');
                setGlobalAlert({ message: `Falha ao carregar dados do cliente: ${err.response?.data?.detail || err.message}`, type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchClientAndCarnes();
    }, [id, setGlobalAlert]);


    // Função auxiliar para estilos de status de carnê (reutilizada de CarnesPage)
    const getCarneStatusStyle = (status) => {
        switch (status) {
            case 'Quitado': return { color: '#28a745', fontWeight: 'bold' };
            case 'Em Atraso': return { color: '#dc3545', fontWeight: 'bold' };
            case 'Cancelado': return { color: '#6c757d', fontWeight: 'bold' };
            case 'Ativo': default: return { color: '#007bff', fontWeight: 'bold' };
        }
    };


    if (loading) return <LoadingSpinner message="Carregando detalhes do cliente..." />;
    if (error && !client) return <p className="text-center text-danger">{error}</p>;
    if (!client) return <p className="text-center">Cliente não encontrado.</p>;

    return (
        <div className="form-container large-container"> {/* Usando large-container */}
            <h2 className="text-center">Resumo do Cliente: {client.nome}</h2>
            
            <div className="carne-info-box" style={{marginBottom: '30px'}}> {/* Reutilizando a classe e ajustando */}
                <p><strong>Nome:</strong> {client.nome}</p>
                <p><strong>CPF/CNPJ:</strong> {client.cpf_cnpj}</p>
                <p><strong>Endereço:</strong> {client.endereco || 'N/A'}</p>
                <p><strong>Telefone:</strong> {client.telefone || 'N/A'}</p>
                <p><strong>Email:</strong> {client.email || 'N/A'}</p>
            </div>

            <h3 className="section-title">Carnês Associados:</h3>
            {carnesDoCliente.length === 0 ? (
                <p className="text-center no-data-message">Nenhum carnê associado a este cliente.</p>
            ) : (
                <table className="styled-table">
                    <thead>
                        <tr>
                            <th>Descrição</th>
                            <th>Valor Total</th>
                            <th>Nº Parcelas</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {carnesDoCliente.map((carne) => (
                            <tr key={carne.id_carne}>
                                <td>{carne.descricao || `Carnê ID ${carne.id_carne}`}</td>
                                <td>R$ {Number(carne.valor_total_original).toFixed(2)}</td>
                                <td>{carne.numero_parcelas}</td>
                                <td>
                                    <span style={getCarneStatusStyle(carne.status_carne)}>
                                        {carne.status_carne}
                                    </span>
                                </td>
                                <td>
                                    <div className="table-actions">
                                        <button 
                                            onClick={() => navigate(`/carnes/details/${carne.id_carne}`)}
                                            className="btn btn-info btn-sm"
                                        >
                                            Ver Detalhes
                                        </button>
                                        <button 
                                            onClick={() => navigate(`/carnes/edit/${carne.id_carne}`)}
                                            className="btn btn-warning btn-sm"
                                        >
                                            Editar
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <div className="mt-2">
                <button onClick={() => navigate('/clients')} className="btn btn-secondary">
                    Voltar para Lista de Clientes
                </button>
            </div>
        </div>
    );
}

export default ClientDetailsPage;