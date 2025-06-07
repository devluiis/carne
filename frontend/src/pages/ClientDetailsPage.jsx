import React, { useState, useEffect, useCallback } from 'react';
import { carnes, clients } from '../api'; // Importado 'clients'
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx'; // Importado LoadingSpinner

function ClientDetailsPage() { // Renomeado de CarneDetailsPage para ClientDetailsPage
    const { id } = useParams();
    const navigate = useNavigate();
    const [clientSummary, setClientSummary] = useState(null); // Usar para o resumo do cliente
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchClientDetails = useCallback(async () => { // Função para buscar detalhes do cliente e resumo
        try {
            setLoading(true);
            const response = await clients.getSummary(id); // Assumindo que você tem getSummary em clients no api.js
            setClientSummary(response.data);
            setError('');
        } catch (err) {
            console.error('Erro ao carregar resumo do cliente:', err);
            setError('Falha ao carregar detalhes do cliente. Verifique o ID ou faça login novamente.');
            setGlobalAlert({ message: `Falha ao carregar resumo do cliente: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id, setGlobalAlert]);

    useEffect(() => {
        fetchClientDetails();
    }, [fetchClientDetails]);


    if (loading) return <LoadingSpinner message="Carregando resumo do cliente..." />;
    if (error && !clientSummary) return <p style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</p>;
    if (!clientSummary) return <p className="text-center">Resumo do cliente não encontrado.</p>;

    return (
        <div className="form-container" style={{maxWidth: '1000px'}}>
            <h2 className="text-center">Resumo do Cliente: {clientSummary.nome}</h2>
            
            <div className="form-group" style={{border: '1px solid #eee', padding: '15px', borderRadius: '5px', backgroundColor: '#f9f9f9', marginBottom: '30px'}}>
                <p><strong>Nome:</strong> {clientSummary.nome}</p>
                <p><strong>CPF/CNPJ:</strong> {clientSummary.cpf_cnpj}</p>
                <p><strong>Endereço:</strong> {clientSummary.endereco || 'N/A'}</p>
                <p><strong>Telefone:</strong> {clientSummary.telefone || 'N/A'}</p>
                <p><strong>Email:</strong> {clientSummary.email || 'N/A'}</p>
                <p><strong>Data de Cadastro:</strong> {new Date(clientSummary.data_cadastro).toLocaleDateString()}</p>
            </div>

            <h3 style={{marginBottom: '15px'}}>Estatísticas de Carnês:</h3>
            <div className="dashboard-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}> {/* Reutiliza estilo de grid do dashboard */}
                <div className="card-dashboard">
                    <h3>Dívida Total Aberta</h3>
                    <p className="card-value card-value-red">R$ {Number(clientSummary.total_divida_aberta).toFixed(2)}</p>
                </div>
                <div className="card-dashboard">
                    <h3>Total Pago (Histórico)</h3>
                    <p className="card-value card-value-green">R$ {Number(clientSummary.total_pago_historico).toFixed(2)}</p>
                </div>
                <div className="card-dashboard">
                    <h3>Carnês Ativos</h3>
                    <p className="card-value card-value-blue">{clientSummary.numero_carnes_ativos}</p>
                </div>
                <div className="card-dashboard">
                    <h3>Carnês Quitados</h3>
                    <p className="card-value card-value-green">{clientSummary.numero_carnes_quitados}</p>
                </div>
                <div className="card-dashboard">
                    <h3>Carnês Cancelados</h3>
                    <p className="card-value card-value-red">{clientSummary.numero_carnes_cancelados}</p>
                </div>
            </div>

            <h3 style={{marginTop: '30px', marginBottom: '15px'}}>Carnês do Cliente:</h3>
            {clientSummary.carnes && clientSummary.carnes.length > 0 ? (
                <table className="styled-table">
                    <thead>
                        <tr>
                            <th>ID Carnê</th>
                            <th>Descrição</th>
                            <th>Data Venda</th>
                            <th>Valor Total</th>
                            <th>Nº Parc.</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clientSummary.carnes.map(carne => (
                            <tr key={carne.id_carne}>
                                <td data-label="ID Carnê">{carne.id_carne}</td>
                                <td data-label="Descrição">{carne.descricao || 'N/A'}</td>
                                <td data-label="Data Venda">{carne.data_venda ? new Date(carne.data_venda + 'T00:00:00').toLocaleDateString() : 'N/A'}</td>
                                <td data-label="Valor Total">R$ {Number(carne.valor_total_original).toFixed(2)}</td>
                                <td data-label="Nº Parc.">{carne.numero_parcelas}</td>
                                <td data-label="Status">
                                    <span style={getStatusStyle(carne.status_carne)}>
                                        {carne.status_carne}
                                    </span>
                                </td>
                                <td data-label="Ações">
                                    <div className="table-actions">
                                        <button onClick={() => navigate(`/carnes/details/${carne.id_carne}`)} className="btn btn-info btn-sm">Detalhes</button>
                                        <button onClick={() => navigate(`/carnes/edit/${carne.id_carne}`)} className="btn btn-warning btn-sm">Editar</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p className="text-center">Nenhum carnê associado a este cliente.</p>
            )}
            
            <button onClick={() => navigate(`/carnes/new/${id}`)} className="btn btn-success mt-2">
                + Adicionar Novo Carnê para este Cliente
            </button>
            <button onClick={() => navigate('/clients')} className="btn btn-secondary mt-2" style={{marginLeft: '10px'}}>
                Voltar para Clientes
            </button>
        </div>
    );
}

// Reutilizar getStatusStyle de CarnesPage.jsx
const getStatusStyle = (status) => {
    switch (status) {
        case 'Quitado': return { color: '#28a745', fontWeight: 'bold' };
        case 'Em Atraso': return { color: '#dc3545', fontWeight: 'bold' };
        case 'Cancelado': return { color: '#6c757d', fontWeight: 'bold' };
        case 'Ativo': default: return { color: '#007bff', fontWeight: 'bold' };
    }
};

export default ClientDetailsPage;