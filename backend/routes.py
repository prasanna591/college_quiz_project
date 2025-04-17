from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
from extensions import db
from models import Student, Quiz, QuizQuestion, QuizAttempt, LiveQuizStatus
import jwt
from functools import wraps
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

student_bp = Blueprint('student', __name__)

# Load environment variables
load_dotenv()

# Secure secret key from environment
SECRET_KEY = os.getenv('SECRET_KEY', 'fallback_secret_key_change_in_production')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

        token = request.headers.get("Authorization")

        if not token:
            logger.warning("Token completely missing in request")
            return jsonify({"message": "Token missing!", "status": "error"}), 401

        if not token.startswith("Bearer "):
            logger.warning(f"Token format invalid: {token[:15]}...")
            return jsonify({"message": "Token format invalid!", "status": "error"}), 401

        try:
            token = token.split("Bearer ")[1].strip()
            decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            student_id = decoded.get("student_id")

            if not student_id:
                logger.warning("Invalid token: No student ID found")
                return jsonify({"message": "Invalid token content!", "status": "error"}), 401

            kwargs['student_id'] = student_id
            return f(*args, **kwargs)

        except jwt.ExpiredSignatureError:
            logger.warning("Token expired")
            return jsonify({"message": "Token expired!", "status": "error"}), 401

        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token error: {str(e)}")
            return jsonify({"message": "Invalid token!", "status": "error"}), 401

        except Exception as e:
            logger.error(f"Unexpected error processing token: {str(e)}")
            return jsonify({"message": "Authentication error", "status": "error"}), 500
    return decorated

