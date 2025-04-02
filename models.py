from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
import os
import logging
from uuid import uuid4

# Configuração de logging
logging.basicConfig(level=logging.DEBUG)

# Arquivo CSV para armazenamento de usuários
USERS_CSV = "usuarios.csv"

# Classe para representar um usuário
class User:
    def __init__(self, id=None, username=None, email=None, password_hash=None):
        self.id = id if id else str(uuid4())
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.is_authenticated = False
        self.is_active = True
        self.is_anonymous = False
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_id(self):
        return self.id
    
    @staticmethod
    def load_users():
        if os.path.exists(USERS_CSV):
            try:
                df = pd.read_csv(USERS_CSV)
                return df
            except Exception as e:
                logging.error(f"Erro ao carregar usuários: {e}")
                return pd.DataFrame(columns=["id", "username", "email", "password_hash"])
        return pd.DataFrame(columns=["id", "username", "email", "password_hash"])
    
    @staticmethod
    def save_users(df):
        try:
            df.to_csv(USERS_CSV, index=False)
            return True
        except Exception as e:
            logging.error(f"Erro ao salvar usuários: {e}")
            return False
    
    @staticmethod
    def get_user_by_id(user_id):
        df = User.load_users()
        user_data = df[df['id'] == user_id]
        if len(user_data) == 0:
            return None
        
        user_row = user_data.iloc[0]
        user = User(
            id=user_row['id'],
            username=user_row['username'],
            email=user_row['email'],
            password_hash=user_row['password_hash']
        )
        user.is_authenticated = True
        return user
    
    @staticmethod
    def get_user_by_username(username):
        df = User.load_users()
        user_data = df[df['username'] == username]
        if len(user_data) == 0:
            return None
        
        user_row = user_data.iloc[0]
        user = User(
            id=user_row['id'],
            username=user_row['username'],
            email=user_row['email'],
            password_hash=user_row['password_hash']
        )
        return user
    
    @staticmethod
    def get_user_by_email(email):
        df = User.load_users()
        user_data = df[df['email'] == email]
        if len(user_data) == 0:
            return None
        
        user_row = user_data.iloc[0]
        user = User(
            id=user_row['id'],
            username=user_row['username'],
            email=user_row['email'],
            password_hash=user_row['password_hash']
        )
        return user
    
    @staticmethod
    def create_user(username, email, password):
        # Verificar se usuário já existe
        if User.get_user_by_username(username) or User.get_user_by_email(email):
            return False
        
        # Criar novo usuário
        new_user = User(username=username, email=email)
        new_user.set_password(password)
        
        # Adicionar ao DataFrame e salvar
        df = User.load_users()
        new_row = pd.DataFrame({
            'id': [new_user.id],
            'username': [new_user.username],
            'email': [new_user.email],
            'password_hash': [new_user.password_hash]
        })
        df = pd.concat([df, new_row], ignore_index=True)
        User.save_users(df)
        return new_user