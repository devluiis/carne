import React, { useState, useEffect, useCallback } from 'react';
import { carnes, clients } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

// Função auxiliar para classes de badge do Bootstrap
const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Paga':
        case 'Paga com Atraso':
            return 'success';
        case 'Atrasada':
            return 'danger';
        case 'Parcialmente Paga':
            return 'warning';
        default: // Pendente
            return 'primary';
    }
};

function ClientDetailsPage() { 
    const { id } = useParams();
    const navigate = useNavigate();
    const [clientSummary, setClientSummary] = useState(null); 
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchClientDetails = useCallback(async () => { 
        try {
            setLoading(true);
            const response = await clients.getSummary(id); 
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
    if (error && !clientSummary) return <p className="text-center text-danger p-3">{error}</p>; 
    if (!clientSummary) return <p className="text-center">Resumo do cliente não encontrado.</p>;

    return (
        <div className="container form-container"> {/* container do Bootstrap */}
            <h2 className="text-center mb-4">Resumo do Cliente: {clientSummary.nome}</h2>
            
            <div className="card mb-4 p-3 bg-light"> {/* card mb-4 p-3 bg-light do Bootstrap */}
                <p><strong>Nome:</strong> {clientSummary.nome}</p>
                <p><strong>CPF/CNPJ:</strong> {clientSummary.cpf_cnpj}</p>
                <p><strong>Endereço:</strong> {clientSummary.endereco || 'N/A'}</p>
                <p><strong>Telefone:</strong> {clientSummary.telefone || 'N/A'}</p>
                <p><strong>Email:</strong> {clientSummary.email || 'N/A'}</p>
                <p><strong>Data de Cadastro:</strong> {new Date(clientSummary.data_cadastro).toLocaleDateString()}</p>
            </div>

            <h3 className="mb-3">Estatísticas de Carnês:</h3> 
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3"> {/* Grid Bootstrap */}
                <div className="col">
                    <div className="card text-center p-3 shadow-sm"> {/* card text-center p-3 shadow-sm do Bootstrap */}
                        <h3 className="fs-6">Dívida Total Aberta</h3> {/* fs-6 para font-size menor */}
                        <p className="card-value text-danger">R$ {Number(clientSummary.total_divida_aberta).toFixed(2)}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Total Pago (Histórico)</h3>
                        <p className="card-value text-success">R$ {Number(clientSummary.total_pago_historico).toFixed(2)}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Carnês Ativos</h3>
                        <p className="card-value text-primary">{clientSummary.numero_carnes_ativos}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Carnês Quitados</h3>
                        <p className="card-value text-success">{clientSummary.numero_carnes_quitados}</p>
                    </div>
                </div>
                <div className="col">
                    <div className="card text-center p-3 shadow-sm">
                        <h3 className="fs-6">Carnês Cancelados</h3>
                        <p className="card-value text-danger">{clientSummary.numero_carnes_cancelados}</p>
                    </div>
                </div>
            </div>

            <h3 className="mt-4 mb-3">Carnês do Cliente:</h3> 
            {clientSummary.carnes && clientSummary.carnes.length > 0 ? (
                <div className="table-responsive"> {/* table-responsive do Bootstrap */}
                    <table className="table table-striped table-hover">
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
                                        <span className={`badge bg-${getStatusBadgeClass(carne.status_carne)}`}>
                                            {carne.status_carne}
                                        </span>
                                    </td>
                                    <td data-label="Ações">
                                        <div className="d-flex flex-wrap gap-2">
                                            <button onClick={() => navigate(`/carnes/details/${carne.id_carne}`)} className="btn btn-info btn-sm">Detalhes</button>
                                            <button onClick={() => navigate(`/carnes/edit/${carne.id_carne}`)} className="btn btn-warning btn-sm">Editar</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-center">Nenhum carnê associado a este cliente.</p>
            )}
            
            <button onClick={() => navigate(`/carnes/new/${id}`)} className="btn btn-success mt-3"> 
                + Adicionar Novo Carnê para este Cliente
            </button>
            <button onClick={() => navigate('/clients')} className="btn btn-secondary mt-3 ms-2"> 
                Voltar para Clientes
            </button>
        </div>
    );
}

export default ClientDetailsPage;