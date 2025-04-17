import os
import jwt
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import pandas as pd
from models import Quiz, QuizQuestion, LiveQuizStatus, QuizAttempt, Student
from extensions import db
from dotenv import load_dotenv
import logging
from sqlalchemy.exc import SQLAlchemyError

load_dotenv()

admin_bp = Blueprint("admin", __name__)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables with error handling
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = os.urandom(24).hex()
    logger.warning("No SECRET_KEY found. Generated a random secret key.")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

if not ADMIN_PASSWORD:
    logger.error("No admin password set. Please set ADMIN_PASSWORD in .env")
    ADMIN_PASSWORD_HASH = generate_password_hash(os.urandom(16).hex())
else:
    ADMIN_PASSWORD_HASH = generate_password_hash(ADMIN_PASSWORD)

# File upload settings
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
ALLOWED_EXTENSIONS = {"csv", "xlsx"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def api_response(message, status="success", data=None, code=200):
    return jsonify({
        "message": message, 
        "status": status, 
        "data": data or {}
    }), code

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token or "Bearer " not in token:
            return api_response("Token is missing or invalid", "error", code=401)

        try:
            token = token.split(" ")[1]
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.user = data
        except jwt.ExpiredSignatureError:
            return api_response("Token expired", "error", code=401)
        except jwt.InvalidTokenError:
            return api_response("Invalid token", "error", code=401)

        return f(*args, **kwargs)
    return decorated

@admin_bp.route("/login", methods=["POST"])
def admin_login():
    try:
        data = request.get_json()
        if not data or "email" not in data or "password" not in data:
            return api_response("Invalid request format", "error", code=400)

        email = data["email"]
        password = data["password"]

        if email == ADMIN_EMAIL and check_password_hash(ADMIN_PASSWORD_HASH, password):
            token = jwt.encode(
                {
                    "role": "admin", 
                    "exp": datetime.utcnow() + timedelta(hours=3),
                    "iat": datetime.utcnow()
                },
                SECRET_KEY,
                algorithm="HS256"
            )
            return api_response("Login successful", data={"token": token, "role": "admin"})

        return api_response("Invalid credentials", "error", code=401)
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return api_response("Internal server error", "error", code=500)

@admin_bp.route("/upload_quiz", methods=["POST"])
@token_required
def upload_quiz():
    try:
        title = request.form.get("title", f"Quiz-{datetime.now().strftime('%Y%m%d-%H%M%S')}")

        if "file" not in request.files:
            return api_response("No file part", "error", code=400)

        file = request.files["file"]
        if file.filename == "":
            return api_response("No selected file", "error", code=400)

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(file_path)

            try:
                df = pd.read_csv(file_path) if filename.endswith(".csv") else pd.read_excel(file_path)

                required_columns = {"text", "option_a", "option_b", "option_c", "option_d", "correct_answer"}
                if not required_columns.issubset(df.columns):
                    return api_response("Invalid file format. Required columns missing.", "error", code=400)

                # Validate data types and content
                df = df.dropna(subset=required_columns)
                if df.empty:
                    return api_response("No valid questions found in the file", "error", code=400)

                quiz = Quiz(title=title)
                db.session.add(quiz)
                db.session.flush()  # Generate quiz ID without committing

                questions = [
                    QuizQuestion(
                        quiz_id=quiz.id,
                        text=row["text"],
                        option_a=row["option_a"],
                        option_b=row["option_b"],
                        option_c=row["option_c"],
                        option_d=row["option_d"],
                        correct_answer=row["correct_answer"]
                    ) for _, row in df.iterrows()
                ]
                db.session.add_all(questions)

                # Deactivate previous active quizzes
                LiveQuizStatus.query.update({LiveQuizStatus.is_active: False})
                live_quiz = LiveQuizStatus(quiz_id=quiz.id, is_active=True)
                db.session.add(live_quiz)

                db.session.commit()
                return api_response("File uploaded and questions added successfully!", data={"quiz_id": quiz.id})

            except Exception as e:
                db.session.rollback()
                logger.error(f"Quiz upload error: {str(e)}")
                return api_response(f"Error processing file: {str(e)}", "error", code=500)
        
        return api_response("Invalid file type. Only CSV/XLSX allowed.", "error", code=400)

    except Exception as e:
        logger.error(f"Unexpected upload error: {str(e)}")
        return api_response("Unexpected error occurred", "error", code=500)


# Add a new quiz question
@admin_bp.route("/add_question", methods=["POST"])
@token_required
def add_question():
    try:
        data = request.json
        required_fields = ["text", "option_a", "option_b", "option_c", "option_d", "correct_answer"]
        if not all(field in data and data[field] for field in required_fields):
            return api_response("Missing required fields", "error", code=400)

        question = QuizQuestion(
            text=data["text"],
            option_a=data["option_a"],
            option_b=data["option_b"],
            option_c=data["option_c"],
            option_d=data["option_d"],
            correct_answer=data["correct_answer"],
        )
        db.session.add(question)
        db.session.commit()

        return api_response("Question added successfully!", code=201)

    except Exception as e:
        db.session.rollback()
        return api_response("Error adding question", "error", data=str(e), code=500)

# Start a live quiz
@admin_bp.route("/start_quiz/<int:quiz_id>", methods=["POST"])
@token_required
def start_quiz(quiz_id):
    try:
        # Stop any existing live quiz
        LiveQuizStatus.query.update({LiveQuizStatus.is_active: False})
        db.session.commit()  # Ensure previous quizzes are deactivated

        # Start a new quiz session
        live_quiz = LiveQuizStatus(quiz_id=quiz_id, is_active=True)
        db.session.add(live_quiz)
        db.session.commit()

        # Debugging print
        print("Quiz started:", quiz_id, "LiveQuizStatus:", live_quiz)

        return api_response(f"Quiz {quiz_id} started!")

    except Exception as e:
        db.session.rollback()
        return api_response("Error starting quiz", "error", data=str(e), code=500)

# Stop a live quiz
@admin_bp.route("/stop_quiz", methods=["POST"])
@token_required
def stop_quiz():
    try:
        # Update the is_active status to False for all entries
        updated_rows = LiveQuizStatus.query.filter_by(is_active=True).update({LiveQuizStatus.is_active: False})
        db.session.commit()

        if updated_rows == 0:
            return api_response("No active quiz found", "error", code=404)

        return api_response("Quiz stopped successfully!")

    except Exception as e:
        db.session.rollback()
        return api_response("Error stopping quiz", "error", data=str(e), code=500)

# Get active quiz
@admin_bp.route("/active_quiz", methods=["GET"])
@token_required
def active_quiz():
    active_quiz = LiveQuizStatus.query.filter_by(is_active=True).first()

    if active_quiz:
        quiz = Quiz.query.get(active_quiz.quiz_id)
        if quiz:
            print("Active Quiz Found:", active_quiz.quiz_id)  # Debugging log
            return api_response("Active quiz found", data={
                "quiz_id": active_quiz.quiz_id,
                "status": "active",
                "title": quiz.title
            })

    print("No Active Quiz Found")  # Debugging log
    return api_response("No active quiz found", "error", code=404)

# Get quiz results
@admin_bp.route("/quiz_results/<int:quiz_id>", methods=["GET"])
@token_required
def quiz_results(quiz_id):
    try:
        results = db.session.query(
            Student.name,
            Student.class_name,
            Student.department,
            QuizAttempt.score
        ).join(QuizAttempt, Student.id == QuizAttempt.student_id).filter(
            QuizAttempt.quiz_id == quiz_id
        ).order_by(QuizAttempt.score.desc()).all()

        results_data = [
            {
                "name": result.name,
                "class_name": result.class_name,
                "department": result.department,
                "score": result.score
            }
            for result in results
        ]

        return api_response("Quiz results fetched successfully", data=results_data)

    except Exception as e:
        return api_response("Error fetching quiz results", "error", data=str(e), code=500)
    
@admin_bp.errorhandler(SQLAlchemyError)
def handle_database_error(error):
    logger.error(f"Database error: {str(error)}")
    return api_response("Database error occurred", "error", code=500)