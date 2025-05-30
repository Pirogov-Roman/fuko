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

// 3D визуализация маятника
let scene, camera, renderer, controls;
let pendulumGroup, bob, string;
let is3DInitialized = false;

function init3DPendulum() {
    if (is3DInitialized) return;
    
    const container = document.getElementById('pendulum-3d');
    
    // Очистка предыдущего содержимого
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    
    // Сцена
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);
    
    // Камера
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);
    
    // Рендерер
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Контроллер для вращения сцены
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.minDistance = 3;
    controls.maxDistance = 10;
    
    // Освещение
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 2, 1);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 10;
    scene.add(directionalLight);
    
    // Пол с розой ветров
    const floorGeometry = new THREE.CircleGeometry(3, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xdddddd,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Роза ветров на полу
    const compassGeometry = new THREE.RingGeometry(2.8, 3, 64);
    const compassMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x333333,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
    });
    const compass = new THREE.Mesh(compassGeometry, compassMaterial);
    compass.rotation.x = -Math.PI / 2;
    scene.add(compass);
    
    // Метки сторон света
    const createCompassLabel = (text, position, rotation) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.font = 'Bold 24px Arial';
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 64, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.rotation.y = rotation;
        sprite.scale.set(0.5, 0.25, 1);
        scene.add(sprite);
    };
    
    createCompassLabel('N', new THREE.Vector3(0, 0.01, -2.5), 0);
    createCompassLabel('E', new THREE.Vector3(2.5, 0.01, 0), Math.PI/2);
    createCompassLabel('S', new THREE.Vector3(0, 0.01, 2.5), Math.PI);
    createCompassLabel('W', new THREE.Vector3(-2.5, 0.01, 0), -Math.PI/2);
    
    // Потолок (точка крепления)
    const ceilingGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32);
    const ceilingMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555,
        roughness: 0.7,
        metalness: 0.3
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.y = 3;
    ceiling.castShadow = true;
    scene.add(ceiling);
    
    // Группа для маятника (чтобы вращать всю конструкцию)
    pendulumGroup = new THREE.Group();
    scene.add(pendulumGroup);
    
    // Нить маятника
    const stringGeometry = new THREE.BufferGeometry();
    const stringMaterial = new THREE.LineBasicMaterial({ 
        color: 0x666666,
        linewidth: 2
    });
    
    string = new THREE.Line(stringGeometry, stringMaterial);
    pendulumGroup.add(string);
    
    // Груз маятника
    const bobGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const bobMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x3498db,
        shininess: 50,
        specular: 0x111111
    });
    bob = new THREE.Mesh(bobGeometry, bobMaterial);
    bob.castShadow = true;
    pendulumGroup.add(bob);
    
    // Ось маятника (для визуализации)
    const axisGeometry = new THREE.BufferGeometry();
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const axis = new THREE.Line(axisGeometry, axisMaterial);
    pendulumGroup.add(axis);
    
    is3DInitialized = true;
    
    // Обработчик изменения размера
    function onWindowResize() {
        const container = document.getElementById('pendulum-3d');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    window.addEventListener('resize', onWindowResize);
    
    // Анимация
    function animate3D() {
        requestAnimationFrame(animate3D);
        controls.update();
        renderer.render(scene, camera);
    }
    
    animate3D();
}

function update3DPendulum(angle, rotationAngle) {
    if (!is3DInitialized) return;
    
    // Обновляем положение маятника
    pendulumGroup.rotation.z = -rotationAngle; // Вращение плоскости качания
    
    // Позиция груза с учетом угла отклонения
    const stringLength = 2.7; // Длина нити (чуть меньше высоты потолка)
    const bobX = Math.sin(angle) * stringLength;
    const bobY = -Math.cos(angle) * stringLength;
    
    // Обновляем положение шара
    bob.position.set(bobX, bobY, 0);
    
    // Обновляем нить (линия от потолка до шара)
    const points = [
        new THREE.Vector3(0, 0, 0), // Точка крепления (центр группы)
        new THREE.Vector3(bobX, bobY, 0) // Положение шара
    ];
    string.geometry.dispose();
    string.geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Обновляем ось (для визуализации плоскости качания)
    const axisPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 3 * Math.sign(rotationAngle))
    ];
    string.geometry.dispose();
    string.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function startSimulation() {
    // Получаем параметры
    const latitude = parseFloat(document.getElementById('latitude').textContent);
    const height = parseFloat(document.getElementById('height').value);
    const dampingCoef = parseFloat(document.getElementById('damping_coef').value) * 1e-5;
    const initAngle = parseFloat(document.getElementById('init_angle').value) * Math.PI / 180;
    const stopTime = parseFloat(document.getElementById('stoptime').value);
    let realTimeRatio = parseFloat(document.getElementById('speed-slider').value);

    init3DPendulum();

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
    currentChart2 = createChart('chart2', [], '#e74c3c'); // График полной траектории

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

    update3DPendulum(angle, rotationAngle);
    
    // Позиция маятника (вид сверху)
    const bobX = pendulumLength * Math.sin(angle) * Math.cos(rotationAngle);
    const bobY = pendulumLength * Math.sin(angle) * Math.sin(rotationAngle);

    // Применяем анимацию только к синему шару
    document.querySelector('.bob').style.transform = `translate(${bobX}px, ${bobY}px)`;

    // Обновление графиков
    if (now - lastChartUpdate > 50) {
        const chartX = height * Math.sin(angle) * Math.cos(rotationAngle);
        const chartY = height * Math.sin(angle) * Math.sin(rotationAngle);
        
        // Добавляем новую точку к графику реального времени
        currentChart.data.datasets[0].data.push({
            x: chartX,
            y: chartY
        });
        
        // Ограничиваем количество точек для производительности
        if (currentChart.data.datasets[0].data.length > 500) {
            currentChart.data.datasets[0].data.shift();
        }
        
        currentChart.update('none');
        lastChartUpdate = now;
    }

    // Продолжаем анимацию
    if (simulatedTime < stopTime) {
        animationId = requestAnimationFrame(animate);
    } else {
        isSimulationRunning = false;
        document.getElementById('start-btn').style.display = 'inline-block';
        document.getElementById('stop-btn').style.display = 'none';
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