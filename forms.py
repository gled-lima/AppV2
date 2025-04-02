from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, BooleanField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, Length, ValidationError
from models import User

class LoginForm(FlaskForm):
    """Formulário de login"""
    username = StringField('Usuário', validators=[DataRequired(message="Usuário é obrigatório")])
    password = PasswordField('Senha', validators=[DataRequired(message="Senha é obrigatória")])
    remember_me = BooleanField('Lembrar-me')
    submit = SubmitField('Entrar')

class RegistrationForm(FlaskForm):
    """Formulário de registro"""
    username = StringField('Usuário', validators=[
        DataRequired(message="Usuário é obrigatório"),
        Length(min=4, max=25, message="O nome de usuário deve ter entre 4 e 25 caracteres")
    ])
    email = StringField('Email', validators=[
        DataRequired(message="Email é obrigatório"),
        Email(message="Formato de email inválido")
    ])
    password = PasswordField('Senha', validators=[
        DataRequired(message="Senha é obrigatória"),
        Length(min=6, message="A senha deve ter pelo menos 6 caracteres")
    ])
    password2 = PasswordField('Confirmar Senha', validators=[
        DataRequired(message="Confirmação de senha é obrigatória"),
        EqualTo('password', message="As senhas devem ser iguais")
    ])
    submit = SubmitField('Registrar')

    def validate_username(self, username):
        """Validar se o nome de usuário já existe"""
        user = User.get_user_by_username(username.data)
        if user is not None:
            raise ValidationError('Este nome de usuário já está em uso. Por favor, escolha outro.')

    def validate_email(self, email):
        """Validar se o email já existe"""
        user = User.get_user_by_email(email.data)
        if user is not None:
            raise ValidationError('Este email já está em uso. Por favor, use outro email.')