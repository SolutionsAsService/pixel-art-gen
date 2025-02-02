from flask import Flask, render_template, send_file
from io import BytesIO
import generator

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/rodent')
def rodent():
    image = generator.generate_rodent_image()
    img_io = BytesIO()
    image.save(img_io, 'PNG')
    img_io.seek(0)
    return send_file(img_io, mimetype='image/png')

@app.route('/island')
def island():
    image = generator.generate_island_image()
    img_io = BytesIO()
    image.save(img_io, 'PNG')
    img_io.seek(0)
    return send_file(img_io, mimetype='image/png')

if __name__ == '__main__':
    app.run(debug=True)