const slider = document.getElementById('speed-slider');
        const display = document.getElementById('speed-display');
        // Обновляем значение при перемещении ползунка
        slider.addEventListener('input', function() {
            display.textContent = this.value;
        });
        
        // Инициализируем начальное значение
        display.textContent = slider.value;
        
        // Инициализация карты
        const map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        // Обработчик клика по карте
        map.on('click', function(e) {
            document.getElementById('latitude').textContent = e.latlng.lat.toFixed(2);
            document.getElementById('longitude').textContent = e.latlng.lng.toFixed(2);
        });

        // Глобальные переменные
        let animationId = null;
        let currentChart = null;
        let currentChart2 = null;
        let isSimulationRunning = false;

        // Обработчик кнопки запуска
        document.getElementById('start-btn').addEventListener('click', function() {           
            startSimulation();
        });

        // Обработчик кнопки остановки
        document.getElementById('stop-btn').addEventListener('click', function() {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            isSimulationRunning = false;
            document.getElementById('start-btn').style.display = 'inline-block';
            document.getElementById('stop-btn').style.display = 'none';
        });
        
        function startSimulation() {
        // Получаем параметры
        const latitude = parseFloat(document.getElementById('latitude').textContent);
        const height = parseFloat(document.getElementById('height').value);
        const dampingCoef = parseFloat(document.getElementById('damping_coef').value) * 1e-5;
        const initAngle = parseFloat(document.getElementById('init_angle').value) * Math.PI / 180;
        const stopTime = parseFloat(document.getElementById('stoptime').value);
        let realTimeRatio = parseFloat(document.getElementById('speed-slider').value);

        // Очистка предыдущей анимации
        if (animationId) cancelAnimationFrame(animationId);
        if (currentChart) currentChart.destroy();
        if (currentChart2) currentChart2.destroy();

        // Удаляем старый таймер, если он есть
        const oldTimer = document.querySelector('.simulation-timer');
        if (oldTimer) oldTimer.remove();
        document.getElementById('start-btn').style.display = 'none';
        document.getElementById('stop-btn').style.display = 'inline-block';
        isSimulationRunning = true;

        // Физические константы
        const g = 9.81;
        const earthRot = 7.2921159e-5;
        const rotationRate = earthRot * Math.sin(latitude * Math.PI / 180);
        const period = 2 * Math.PI * Math.sqrt(height / g);
        const oscillRate = (2 * Math.PI)/period;
        const rotationPeriod = rotationRate ? (2 * Math.PI) / (Math.abs(rotationRate) * 3600) : Infinity;
        const simulationDuration = rotationPeriod*3600;

        // Обновляем информацию о периоде
        document.getElementById('period-value').textContent = period.toFixed(2);
        document.getElementById('rotation-value').textContent = rotationPeriod.toFixed(2);

        // Параметры анимации
        const pendulumLength = 200;
        
        // Генерация точек для полной траектории (один раз)
        const fullTrajectoryPoints = [];
        const totalPoints = 1000;
        const timeStep = simulationDuration / totalPoints;
        
        // В функции startSimulation() обновляем генерацию точек:
        for (let i = 0; i < totalPoints; i++) {
            const t = i * timeStep;
            const angle = initAngle * Math.exp(-dampingCoef * t) * Math.cos(Math.sqrt(oscillRate**2 - dampingCoef**2) * t);
            const rotationAngle = rotationRate * t;
            const x = height * Math.sin(angle) * Math.cos(rotationAngle);
            const y = height * Math.sin(angle) * Math.sin(rotationAngle);
            fullTrajectoryPoints.push({x, y, t});
        }

        // Рассчитываем диапазон для графиков
        const maxX = Math.max(...fullTrajectoryPoints.map(p => Math.abs(p.x)));
        const maxY = Math.max(...fullTrajectoryPoints.map(p => Math.abs(p.y)));
        const chartRange = Math.max(maxX, maxY) * 1.2;

        // Общие настройки для обоих графиков
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            animation: { duration: 0 },
            scales: {
                x: {
                    min: -chartRange,
                    max: chartRange,
                    title: { display: true, text: 'X координата (м)' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' }
                },
                y: {
                    min: -chartRange,
                    max: chartRange,
                    title: { display: true, text: 'Y координата (м)' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `X=${context.parsed.x.toFixed(2)} м, Y=${context.parsed.y.toFixed(2)} м`;
                        }
                    }
                },
                zoom: {
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
                    pan: { enabled: true, mode: 'xy' },
                    limits: { 
                        x: { min: -chartRange*2, max: chartRange*2 },
                        y: { min: -chartRange*2, max: chartRange*2 } 
                    }
                }
            }
        };

        // Создаем элемент для таймера
        const realTimeChartWrapper = document.querySelector('.chart-wrapper:first-child');
        const timerElement = document.createElement('div');
        timerElement.className = 'simulation-timer';
        timerElement.innerHTML = `
            <div class="timer-container">
                <div class="timer-icon">⏱</div>
                <div class="timer-values">
                    <div class="timer-row">
                        <span class="timer-label">Прошло:</span>
                        <span class="timer-value">0.0</span>
                        <span class="timer-unit">сек</span>
                    </div>
                    <div class="timer-row">
                        <span class="timer-label">Ускорение:</span>
                        <span class="speed-value">${realTimeRatio}</span>
                        <span class="timer-unit">x</span>
                    </div>
                </div>
            </div>
        `;
        const canvasElement = realTimeChartWrapper.querySelector('canvas');
        canvasElement.insertAdjacentElement('afterend', timerElement);

        // График в реальном времени (синий) - изначально пустой
        // Функция создания графиков
        function createChart(elementId, data, color, isFullTrajectory = false) {
            const ctx = document.getElementById(elementId).getContext('2d');
            return new Chart(ctx, {
                type: 'scatter',
                data: { 
                    datasets: [{
                        label: isFullTrajectory ? 'Полная траектория' : 'Траектория в реальном времени',
                        data: data,
                        borderColor: color,
                        pointRadius: 0,
                        borderWidth: isFullTrajectory ? 1 : 2, // Более толстая линия для реального времени
                        showLine: true,
                        tension: 0.1
                    }]
                },
                options: commonOptions
            });
        }

        // Создаем оба графика
        currentChart = createChart('chart', [], '#3498db', 0.5); // График реального времени (синий)
        currentChart2 = createChart('chart2', [], 'rgba(231, 76, 60, 0.5)'); // График полной траектории

        // Добавляем все точки на график полной траектории
        currentChart2.data.datasets[0].data = fullTrajectoryPoints;
        currentChart2.update();

        // Элементы DOM
        const string = document.querySelector('.string');
        const bobTop = document.querySelector('.bob');
        const bobSide = document.querySelector('.bob2');
        let startTime = Date.now();
        let lastChartUpdate = 0;
        let lastTimerUpdate = 0;
        let accumulatedTime = 0;
        let lastRealTimeRatio = realTimeRatio;

        // Функция анимации
        function animate() {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;
        
        // Проверяем изменение коэффициента ускорения
        const newRealTimeRatio = parseFloat(document.getElementById('speed-slider').value);
        if (newRealTimeRatio !== lastRealTimeRatio) {
            accumulatedTime += elapsed * lastRealTimeRatio;
            startTime = now;
            lastRealTimeRatio = newRealTimeRatio;
            document.querySelector('.speed-value').textContent = newRealTimeRatio;
        }
        
        const simulatedTime = accumulatedTime + elapsed * realTimeRatio;
        
        // Обновляем таймер
        if (now - lastTimerUpdate > 100) {
            document.querySelector('.timer-value').textContent = simulatedTime.toFixed(1);
            lastTimerUpdate = now;
        }
        
        // Расчет текущего состояния
        const angle = initAngle * Math.exp(-dampingCoef * simulatedTime) * 
                    Math.cos(Math.sqrt(oscillRate**2 - dampingCoef**2) * simulatedTime);
        const rotationAngle = rotationRate * simulatedTime;
        
        // Позиция маятника
        const bobX = pendulumLength * Math.sin(angle) * Math.cos(rotationAngle);
        const bobY = pendulumLength * Math.sin(angle) * Math.sin(rotationAngle);
        
        // Применяем анимацию
        string.style.transform = `rotate(${angle * 180/Math.PI}deg)`;
        bobTop.style.transform = `translate(${bobX}px, ${bobY}px)`;
        
        // Обновление графиков
        if (now - lastChartUpdate > 50) {
            // Для графика реального времени - добавляем только текущую точку
            const chartX = height * Math.sin(angle) * Math.cos(rotationAngle);
            const chartY = height * Math.sin(angle) * Math.sin(rotationAngle);
            
            // Добавляем новую точку к графику реального времени
            currentChart.data.datasets[0].data.push({
                x: chartX,
                y: chartY
            });
            
            // Для полной траектории - выделяем пройденную часть
            const currentPoints = fullTrajectoryPoints.filter(p => p.t <= simulatedTime);
            currentChart2.data.datasets = [
                {
                    label: 'Пройденная траектория',
                    data: currentPoints,
                    borderColor: '#e74c3c',
                    borderWidth: 1,
                    pointRadius: 0,
                    showLine: true
                },
                {
                    label: 'Предстоящая траектория',
                    data: fullTrajectoryPoints.filter(p => p.t > simulatedTime),
                    borderColor: 'rgba(231, 76, 60, 0.3)',
                    borderWidth: 1,
                    pointRadius: 0,
                    showLine: true
                }
            ];
            
            currentChart.update('none');
            currentChart2.update('none');
            lastChartUpdate = now;
        }
        
        // Продолжаем анимацию
        if (simulatedTime < stopTime) {
            animationId = requestAnimationFrame(animate);
        } else {
            // По завершении оставляем только полную траекторию
            currentChart2.data.datasets = [{
                label: 'Полная траектория',
                data: fullTrajectoryPoints,
                borderColor: '#e74c3c',
                borderWidth: 1,
                pointRadius: 0,
                showLine: true
            }];
            currentChart2.update();
            
            // Оставляем все точки на графике реального времени
            currentChart.update();
        }
    }

        animate();
    }

        // График зависимости периода от широты
        function calculateRotationPeriod(latitude) {
            const earthRot = 7.2921159e-5;
            const rotationRate = earthRot * Math.sin(latitude * Math.PI / 180);
            return rotationRate ? (2 * Math.PI) / (Math.abs(rotationRate) * 3600) : Infinity;
        }

        const latitudes = [];
        const periods = [];
        for (let lat = -90; lat <= 90; lat += 5) {
            latitudes.push(lat);
            periods.push(calculateRotationPeriod(lat));
        }

        const specialPoints = [
            { name: "Северный полюс", lat: 90, period: calculateRotationPeriod(90) },
            { name: "Южный полюс", lat: -90, period: calculateRotationPeriod(-90) },
            { name: "Мурманск", lat: 68.97, period: calculateRotationPeriod(68.97) },
            { name: "Гринвич (Лондон)", lat: 51.4779, period: calculateRotationPeriod(51.4779) },
            { name: "Исаакиевский собор (СПб)", lat: 59.9341, period: calculateRotationPeriod(59.9341) },
            { name: "Нью-Йорк", lat: 40.7128, period: calculateRotationPeriod(40.7128) },
            { name: "Пекин", lat: 39.9042, period: calculateRotationPeriod(39.9042) },
            { name: "Экватор", lat: 0, period: calculateRotationPeriod(0) },
            { name: "Париж", lat: 48.8566, period: calculateRotationPeriod(48.8566) },
            { name: "Сидней", lat: -33.8688, period: calculateRotationPeriod(-33.8688) }
        ];

        const ctx3 = document.getElementById('latitude-period-chart').getContext('2d');
        new Chart(ctx3, {
            type: 'line',
            data: {
                labels: latitudes,
                datasets: [
                    {
                        label: 'Период обращения (часы)',
                        data: periods,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Известные места',
                        data: specialPoints.map(point => {
                            const closestLatIndex = latitudes.reduce((prev, curr, idx) => 
                                Math.abs(curr - point.lat) < Math.abs(latitudes[prev] - point.lat) ? idx : prev, 0);
                            return {
                                x: latitudes[closestLatIndex],
                                y: periods[closestLatIndex]
                            };
                        }),
                        pointBackgroundColor: specialPoints.map((_, i) => 
                            i === 0 ? '#2c3e50' :
                            i === 1 ? '#2c3e50' : 
                            i === 7 ? '#27ae60' :
                            '#3498db'
                        ),
                        pointRadius: specialPoints.map((_, i) => 5),
                        pointHoverRadius: 8,
                        showLine: false,
                        pointStyle: 'circle'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Широта (градусы)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Период обращения (часы)'
                        },
                        min: 0
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Период: ${context.raw.toFixed(2)} часов`;
                                } else {
                                    const point = specialPoints[context.dataIndex];
                                    return [
                                        point.name,
                                        `Широта: ${point.lat}° (точное значение)`,
                                        `Период: ${point.period.toFixed(2)} часов`
                                    ];
                                }
                            }
                        }
                    }
                }
            }
        });