from flask import Flask

app = Flask(__name__)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def file(path):
    return app.send_static_file(path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)