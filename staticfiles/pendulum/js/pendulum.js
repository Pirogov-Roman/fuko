document.addEventListener('DOMContentLoaded', function() {
    console.log("Скрипт загружен!"); // Проверка загрузки
    
    // Проверка Leaflet
    if (typeof L === 'undefined') {
        console.error("Leaflet не загружен!");
    } else {
        console.log("Leaflet доступен");
        const map = L.map('earth-map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    }
    
    // Проверка Chart.js
    if (typeof Chart === 'undefined') {
        console.error("Chart.js не загружен!");
    } else {
        console.log("Chart.js доступен");
        const ctx = document.getElementById('trajectory-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Тест'],
                datasets: [{
                    label: 'Проверка',
                    data: [1, 2, 3]
                }]
            }
        });
    }
});