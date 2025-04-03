# app.py
from flask import Flask, render_template, request, jsonify, Response
import sqlite3
import uuid
import json
import time
import requests

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # 禁用缓存

DATABASE = 'chats.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with app.app_context():
        conn = get_db_connection()
        conn.execute('''
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at REAL NOT NULL,
                last_accessed_at REAL NOT NULL,
                messages TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()

init_db()

def get_user_id():
    user_id = request.cookies.get('user_id')
    if not user_id:
        user_id = str(uuid.uuid4())
    return user_id

@app.route('/chat')
def chat():
    resp = Response(render_template('chat.html'))
    if not request.cookies.get('user_id'):
        resp.set_cookie('user_id', str(uuid.uuid4()), max_age=86400*10)
    return resp

@app.route('/api/chats', methods=['GET'])
def get_chats():
    user_id = get_user_id()
    conn = get_db_connection()
    now = time.time()
    ten_days_ago = now - 86400 * 10
    conn.execute('DELETE FROM chat_sessions WHERE user_id = ? AND last_accessed_at < ?', (user_id, ten_days_ago))
    sessions = conn.execute('''
        SELECT id, created_at, last_accessed_at, messages 
        FROM chat_sessions 
        WHERE user_id = ? 
        ORDER BY last_accessed_at DESC
    ''', (user_id,)).fetchall()
    if len(sessions) > 10:
        ids_to_delete = [s['id'] for s in sessions[10:]]
        conn.executemany('DELETE FROM chat_sessions WHERE id = ?', [(id,) for id in ids_to_delete])
        sessions = sessions[:10]
    conn.commit()
    chat_list = []
    for s in sessions:
        messages = json.loads(s['messages'])
        title = next((msg['content'][:20] + '...' for msg in messages if msg['role'] == 'user'), 'New Chat')
        chat_list.append({
            'id': s['id'],
            'title': title,
            'created_at': s['created_at'],
            'last_accessed': s['last_accessed_at']
        })
    conn.close()
    return jsonify(chat_list)

@app.route('/api/chat', methods=['POST'])
def chat_api():
    user_id = get_user_id()
    data = request.get_json()
    message = data.get('message')
    session_id = data.get('session_id')
    
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    
    conn = get_db_connection()
    try:
        if session_id:
            session = conn.execute('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?', (session_id, user_id)).fetchone()
            if not session:
                return jsonify({'error': 'Session not found'}), 404
            messages = json.loads(session['messages'])
        else:
            session_id = str(uuid.uuid4())
            messages = []
            conn.execute('''
                INSERT INTO chat_sessions (id, user_id, created_at, last_accessed_at, messages)
                VALUES (?, ?, ?, ?, ?)
            ''', (session_id, user_id, time.time(), time.time(), json.dumps(messages)))
            conn.commit()
        
        messages.append({'role': 'user', 'content': message, 'timestamp': time.time()})
        
        api_key = 'sk-80fe3eccdc134d8986a3a6f6bef83248'
        url = 'https://api.deepseek.com/v1/chat/completions'
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        payload = {
            'model': 'deepseek-chat',
            'messages': [{'role': msg['role'], 'content': msg['content']} for msg in messages],
            'stream': True,
            'temperature': 0.7
        }
        
        def generate():
            assistant_content = ''
            try:
                response = requests.post(url, headers=headers, json=payload, stream=True)
                for line in response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8').strip()
                        if decoded_line.startswith('data: '):
                            try:
                                chunk = json.loads(decoded_line[6:])
                                content = chunk['choices'][0]['delta'].get('content', '')
                                if content:
                                    assistant_content += content
                                    yield f"data: {json.dumps({'content': content})}\n\n"
                            except Exception as e:
                                print(f"Error parsing chunk: {e}")
            finally:
                messages.append({'role': 'assistant', 'content': assistant_content, 'timestamp': time.time()})
                conn.execute('''
                    UPDATE chat_sessions 
                    SET messages = ?, last_accessed_at = ?
                    WHERE id = ?
                ''', (json.dumps(messages), time.time(), session_id))
                conn.commit()
                conn.close()

        return Response(generate(), mimetype='text/event-stream')  # 修正缩进位置
    
    except Exception as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/<session_id>', methods=['GET'])
def get_chat_history(session_id):
    user_id = get_user_id()
    conn = get_db_connection()
    session = conn.execute('SELECT messages FROM chat_sessions WHERE id = ? AND user_id = ?', (session_id, user_id)).fetchone()
    conn.close()
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    return jsonify(json.loads(session['messages']))

@app.route('/api/new_chat', methods=['POST'])
def new_chat():
    user_id = get_user_id()
    session_id = str(uuid.uuid4())
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO chat_sessions (id, user_id, created_at, last_accessed_at, messages)
        VALUES (?, ?, ?, ?, ?)
    ''', (session_id, user_id, time.time(), time.time(), json.dumps([])))
    conn.commit()
    conn.close()
    return jsonify({'session_id': session_id})

if __name__ == '__main__':
    app.run(debug=True)