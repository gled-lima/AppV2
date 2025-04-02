from flask import Flask, render_template, request, jsonify, send_file, flash, redirect, url_for
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
import pandas as pd
import folium
from folium.plugins import MarkerCluster
import os
import logging
import io
from werkzeug.utils import secure_filename

# Importar módulos de autenticação
from models import User
from forms import LoginForm, RegistrationForm
from auth import login_manager

# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key")

# Inicializar o login manager
login_manager.init_app(app)
CSV_FILE = "enderecos.csv"
ENDERECOS_FILE = "enderecos_pontos.csv"
UPLOAD_FOLDER = 'uploads'

# Criar pasta de uploads se não existir
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024  # Limite de 1MB

# Função para carregar endereços do CSV 
def carregar_enderecos_do_csv():
    # Se o arquivo de endereços existir, carregar dele
    if os.path.exists(ENDERECOS_FILE):
        # Tentar diferentes codificações e separadores
        codificacoes = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
        separadores = [';', ',', '\t']
        
        for codificacao in codificacoes:
            for separador in separadores:
                try:
                    df = pd.read_csv(ENDERECOS_FILE, encoding=codificacao, sep=separador)
                    # Validar se tem as colunas necessárias
                    colunas_necessarias = ['lat', 'lon', 'cidade', 'estado', 'endereco']
                    if all(coluna in df.columns for coluna in colunas_necessarias):
                        # Converter DataFrame para lista de dicionários
                        logging.info(f"Arquivo de endereços carregado com sucesso usando codificação {codificacao} e separador '{separador}'!")
                        logging.info(f"Total de endereços carregados: {len(df)}")
                        return df.to_dict(orient='records')
                except Exception as e:
                    logging.error(f"Erro ao carregar arquivo de endereços com codificação {codificacao} e separador '{separador}': {e}")
                    continue
        
        logging.error("Não foi possível ler o arquivo com nenhuma das combinações de codificação e separador tentadas.")
    
    # Dados de exemplo caso não exista arquivo ou ocorra erro
    return [
        {"lat": -23.55052, "lon": -46.633308, "cidade": "São Paulo", "estado": "SP", "endereco": "Av. Paulista, 1000"},
        {"lat": -22.906847, "lon": -43.172897, "cidade": "Rio de Janeiro", "estado": "RJ", "endereco": "Copacabana, 200"},
        {"lat": -19.916681, "lon": -43.934493, "cidade": "Belo Horizonte", "estado": "MG", "endereco": "Praça da Liberdade, 300"},
        {"lat": -25.4284, "lon": -49.2733, "cidade": "Curitiba", "estado": "PR", "endereco": "R. XV de Novembro, 100"},
        {"lat": -30.0277, "lon": -51.2287, "cidade": "Porto Alegre", "estado": "RS", "endereco": "Av. Borges de Medeiros, 500"},
        {"lat": -16.6799, "lon": -49.255, "cidade": "Goiânia", "estado": "GO", "endereco": "Av. Goiás, 400"},
        {"lat": -3.7327, "lon": -38.5270, "cidade": "Fortaleza", "estado": "CE", "endereco": "Av. Beira Mar, 600"},
        {"lat": -8.0476, "lon": -34.8770, "cidade": "Recife", "estado": "PE", "endereco": "Av. Boa Viagem, 700"}
    ]

# Carregar endereços no início da aplicação
enderecos = carregar_enderecos_do_csv()

# Variável global para controlar limitação de pontos
LIMITAR_PONTOS = True  # Iniciar com limitação por padrão para estabilidade
MAX_MARKERS = 1000

