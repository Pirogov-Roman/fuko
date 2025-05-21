from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import math
import matplotlib.pyplot as plt
from io import BytesIO
import base64

@csrf_exempt
def simulate(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Валидация данных
            latitude = float(data.get('latitude', 0))
            height = float(data.get('height', 20))
            damping_coef = float(data.get('damping_coef', 1)) * 1e-5
            init_angle = float(data.get('init_angle', 30)) * math.pi / 180

            # Физические расчеты
            G = 9.81
            EARTH_ROT = 7.2921159e-5
            rotation_rate = EARTH_ROT * math.sin(math.radians(latitude))
            period = 2 * math.pi * math.sqrt(height / G)
            oscill_rate = (2 * math.pi) / period
            rotation_period_hours = (2 * math.pi) / (abs(rotation_rate) * 3600) / 3600
            rotation_period = (2 * math.pi) / (abs(rotation_rate) * 3600)

            # Генерация точек траектории
            total_points = 2000
            simulation_duration = rotation_period * 3600
            time_step = simulation_duration / total_points

            pendulum_points = []
            chart_points = []
            pendulum_length = 200
            scale_factor = 10

            for i in range(total_points):
                t = i * time_step
                angle = init_angle * math.exp(-damping_coef * t) * math.cos(
                    math.sqrt(oscill_rate**2 - damping_coef**2) * t)
                rotation_angle = rotation_rate * t

                bob_x = pendulum_length * math.sin(angle) * math.cos(rotation_angle)
                bob_y = pendulum_length * math.sin(angle) * math.sin(rotation_angle)
                chart_x = scale_factor * math.sin(angle) * math.cos(rotation_angle)
                chart_y = scale_factor * math.sin(angle) * math.sin(rotation_angle)

                pendulum_points.append({
                    'bob_x': bob_x,
                    'bob_y': bob_y,
                    'angle': angle * 180/math.pi
                })
                chart_points.append({'x': chart_x, 'y': chart_y})

            # Генерация графика
            plt.figure(figsize=(8, 6))
            plt.plot(
                [p['x'] for p in chart_points],
                [p['y'] for p in chart_points],
                color='#3498db',
                linewidth=1
            )
            plt.xlim(-5, 5)
            plt.ylim(-5, 5)
            plt.grid(color='#e0e0e0')

            img = BytesIO()
            plt.savefig(img, format='png', bbox_inches='tight', dpi=100)
            plt.close()
            img.seek(0)
            chart_url = base64.b64encode(img.getvalue()).decode('utf8')

            return JsonResponse({
                'success': True,
                'period': round(period, 2),
                'rotation_period': round(rotation_period, 2),
                'chart_url': f'data:image/png;base64,{chart_url}',
                'pendulum_points': pendulum_points,
                'chart_points': chart_points
            })

        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'error': 'Method not allowed'}, status=405)