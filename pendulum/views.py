import traceback
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import math
from datetime import datetime
from django.views.decorators.csrf import ensure_csrf_cookie


@ensure_csrf_cookie
def index(request):
    return render(request, 'index.html')


@csrf_exempt
def simulate(request):
    if request.method == 'POST':
        try:
            # проверяем наличие тела запроса
            if not request.body:
                return JsonResponse({'success': False, 'error': 'Empty request body'}, status=400)
                
            try:
                data = json.loads(request.body.decode('utf-8'))
            except json.JSONDecodeError as e:
                return JsonResponse({'success': False, 'error': f'Invalid JSON: {str(e)}'}, status=400)
            
            # валидация с значениями по умолчанию
            try:
                latitude = float(data.get('latitude', 0))
                height = float(data.get('height', 70))
                damping_coef = float(data.get('damping_coef', 0.1))
                init_angle = float(data.get('init_angle', 15))
                stoptime = max(30, min(float(data.get('stoptime', 10000)), 100000))
            except (TypeError, ValueError) as e:
                return JsonResponse({'success': False, 'error': f'Invalid parameter value: {str(e)}'}, status=400)
            
            # основные расчеты
            g = 9.81
            earth_rot = 7.2921159e-5
            latitude = float(data.get('latitude', 0))
            rotation_rate = earth_rot * math.sin(math.radians(latitude)) if latitude != 0 else 0
            period = 2 * math.pi * math.sqrt(height / g)
            oscill_rate = (2 * math.pi)/period
            
            rotation_period = None if rotation_rate == 0 else (2 * math.pi) / (abs(rotation_rate) * 3600)
            
            # генерация точек траектории 
            full_trajectory_points = []
            if abs(latitude) < 1e-6:  # экватор
                num_points = 1000
                for i in range(num_points + 1):
                    t = i * stoptime / num_points
                    angle = math.radians(init_angle) * math.exp(-damping_coef * 1e-5 * t) * math.cos(
                        math.sqrt(oscill_rate**2 - (damping_coef * 1e-5)**2) * t)
                    x = height * math.sin(angle)
                    full_trajectory_points.append({'x': x, 'y': 0})
            else:
                # обычный расчет для других широт
                full_rotation_time = abs(2 * math.pi / rotation_rate)
                num_points = 1000
                for i in range(num_points + 1):
                    t = i * full_rotation_time / num_points
                    angle = math.radians(init_angle) * math.exp(-damping_coef * 1e-5 * t) * math.cos(
                        math.sqrt(oscill_rate**2 - (damping_coef * 1e-5)**2) * t)
                    rotation_angle = rotation_rate * t
                    x = height * math.sin(angle) * math.cos(rotation_angle)
                    y = height * math.sin(angle) * math.sin(rotation_angle)
                    full_trajectory_points.append({'x': x, 'y': y})

            return JsonResponse({
                'success': True,
                'period': period,
                'rotation_period': rotation_period,
                'rotation_rate': rotation_rate,
                'oscill_rate': oscill_rate,
                'full_trajectory_points': full_trajectory_points
            })
                
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)