# Criar mapa interativo
def criar_mapa(enderecos_filtrados=None, limitar_pontos=None):
    import time
    inicio = time.time()
    logging.info("Iniciando criação do mapa...")
    
    mapa = folium.Map(location=[-15.7801, -47.9292], zoom_start=5)
    marker_cluster = MarkerCluster().add_to(mapa)
    
    # Usar endereços filtrados se fornecidos, caso contrário usar todos os endereços
    lista_enderecos = enderecos_filtrados if enderecos_filtrados else enderecos
    logging.info(f"Total de pontos para exibir no mapa: {len(lista_enderecos)}")
    
    # Verificar se deve limitar os pontos
    if limitar_pontos is None:
        # Usar configuração global
        limitar_pontos = LIMITAR_PONTOS
    
    if limitar_pontos and len(lista_enderecos) > MAX_MARKERS:
        logging.warning(f"Limitando visualização para {MAX_MARKERS} marcadores dos {len(lista_enderecos)} disponíveis")
        lista_enderecos = lista_enderecos[:MAX_MARKERS]
    else:
        logging.info(f"Exibindo todos os {len(lista_enderecos)} pontos no mapa")
    
    # Cache para armazenar preferências e evitar consultas repetidas
    preferencias_cache = {}
    
    for endereco in lista_enderecos:
        # Verificar se o endereço já tem uma preferência salva
        cidade = endereco["cidade"]
        estado = endereco["estado"]
        endereco_rua = endereco["endereco"]
        
        # Identificador único para o cache
        ender_key = f"{cidade}||{estado}||{endereco_rua}"
        
        # Verificar preferência (usando cache se disponível)
        if ender_key in preferencias_cache:
            preferencia_existe = preferencias_cache[ender_key]
        else:
            preferencia_existe = tem_preferencia(cidade, estado, endereco_rua)
            preferencias_cache[ender_key] = preferencia_existe
        
        # Definir cor do marcador baseado na existência de preferência
        cor_marcador = 'green' if preferencia_existe else 'red'
        
        # Definir classe do botão baseado na existência de preferência
        classe_botao = 'btn-success' if preferencia_existe else 'btn-danger'
        
        # Texto adicional se já tiver preferência
        texto_status = '<span class="text-success">✓ Avaliado</span>' if preferencia_existe else '<span class="text-danger">Não avaliado</span>'
        
        folium.Marker(
            location=[endereco["lat"], endereco["lon"]],
            popup=f"""
            <div>
                <strong>{cidade}, {estado}</strong><br>
                {endereco_rua}<br>
                {texto_status}<br>
                <button class='btn btn-sm {classe_botao} select-endereco' 
                data-cidade='{cidade}' 
                data-estado='{estado}' 
                data-endereco='{endereco_rua}'>
                Selecionar
                </button>
            </div>
            """,
            tooltip=f"{cidade}, {estado}",
            icon=folium.Icon(color=cor_marcador)
        ).add_to(marker_cluster)
    
    # Salvar mapa
    mapa.save("static/mapa.html")
    
    # Adicionar código JavaScript para comunicação entre iframe e página principal
    with open("static/mapa.html", "r") as file:
        conteudo = file.read()
    
    # Código JavaScript para manipular cliques nos botões
    script_comunicacao = """
    <script>
    // Função para enviar dados para a página pai quando um botão é clicado
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('select-endereco')) {
            var cidade = e.target.getAttribute('data-cidade');
            var estado = e.target.getAttribute('data-estado');
            var endereco = e.target.getAttribute('data-endereco');
            
            // Enviar mensagem para a página pai
            window.parent.postMessage({
                type: 'enderecoSelecionado',
                cidade: cidade,
                estado: estado,
                endereco: endereco
            }, '*');
        }
    });
    </script>
    """
    
    # Adicionar o script antes do fechamento do body
    conteudo = conteudo.replace("</body>", script_comunicacao + "</body>")
    
    # Salvar o arquivo modificado
    with open("static/mapa.html", "w") as file:
        file.write(conteudo)
    
    # Registrar o tempo de execução
    fim = time.time()
    tempo_execucao = fim - inicio
    logging.info(f"Mapa gerado em {tempo_execucao:.2f} segundos")
    
    return "static/mapa.html"

# Função para carregar dados do CSV
def carregar_csv():
    if os.path.exists(CSV_FILE):
        return pd.read_csv(CSV_FILE)
    # Criar um DataFrame vazio com as colunas necessárias
    return pd.DataFrame(columns=["cidade", "estado", "endereco", "preferencia"])

# Função para verificar se um endereço já tem prioridade definida
def tem_preferencia(cidade, estado, endereco):
    df = carregar_csv()
    filtro = (
        (df["cidade"] == cidade) & 
        (df["estado"] == estado) & 
        (df["endereco"] == endereco)
    )
    return filtro.any()

