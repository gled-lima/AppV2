from flask_login import LoginManager
from models import User

# Inicializar o gerenciador de login
login_manager = LoginManager()

# Configurar a página de login
login_manager.login_view = 'login'
login_manager.login_message = 'Por favor, faça login para acessar esta página.'

# Função para carregar usuário pelo ID
@login_manager.user_loader
def load_user(user_id):
    return User.get_user_by_id(user_id)