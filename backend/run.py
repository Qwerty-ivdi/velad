from app import create_app
from flask_cors import CORS


app, socketio = create_app()

CORS(app, origins=['http://localhost:3000'],
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'])


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)