# Rota principal
@app.route("/")
def index():
    # Verificar se o usuário está autenticado
    if not current_user.is_authenticated:
        # Redirecionar para a página de login
        return redirect(url_for('login'))
    
    # Se o usuário estiver autenticado, mostrar o mapa
    criar_mapa()
    return render_template("index.html")

# Rota para o mapa (protegida)
@app.route("/mapa")
@login_required
def mapa():
    criar_mapa()
    return render_template("index.html")

# Rota para a visualização em tabela
@app.route("/tabela")
@login_required
def tabela():
    # Criar mapa para integração
    criar_mapa()
    
    # Obter listas de cidades e estados disponíveis para os filtros
    cidades_unicas = sorted(list(set(e["cidade"] for e in enderecos)))
    estados_unicos = sorted(list(set(e["estado"] for e in enderecos)))
    
    return render_template("tabela.html", 
                           cidades=cidades_unicas, 
                           estados=estados_unicos)

# Rota para obter endereços filtrados
@app.route("/get_enderecos", methods=["POST"])
@login_required
def get_enderecos():
    data = request.get_json()
    cidade = data.get("cidade")
    estado = data.get("estado")
    
    enderecos_filtrados = [e for e in enderecos if e["cidade"] == cidade and e["estado"] == estado]
    return jsonify(enderecos_filtrados)

# Rota para obter endereços em formato tabela com suas prioridades
@app.route("/get_enderecos_tabela", methods=["POST"])
@login_required
def get_enderecos_tabela():
    data = request.get_json()
    filtro = data.get("filtro", {})
    cidade = filtro.get("cidade")
    estado = filtro.get("estado")
    pagina = data.get("pagina", 1)
    itens_por_pagina = data.get("itens_por_pagina", 50)
    
    # Aplicar filtros se fornecidos
    enderecos_filtrados = enderecos
    if cidade:
        enderecos_filtrados = [e for e in enderecos_filtrados if e["cidade"] == cidade]
    if estado:
        enderecos_filtrados = [e for e in enderecos_filtrados if e["estado"] == estado]
    
    # Carregar prioridades salvas
    df_prioridades = carregar_csv()
    
    # Total de endereços filtrados
    total_enderecos = len(enderecos_filtrados)
    
    # Calcular paginação
    inicio = (pagina - 1) * itens_por_pagina
    fim = inicio + itens_por_pagina
    enderecos_paginados = enderecos_filtrados[inicio:fim]
    
    # Preparar resultado com informações de prioridade
    resultado = []
    for endereco in enderecos_paginados:
        cidade_end = endereco["cidade"]
        estado_end = endereco["estado"]
        endereco_rua = endereco["endereco"]
        
        # Verificar se já existe prioridade para este endereço
        filtro_prioridade = (
            (df_prioridades["cidade"] == cidade_end) & 
            (df_prioridades["estado"] == estado_end) & 
            (df_prioridades["endereco"] == endereco_rua)
        )
        
        prioridade = None
        if filtro_prioridade.any():
            prioridade = df_prioridades.loc[filtro_prioridade, "preferencia"].values[0]
        
        # Adicionar ao resultado
        resultado.append({
            "lat": endereco["lat"],
            "lon": endereco["lon"],
            "cidade": cidade_end,
            "estado": estado_end,
            "endereco": endereco_rua,
            "prioridade": prioridade
        })
    
    # Obter lista única de cidades e estados para os filtros
    cidades_unicas = sorted(list(set(e["cidade"] for e in enderecos)))
    estados_unicos = sorted(list(set(e["estado"] for e in enderecos)))
    
    return jsonify({
        "enderecos": resultado,
        "total": total_enderecos,
        "paginas": (total_enderecos + itens_por_pagina - 1) // itens_por_pagina,
        "pagina_atual": pagina,
        "cidades_disponiveis": cidades_unicas,
        "estados_disponiveis": estados_unicos
    })

