from app import create_app
from flask_cors import CORS
import os


app, socketio = create_app()

CORS(app, origins=['http://localhost:3000'],
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'])


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port)