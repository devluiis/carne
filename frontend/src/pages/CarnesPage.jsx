// pages/CarnesPage.jsx
import React, { useState, useEffect } from 'react';
import { carnes, clients } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider.jsx';
import { useGlobalAlert } from '../App.jsx'; // Importar useGlobalAlert

function CarnesPage() {
    const [carnesList, setCarnesList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(''); // Manter erro local para carregamento
    const navigate = useNavigate();
    const { id_cliente } = useParams();
    const { user } = useAuth();
    const { setGlobalAlert } = useGlobalAlert(); // Usar o contexto do alerta global


    const [clientOptions, setClientOptions] = useState([]);
    const [clienteSelecionadoParaNovoCarne, setClienteSelecionadoParaNovoCarne] = useState('');

    const [filterStatus, setFilterStatus] = useState('');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterSearchQuery, setFilterSearchQuery] = useState('');

    useEffect(() => {
        if (user) {
            fetchCarnes();
            fetchClientOptions();
        } else {
            setLoading(false);
            setError('Faça login para ver os carnês.');
            setGlobalAlert({ message: 'Faça login para ver os carnês.', type: 'error' });
        }
    }, [user, id_cliente, filterStatus, filterDateStart, filterDateEnd, filterSearchQuery]);

    const fetchCarnes = async () => {
        try {
            setLoading(true);
            const response = await carnes.getAll(
                id_cliente,
                filterStatus || null,
                filterDateStart || null,
                filterDateEnd || null,
                filterSearchQuery || null
            );
            setCarnesList(response.data);
            setError('');
        } catch (err) {
            console.error('Erro ao buscar carnês:', err);
            setError('Falha ao carregar carnês. Faça login novamente ou verifique as permissões.');
            setGlobalAlert({ message: 'Falha ao carregar carnês. Faça login novamente ou verifique as permissões.', type: 'error' });
            if (err.response && err.response.status === 401) {
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchClientOptions = async () => {
        try {
            const response = await clients.getAll();
            setClientOptions(response.data);
        } catch (err) {
            console.error('Erro ao carregar opções de clientes:', err);
        }
    };

    const handleApplyFilters = () => {
        fetchCarnes();
    };

    const handleClearFilters = () => {
        setFilterStatus('');
        setFilterDateStart('');
        setFilterDateEnd('');
        setFilterSearchQuery('');
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este carnê e todas as suas parcelas e pagamentos?')) {
            try {
                await carnes.delete(id);
                setGlobalAlert({ message: 'Carnê excluído com sucesso!', type: 'success' }); // Feedback de sucesso
                fetchCarnes();
            } catch (err) {
                console.error('Erro ao excluir carnê:', err);
                const errorMessage = `Falha ao excluir carnê: ${err.response?.data?.detail || err.message || 'Erro desconhecido.'}`;
                setError(errorMessage); // Manter erro local
                setGlobalAlert({ message: errorMessage, type: 'error' }); // Feedback de erro global
            }
        }
    };

    const handleAdicionarNovoCarne = () => {
        if (!clienteSelecionadoParaNovoCarne) {
            setGlobalAlert({ message: 'Por favor, selecione um cliente antes de adicionar um novo carnê.', type: 'warning' });
            return;
        }
        navigate(`/carnes/new/${clienteSelecionadoParaNovoCarne}`);
    };


    if (loading) return <p style={loadingStyle}>Carregando carnês...</p>;
    if (error && carnesList.length === 0) return <p style={{ ...errorStyle, color: 'red' }}>{error}</p>;

    return (
        <div style={containerStyle}>
            <h2 style={headerStyle}>Lista de Carnês {id_cliente ? `do Cliente ${id_cliente}` : ''}</h2>

            <div style={filterSectionStyle}>
                <h3>Filtrar Carnês:</h3>
                <div style={filterGroupStyle}>
                    <label>Status:</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
                        <option value="">Todos</option>
                        <option value="Ativo">Ativo</option>
                        <option value="Quitado">Quitado</option>
                        <option value="Em Atraso">Em Atraso</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
                <div style={filterGroupStyle}>
                    <label>Vencimento De:</label>
                    <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} style={inputStyle} />
                </div>
                <div style={filterGroupStyle}>
                    <label>Vencimento Até:</label>
                    <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} style={inputStyle} />
                </div>
                <div style={filterGroupStyle}>
                    <label>Descrição ou Cliente:</label>
                    <input
                        type="text"
                        placeholder="Buscar por descrição ou nome/CPF do cliente..."
                        value={filterSearchQuery}
                        onChange={(e) => setFilterSearchQuery(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <div style={filterButtonContainerStyle}>
                    <button onClick={handleApplyFilters} style={filterButtonStyle}>Aplicar Filtros</button>
                    <button onClick={handleClearFilters} style={clearFilterButtonStyle}>Limpar Filtros</button>
                </div>
            </div>

            {id_cliente && (
                <button
                    onClick={() => navigate(`/carnes/new/${id_cliente}`)}
                    style={addButtonStyle}
                >
                    Adicionar Novo Carnê para este Cliente
                </button>
            )}

            {!id_cliente && (
                <div style={addCarneSectionStyle}>
                    <h3>Adicionar Novo Carnê:</h3>
                    <select
                        value={clienteSelecionadoParaNovoCarne}
                        onChange={(e) => setClienteSelecionadoParaNovoCarne(e.target.value)}
                        style={selectStyle}
                    >
                        <option key="default-carne-client-option" value="">-- Selecione um Cliente --</option>
                        {clientOptions.map(client => (
                            <option key={client.id_cliente} value={client.id_cliente}>
                                {client.nome} ({client.cpf_cnpj})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleAdicionarNovoCarne}
                        style={addButtonStyle}
                        disabled={!clienteSelecionadoParaNovoCarne}
                    >
                        Adicionar Novo Carnê
                    </button>
                </div>
            )}

            {carnesList.length === 0 && (!filterStatus && !filterDateStart && !filterDateEnd && !filterSearchQuery) ? (
                <p style={noDataStyle}>Nenhum carnê cadastrado.</p>
            ) : carnesList.length === 0 ? (
                <p style={noDataStyle}>Nenhum carnê encontrado com os filtros aplicados.</p>
            ) : (
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={tableHeaderStyle}>Cliente</th>
                            <th style={tableHeaderStyle}>Descrição</th>
                            <th style={tableHeaderStyle}>Valor Total</th>
                            <th style={tableHeaderStyle}>Parcelas</th>
                            <th style={tableHeaderStyle}>Status</th>
                            <th style={tableHeaderStyle}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {carnesList.map((carne) => (
                            <tr key={carne.id_carne}>
                                <td style={tableCellStyle}>
                                    {carne.cliente ? `${carne.cliente.nome} (${carne.cliente.cpf_cnpj})` : 'N/A'}
                                </td>
                                <td style={tableCellStyle}>{carne.descricao || 'N/A'}</td>
                                <td style={tableCellStyle}>R$ {carne.valor_total_original ? carne.valor_total_original.toFixed(2) : '0.00'}</td>
                                <td style={tableCellStyle}>{carne.numero_parcelas}</td>
                                <td style={tableCellStyle}>{carne.status_carne}</td>
                                <td style={tableCellStyle}>
                                    <button
                                        onClick={() => navigate(`/carnes/details/${carne.id_carne}`)}
                                        style={actionButtonStyle}
                                    >
                                        Detalhes/Parcelas
                                    </button>
                                    <button
                                        onClick={() => navigate(`/carnes/edit/${carne.id_carne}`)}
                                        style={{...actionButtonStyle, backgroundColor: '#007bff'}}
                                    >
                                        Editar
                                    </button>
                                    {user && user.perfil === 'admin' && (
                                        <button
                                            onClick={() => handleDelete(carne.id_carne)}
                                            style={{...actionButtonStyle, backgroundColor: '#dc3545'}}
                                        >
                                            Excluir
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

const containerStyle = { maxWidth: '1000px', margin: '20px auto', padding: '20px', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const headerStyle = { textAlign: 'center', marginBottom: '20px' };
const addButtonStyle = { padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px', marginLeft: '10px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const tableHeaderStyle = { borderBottom: '1px solid #ddd', padding: '10px', textAlign: 'left', backgroundColor: '#f2f2f2' };
const tableCellStyle = { borderBottom: '1px solid #eee', padding: '10px' };
const actionButtonStyle = { padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' };
const loadingStyle = { textAlign: 'center', fontSize: '1.2em', color: '#555' };
const errorStyle = { textAlign: 'center', fontSize: '1.2em', color: 'red' };
const noDataStyle = { textAlign: 'center', fontSize: '1.1em', color: '#777' };
const addCarneSectionStyle = {
    marginBottom: '20px',
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px'
};
const selectStyle = {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    minWidth: '200px',
    fontSize: '1em'
};

const filterSectionStyle = {
    marginBottom: '20px',
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f5f5f5',
};

const filterGroupStyle = {
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
};

const inputStyle = {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    flexGrow: 1,
};

const filterButtonStyle = {
    padding: '8px 15px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '10px',
};

const clearFilterButtonStyle = {
    padding: '8px 15px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
};

const filterButtonContainerStyle = {
    marginTop: '15px',
    display: 'flex',
    justifyContent: 'flex-end',
};

export default CarnesPage;