# Rota para pesquisar endereços
@app.route("/pesquisar_enderecos", methods=["POST"])
@login_required
def pesquisar_enderecos():
    data = request.get_json()
    termo_pesquisa = data.get("termo_pesquisa", "").lower()
    
    if not termo_pesquisa:
        return jsonify({"enderecos": enderecos, "mapa_url": criar_mapa()})
    
    # Filtrar endereços que correspondem ao termo de pesquisa
    enderecos_filtrados = []
    for endereco in enderecos:
        # Verificar se o termo de pesquisa está presente na cidade, estado ou endereço
        if (termo_pesquisa in endereco["cidade"].lower() or 
            termo_pesquisa in endereco["estado"].lower() or 
            termo_pesquisa in endereco["endereco"].lower()):
            enderecos_filtrados.append(endereco)
    
    # Gerar novo mapa com os endereços filtrados
    mapa_url = criar_mapa(enderecos_filtrados)
    
    return jsonify({
        "enderecos": enderecos_filtrados,
        "mapa_url": mapa_url,
        "total_resultados": len(enderecos_filtrados)
    })

# Rota para salvar prioridade
@app.route("/salvar_preferencia", methods=["POST"])
@login_required
def salvar_preferencia():
    data = request.get_json()
    logging.debug(f"Dados recebidos para salvar: {data}")
    
    # Validar dados recebidos
    if not all(key in data for key in ["cidade", "estado", "endereco", "preferencia"]):
        return jsonify({"status": "error", "message": "Dados incompletos"}), 400
    
    # Verificar se a prioridade é um número válido
    try:
        preferencia = int(data["preferencia"])
    except ValueError:
        return jsonify({"status": "error", "message": "Prioridade deve ser um número"}), 400
    
    # Carregar dados existentes
    df = carregar_csv()
    
    # Verificar se o endereço já existe
    filtro = (
        (df["cidade"] == data["cidade"]) & 
        (df["estado"] == data["estado"]) & 
        (df["endereco"] == data["endereco"])
    )
    
    if filtro.any():
        # Atualizar preferência se o endereço já existe
        df.loc[filtro, "preferencia"] = data["preferencia"]
    else:
        # Adicionar novo registro
        nova_linha = pd.DataFrame([data])
        df = pd.concat([df, nova_linha], ignore_index=True)
    
    # Salvar no CSV
    df.to_csv(CSV_FILE, index=False)
    
    # Recriar o mapa para atualizar as cores dos marcadores
    mapa_url = criar_mapa()
    
    return jsonify({
        "status": "success", 
        "message": "Prioridade salva com sucesso",
        "mapa_url": mapa_url
    })

# Rota para salvar múltiplas prioridades da tabela de uma vez
@app.route("/salvar_prioridades_tabela", methods=["POST"])
@login_required
def salvar_prioridades_tabela():
    data = request.get_json()
    prioridades = data.get("prioridades", [])
    
    if not prioridades:
        return jsonify({"status": "error", "message": "Nenhuma prioridade para salvar"}), 400
    
    sucessos = 0
    erros = 0
    
    # Carregar dados existentes
    df = carregar_csv()
    
    for item in prioridades:
        # Verificar se tem todos os campos necessários
        if not all(key in item for key in ["cidade", "estado", "endereco", "prioridade"]):
            erros += 1
            continue
        
        # Verificar se a prioridade está no formato correto
        try:
            if item["prioridade"] is not None:
                prioridade = int(item["prioridade"])
            else:
                # Pular este item se a prioridade for None (não definida)
                continue
        except (ValueError, TypeError):
            erros += 1
            continue
        
        # Preparar dados para salvar
        dados = {
            "cidade": item["cidade"],
            "estado": item["estado"],
            "endereco": item["endereco"],
            "preferencia": prioridade
        }
        
        # Verificar se o endereço já existe
        filtro = (
            (df["cidade"] == dados["cidade"]) & 
            (df["estado"] == dados["estado"]) & 
            (df["endereco"] == dados["endereco"])
        )
        
        if filtro.any():
            # Atualizar preferência se o endereço já existe
            df.loc[filtro, "preferencia"] = dados["preferencia"]
        else:
            # Adicionar novo registro
            nova_linha = pd.DataFrame([dados])
            df = pd.concat([df, nova_linha], ignore_index=True)
        
        sucessos += 1
    
    # Salvar no CSV apenas se houver alterações bem-sucedidas
    if sucessos > 0:
        df.to_csv(CSV_FILE, index=False)
        
        # Recriar o mapa para atualizar as cores dos marcadores
        mapa_url = criar_mapa()
        
        return jsonify({
            "status": "success", 
            "message": f"{sucessos} prioridades salvas com sucesso" + (f", {erros} com erro" if erros > 0 else ""),
            "mapa_url": mapa_url
        })
    else:
        return jsonify({
            "status": "error", 
            "message": "Nenhuma prioridade foi salva. Verifique o formato dos dados."
        }), 400

