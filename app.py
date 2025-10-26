from flask import Flask, render_template, request, jsonify, redirect, url_for
import sqlite3
import os
from datetime import datetime
import random
from dotenv import load_dotenv

load_dotenv()

secret = os.getenv('SECRET_KEY')

app = Flask(__name__)
app.config['SECRET_KEY'] = secret

# Database setup
DATABASE = 'thoughts.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS thoughts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            x_position INTEGER DEFAULT 0,
            y_position INTEGER DEFAULT 0,
            color TEXT DEFAULT '#FFE4B5'
        )
    ''')
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/<board_id>')
def board(board_id):
    conn = get_db_connection()
    thoughts = conn.execute(
        'SELECT * FROM thoughts WHERE board_id = ? ORDER BY timestamp',
        (board_id,)
    ).fetchall()
    conn.close()
    
    return render_template('board.html', board_id=board_id, thoughts=thoughts)

@app.route('/add_thought', methods=['POST'])
def add_thought():
    data = request.get_json()
    board_id = data.get('board_id')
    content = data.get('content')
    
    if not board_id or not content:
        return jsonify({'error': 'Missing board_id or content'}), 400
    
    # Random subtle colors for thoughts
    colors = ['#f8f8f8', '#f0f0f0', '#e8e8e8', '#f5f5f5', '#efefef']
    color = random.choice(colors)
    
    conn = get_db_connection()
    cursor = conn.execute(
        'INSERT INTO thoughts (board_id, content, x_position, y_position, color) VALUES (?, ?, ?, ?, ?)',
        (board_id, content, 0, 0, color)  # Position no longer matters
    )
    thought_id = cursor.lastrowid
    
    # Get the newly created thought
    thought = conn.execute(
        'SELECT * FROM thoughts WHERE id = ?',
        (thought_id,)
    ).fetchone()
    conn.commit()
    conn.close()
    
    return jsonify({
        'id': thought['id'],
        'content': thought['content'],
        'color': thought['color'],
        'timestamp': thought['timestamp']
    })

@app.route('/get_thoughts/<board_id>')
def get_thoughts(board_id):
    conn = get_db_connection()
    thoughts = conn.execute(
        'SELECT * FROM thoughts WHERE board_id = ? ORDER BY timestamp',
        (board_id,)
    ).fetchall()
    conn.close()
    
    thoughts_list = []
    for thought in thoughts:
        thoughts_list.append({
            'id': thought['id'],
            'content': thought['content'],
            'color': thought['color'],
            'timestamp': thought['timestamp']
        })
    
    return jsonify(thoughts_list)

if __name__ == '__main__':
    app.run(debug=True)
