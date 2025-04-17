from extensions import db
from datetime import datetime
from sqlalchemy.orm import validates

# Student Model
class Student(db.Model):
    __tablename__ = 'student'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    register_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    class_name = db.Column(db.String(100), nullable=False)
    section = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=False)

    @validates('name', 'register_number', 'class_name', 'section', 'department')
    def validate_non_empty(self, key, value):
        if not value or value.strip() == "":
            raise ValueError(f"{key} cannot be empty")
        return value.strip()

    def __repr__(self):
        return f"<Student {self.name} ({self.register_number})>"

# Quiz Model
class Quiz(db.Model):
    __tablename__ = 'quiz'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(500), nullable=False)
    questions = db.relationship('QuizQuestion', backref='quiz', lazy=True)

    @validates('title')
    def validate_title(self, key, title):
        if not title or title.strip() == "":
            raise ValueError("Quiz title cannot be empty")
        return title.strip()

    def __repr__(self):
        return f"<Quiz {self.title}>"

# Quiz Question Model
class QuizQuestion(db.Model):
    __tablename__ = 'quiz_question'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id', ondelete="CASCADE"), nullable=False, index=True)
    text = db.Column(db.String(500), nullable=False)
    option_a = db.Column(db.String(255), nullable=False)
    option_b = db.Column(db.String(255), nullable=False)
    option_c = db.Column(db.String(255), nullable=False)
    option_d = db.Column(db.String(255), nullable=False)
    correct_answer = db.Column(db.Integer, nullable=False)  # Store the index of the correct option

    @validates('text')
    def validate_text(self, key, text):
        if not text or text.strip() == "":
            raise ValueError("Question text cannot be empty")
        return text.strip()

    @validates('option_a', 'option_b', 'option_c', 'option_d')
    def validate_options(self, key, option):
        if not option or option.strip() == "":
            raise ValueError(f"{key} cannot be empty")
        return option.strip()

    @validates('correct_answer')
    def validate_correct_answer(self, key, correct_answer):
        if correct_answer not in [0, 1, 2, 3]:
            raise ValueError("Correct answer must be an index between 0 and 3")
        return correct_answer

    def __repr__(self):
        return f"<QuizQuestion {self.text[:50]}...>"

# Quiz Attempt Model
class QuizAttempt(db.Model):
    __tablename__ = 'quiz_attempt'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('student.id', ondelete="CASCADE"), nullable=False, index=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id', ondelete="CASCADE"), nullable=False, index=True)
    score = db.Column(db.Integer, nullable=False)
    time_taken = db.Column(db.Integer, nullable=True)  # Optional
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('student_id', 'quiz_id', name='unique_quiz_attempt'),
    )

    @validates('score')
    def validate_score(self, key, score):
        if score < 0:
            raise ValueError("Score cannot be negative")
        return score

    @validates('time_taken')
    def validate_time_taken(self, key, time_taken):
        if time_taken is not None and time_taken < 0:
            raise ValueError("Time taken cannot be negative")
        return time_taken

    @validates('student_id','quiz_id')
    def validate_ids(self, key, id):
        if id < 1:
            raise ValueError(f'{key} must be greater than 0')
        return id

    def __repr__(self):
        return f"<QuizAttempt Student {self.student_id} Quiz {self.quiz_id} Score {self.score}>"

# Live Quiz Status Model
class LiveQuizStatus(db.Model):
    __tablename__ = 'live_quiz_status'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quiz.id', ondelete="CASCADE"), nullable=False, index=True)
    is_active = db.Column(db.Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<LiveQuizStatus Quiz {self.quiz_id} Active {self.is_active}>"