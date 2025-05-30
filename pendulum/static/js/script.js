// Управление слайдером скорости
const slider = document.getElementById('speed-slider');
const display = document.getElementById('speed-display');
slider.addEventListener('input', function() {
    display.textContent = this.value + 'x';
});
display.textContent = slider.value + 'x';

// Инициализация карты
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Обработчик клика по карте
map.on('click', function(e) {
    document.getElementById('latitude').textContent = e.latlng.lat.toFixed(2);
    document.getElementById('longitude').textContent = e.latlng.lng.toFixed(2);
});

let animationId = null;
let currentChart = null;
let currentChart2 = null;
let isSimulationRunning = false;
let simulationData = null;

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
    scene.background = new THREE.Color(0xe0e0e0);
    
    // Камера
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 7);
    camera.lookAt(0, 1.5, 0);
    
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
    
    // Точка крепления маятника 
    const attachmentGeometry = new THREE.SphereGeometry(0.15, 32, 32);
    const attachmentMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.5,
        metalness: 0.5
    });
    const attachment = new THREE.Mesh(attachmentGeometry, attachmentMaterial);
    attachment.position.y = 3.2;
    attachment.castShadow = true;
    scene.add(attachment);
    
    // Пол с текстурой
    const floorGeometry = new THREE.CircleGeometry(5, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xeeeeee,
        side: THREE.DoubleSide,
        roughness: 0.7,
        metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    // Текстура для пола с радиальными линиями
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    context.fillStyle = '#eeeeee';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Рисуем радиальные линии
    context.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    context.lineWidth = 2;
    const center = canvas.width / 2;
    const radius = canvas.width / 2;

    for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI / 12);
        context.beginPath();
        context.moveTo(center, center);
        context.lineTo(
            center + Math.cos(angle) * radius,
            center + Math.sin(angle) * radius
        );
        context.stroke();
    }

    // Концентрические круги
    for (let r = 0.2; r < 1; r += 0.2) {
        context.beginPath();
        context.arc(center, center, r * radius, 0, 2 * Math.PI);
        context.stroke();
    }

    const floorTexture = new THREE.CanvasTexture(canvas);
    const patternedFloorMaterial = new THREE.MeshStandardMaterial({
        map: floorTexture,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0.1
    });
    const patternedFloor = new THREE.Mesh(floorGeometry, patternedFloorMaterial);
    patternedFloor.rotation.x = -Math.PI / 2;
    patternedFloor.position.y = 0;
    patternedFloor.receiveShadow = true;
    scene.add(patternedFloor);

    const createCompassLabel = (text, position, rotation, isCardinal = false) => {
        const canvas = document.createElement('canvas');
        canvas.width = isCardinal ? 256 : 128;
        canvas.height = isCardinal ? 256 : 128;
        const context = canvas.getContext('2d');
        
        if (isCardinal) {
            context.fillStyle = 'rgba(50, 50, 150, 0.7)';
            context.beginPath();
            context.arc(128, 128, 100, 0, 2 * Math.PI);
            context.fill();
        }
        
        context.font = isCardinal ? 'Bold 120px Arial' : 'Bold 60px Arial';
        context.fillStyle = isCardinal ? '#ffffff' : 'rgba(50, 50, 150, 0.8)';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(position.x, 0.1, position.z);
        sprite.rotation.y = rotation;
        sprite.scale.set(isCardinal ? 0.8 : 0.4, isCardinal ? 0.8 : 0.4, 1);
        scene.add(sprite);
    };

    createCompassLabel('N', new THREE.Vector3(0, 0, -4.5), 0, true);
    createCompassLabel('S', new THREE.Vector3(0, 0, 4.5), Math.PI, true);
    createCompassLabel('E', new THREE.Vector3(4.5, 0, 0), Math.PI/2, true);
    createCompassLabel('W', new THREE.Vector3(-4.5, 0, 0), -Math.PI/2, true);

    createCompassLabel('NE', new THREE.Vector3(3.2, 0, -3.2), Math.PI/4);
    createCompassLabel('SE', new THREE.Vector3(3.2, 0, 3.2), 3*Math.PI/4);
    createCompassLabel('SW', new THREE.Vector3(-3.2, 0, 3.2), -3*Math.PI/4);
    createCompassLabel('NW', new THREE.Vector3(-3.2, 0, -3.2), -Math.PI/4);

    // Группа для маятника
    pendulumGroup = new THREE.Group();
    pendulumGroup.position.y = 3.2;
    scene.add(pendulumGroup);
    
    const stringGeometry = new THREE.BufferGeometry();
    const stringMaterial = new THREE.LineBasicMaterial({ 
        color: 0x555555,
        linewidth: 2
    });
    string = new THREE.Line(stringGeometry, stringMaterial);
    pendulumGroup.add(string);
    
    const bobGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const bobMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x3498db,
        shininess: 50,
        specular: 0x111111
    });
    bob = new THREE.Mesh(bobGeometry, bobMaterial);
    bob.castShadow = true;
    pendulumGroup.add(bob);
    
    is3DInitialized = true;
    
    // Обработчик изменения размера
    function onWindowResize() {
        const container = document.getElementById('pendulum-3d');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
    
    window.addEventListener('resize', onWindowResize);
    
    function animate3D() {
        requestAnimationFrame(animate3D);
        controls.update();
        renderer.render(scene, camera);
    }
    
    animate3D();
}

