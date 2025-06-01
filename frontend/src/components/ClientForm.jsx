import React, { useState, useEffect } from 'react';
import { clients } from '../api';
import { useNavigate, useParams } from 'react-router-dom';

function ClientForm() {
    const [nome, setNome] = useState('');
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [endereco, setEndereco] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { id } = useParams(); // Para edição

    useEffect(() => {
        if (id) {
            setLoading(true);
            clients.getById(id)
                .then(response => {
                    const client = response.data;
                    setNome(client.nome);
                    setCpfCnpj(client.cpf_cnpj);
                    setEndereco(client.endereco || '');
                    setTelefone(client.telefone || '');
                    setEmail(client.email || '');
                })
                .catch(err => {
                    console.error('Erro ao carregar cliente para edição:', err);
                    setError('Erro ao carregar dados do cliente.');
                })
                .finally(() => setLoading(false));
        }
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const clientData = { nome, cpf_cnpj: cpfCnpj, endereco, telefone, email };

        try {
            if (id) {
                await clients.update(id, clientData);
                alert('Cliente atualizado com sucesso!');
            } else {
                await clients.create(clientData);
                alert('Cliente cadastrado com sucesso!');
            }
            navigate('/clients');
        } catch (err) {
            console.error('Erro ao salvar cliente:', err);
            setError(`Erro ao salvar cliente: ${err.response?.data?.detail || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading && id) return <p>Carregando dados do cliente...</p>;

    return (
        <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2>{id ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Nome:</label>
                    <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>CPF/CNPJ:</label>
                    <input
                        type="text"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Endereço:</label>
                    <input
                        type="text"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Telefone:</label>
                    <input
                        type="text"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    {loading ? 'Salvando...' : (id ? 'Atualizar Cliente' : 'Cadastrar Cliente')}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/clients')}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px' }}
                >
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default ClientForm;