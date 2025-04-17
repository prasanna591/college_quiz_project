from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_session import Session
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from extensions import db
from routes import student_bp  # Importing student routes
from admin_routes import admin_bp
import os 

app = Flask(__name__)

# CORS (Allow frontend to communicate with backend)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

# Database Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///quiz.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
migrate = Migrate(app, db)

# Session Configuration
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_KEY_PREFIX'] = 'quiz_'
app.secret_key = "a8f5d3b1c4e9h7g2j6k0m5nq"
Session(app)

# JWT Configuration
app.config['JWT_SECRET_KEY'] = "kljaiuhldkfkf9459085vnjegfkth"
jwt = JWTManager(app)

@app.route("/")
def home():
    return "Welcome to the Quiz App"

# Registering Routes
app.register_blueprint(student_bp, url_prefix='/student')
app.register_blueprint(admin_bp, url_prefix='/admin')

# Create tables if not exist
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True)