def validate_json_payload(required_fields):
    """Decorator to validate JSON payload"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                logger.warning("Request must be JSON")
                return jsonify({"message": "Request must be JSON", "status": "error"}), 400

            data = request.get_json()
            missing_fields = [field for field in required_fields if not data.get(field)]

            if missing_fields:
                logger.warning(f"Missing fields: {missing_fields}")
                return jsonify({"message": "Missing required fields!", "status": "error", "missing_fields": missing_fields}), 400

            return f(data, *args, **kwargs)
        return decorated_function
    return decorator

@student_bp.route('/register', methods=['POST'])
@cross_origin()
@validate_json_payload(['name', 'register_number', 'class_name', 'section', 'department'])
def register_student(data):
    try:
        existing_student = Student.query.filter_by(register_number=data['register_number']).first()
        if existing_student:
            logger.warning(f"Registration attempt for existing student: {data['register_number']}")
            return jsonify({"message": "Student already registered!", "status": "error"}), 400

        new_student = Student(
            name=data['name'],
            register_number=data['register_number'],
            class_name=data['class_name'],
            section=data['section'],
            department=data['department']
        )

        db.session.add(new_student)
        db.session.commit()

        token = jwt.encode(
            {"student_id": new_student.id, "exp": datetime.utcnow() + timedelta(hours=24)},
            SECRET_KEY,
            algorithm="HS256"
        )

        logger.info(f"Student registered: {data['register_number']}")
        return jsonify({"message": "Student registered successfully!", "student_id": new_student.id, "status": "success", "token": token}), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Registration error: {str(e)}")
        return jsonify({"message": "Registration failed", "status": "error", "error": str(e)}), 500

@student_bp.route('/login', methods=['POST'])
@cross_origin()
@validate_json_payload(['register_number'])
def login_student(data):
    try:
        register_number = data['register_number']
        student = Student.query.filter_by(register_number=register_number).first()

        if not student:
            logger.warning(f"Login attempt for non-existent student: {register_number}")
            return jsonify({"message": "Student not found!", "status": "error"}), 404

        token = jwt.encode(
            {"student_id": student.id, "exp": datetime.utcnow() + timedelta(hours=24)},
            SECRET_KEY,
            algorithm="HS256"
        )

        logger.info(f"Student logged in: {register_number}")
        return jsonify({"message": "Login successful!", "token": token, "status": "success", "student_info": {"id": student.id, "name": student.name, "register_number": student.register_number}}), 200

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"message": "Login failed", "status": "error", "error": str(e)}), 500

@student_bp.route('/get_active_quiz', methods=['GET'])
@cross_origin()
@token_required
def get_active_quiz(student_id):
    try:
        active_quizzes = LiveQuizStatus.query.filter_by(is_active=True).all()
        if len(active_quizzes) > 1:
            logger.error("Multiple active quizzes found!")
            return jsonify({"message": "Multiple active quizzes detected. Please contact support.", "status": "error"}), 500

        active_quiz_status = active_quizzes[0] if active_quizzes else None

        if not active_quiz_status:
            logger.warning("No active quizzes found")
            return jsonify({"message": "No active quizzes", "status": "error"}), 404

        quiz = Quiz.query.get(active_quiz_status.quiz_id)
        if not quiz:
            logger.warning(f"Quiz not found for active quiz ID: {active_quiz_status.quiz_id}")
            return jsonify({"message": "Quiz not found", "status": "error"}), 404

        logger.info(f"Returning active quiz ID: {quiz.id}")
        return jsonify({"quiz_id": quiz.id, "title": quiz.title, "status": "success"}), 200

    except Exception as e:
        logger.error(f"Error fetching active quiz: {str(e)}")
        return jsonify({"message": "Error fetching active quiz", "status": "error", "error": str(e)}), 500

@student_bp.route('/get_questions', methods=['GET'])
@cross_origin()
@token_required
def get_questions(student_id):
    try:
        quiz_id = request.args.get('quiz_id')
        logger.info(f"Fetching questions for quiz ID: {quiz_id}, student ID: {student_id}")

        if not quiz_id:
            logger.warning("No quiz ID provided")
            return jsonify({"message": "No quiz selected!", "status": "error"}), 400

        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            logger.warning(f"Invalid quiz ID: {quiz_id}")
            return jsonify({"message": "Invalid quiz!", "status": "error"}), 404

        questions = QuizQuestion.query.filter_by(quiz_id=quiz_id).all()
        if not questions:
            logger.warning(f"No questions found for quiz: {quiz_id}")
            return jsonify({"message": "No questions found!", "status": "error"}), 404

        question_list = [{"id": q.id, "question_text": q.text, "options": [q.option_a, q.option_b, q.option_c, q.option_d]} for q in questions]

        logger.info(f"Returning {len(question_list)} questions for quiz ID: {quiz_id}")
        return jsonify({"questions": question_list, "status": "success"}), 200

    except Exception as e:
        logger.error(f"Error fetching questions: {str(e)}")
        return jsonify({"message": "Error fetching questions", "status": "error", "error": str(e)}), 500

@student_bp.route("/submit_quiz", methods=["POST"])
@cross_origin()
@token_required
def submit_quiz(student_id):
    try:
        if not request.is_json:
            logger.warning("Invalid submission: Not JSON")
            return jsonify({"message": "Invalid request format", "status": "error"}), 400

        data = request.get_json()
        quiz_id = data.get("quiz_id")
        answers = data.get("answers", {})
        time_taken = data.get("time_taken", 0)

        logger.info(f"Quiz submission from student {student_id} for quiz {quiz_id}")

        if not quiz_id:
            logger.warning("Invalid quiz submission: Missing quiz_id")
            return jsonify({"message": "Quiz ID is required", "status": "error"}), 400

        if not isinstance(answers, dict) or not answers:
            logger.warning("Invalid quiz submission: Missing or invalid answers")
            return jsonify({"message": "Answers must be provided as a dictionary", "status": "error"}), 400

        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            logger.warning(f"Invalid quiz ID for submission: {quiz_id}")
            return jsonify({"message": "Quiz not found", "status": "error"}), 404

        questions = QuizQuestion.query.filter_by(quiz_id=quiz_id).all()
        if not questions:
            logger.warning(f"No questions found for quiz: {quiz_id}")
            return jsonify({"message": "Quiz has no questions", "status": "error"}), 404

        question_ids = {str(q.id) for q in questions}
        if set(answers.keys()) != question_ids:
            missing_questions = list(question_ids - set(answers.keys()))
            extra_questions = list(set(answers.keys()) - question_ids)
            return jsonify({"message": "All questions must be answered", "status": "error", "missing_questions": missing_questions, "extra_questions": extra_questions}), 400

        score = 0
        for question in questions:
            q_id_str = str(question.id)
            submitted_answer = int(answers.get(q_id_str, -1))
            if submitted_answer == question.correct_answer:
                score += 1

        quiz_attempt = QuizAttempt(student_id=student_id, quiz_id=quiz_id, score=score, time_taken=time_taken)
        db.session.add(quiz_attempt)
        db.session.commit()

        logger.info(f"Quiz submitted by student {student_id}: Quiz ID {quiz_id}, Score {score}/{len(questions)}")
        return jsonify({"message": "Quiz submitted successfully!", "status": "success", "quiz_id": quiz_id, "score": score, "total_questions": len(questions)}), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error submitting quiz: {str(e)}")
        return jsonify({"message": "Error submitting quiz", "status": "error", "error": str(e)}), 500

@student_bp.errorhandler(404)
def not_found(error):
    return jsonify({"message": "Resource not found", "status": "error"}), 404

@student_bp.errorhandler(500)
def server_error(error):
    return jsonify({"message": "Internal server error", "status": "error"}), 500