# Rota para obter prioridades salvas
@app.route("/get_preferencias")
@login_required
def get_preferencias():
    df = carregar_csv()
    return jsonify(df.to_dict(orient='records'))

# Rota para baixar o CSV de prioridades
@app.route("/download_preferencias")
@login_required
def download_preferencias():
    if os.path.exists(CSV_FILE):
        return send_file(CSV_FILE, 
                         mimetype='text/csv',
                         download_name='prioridades_enderecos.csv',
                         as_attachment=True)
    else:
        return jsonify({"error": "Arquivo CSV não encontrado"}), 404

# Rota para limpar o CSV de prioridades
@app.route("/limpar_preferencias", methods=["POST"])
@login_required
def limpar_preferencias():
    # Cria um DataFrame vazio com as colunas necessárias
    df_empty = pd.DataFrame(columns=["cidade", "estado", "endereco", "preferencia"])
    # Salva o DataFrame vazio no CSV
    df_empty.to_csv(CSV_FILE, index=False)
    # Atualiza o mapa para refletir as mudanças
    mapa_url = criar_mapa()
    return jsonify({"status": "success", "message": "Lista de prioridades limpa com sucesso", "mapa_url": mapa_url})

# Verificar se é um arquivo CSV válido
def arquivo_csv_valido(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'csv'

# Rota para upload de arquivo CSV com endereços
@app.route('/upload_enderecos', methods=['POST'])
@login_required
def upload_enderecos():
    # Verificar se há arquivo na requisição
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "Nenhum arquivo enviado"}), 400
    
    file = request.files['file']
    
    # Verificar se o usuário selecionou um arquivo
    if file.filename == '':
        return jsonify({"status": "error", "message": "Nenhum arquivo selecionado"}), 400
    
    # Verificar se é um arquivo CSV
    if file and arquivo_csv_valido(file.filename):
        # Obter conteúdo bruto do arquivo
        file_content = file.read()
        
        # Tentar diferentes codificações e separadores
        codificacoes = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
        separadores = [';', ',', '\t']
        
        for codificacao in codificacoes:
            try:
                # Tentar decodificar com a codificação atual
                decoded_content = file_content.decode(codificacao)
                
                # Tentar diferentes separadores
                for separador in separadores:
                    try:
                        stream = io.StringIO(decoded_content, newline=None)
                        df = pd.read_csv(stream, sep=separador)
                        
                        # Verificar se o CSV tem as colunas necessárias
                        colunas_necessarias = ['lat', 'lon', 'cidade', 'estado', 'endereco']
                        colunas_faltantes = [col for col in colunas_necessarias if col not in df.columns]
                        
                        if not colunas_faltantes:
                            logging.info(f"Upload: Arquivo processado com sucesso usando codificação {codificacao} e separador '{separador}'")
                            break  # Separador funcionou
                    except Exception as e:
                        logging.error(f"Upload: Erro ao processar com separador '{separador}': {str(e)}")
                        continue
                
                # Verificar se o DataFrame foi criado
                if 'df' not in locals() or df is None:
                    continue  # Tentar próxima codificação
                
                if colunas_faltantes:
                    return jsonify({
                        "status": "error", 
                        "message": f"Arquivo CSV inválido. Colunas faltantes: {', '.join(colunas_faltantes)}"
                    }), 400
                    
                # Salvar o arquivo CSV processado
                df.to_csv(ENDERECOS_FILE, index=False)
                
                # Recarregar os endereços e atualizar o mapa
                global enderecos
                enderecos = carregar_enderecos_do_csv()
                mapa_url = criar_mapa()
                
                logging.info(f"Arquivo carregado com sucesso usando codificação {codificacao}")
                
                return jsonify({
                    "status": "success", 
                    "message": f"Arquivo '{file.filename}' carregado com sucesso. {len(df)} endereços importados.",
                    "mapa_url": mapa_url
                })
                
            except Exception as e:
                logging.error(f"Erro ao processar arquivo com codificação {codificacao}: {str(e)}")
                continue
        
        # Se chegou aqui, é porque nenhuma codificação funcionou
        return jsonify({
            "status": "error", 
            "message": "Não foi possível processar o arquivo. Tente salvar o CSV em formato UTF-8."
        }), 500
    
    return jsonify({"status": "error", "message": "Formato de arquivo não permitido. Apenas arquivos CSV são aceitos."}), 400