function update3DPendulum(angle, rotationAngle) {
    if (!is3DInitialized) return;
    
    pendulumGroup.rotation.y = rotationAngle;
    const stringLength = 3;
    const bobX = Math.sin(angle) * stringLength;
    const bobY = -Math.cos(angle) * stringLength;
    bob.position.set(bobX, bobY, 0);
    const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(bobX, bobY, 0)
    ];
    string.geometry.dispose();
    string.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

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

// Функция для получения CSRF токена
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

async function startSimulation() {
    // Получаем параметры
    const latitude = parseFloat(document.getElementById('latitude').textContent);
    const height = parseFloat(document.getElementById('height').value);
    const dampingCoef = parseFloat(document.getElementById('damping_coef').value);
    const initAngle = parseFloat(document.getElementById('init_angle').value);
    const stopTime = parseFloat(document.getElementById('stoptime').value);
    const realTimeRatio = parseFloat(document.getElementById('speed-slider').value);

    init3DPendulum();

    // Очистка предыдущей анимации
    if (animationId) cancelAnimationFrame(animationId);
    if (currentChart) currentChart.destroy();
    if (currentChart2) currentChart2.destroy();

    // Удаляем старый таймер
    const oldTimer = document.querySelector('.simulation-timer');
    if (oldTimer) oldTimer.remove();
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'inline-block';
    isSimulationRunning = true;

    try {
        const response = await fetch('/simulate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                latitude: latitude,
                height: height,
                damping_coef: dampingCoef,
                init_angle: initAngle,
                stoptime: stopTime
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            let errorMsg = data.error || 'Unknown server error';
            if (data.traceback) {
                console.error('Server traceback:', data.traceback);
                errorMsg += ' (see console for details)';
            }
            throw new Error(errorMsg);
        }
        
        if (!data.success) {
            throw new Error(data.error || 'Simulation failed');
        }

        // Сохраняем данные симуляции
        simulationData = {
            ...data,
            initAngle: initAngle * Math.PI / 180,
            dampingCoef: dampingCoef * 1e-5,
            height: height
        };
        document.getElementById('period-value').textContent = data.period.toFixed(2);
        document.getElementById('rotation-value').textContent = data.rotation_period.toFixed(2);
        const maxX = Math.max(...data.full_trajectory_points.map(p => Math.abs(p.x)));
        const maxY = Math.max(...data.full_trajectory_points.map(p => Math.abs(p.y)));
        const chartRange = Math.max(maxX, maxY) * 1.2;

        // Общие настройки для графиков
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

        // График полной траектории (красный)
        currentChart2 = new Chart(
            document.getElementById('chart2').getContext('2d'),
            {
                type: 'scatter',
                data: { 
                    datasets: [{
                        label: 'Полная траектория',
                        data: data.full_trajectory_points,
                        borderColor: '#e74c3c',
                        pointRadius: 0,
                        borderWidth: 1,
                        showLine: true,
                        tension: 0.1
                    }]
                },
                options: commonOptions
            }
        );

        // График реального времени (синий) - изначально пустой
        currentChart = new Chart(
            document.getElementById('chart').getContext('2d'),
            {
                type: 'scatter',
                data: { 
                    datasets: [{
                        label: 'Траектория в реальном времени',
                        data: [],
                        borderColor: '#3498db80',
                        pointRadius: 0,
                        borderWidth: 1,
                        showLine: true,
                        tension: 0.1
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        x: {
                            ...commonOptions.scales.x,
                            min: -Math.max(...data.full_trajectory_points.map(p => Math.abs(p.x))) * 1.2,
                            max: Math.max(...data.full_trajectory_points.map(p => Math.abs(p.x))) * 1.2
                        },
                        y: {
                            ...commonOptions.scales.y,
                            min: -Math.max(...data.full_trajectory_points.map(p => Math.abs(p.y))) * 1.2,
                            max: Math.max(...data.full_trajectory_points.map(p => Math.abs(p.y))) * 1.2
                        }
                    }
                }
            }
        );

        // Запускаем анимацию
        animateSimulation(realTimeRatio, stopTime);

    } catch (error) {
        console.error('Simulation error:', error);
        alert(`Ошибка при запуске симуляции: ${error.message}`);
        isSimulationRunning = false;
        document.getElementById('start-btn').style.display = 'inline-block';
        document.getElementById('stop-btn').style.display = 'none';
        return;  // Прерываем выполнение при ошибке
    }
}

function animateSimulation(realTimeRatio, stopTime) {
    let startTime = Date.now();
    let lastChartUpdate = 0;
    let lastTimerUpdate = 0;
    let accumulatedTime = 0;
    let lastRealTimeRatio = realTimeRatio;

    function animate() {
        if (!isSimulationRunning) return;

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
        const angle = simulationData.initAngle * Math.exp(-simulationData.dampingCoef * simulatedTime) * 
                    Math.cos(Math.sqrt(simulationData.oscill_rate**2 - simulationData.dampingCoef**2) * simulatedTime);
        const rotationAngle = simulationData.rotation_rate * simulatedTime;

        update3DPendulum(angle, rotationAngle);

        // Обновление графиков
        if (now - lastChartUpdate > 50) {
            const x = simulationData.height * Math.sin(angle) * Math.cos(rotationAngle);
            const y = simulationData.height * Math.sin(angle) * Math.sin(rotationAngle);
            
            // Всегда добавляем точку, но ограничиваем общее количество
            currentChart.data.datasets[0].data.push({x, y});
            
            // Ограничиваем количество точек для плавности
            if (currentChart.data.datasets[0].data.length > 2000) {
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

// Инициализация графика зависимости периода от широты
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