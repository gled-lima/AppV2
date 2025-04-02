document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const preferenciaForm = document.getElementById('preferenciaForm');
    const cidadeField = document.getElementById('cidadeField');
    const estadoField = document.getElementById('estadoField');
    const enderecoField = document.getElementById('enderecoField');
    const salvarBtn = document.getElementById('salvarBtn');
    const preferenciaTable = document.getElementById('preferenciaTable');
    const semPreferencias = document.getElementById('semPreferencias');
    const mapFrame = document.getElementById('mapFrame');
    const limparBtn = document.getElementById('limparBtn');
    const uploadForm = document.getElementById('uploadForm');
    const toggleLimitBtn = document.getElementById('toggleLimitBtn');
    const limitStatus = document.getElementById('limitStatus');
    
    // Elementos de pesquisa
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    
    // Modal de notificação
    const notificationModal = new bootstrap.Modal(document.getElementById('notificationModal'));
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    
    // Inicializar ouvinte para mensagens da iframe do mapa
    window.addEventListener('message', function(event) {
        console.log('Mensagem recebida do iframe:', event.data);
        
        // Verificar se a mensagem é do tipo esperado
        if (event.data && event.data.type === 'enderecoSelecionado') {
            // Preencher o formulário com os dados recebidos
            cidadeField.value = event.data.cidade;
            estadoField.value = event.data.estado;
            enderecoField.value = event.data.endereco;
            
            // Habilitar o botão de salvar
            salvarBtn.disabled = false;
            
            // Verificar se já existe uma preferência para este endereço
            buscarPreferenciaExistente(event.data.cidade, event.data.estado, event.data.endereco);
        }
    });
    
    // Função para buscar preferência existente para o endereço selecionado
    function buscarPreferenciaExistente(cidade, estado, endereco) {
        fetch('/get_preferencias')
            .then(response => response.json())
            .then(data => {
                const preferencia = data.find(item => 
                    item.cidade === cidade && 
                    item.estado === estado && 
                    item.endereco === endereco
                );
                
                const campoPreferencia = document.getElementById('prioridadeField');
                
                if (preferencia) {
                    // Preencher o campo de prioridade com o valor existente
                    campoPreferencia.value = preferencia.preferencia;
                } else {
                    // Limpar o campo
                    campoPreferencia.value = '';
                }
            })
            .catch(error => {
                console.error('Erro ao buscar preferências:', error);
                mostrarNotificacao('Erro', 'Não foi possível carregar as preferências salvas.');
            });
    }
    
    // Submissão do formulário de preferência
    preferenciaForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Obter valor da preferência inserida
        const preferenciaValue = document.getElementById('prioridadeField');
        
        if (!preferenciaValue.value.trim()) {
            mostrarNotificacao('Atenção', 'Insira um valor de prioridade.');
            return;
        }
        
        // Verificar se é um número
        if (isNaN(parseInt(preferenciaValue.value))) {
            mostrarNotificacao('Atenção', 'A prioridade deve ser um número válido.');
            return;
        }
        
        const dados = {
            cidade: cidadeField.value,
            estado: estadoField.value,
            endereco: enderecoField.value,
            preferencia: preferenciaValue.value
        };
        
        // Enviar dados para o backend
        fetch('/salvar_preferencia', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                mostrarNotificacao('Sucesso', 'Prioridade salva com sucesso!');
                carregarPreferencias(); // Atualizar a tabela
                
                // Atualizar o mapa com marcadores coloridos
                if (data.mapa_url) {
                    mapFrame.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                }
            } else {
                mostrarNotificacao('Erro', data.message || 'Erro ao salvar prioridade.');
            }
        })
        .catch(error => {
            console.error('Erro ao salvar prioridade:', error);
            mostrarNotificacao('Erro', 'Ocorreu um erro ao tentar salvar a prioridade.');
        });
    });
    
    // Carregar preferências salvas
    function carregarPreferencias() {
        fetch('/get_preferencias')
            .then(response => response.json())
            .then(data => {
                // Limpar tabela
                const tbody = preferenciaTable.querySelector('tbody');
                tbody.innerHTML = '';
                
                if (data.length > 0) {
                    // Esconder mensagem de nenhuma preferência
                    semPreferencias.style.display = 'none';
                    preferenciaTable.style.display = 'table';
                    
                    // Preencher tabela com os dados
                    data.forEach(item => {
                        const tr = document.createElement('tr');
                        
                        // Criar células
                        const tdCidade = document.createElement('td');
                        tdCidade.textContent = `${item.cidade}, ${item.estado}`;
                        
                        const tdEndereco = document.createElement('td');
                        tdEndereco.textContent = item.endereco;
                        
                        const tdPreferencia = document.createElement('td');
                        tdPreferencia.innerHTML = criarEstrelas(item.preferencia);
                        
                        // Adicionar células à linha
                        tr.appendChild(tdCidade);
                        tr.appendChild(tdEndereco);
                        tr.appendChild(tdPreferencia);
                        
                        // Adicionar linha ao tbody
                        tbody.appendChild(tr);
                    });
                } else {
                    // Mostrar mensagem de nenhuma preferência
                    semPreferencias.style.display = 'block';
                    preferenciaTable.style.display = 'none';
                }
            })
            .catch(error => {
                console.error('Erro ao carregar prioridades:', error);
                mostrarNotificacao('Erro', 'Não foi possível carregar as prioridades salvas.');
            });
    }
    
    // Função para criar representação textual da prioridade
    function criarEstrelas(valor) {
        valor = parseInt(valor);
        let classeCor = 'text-primary';
        let texto = `Prioridade ${valor}`;
        
        if (isNaN(valor)) {
            classeCor = 'text-muted';
            texto = 'Não definida';
        } else if (valor === 1) {
            classeCor = 'text-danger fw-bold';
            texto = 'Prioridade 1';
        } else if (valor >= 2 && valor <= 3) {
            classeCor = 'text-warning';
            texto = `Prioridade ${valor}`;
        } else if (valor >= 4 && valor <= 5) {
            classeCor = 'text-info';
            texto = `Prioridade ${valor}`;
        }
        
        return `<span class="${classeCor}">${texto}</span>`;
    }
    
    // Função para mostrar notificação
    function mostrarNotificacao(titulo, mensagem) {
        modalTitle.textContent = titulo;
        modalMessage.textContent = mensagem;
        notificationModal.show();
    }
    
    // Função para pesquisar endereços
    function pesquisarEnderecos(termo) {
        fetch('/pesquisar_enderecos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ termo_pesquisa: termo })
        })
        .then(response => response.json())
        .then(data => {
            // Atualizar o iframe do mapa com o novo mapa gerado
            mapFrame.src = data.mapa_url + '?' + new Date().getTime(); // Adicionar timestamp para evitar cache
            
            // Mostrar quantidade de resultados ou mensagem se não encontrar
            if (data.total_resultados === 0) {
                mostrarNotificacao('Pesquisa', 'Nenhum endereço encontrado com o termo: ' + termo);
            } else {
                const mensagem = data.total_resultados === 1 ? 
                    '1 endereço encontrado' : 
                    `${data.total_resultados} endereços encontrados`;
                
                searchInput.placeholder = mensagem;
                
                // Resetar placeholder após 3 segundos
                setTimeout(() => {
                    searchInput.placeholder = 'Pesquisar endereço...';
                }, 3000);
            }
        })
        .catch(error => {
            console.error('Erro ao pesquisar endereços:', error);
            mostrarNotificacao('Erro', 'Ocorreu um erro ao pesquisar endereços.');
        });
    }
    
    // Event listener para o botão de pesquisa
    searchButton.addEventListener('click', function() {
        const termoPesquisa = searchInput.value.trim();
        if (termoPesquisa) {
            pesquisarEnderecos(termoPesquisa);
        } else {
            // Se o campo estiver vazio, recarregar todos os endereços
            pesquisarEnderecos('');
        }
    });
    
    // Event listener para pesquisar ao pressionar Enter no campo de pesquisa
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchButton.click();
        }
    });
    
    // Event listener para o botão de limpar lista
    limparBtn.addEventListener('click', function() {
        // Confirmar com o usuário antes de limpar
        if (confirm('Tem certeza que deseja limpar toda a lista de prioridades? Esta ação não pode ser desfeita.')) {
            fetch('/limpar_preferencias', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    mostrarNotificacao('Sucesso', data.message || 'Lista de prioridades limpa com sucesso!');
                    carregarPreferencias(); // Atualizar a tabela
                    
                    // Atualizar o mapa com marcadores atualizados
                    if (data.mapa_url) {
                        mapFrame.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                    }
                    
                    // Limpar o formulário de preferência
                    preferenciaForm.reset();
                    salvarBtn.disabled = true;
                } else {
                    mostrarNotificacao('Erro', data.message || 'Erro ao limpar lista de prioridades.');
                }
            })
            .catch(error => {
                console.error('Erro ao limpar prioridades:', error);
                mostrarNotificacao('Erro', 'Ocorreu um erro ao tentar limpar a lista de prioridades.');
            });
        }
    });
    
    // Handler para upload de arquivo CSV
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const fileInput = document.getElementById('csvFile');
        const file = fileInput.files[0];
        
        if (!file) {
            mostrarNotificacao('Atenção', 'Selecione um arquivo CSV para upload.');
            return;
        }
        
        // Verificar extensão do arquivo
        const fileExt = file.name.split('.').pop().toLowerCase();
        if (fileExt !== 'csv') {
            mostrarNotificacao('Erro', 'O arquivo deve ser do tipo CSV.');
            return;
        }
        
        // Criar objeto FormData para enviar o arquivo
        const formData = new FormData();
        formData.append('file', file);
        
        // Mostrar indicador de carregamento
        const uploadBtn = uploadForm.querySelector('button[type="submit"]');
        const btnOriginalText = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Carregando...';
        uploadBtn.disabled = true;
        
        // Enviar arquivo para o servidor
        fetch('/upload_enderecos', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            // Restaurar o botão
            uploadBtn.innerHTML = btnOriginalText;
            uploadBtn.disabled = false;
            
            if (data.status === 'success') {
                mostrarNotificacao('Sucesso', data.message);
                
                // Atualizar o mapa com os novos endereços
                if (data.mapa_url) {
                    mapFrame.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                }
                
                // Limpar o campo de arquivo
                fileInput.value = '';
            } else {
                mostrarNotificacao('Erro', data.message || 'Erro ao processar o arquivo CSV.');
            }
        })
        .catch(error => {
            // Restaurar o botão
            uploadBtn.innerHTML = btnOriginalText;
            uploadBtn.disabled = false;
            
            console.error('Erro ao enviar arquivo:', error);
            mostrarNotificacao('Erro', 'Ocorreu um erro ao enviar o arquivo. Verifique o formato e tente novamente.');
        });
    });
    
    // Verificar estado atual da limitação
    fetch('/alternar_limitacao', {
        method: 'GET' // Usar GET para apenas consultar o estado atual
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Atualizar o texto do botão com base no estado atual
        if (data && 'limitacao_ativa' in data) {
            atualizarBotaoLimitacao(data.limitacao_ativa);
        } else {
            console.error('Resposta inválida do servidor:', data);
        }
    })
    .catch(error => {
        console.error('Erro ao verificar estado da limitação:', error);
    });
    
    // Event listener para o botão de alternar limitação
    toggleLimitBtn.addEventListener('click', function() {
        // Armazenar o conteúdo original do botão (com o texto atual)
        const btnOriginalHTML = toggleLimitBtn.innerHTML;
        // Armazenar o estado visual atual para restaurar em caso de erro
        const currentClass = toggleLimitBtn.classList.contains('btn-outline-warning') ? 
            'btn-outline-warning' : 'btn-outline-primary';
        
        // Mostrar indicador de carregamento
        toggleLimitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Atualizando...';
        toggleLimitBtn.disabled = true;
        
        fetch('/alternar_limitacao', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // Sem especificar valor, vai alternar o estado atual
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Restaurar o botão
            toggleLimitBtn.disabled = false;
            
            if (data.status === 'success') {
                // Atualizar o texto do botão
                atualizarBotaoLimitacao(data.limitacao_ativa);
                
                // Mostrar notificação
                mostrarNotificacao('Modo alterado', data.message);
                
                // Atualizar o mapa
                if (data.mapa_url) {
                    mapFrame.src = data.mapa_url + '?' + new Date().getTime(); // Evitar cache
                }
            } else {
                // Restaurar texto e classe original
                toggleLimitBtn.innerHTML = btnOriginalHTML;
                toggleLimitBtn.classList.remove('btn-outline-warning', 'btn-outline-primary');
                toggleLimitBtn.classList.add(currentClass);
                
                mostrarNotificacao('Erro', data.message || 'Erro ao alternar modo de limitação.');
            }
        })
        .catch(error => {
            // Restaurar o botão para seu estado visual original
            toggleLimitBtn.disabled = false;
            toggleLimitBtn.innerHTML = btnOriginalHTML;
            toggleLimitBtn.classList.remove('btn-outline-warning', 'btn-outline-primary');
            toggleLimitBtn.classList.add(currentClass);
            
            console.error('Erro ao alternar limitação:', error);
            mostrarNotificacao('Erro', 'Ocorreu um erro ao tentar alternar o modo de limitação.');
        });
    });
    
    // Função para atualizar o texto e estilo do botão de limitação
    function atualizarBotaoLimitacao(limitacaoAtiva) {
        if (limitacaoAtiva) {
            limitStatus.textContent = 'Limitado (1000 pts)';
            toggleLimitBtn.classList.remove('btn-outline-primary');
            toggleLimitBtn.classList.add('btn-outline-warning');
        } else {
            limitStatus.textContent = 'Sem limitação';
            toggleLimitBtn.classList.remove('btn-outline-warning');
            toggleLimitBtn.classList.add('btn-outline-primary');
        }
    }
    
    // Carregar preferências ao iniciar
    carregarPreferencias();
});