# Rota para alternar o modo de limitação de pontos
@app.route('/alternar_limitacao', methods=['POST', 'GET'])
@login_required
def alternar_limitacao():
    global LIMITAR_PONTOS
    
    # Para requisições GET, apenas retornar o estado atual sem alterá-lo
    if request.method == 'GET':
        return jsonify({
            "limitacao_ativa": LIMITAR_PONTOS,
            "max_markers": MAX_MARKERS
        })
    
    # Para requisições POST, alternar o estado
    data = request.get_json() if request.is_json else {}
    limitar = data.get('limitar', None)
    
    if limitar is not None:
        LIMITAR_PONTOS = limitar
    else:
        # Se não for especificado, alternar o estado atual
        LIMITAR_PONTOS = not LIMITAR_PONTOS
    
    # Atualizar o mapa com a nova configuração
    mapa_url = criar_mapa()
    
    return jsonify({
        "status": "success",
        "limitacao_ativa": LIMITAR_PONTOS,
        "message": f"Limitação de pontos {'ativada' if LIMITAR_PONTOS else 'desativada'}. {'Exibindo até ' + str(MAX_MARKERS) + ' pontos.' if LIMITAR_PONTOS else 'Exibindo todos os pontos.'}",
        "mapa_url": mapa_url
    })

# Rota para baixar modelo CSV vazio para preenchimento
@app.route('/download_modelo_csv')
@login_required
def download_modelo_csv():
    # Criar DataFrame com as colunas do modelo
    df_modelo = pd.DataFrame(columns=['lat', 'lon', 'cidade', 'estado', 'endereco'])
    
    # Adicionar uma linha de exemplo
    df_modelo = pd.concat([df_modelo, pd.DataFrame([{
        'lat': -23.55052,
        'lon': -46.633308,
        'cidade': 'São Paulo',
        'estado': 'SP',
        'endereco': 'Av. Paulista, 1000'
    }])], ignore_index=True)
    
    # Salvar em um buffer de memória
    buffer = io.StringIO()
    df_modelo.to_csv(buffer, index=False)
    buffer.seek(0)
    
    # Retornar o arquivo para download
    return send_file(
        io.BytesIO(buffer.getvalue().encode('utf-8')),
        mimetype='text/csv',
        download_name='modelo_enderecos.csv',
        as_attachment=True
    )

# =============== ROTAS DE AUTENTICAÇÃO =============== #

# Rota para página de login
@app.route('/login', methods=['GET', 'POST'])
def login():
    # Se o usuário já está autenticado, redirecionar para a página principal
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    form = LoginForm()
    if form.validate_on_submit():
        user = User.get_user_by_username(form.username.data)
        
        # Verificar se o usuário existe e a senha está correta
        if user is None or not user.check_password(form.password.data):
            flash('Nome de usuário ou senha inválidos', 'danger')
            return redirect(url_for('login'))
        
        # Realizar login do usuário
        login_user(user, remember=form.remember_me.data)
        flash('Login realizado com sucesso!', 'success')
        
        # Redirecionar para a página solicitada ou para a página principal
        next_page = request.args.get('next')
        if next_page:
            return redirect(next_page)
        return redirect(url_for('index'))
    
    return render_template('login.html', form=form)

# Rota para página de registro
@app.route('/register', methods=['GET', 'POST'])
def register():
    # Se o usuário já está autenticado, redirecionar para a página principal
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        # Criar novo usuário
        user = User.create_user(
            username=form.username.data,
            email=form.email.data,
            password=form.password.data
        )
        
        if user:
            flash('Conta criada com sucesso! Agora você pode fazer login.', 'success')
            return redirect(url_for('login'))
        else:
            flash('Erro ao criar conta. Tente novamente.', 'danger')
    
    return render_template('register.html', form=form)

# Rota para logout
@app.route('/logout')
def logout():
    logout_user()
    flash('Você saiu da sua conta com sucesso!', 'info')
    return redirect(url_for('index'))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
