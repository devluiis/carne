import React, { useState, useEffect } from 'react';
import { clients, carnes } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx'; // Importar useGlobalAlert

function ClientDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [clientSummary, setClientSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(''); // Manter erro local para carregamento
    const { setGlobalAlert } = useGlobalAlert(); // Usar o contexto do alerta global

    useEffect(() => {
        fetchClientSummary();
    }, [id]);

    const fetchClientSummary = async () => {
        try {
            setLoading(true);
            const response = await clients.getSummary(id);
            setClientSummary(response.data);
            setError('');
        } catch (err) {
            console.error('Erro ao carregar resumo do cliente:', err);
            setError('Falha ao carregar resumo do cliente. Verifique o ID ou faça login novamente.');
            setGlobalAlert({ message: `Falha ao carregar resumo do cliente: ${err.response?.data?.detail || err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <p style={loadingStyle}>Carregando resumo do cliente...</p>;
    if (error && !clientSummary) return <p style={{ ...errorStyle, color: 'red' }}>{error}</p>; // Exibir erro local se não houver dados
    if (!clientSummary) return <p style={noDataStyle}>Resumo do cliente não encontrado.</p>;

    return (
        <div style={containerStyle}>
            <h2 style={headerStyle}>Resumo Detalhado do Cliente: {clientSummary.nome}</h2>
            
            <div style={sectionStyle}>
                <h3>Informações do Cliente</h3>
                <p><strong>Nome:</strong> {clientSummary.nome}</p>
                <p><strong>CPF/CNPJ:</strong> {clientSummary.cpf_cnpj}</p>
                <p><strong>Endereço:</strong> {clientSummary.endereco || 'N/A'}</p>
                <p><strong>Telefone:</strong> {clientSummary.telefone || 'N/A'}</p>
                <p><strong>Email:</strong> {clientSummary.email || 'N/A'}</p>
                <p><strong>Data de Cadastro:</strong> {new Date(clientSummary.data_cadastro).toLocaleDateString()}</p>
                <button
                    onClick={() => navigate(`/clients/edit/${clientSummary.id_cliente}`)}
                    style={{ ...actionButtonStyle, backgroundColor: '#007bff' }}
                >
                    Editar Cliente
                </button>
            </div>

            <div style={sectionStyle}>
                <h3>Resumo Financeiro dos Carnês</h3>
                <p><strong>Dívida Total em Aberto:</strong> R$ {clientSummary.total_divida_aberta.toFixed(2)}</p>
                <p><strong>Valor Total Pago (Histórico):</strong> R$ {clientSummary.total_pago_historico.toFixed(2)}</p>
                <p><strong>Carnês Ativos/Em Atraso:</strong> {clientSummary.numero_carnes_ativos}</p>
                <p><strong>Carnês Quitados:</strong> {clientSummary.numero_carnes_quitados}</p>
                <p><strong>Carnês Cancelados:</strong> {clientSummary.numero_carnes_cancelados}</p>
                
                <button
                    onClick={() => navigate(`/clients/${clientSummary.id_cliente}/carnes`)}
                    style={{ ...actionButtonStyle, backgroundColor: '#28a745', marginTop: '15px' }}
                >
                    Ver Todos os Carnês do Cliente
                </button>
                {/* NOVO: Botão para ver o relatório de dívidas pendentes do cliente (RF023) */}
                <button
                    onClick={() => navigate(`/reports/pending-debts-by-client/${clientSummary.id_cliente}`)}
                    style={{ ...actionButtonStyle, backgroundColor: '#ffc107', color: 'black', marginTop: '15px', marginLeft: '10px' }}
                >
                    Ver Dívidas Pendentes
                </button>
            </div>

            <button onClick={() => navigate('/clients')} style={{ ...backButtonStyle, marginTop: '20px' }}>
                Voltar para Lista de Clientes
            </button>
        </div>
    );
}

// Estilos
const containerStyle = { maxWidth: '800px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba[0,0,0,0.1]', backgroundColor: 'white' };
const headerStyle = { textAlign: 'center', marginBottom: '30px', color: '#333' };
const sectionStyle = { marginBottom: '25px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#f9f9f9' };
const actionButtonStyle = { padding: '8px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', marginRight: '10px' };
const backButtonStyle = { padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const loadingStyle = { textAlign: 'center', fontSize: '1.2em', color: '#555' };
const errorStyle = { textAlign: 'center', fontSize: '1.2em', color: 'red' };
const noDataStyle = { textAlign: 'center', fontSize: '1.1em', color: '#777' };

export default ClientDetailsPage;