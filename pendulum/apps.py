# from flask import Flask, render_template, request, jsonify
# import math
# import numpy as np
# import matplotlib
# matplotlib.use('Agg')
# import matplotlib.pyplot as plt
# from io import BytesIO
# import base64
# import folium

# app = Flask(__name__)

# # Константы
# G = 9.81
# EARTH_ROT = 7.2921159e-5

# @app.route('/')
# def index():
#     # Создаем карту
#     m = folium.Map(location=[0, 0], zoom_start=2)
#     return render_template('index.html', map=m._repr_html_())

# @app.route('/simulate', methods=['POST'])
# def simulate():
#     try:
#         # Получаем параметры
#         data = request.json
#         latitude = float(data['latitude'])
#         height = float(data['height'])
#         damping_coef = float(data['damping_coef']) * 1e-5
#         init_angle = float(data['init_angle']) * math.pi / 180

#         # Физические расчеты
#         rotation_rate = EARTH_ROT * math.sin(math.radians(latitude))
#         period = 2 * math.pi * math.sqrt(height / G)
#         oscill_rate = (2 * math.pi) / period
#         rotation_period = (2 * math.pi) / (abs(rotation_rate) * 3600)
#         simulation_duration = rotation_period * 3600

#         # Расчет точек
#         total_points = 1000
#         time_step = simulation_duration / total_points
        
#         pendulum_points = []
#         chart_points = []
#         pendulum_length = 200
#         scale_factor = 10

#         for i in range(total_points):
#             t = i * time_step
            
#             # Физические расчеты
#             angle = init_angle * math.exp(-damping_coef * t) * math.cos(
#                 math.sqrt(oscill_rate**2 - damping_coef**2) * t)
#             rotation_angle = rotation_rate * t
            
#             # Точки для маятника
#             bob_x = pendulum_length * math.sin(angle) * math.cos(rotation_angle)
#             bob_y = pendulum_length * math.sin(angle) * math.sin(rotation_angle)
#             pendulum_points.append({
#                 'angle': angle,
#                 'bob_x': bob_x,
#                 'bob_y': bob_y,
#                 't': t
#             })
            
#             # Точки для графика
#             x = scale_factor * math.sin(angle) * math.cos(rotation_angle)
#             y = scale_factor * math.sin(angle) * math.sin(rotation_angle)
#             chart_points.append({'x': x, 'y': y})

#         # Создаем график
#         x_vals = [p['x'] for p in chart_points]
#         y_vals = [p['y'] for p in chart_points]
        
#         plt.figure(figsize=(8, 6))
#         plt.plot(x_vals, y_vals, color='#3498db', linewidth=1)
#         plt.xlim(-5, 5)
#         plt.ylim(-5, 5)
#         plt.grid(color='rgba(0,0,0,0.1)')
        
#         # Сохраняем график в base64
#         img = BytesIO()
#         plt.savefig(img, format='png', bbox_inches='tight')
#         plt.close()
#         img.seek(0)
#         chart_url = base64.b64encode(img.getvalue()).decode('utf8')

#         return jsonify({
#             'success': True,
#             'period': round(period, 2),
#             'rotation_period': round(rotation_period, 2),
#             'chart_url': chart_url,
#             'pendulum_points': pendulum_points
#         })

#     except Exception as e:
#         return jsonify({'success': False, 'error': str(e)})

# from flask import Flask, render_template


# if __name__ == '__main__':
#     app.run(debug=True)