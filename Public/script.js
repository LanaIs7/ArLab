// ==================== АВТОРИЗАЦИЯ И АККАУНТЫ ====================
const AUTH_KEY = 'arlab_auth';
const STATS_DB_KEY = 'arlab_stats_db'; // Общая база статистики всех пользователей

// Получить текущего пользователя
function getCurrentUser() {
    const auth = localStorage.getItem(AUTH_KEY);
    return auth ? JSON.parse(auth) : null;
}

// Войти в систему
function loginUser(username, password) {
    if (!username || password.length < 3) {
        alert('️ Введите логин и пароль (мин. 3 символа)');
        return false;
    }
    // Сохраняем сессию (в реальном проекте здесь будет запрос к серверу)
    const user = { username: username.trim(), loggedIn: true, loginTime: Date.now() };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return true;
}

// Выйти из системы
function logoutUser() {
    saveUserStats(); // Сохраняем статистику перед выходом
    localStorage.removeItem(AUTH_KEY);
    window.location.href = 'index.html';
}

/// Проверка сессии при загрузке страницы
function checkAuth() {
    const user = getCurrentUser();
    // Определяем имя текущей страницы
    const currentPage = window.location.pathname.split('/').pop();

    // 1. Если НЕ авторизован И НЕ на странице входа -> Перекинуть на вход
    if ((!user || !user.loggedIn) && currentPage !== 'index.html') {
        window.location.href = 'index.html';
        return null;
    }

    // 2. Если авторизован И на странице входа -> Перекинуть в дашборд
    if (user && user.loggedIn && currentPage === 'index.html') {
        window.location.href = 'dashboard.html';
        return user;
    }

    // 3. Если всё ок (авторизован в дашборде или не авторизован на входе) -> Продолжить работу
    return user;
}

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let isConnecting = false;
let startPoint = null;
let tempWire = null;
let connections = [];
let deleteModeActive = false;
let isCodeMode = false;
let scriptInitialized = false;
let startX = 0;
let startY = 0;


let currentTaskNumber = 1; // Глобальная переменная для отслеживания задания

// Глобальный массив заданий (с ключевыми словами для проверки)
const codeTasks = [
    { number: 1, title: 'Объявление переменной', description: "Объявите целочисленную переменную 'count' со значением 5.", example: 'int count = 5;', keywords: ['int', 'count', '5'] },
    { number: 2, title: 'Цикл for', description: 'Напишите цикл for для вывода чисел от 1 до 10.', example: 'for (int i = 1; i <= 10; i++) {\n  Serial.println(i);\n}', keywords: ['for', 'int', '++', '{', '}'] },
    { number: 3, title: 'Условный оператор', description: "Напишите if для проверки, больше ли x нуля.", example: 'if (x > 0) {\n  // код\n}', keywords: ['if', '(', ')', '{', '}'] },
    { number: 4, title: 'Функция setup()', description: 'Инициализируйте пин 13 как выходной.', example: 'void setup() {\n  pinMode(13, OUTPUT);\n}', keywords: ['void setup', 'pinMode', '13', 'OUTPUT'] },
    { number: 5, title: 'Функция loop()', description: 'Включите светодиод на пине 13.', example: 'void loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n}', keywords: ['void loop', 'digitalWrite', '13', 'HIGH', 'delay'] },
    {number: 6,title: 'Широтно-импульсная модуляция (PWM)',
        description: 'Используйте analogWrite() для управления яркостью светодиода на пине 9. Значение должно быть 128.',
        example: 'void setup(){analogWrite(9,128);} void loop(){}',
        keywords: ['analogWrite', '9', '128']
    },
    
    {
        number: 7,
        title: 'Чтение аналогового входа',
        description: 'Считайте значение с аналогового пина A0 используя analogRead() и сохраните в переменную sensorValue.',
        example: 'int sensorValue; void setup(){Serial.begin(9600);} void loop(){sensorValue=analogRead(A0);delay(100);}',
        keywords: ['analogRead', 'A0', 'sensorValue', 'int']
    },
    
    {
        number: 8,
        title: 'Управление сервоприводом',
        description: 'Подключите библиотеку Servo, создайте объект servo и установите угол 90 градусов на пине 3.',
        example: '#include <Servo.h> Servo myServo; void setup(){myServo.attach(3);myServo.write(90);} void loop(){}',
        keywords: ['#include', '<Servo.h>', 'Servo', 'attach', 'write', '90']
    },
    
    {
        number: 9,
        title: 'Условный оператор if-else',
        description: 'Напишите условие: если sensorValue больше 500, включите светодиод на пине 13, иначе выключите его.',
        example: 'if(sensorValue>500){digitalWrite(13,HIGH);}else{digitalWrite(13,LOW);}',
        keywords: ['if', 'sensorValue', '>', '500', 'else', 'digitalWrite', '13', 'HIGH', 'LOW']
    },
    
    {
        number: 10,
        title: 'Комплексное задание: умный свет',
        description: 'Считайте значение с A0, если оно больше 300, установите яркость на пине 9 в 255, иначе 0.',
        example: 'int sensorValue; void setup(){Serial.begin(9600);} void loop(){sensorValue=analogRead(A0);if(sensorValue>300){analogWrite(9,255);}else{analogWrite(9,0);}delay(100);}',
        keywords: ['analogRead', 'A0', 'if', 'sensorValue', '>', '300', 'analogWrite', '9', '255', 'else', '0']
    }
];

// ==================== ФУНКЦИИ УПРАВЛЕНИЯ ИНТЕРФЕЙСОМ ====================

function openSchemes() {
    isCodeMode = false;
    const codeEditor = document.getElementById('codeEditor');
    if (codeEditor) codeEditor.style.display = 'none';
    
    const workspace = document.getElementById('workspace');
    const redLine = document.getElementById('redLine');
    if (workspace) workspace.classList.add('active');
    if (redLine) redLine.classList.add('active');
    
    const taskPanel = document.getElementById('taskPanel');
    if (taskPanel) taskPanel.classList.remove('active');
    
    resetCircuitAnimation();
}

function openCodeMode() {
    isCodeMode = true;
    const workspace = document.getElementById('workspace');
    if (workspace) workspace.classList.remove('active');
    
    const codeEditor = document.getElementById('codeEditor');
    if (codeEditor) codeEditor.style.display = 'block';
    
    const redLine = document.getElementById('redLine');
    if (redLine) redLine.classList.add('active');
    
    const taskPanel = document.getElementById('taskPanel');
    if (taskPanel) taskPanel.classList.remove('active');
    
    alert('💻 Режим программирования активирован!\nВыберите задание из красной линии.');
}

function showTask(number) {
    // Сбрасываем предыдущее состояние
    resetCircuitAnimation();
    currentTaskNumber = number;
    
    const taskPanel = document.getElementById('taskPanel');
    const componentsPanel = document.getElementById('componentsPanel');
    
    if (taskPanel) taskPanel.classList.add('active');
    if (componentsPanel) componentsPanel.classList.add('active');
    
    const titleEl = taskPanel.querySelector('h3');
    const descEl = taskPanel.querySelector('p');

    // Логика для разных заданий
    switch (number) {
        case 1:
            titleEl.textContent = 'Задание №1: Мигающий светодиод';
            descEl.textContent = 'Соберите схему: Пин 13 -> Анод LED -> Резистор -> Катод LED -> GND.';
            break;
        case 2:
            titleEl.textContent = 'Задание №2: RGB светодиод';
            descEl.textContent = 'Соберите схему: Common -> GND, R -> Резистор -> Пин 9, G -> Резистор -> Пин 10, B -> Резистор -> Пин 11.';
            break;
        case 3:
            titleEl.textContent = 'Задание №3: Потенциометр';
            descEl.textContent = 'Соберите схему: 5V -> Левый контакт, GND -> Правый контакт, Средний контакт -> Пин A0.';
            break;
        case 4:
            titleEl.textContent = 'Задание №4: Сервопривод';
            descEl.textContent = 'Соберите схему: Красный провод -> 5V, Коричневый -> GND, Оранжевый (сигнал) -> Пин 9.';
            break;
        case 5:
            titleEl.textContent = 'Задание №5: Кнопка с подтяжкой';
            descEl.textContent = 'Соберите схему: Контакт 1 -> 5V, Контакт 2 -> Пин 2 и Резистор -> GND.';
            break;
        case 6:
            titleEl.textContent = 'Задание №6: Пьезоэлемент';
            descEl.textContent = 'Соберите схему: (+) Пьезо -> Пин 8, (-) Пьезо -> GND.';
            break;
        case 7:
            titleEl.textContent = 'Задание №7: Светофор';
            descEl.textContent = 'Соберите 3 цепи: Красный LED (через рез.) -> Пин 11, Желтый -> Пин 10, Зеленый -> Пин 9. Катоды -> GND.';
            break;
        case 8:
            titleEl.textContent = 'Задание №8: Фоторезистор';
            descEl.textContent = 'Соберите делитель: 5V -> Фоторезистор -> Пин A1 -> Резистор 10кОм -> GND.';
            break;
        case 9:
            titleEl.textContent = 'Задание №9: Датчик температуры';
            descEl.textContent = 'Соберите схему (плоской стороной к себе): Левый вывод -> 5V, Средний -> Пин A2, Правый -> GND.';
            break;
        case 10:
            titleEl.textContent = 'Задание №10: Умный ночник';
            descEl.textContent = 'Соберите схему: Фоторезистор -> A0. Светодиод (через рез.) -> Пин 9.';
            break;
        default:
            titleEl.textContent = `Задание №${number}`;
            descEl.textContent = 'Задание в разработке...';
            break;
    }
}

function showCodeTask(number) {
    // Сбрасываем состояние при переключении
    currentTaskNumber = number;
    resetCircuitAnimation();
    
    const taskPanel = document.getElementById('taskPanel');
    const componentsPanel = document.getElementById('componentsPanel');
    const codeEditor = document.getElementById('codeEditor');
    const workspace = document.getElementById('workspace');
    
    if (taskPanel) taskPanel.classList.add('active');
    if (codeEditor) codeEditor.style.display = 'block';
    if (workspace) workspace.classList.remove('active');
    if (componentsPanel) componentsPanel.classList.remove('active');
    
    const task = codeTasks.find(t => t.number === number);
    
    if (task && taskPanel) {
        taskPanel.querySelector('h3').textContent = `Задание №${task.number}: ${task.title}`;
        taskPanel.querySelector('p').textContent = task.description;
        
        const codeInput = document.getElementById('codeInput');
        if (codeInput) {
            codeInput.value = '';
            codeInput.placeholder = `Пример:\n${task.example}`;
        }
        
        alert(`💻 Задание №${task.number}\n\n${task.description}`);
    }
}

function closeTask() {
    const taskPanel = document.getElementById('taskPanel');
    const componentsPanel = document.getElementById('componentsPanel');
    
    if (taskPanel) taskPanel.classList.remove('active');
    if (componentsPanel) componentsPanel.classList.remove('active');
}

function logout() {
    isCodeMode = false;
    deleteModeActive = false;
    try {
        window.location.href = 'index.html';
    } catch (e) {
        console.error('Ошибка при выходе:', e);
        window.location.replace('index.html');
    }
}

// ==================== ДОБАВЛЕНИЕ КОМПОНЕНТОВ ====================

function addComponent(type) {
    const container = document.getElementById('componentsContainer');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'component-wrapper';
    wrapper.style.left = '100px';
    wrapper.style.top = '100px';
    wrapper.style.width = '130px';
    wrapper.style.height = '130px';

    const img = document.createElement('img');
    img.className = 'component-item';
    img.alt = type;
    
    let srcPath = 'assets/led_1.png'; 
    if (type === 'резистор') srcPath = 'assets/rezistor.png';
    else if (type === 'сервопривод') srcPath = 'assets/servo.png';
    else if (type === 'RGB LED') srcPath = 'assets/rgbled.png';
    else if (type === 'пьезоэлемент') srcPath = 'assets/piezo.png'; 
    else if (type === 'кнопка') srcPath = 'assets/button.png';
    else if (type === 'фоторезистор') srcPath = 'assets/photoresistor.png';
    else if (type === 'потенциометр') srcPath = 'assets/potentiometer.png';
    else if (type === 'датчик температуры') srcPath = 'assets/temperature_sensor.png';
    
    img.src = srcPath;
    wrapper.appendChild(img);

    // ================= LED =================
    if (type === 'LED') {
        const anode = document.createElement('div');
        anode.className = 'component-contact anode';
        anode.dataset.contact = 'anode';
        anode.dataset.type = 'LED';
        anode.style.left = '10px'; anode.style.top = '30px';
        wrapper.appendChild(anode);

        const cathode = document.createElement('div');
        cathode.className = 'component-contact cathode';
        cathode.dataset.contact = 'cathode';
        cathode.dataset.type = 'LED';
        cathode.style.left = '10px'; cathode.style.top = '90px';
        wrapper.appendChild(cathode);
    } 
    // ================= RGB LED (Выровненные контакты) =================
    else if (type === 'RGB LED') {
        // Красный (Слева)
        const red = document.createElement('div');
        red.className = 'component-contact red';
        red.dataset.contact = 'R';
        red.dataset.type = 'RGB LED';
        red.style.left = '25px'; red.style.top = '105px'; // Выровнено
        wrapper.appendChild(red);

        // Общий (Посередине слева)
        const common = document.createElement('div');
        common.className = 'component-contact common';
        common.dataset.contact = 'common';
        common.dataset.type = 'RGB LED';
        common.style.left = '45px'; common.style.top = '105px'; // Выровнено
        wrapper.appendChild(common);

        // Зеленый (Посередине справа)
        const green = document.createElement('div');
        green.className = 'component-contact green';
        green.dataset.contact = 'G';
        green.dataset.type = 'RGB LED';
        green.style.left = '65px'; green.style.top = '105px'; // Выровнено
        wrapper.appendChild(green);

        // Синий (Справа)
        const blue = document.createElement('div');
        blue.className = 'component-contact blue';
        blue.dataset.contact = 'B';
        blue.dataset.type = 'RGB LED';
        blue.style.left = '85px'; blue.style.top = '105px'; // Выровнено
        wrapper.appendChild(blue);
    }
    // ================= Резистор =================
    else if (type === 'резистор') {
        const c1 = document.createElement('div');
        c1.className = 'component-contact';
        c1.dataset.contact = '1';
        c1.dataset.type = 'резистор';
        c1.style.left = '-5px'; c1.style.top = '60px';
        wrapper.appendChild(c1);

        const c2 = document.createElement('div');
        c2.className = 'component-contact';
        c2.dataset.contact = '2';
        c2.dataset.type = 'резистор';
        c2.style.left = '125px'; c2.style.top = '60px';
        wrapper.appendChild(c2);
    }
    // ================= Сервопривод (Добавлены пины) =================
    else if (type === 'сервопривод') {
        // Земля (Коричневый)
        const gnd = document.createElement('div');
        gnd.className = 'component-contact gnd';
        gnd.dataset.contact = 'gnd';
        gnd.dataset.type = 'сервопривод';
        gnd.style.left = '35px'; gnd.style.top = '105px';
        wrapper.appendChild(gnd);

        // Питание 5V (Красный)
        const vcc = document.createElement('div');
        vcc.className = 'component-contact vcc';
        vcc.dataset.contact = 'vcc';
        vcc.dataset.type = 'сервопривод';
        vcc.style.left = '55px'; vcc.style.top = '105px';
        wrapper.appendChild(vcc);

        // Сигнал (Оранжевый)
        const signal = document.createElement('div');
        signal.className = 'component-contact signal';
        signal.dataset.contact = 'signal';
        signal.dataset.type = 'сервопривод';
        signal.style.left = '75px'; signal.style.top = '105px';
        wrapper.appendChild(signal);
    }
    // ================= Пьезоэлемент (Добавлены пины) =================
    else if (type === 'пьезоэлемент') {
        // Плюс (Красный)
        const pos = document.createElement('div');
        pos.className = 'component-contact positive';
        pos.dataset.contact = 'positive';
        pos.dataset.type = 'пьезоэлемент';
        pos.style.left = '45px'; pos.style.top = '100px';
        wrapper.appendChild(pos);

        // Минус (Черный)
        const neg = document.createElement('div');
        neg.className = 'component-contact negative';
        neg.dataset.contact = 'negative';
        neg.dataset.type = 'пьезоэлемент';
        neg.style.left = '75px'; neg.style.top = '100px';
        wrapper.appendChild(neg);
    }
    // === ДАТЧИК ТЕМПЕРАТУРЫ (TMP) ===
else if (type === 'датчик температуры') {
    srcPath = 'assets/temperature_sensor.png';
    
    // Левый вывод (VCC / +5V)
    const vcc = document.createElement('div');
    vcc.className = 'component-contact vcc';
    vcc.dataset.contact = 'VCC';
    vcc.dataset.type = 'датчик температуры';
    vcc.style.left = '30px'; 
    vcc.style.top = '105px';
    wrapper.appendChild(vcc);

    // Средний вывод (Signal / OUT)
    const signal = document.createElement('div');
    signal.className = 'component-contact signal';
    signal.dataset.contact = 'OUT';
    signal.dataset.type = 'датчик температуры';
    signal.style.left = '60px'; 
    signal.style.top = '105px';
    wrapper.appendChild(signal);

    // Правый вывод (GND)
    const gnd = document.createElement('div');
    gnd.className = 'component-contact gnd';
    gnd.dataset.contact = 'GND';
    gnd.dataset.type = 'датчик температуры';
    gnd.style.left = '90px'; 
    gnd.style.top = '105px';
    wrapper.appendChild(gnd);
}

// === ПОТЕНЦИОМЕТР ===
else if (type === 'потенциометр') {
    srcPath = 'assets/potentiometer.png';
    
    // Левый контакт
    const left = document.createElement('div');
    left.className = 'component-contact';
    left.dataset.contact = 'left';
    left.dataset.type = 'потенциометр';
    left.style.left = '20px'; 
    left.style.top = '105px';
    wrapper.appendChild(left);

    // Средний контакт (ползунок)
    const middle = document.createElement('div');
    middle.className = 'component-contact middle';
    middle.dataset.contact = 'middle';
    middle.dataset.type = 'потенциометр';
    middle.style.left = '60px'; 
    middle.style.top = '105px';
    wrapper.appendChild(middle);

    // Правый контакт
    const right = document.createElement('div');
    right.className = 'component-contact';
    right.dataset.contact = 'right';
    right.dataset.type = 'потенциометр';
    right.style.left = '100px'; 
    right.style.top = '105px';
    wrapper.appendChild(right);
}

// === ФОТОРЕЗИСТОР ===
else if (type === 'фоторезистор') {
    srcPath = 'assets/photoresistor.png';
    
    // Левый контакт
    const c1 = document.createElement('div');
    c1.className = 'component-contact';
    c1.dataset.contact = '1';
    c1.dataset.type = 'фоторезистор';
    c1.style.left = '35px'; 
    c1.style.top = '105px';
    wrapper.appendChild(c1);

    // Правый контакт
    const c2 = document.createElement('div');
    c2.className = 'component-contact';
    c2.dataset.contact = '2';
    c2.dataset.type = 'фоторезистор';
    c2.style.left = '85px'; 
    c2.style.top = '105px';
    wrapper.appendChild(c2);
}

// === КНОПКА ===
else if (type === 'кнопка') {
    srcPath = 'assets/button.png';
    
    // Верхний левый контакт
    const tl = document.createElement('div');
    tl.className = 'component-contact';
    tl.dataset.contact = 'TL';
    tl.dataset.type = 'кнопка';
    tl.style.left = '20px'; 
    tl.style.top = '20px';
    wrapper.appendChild(tl);

    // Верхний правый контакт
    const tr = document.createElement('div');
    tr.className = 'component-contact';
    tr.dataset.contact = 'TR';
    tr.dataset.type = 'кнопка';
    tr.style.left = '100px'; 
    tr.style.top = '20px';
    wrapper.appendChild(tr);
    
    // Нижний левый контакт
    const bl = document.createElement('div');
    bl.className = 'component-contact';
    bl.dataset.contact = 'BL';
    bl.dataset.type = 'кнопка';
    bl.style.left = '20px'; 
    bl.style.top = '100px';
    wrapper.appendChild(bl);

    // Нижний правый контакт
    const br = document.createElement('div');
    br.className = 'component-contact';
    br.dataset.contact = 'BR';
    br.dataset.type = 'кнопка';
    br.style.left = '100px'; 
    br.style.top = '100px';
    wrapper.appendChild(br);
}

    container.appendChild(wrapper);
    makeDraggable(wrapper);

    wrapper.querySelectorAll('.component-contact').forEach(contact => {
        contact.addEventListener('click', handleConnectionClick);
    });
    
}

function makeDraggable(element) {
    let isDragging = false;
    let offsetX, offsetY;
    const workspace = document.getElementById('workspace');
    if (!workspace) return;

    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('component-contact')) return;
        isDragging = true;
        offsetX = e.clientX - element.getBoundingClientRect().left;
        offsetY = e.clientY - element.getBoundingClientRect().top;
        element.style.zIndex = '1000';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const wsRect = workspace.getBoundingClientRect();
        const x = e.clientX - wsRect.left - offsetX;
        const y = e.clientY - wsRect.top - offsetY;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        connections.forEach(conn => {
            const sEl = conn.start?.element;
            const eEl = conn.end?.element;
            if ((sEl && element.contains(sEl)) || (eEl && element.contains(eEl))) {
                updateWireGeometry(conn);
            }
        });
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        element.style.zIndex = '10';
    });
}

// ==================== РИСОВАНИЕ ПРОВОДОВ ====================

function handleConnectionClick(e) {
    e.stopPropagation();
    const point = this;
    const workspace = document.getElementById('workspace');
    if (!workspace) return;
    
    const wsRect = workspace.getBoundingClientRect();
    const pRect = point.getBoundingClientRect();
    const x = pRect.left - wsRect.left + 6;
    const y = pRect.top - wsRect.top + 6;

    if (isConnecting) {
        createConnection(startPoint, point, x, y);
        isConnecting = false;
        startPoint = null;
        if (tempWire) { tempWire.remove(); tempWire = null; }
    } else {
        isConnecting = true;
        startPoint = point;
        startX = x; 
        startY = y;
        tempWire = document.createElement('div');
        tempWire.className = 'temp-wire';
        tempWire.style.left = `${x}px`;
        tempWire.style.top = `${y}px`;
        workspace.appendChild(tempWire);
    }
}

document.addEventListener('mousemove', (e) => {
    if (!isConnecting || !tempWire) return;
    const workspace = document.getElementById('workspace');
    if (!workspace) return;
    const wsRect = workspace.getBoundingClientRect();
    const mouseX = e.clientX - wsRect.left;
    const mouseY = e.clientY - wsRect.top;
    const length = Math.sqrt(Math.pow(mouseX - startX, 2) + Math.pow(mouseY - startY, 2));
    const angle = Math.atan2(mouseY - startY, mouseX - startX) * 180 / Math.PI;
    tempWire.style.width = `${length}px`;
    tempWire.style.transform = `rotate(${angle}deg)`;
});

function createConnection(start, end, endX, endY) {
    const workspace = document.getElementById('workspace');
    if (!workspace) return;
    const wsRect = workspace.getBoundingClientRect();
    const sRect = start.getBoundingClientRect();
    const startX = sRect.left - wsRect.left + 6;
    const startY = sRect.top - wsRect.top + 6;
    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

    const wire = document.createElement('div');
    wire.className = 'wire';
    wire.style.left = `${startX}px`;
    wire.style.top = `${startY}px`;
    wire.style.width = `${length}px`;
    wire.style.transform = `rotate(${angle}deg)`;
    workspace.appendChild(wire);

    connections.push({
        start: { element: start, pin: start.dataset.pin, contact: start.dataset.contact, type: start.dataset.type },
        end: { element: end, pin: end.dataset.pin, contact: end.dataset.contact, type: end.dataset.type },
        element: wire
    });
}

function updateWireGeometry(conn) {
    if (!conn.element || !conn.element.parentNode) return;
    if (!conn.start?.element || !conn.end?.element) return;
    const workspace = document.getElementById('workspace');
    if (!workspace) return;
    const wsRect = workspace.getBoundingClientRect();
    const sRect = conn.start.element.getBoundingClientRect();
    const eRect = conn.end.element.getBoundingClientRect();
    const x1 = sRect.left - wsRect.left + 6;
    const y1 = sRect.top - wsRect.top + 6;
    const x2 = eRect.left - wsRect.left + 6;
    const y2 = eRect.top - wsRect.top + 6;
    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    conn.element.style.left = `${x1}px`;
    conn.element.style.top = `${y1}px`;
    conn.element.style.width = `${length}px`;
    conn.element.style.transform = `rotate(${angle}deg)`;
}

// ==================== УДАЛЕНИЕ ====================

function deleteWire(wireElement) {
    const index = connections.findIndex(conn => conn.element === wireElement);
    if (index !== -1) {
        if (wireElement.parentNode) wireElement.remove();
        connections.splice(index, 1);
        return true;
    }
    return false;
}

function deleteComponent(componentWrapper) {
    for (let i = connections.length - 1; i >= 0; i--) {
        const conn = connections[i];
        const isRelatedToStart = conn.start?.element && componentWrapper.contains(conn.start.element);
        const isRelatedToEnd = conn.end?.element && componentWrapper.contains(conn.end.element);
        if (isRelatedToStart || isRelatedToEnd) {
            if (conn.element?.parentNode) conn.element.remove();
            connections.splice(i, 1);
        }
    }
    if (componentWrapper.parentNode) {
        componentWrapper.remove();
    }
    return true;
}

// ==================== СТАТИСТИКА ПО АККАУНТАМ ====================
let currentUserStats = { 
    username: '',
    lastVisit: null,
    // Разделяем статистику по режимам
    code: {
        completed: [],    // Выполненные задания по коду
        attempts: {},     // Попытки по коду {1: 3, 2: 1, ...}
        totalChecks: 0    // Всего проверок кода
    },
    schematic: {
        completed: [],    // Выполненные задания по схемам
        attempts: {},     // Попытки по схемам
        totalChecks: 0    // Всего проверок схем
    }
};

// Загрузка статистики конкретного пользователя
function loadUserStats(username) {
    const db = JSON.parse(localStorage.getItem(STATS_DB_KEY) || '{}');
    
    if (!db[username]) {
        // Новый пользователь — создаём структуру с двумя режимами
        db[username] = { 
            username: username,
            lastVisit: new Date().toLocaleDateString(),
            code: { completed: [], attempts: {}, totalChecks: 0 },
            schematic: { completed: [], attempts: {}, totalChecks: 0 }
        };
    } else {
        // Миграция старых данных (если структура устарела)
        if (!db[username].code) {
            db[username].code = { 
                completed: db[username].completed || [], 
                attempts: db[username].attempts || {}, 
                totalChecks: db[username].totalChecks || 0 
            };
            db[username].schematic = { 
                completed: [], 
                attempts: {}, 
                totalChecks: 0 
            };
        }
        db[username].lastVisit = new Date().toLocaleDateString();
    }
    
    currentUserStats = db[username];
    localStorage.setItem(STATS_DB_KEY, JSON.stringify(db));
}

// Сохранение статистики текущего пользователя
function saveUserStats() {
    const user = getCurrentUser();
    if (!user) return;
    
    const db = JSON.parse(localStorage.getItem(STATS_DB_KEY) || '{}');
    db[user.username] = currentUserStats;
    localStorage.setItem(STATS_DB_KEY, JSON.stringify(db));
}

// Запись попытки (вызывается при проверке)
// mode: 'code' или 'schematic'
function recordAttempt(taskNum, success, mode = 'schematic') {
    const section = currentUserStats[mode];
    if (!section) return;
    
    if (!section.attempts[taskNum]) section.attempts[taskNum] = 0;
    section.attempts[taskNum]++;
    section.totalChecks++;
    
    if (success && !section.completed.includes(taskNum)) {
        section.completed.push(taskNum);
    }
    
    saveUserStats();
    
    // Обновляем окно, если оно открыто
    if (document.getElementById('statsModal')?.classList.contains('active')) {
        renderStats();
    }
}

// Отрисовка окна статистики с разделением по режимам
function renderStats() {
    const container = document.getElementById('statsContainer');
    if (!container) return;

    const username = currentUserStats.username || 'Гость';
    const lastVisit = currentUserStats.lastVisit || 'Сегодня';
    
    // Данные по режимам
    const code = currentUserStats.code || { completed: [], attempts: {}, totalChecks: 0 };
    const schematic = currentUserStats.schematic || { completed: [], attempts: {}, totalChecks: 0 };
    
    const codeCompleted = code.completed?.length || 0;
    const schematicCompleted = schematic.completed?.length || 0;
    const codePercent = Math.round((codeCompleted / 10) * 100);
    const schematicPercent = Math.round((schematicCompleted / 10) * 100);
    const totalCompleted = codeCompleted + schematicCompleted;
    const totalPercent = Math.round((totalCompleted / 20) * 100);

    let html = `
        <div style="text-align:center; margin-bottom:15px; padding:10px; background:#e3f2fd; border-radius:8px;">
            👤 <strong>${username}</strong><br>
            <small style="color:#666">📅 Последний вход: ${lastVisit}</small>
        </div>
        
        <!-- Общий прогресс -->
        <div style="margin-bottom:20px; padding:12px; background:#f8f9fa; border-radius:8px;">
            <strong>📊 Общий прогресс:</strong>
            <div style="display:flex; justify-content:space-between; margin:8px 0; font-size:14px;">
                <span>Выполнено заданий:</span>
                <strong>${totalCompleted} / 20</strong>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${totalPercent}%; background: linear-gradient(90deg, #667eea, #764ba2);"></div>
            </div>
        </div>
        
        <!-- Режим: СХЕМЫ -->
        <div style="margin-bottom:20px; padding:12px; background:#e8f5e9; border-radius:8px; border-left:4px solid #4caf50;">
            <strong>🔌 Режим "Схемы"</strong>
            <div style="display:flex; justify-content:space-between; margin:8px 0; font-size:14px;">
                <span>Выполнено:</span>
                <strong class="success">${schematicCompleted} / 10</strong>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${schematicPercent}%; background: #4caf50;"></div>
            </div>
            <div style="font-size:12px; color:#666; margin-top:5px;">
                🔍 Проверок: ${schematic.totalChecks}
            </div>
        </div>
        
        <!-- Режим: КОД -->
        <div style="margin-bottom:20px; padding:12px; background:#e3f2fd; border-radius:8px; border-left:4px solid #2196f3;">
            <strong>💻 Режим "Код"</strong>
            <div style="display:flex; justify-content:space-between; margin:8px 0; font-size:14px;">
                <span>Выполнено:</span>
                <strong class="success">${codeCompleted} / 10</strong>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${codePercent}%; background: #2196f3;"></div>
            </div>
            <div style="font-size:12px; color:#666; margin-top:5px;">
                🔍 Проверок: ${code.totalChecks}
            </div>
        </div>
        
        <!-- Детализация по заданиям -->
        <div style="margin-top:20px; font-weight:600; color:#333; padding-top:10px; border-top:2px solid #eee;">
            📋 Детализация по заданиям:
        </div>
    `;

    // Таблица: Схемы (задания 1-10)
    html += `<div style="margin:10px 0; padding:8px; background:#f1f8e9; border-radius:6px;">
        <strong style="color:#4caf50;">🔌 Схемы:</strong>
    </div>`;
    for (let i = 1; i <= 10; i++) {
        const attempts = schematic.attempts[i] || 0;
        const isDone = schematic.completed?.includes(i);
        const statusClass = isDone ? 'success' : (attempts > 2 ? 'warning' : 'error');
        const statusText = isDone ? '✅' : `🔄 ${attempts}`;
        html += `<div class="stat-row">
            <span class="stat-label">Задание №${i}</span>
            <span class="stat-value ${statusClass}">${statusText}</span>
        </div>`;
    }

    // Таблица: Код (задания 1-10)
    html += `<div style="margin:15px 0 10px 0; padding:8px; background:#e3f2fd; border-radius:6px;">
        <strong style="color:#2196f3;">💻 Код:</strong>
    </div>`;
    for (let i = 1; i <= 10; i++) {
        const attempts = code.attempts[i] || 0;
        const isDone = code.completed?.includes(i);
        const statusClass = isDone ? 'success' : (attempts > 2 ? 'warning' : 'error');
        const statusText = isDone ? '✅' : `🔄 ${attempts}`;
        html += `<div class="stat-row">
            <span class="stat-label">Задание №${i}</span>
            <span class="stat-value ${statusClass}">${statusText}</span>
        </div>`;
    }

    container.innerHTML = html;
}

// Управление окном
function openStats() {
    console.log('📊 Открытие статистики...');
    
    const modal = document.getElementById('statsModal');
    const container = document.getElementById('statsContainer');
    
    if (!modal) {
        console.error('❌ Не найден #statsModal');
        return;
    }
    
    if (!container) {
        console.error('❌ Не найден #statsContainer');
        return;
    }
    
    try {
        renderStats();
        modal.classList.add('active');
        console.log('✅ Статистика открыта');
    } catch (e) {
        console.error('❌ Ошибка в openStats():', e);
        alert('⚠️ Ошибка при открытии статистики');
    }
}

function closeStats() {
    document.getElementById('statsModal').classList.remove('active');
}

function resetStats() {
    if (confirm('Вы уверены, что хотите сбросить всю статистику?')) {
        const db = JSON.parse(localStorage.getItem(STATS_DB_KEY) || '{}');
        const user = getCurrentUser();
        
        if (user?.username) {
            // Сбрасываем оба режима
            db[user.username] = { 
                username: user.username,
                lastVisit: new Date().toLocaleDateString(),
                code: { completed: [], attempts: {}, totalChecks: 0 },
                schematic: { completed: [], attempts: {}, totalChecks: 0 }
            };
            localStorage.setItem(STATS_DB_KEY, JSON.stringify(db));
            currentUserStats = db[user.username];
        }
        
        renderStats();
        alert('✅ Статистика сброшена.');
    }
}

// Привязка кнопки (добавьте в DOMContentLoaded)
document.querySelector('.btn-statistics')?.addEventListener('click', openStats);
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeStats(); });

// ==================== ПРОВЕРКА СХЕМЫ ====================

function checkCircuit() {
    if (isCodeMode) {
        checkCode();
        return;
    }

    const taskPanel = document.getElementById('taskPanel');
    if (!taskPanel || !taskPanel.classList.contains('active')) {
        alert('⚠️ Сначала выберите задание!');
        return;
    }

   

    // ==================== ЗАДАНИЕ №1 ====================
    if (currentTaskNumber === 1) {
        let hasAnodeToPin13 = false;
        let hasCathodeToResistor = false;
        let hasResistorToGND = false;

        connections.forEach(conn => {
            // Проверка: Анод <-> Пин 13
            if ((conn.start.contact === 'anode' && conn.end.pin === '13') ||
                (conn.end.contact === 'anode' && conn.start.pin === '13')) {
                hasAnodeToPin13 = true;
            }

            // Проверка: Катод <-> Резистор
            if ((conn.start.contact === 'cathode' && conn.end.type === 'резистор') ||
                (conn.end.contact === 'cathode' && conn.start.type === 'резистор')) {
                hasCathodeToResistor = true;
            }

            // Проверка: Резистор <-> GND
            if ((conn.start.type === 'резистор' && conn.end.pin === 'GND') ||
                (conn.end.type === 'резистор' && conn.start.pin === 'GND')) {
                hasResistorToGND = true;
            }
        });

        if (hasAnodeToPin13 && hasCathodeToResistor && hasResistorToGND) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Схема работает!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Схема собрана неверно. Проверьте соединения.\nНужно: 13 -> LED -> Резистор -> GND');
            resetCircuitAnimation();
        }
    }
    
        // ==================== ЗАДАНИЕ №2 (RGB LED) ====================
    else if (currentTaskNumber === 2) {
        let hasCommonToGND = false;
        let channelsOk = { R: false, G: false, B: false };
        let resistorsUsed = 0;

        // 1. Проверка Common -> GND
        const commonConn = connections.find(c =>
            (c.start.contact === 'common' && c.start.type === 'RGB LED' && c.end.pin === 'GND') ||
            (c.end.contact === 'common' && c.end.type === 'RGB LED' && c.start.pin === 'GND')
        );
        if (commonConn) hasCommonToGND = true;

        // 2. Проверка цепочек: R/G/B -> Резистор -> Пин (9/10/11)
        ['R', 'G', 'B'].forEach(channel => {
            // Шаг А: Ищем провод от контакта RGB LED к любому контакту резистора
            const wireToResistor = connections.find(c =>
                (c.start.contact === channel && c.start.type === 'RGB LED' && c.end.type === 'резистор') ||
                (c.end.contact === channel && c.end.type === 'RGB LED' && c.start.type === 'резистор')
            );

            if (wireToResistor) {
                // Определяем, какой контакт резистора задействован
                const resContact = wireToResistor.start.type === 'резистор' ? wireToResistor.start : wireToResistor.end;
                const resistorWrapper = resContact.element.closest('.component-wrapper');

                // Шаг Б: Ищем ВТОРОЙ провод от ЭТОГО ЖЕ резистора к пину Arduino
                const wireToPin = connections.find(c => {
                    const startWrap = c.start.element.closest('.component-wrapper');
                    const endWrap = c.end.element.closest('.component-wrapper');
                    
                    // Провод должен касаться того же резистора
                    const isSameResistor = (startWrap === resistorWrapper) || (endWrap === resistorWrapper);
                    if (!isSameResistor) return false;

                    // И должен вести к пину Arduino (не к GND)
                    const pinTarget = c.start.pin || c.end.pin;
                    return pinTarget && pinTarget !== 'GND';
                });

                if (wireToPin) {
                    const targetPin = wireToPin.start.pin || wireToPin.end.pin;
                    const expectedPin = channel === 'R' ? '9' : channel === 'G' ? '10' : '11';
                    
                    if (targetPin === expectedPin) {
                        channelsOk[channel] = true;
                        resistorsUsed++;
                    }
                }
            }
        });

        // Формируем список ошибок
        let errors = [];
        if (!hasCommonToGND) errors.push('• Common -> GND');
        if (!channelsOk.R) errors.push('• R -> Резистор -> Пин 9');
        if (!channelsOk.G) errors.push('• G -> Резистор -> Пин 10');
        if (!channelsOk.B) errors.push('• B -> Резистор -> Пин 11');
        if (resistorsUsed < 3) errors.push(`• Не хватает резисторов (нужно 3, подключено ${resistorsUsed})`);

        // Итог проверки
        if (hasCommonToGND && channelsOk.R && channelsOk.G && channelsOk.B && resistorsUsed >= 3) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! RGB LED подключен правильно!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Схема собрана неверно.\n\nПравильное подключение:\n' + errors.join('\n'));
            resetCircuitAnimation();
        }
    }

     // ==================== ЗАДАНИЕ №3 (ПОТЕНЦИОМЕТР) ====================
    else if (currentTaskNumber === 3) {
        let hasLeftTo5V = false;
        let hasRightToGND = false;
        let hasMiddleToA0 = false;

        connections.forEach(conn => {
            const start = conn.start;
            const end = conn.end;

            // Проверка: Левый контакт -> 5V
            if ((start.type === 'потенциометр' && start.contact === 'left' && end.pin === '5V') ||
                (end.type === 'потенциометр' && end.contact === 'left' && start.pin === '5V')) {
                hasLeftTo5V = true;
            }

            // Проверка: Правый контакт -> GND
            if ((start.type === 'потенциометр' && start.contact === 'right' && end.pin === 'GND') ||
                (end.type === 'потенциометр' && end.contact === 'right' && start.pin === 'GND')) {
                hasRightToGND = true;
            }

            // Проверка: Средний контакт -> A0
            if ((start.type === 'потенциометр' && start.contact === 'middle' && end.pin === 'A0') ||
                (end.type === 'потенциометр' && end.contact === 'middle' && start.pin === 'A0')) {
                hasMiddleToA0 = true;
            }
        });

        if (hasLeftTo5V && hasRightToGND && hasMiddleToA0) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Потенциометр подключен правильно!');
            activateCircuitAnimation();
        } else {
            let errors = [];
            if (!hasLeftTo5V) errors.push('• Левый контакт -> 5V');
            if (!hasRightToGND) errors.push('• Правый контакт -> GND');
            if (!hasMiddleToA0) errors.push('• Средний контакт -> Пин A0');
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Схема собрана неверно.\n\nПравильное подключение:\n' + errors.join('\n'));
            resetCircuitAnimation();
        }
    }

    // ==================== ЗАДАНИЕ №4 (СЕРВОПРИВОД) ====================
    else if (currentTaskNumber === 4) {
        let has5V = false, hasGND = false, hasSignal = false;

        connections.forEach(conn => {
            const comp = conn.start.type === 'сервопривод' ? conn.start : (conn.end.type === 'сервопривод' ? conn.end : null);
            const pin = conn.start.type === 'сервопривод' ? conn.end.pin : conn.start.pin;

            if (comp) {
                if (pin === '5V') has5V = true;
                if (pin === 'GND') hasGND = true;
                if (pin === '9') hasSignal = true; // PWM пин
            }
        });

        if (has5V && hasGND && hasSignal) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Сервопривод подключен правильно!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Ошибка. Нужно: Красный->5V, Коричневый->GND, Оранжевый->Пин 9');
            resetCircuitAnimation();
        }
    }

    // ==================== ЗАДАНИЕ №5 (КНОПКА С ПОДТЯЖКОЙ) ====================
    else if (currentTaskNumber === 5) {
        let hasBtnTo5V = false, hasBtnToPin2 = false, hasResToGND = false;

        connections.forEach(conn => {
            const s = conn.start, e = conn.end;

            // Кнопка -> 5V (контакты TL/TR или 1/2)
            if ((s.type === 'кнопка' && ['TL','TR','1','2'].includes(s.contact) && e.pin === '5V') ||
                (e.type === 'кнопка' && ['TL','TR','1','2'].includes(e.contact) && s.pin === '5V')) {
                hasBtnTo5V = true;
            }

            // Кнопка -> Пин 2
            if ((s.type === 'кнопка' && ['TL','TR','1','2'].includes(s.contact) && e.pin === '2') ||
                (e.type === 'кнопка' && ['TL','TR','1','2'].includes(e.contact) && s.pin === '2')) {
                hasBtnToPin2 = true;
            }

            // Резистор -> GND
            if ((s.type === 'резистор' && e.pin === 'GND') || (e.type === 'резистор' && s.pin === 'GND')) {
                hasResToGND = true;
            }
        });

        if (hasBtnTo5V && hasBtnToPin2 && hasResToGND) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Кнопка подключена правильно!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert(' Ошибка. Нужно: Кнопка->5V, Кнопка->Пин 2, Резистор->GND');
            resetCircuitAnimation();
        }
    }

    // ==================== ЗАДАНИЕ №6 (ПЬЕЗОЭЛЕМЕНТ) ====================
    else if (currentTaskNumber === 6) {
        let hasPin8 = false, hasGND = false;

        connections.forEach(conn => {
            const s = conn.start, e = conn.end;
            if (s.type === 'пьезоэлемент' && e.pin === '8') hasPin8 = true;
            if (e.type === 'пьезоэлемент' && s.pin === '8') hasPin8 = true;
            
            if (s.type === 'пьезоэлемент' && e.pin === 'GND') hasGND = true;
            if (e.type === 'пьезоэлемент' && s.pin === 'GND') hasGND = true;
        });

        if (hasPin8 && hasGND) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Пьезоэлемент подключен правильно!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Ошибка. Нужно: (+) -> Пин 8, (-) -> GND');
            resetCircuitAnimation();
        }
    }

    // ==================== ЗАДАНИЕ №7 (СВЕТОФОР) ====================
    else if (currentTaskNumber === 7) {
        let led11 = false, led10 = false, led9 = false;

        connections.forEach(conn => {
            const s = conn.start, e = conn.end;
            // Проверяем, есть ли LED, подключенный к конкретному пину
            if (s.type === 'LED' && e.pin === '11') led11 = true;
            if (e.type === 'LED' && s.pin === '11') led11 = true;

            if (s.type === 'LED' && e.pin === '10') led10 = true;
            if (e.type === 'LED' && s.pin === '10') led10 = true;

            if (s.type === 'LED' && e.pin === '9') led9 = true;
            if (e.type === 'LED' && s.pin === '9') led9 = true;
        });

        if (led11 && led10 && led9) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Светофор собран!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Ошибка. Нужно 3 светодиода: на пины 11 (Красный), 10 (Желтый), 9 (Зеленый)');
            resetCircuitAnimation();
        }
    }

    // ==================== ЗАДАНИЕ №8 (ФОТОРЕЗИСТОР) ====================
    else if (currentTaskNumber === 8) {
        let hasPhoto5V = false, hasPhotoRes = false, hasResGND = false, hasA1 = false;

        connections.forEach(conn => {
            const s = conn.start, e = conn.end;
            
            // Фоторезистор -> 5V
            if ((s.type === 'фоторезистор' && e.pin === '5V') || (e.type === 'фоторезистор' && s.pin === '5V')) hasPhoto5V = true;
            
            // Фоторезистор -> Резистор
            if ((s.type === 'фоторезистор' && e.type === 'резистор') || (e.type === 'фоторезистор' && s.type === 'резистор')) hasPhotoRes = true;
            
            // Резистор -> GND
            if ((s.type === 'резистор' && e.pin === 'GND') || (e.type === 'резистор' && s.pin === 'GND')) hasResGND = true;

            // Кто-то из них -> A1
            if ((s.type === 'фоторезистор' || s.type === 'резистор') && e.pin === 'A1') hasA1 = true;
            if ((e.type === 'фоторезистор' || e.type === 'резистор') && s.pin === 'A1') hasA1 = true;
        });

        if (hasPhoto5V && hasPhotoRes && hasResGND && hasA1) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Датчик света подключен!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Ошибка. Схема: 5V -> Фото -> Резистор -> GND. Точка соединения -> A1');
            resetCircuitAnimation();
        }
    }

    // ==================== ЗАДАНИЕ №9 (ДАТЧИК ТЕМПЕРАТУРЫ) ====================
    else if (currentTaskNumber === 9) {
        let hasVCC = false, hasOUT = false, hasGND = false;

        connections.forEach(conn => {
            const s = conn.start, e = conn.end;
            const comp = s.type === 'датчик температуры' ? s : (e.type === 'датчик температуры' ? e : null);
            const pin = s.type === 'датчик температуры' ? e.pin : s.pin;

            if (comp) {
                if (comp.contact === 'VCC' && pin === '5V') hasVCC = true;
                if (comp.contact === 'OUT' && pin === 'A2') hasOUT = true;
                if (comp.contact === 'GND' && pin === 'GND') hasGND = true;
            }
        });

        if (hasVCC && hasOUT && hasGND) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Датчик температуры подключен!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Ошибка. Нужно: VCC->5V, OUT->A2, GND->GND');
            resetCircuitAnimation();
        }
    }

    // ==================== ЗАДАНИЕ №10 (УМНЫЙ НОЧНИК) ====================
    else if (currentTaskNumber === 10) {
        // Проверяем наличие схемы фоторезистора на A0 и светодиода на 9
        let hasPhotoCircuit = false, hasLED = false;
        let photoConnectedToA0 = false, ledConnectedTo9 = false;

        connections.forEach(conn => {
            const s = conn.start, e = conn.end;
            
            // Проверка цепи фоторезистора (упрощенно: фото -> A0)
            if ((s.type === 'фоторезистор' && e.pin === 'A0') || (e.type === 'фоторезистор' && s.pin === 'A0')) {
                photoConnectedToA0 = true;
            }
            
            // Проверка светодиода
            if ((s.type === 'LED' && e.pin === '9') || (e.type === 'LED' && s.pin === '9')) {
                ledConnectedTo9 = true;
            }
        });

        if (photoConnectedToA0 && ledConnectedTo9) {
            recordAttempt(currentTaskNumber, true, 'schematic');
            alert('✅ Отлично! Умный ночник работает!');
            activateCircuitAnimation();
        } else {
            recordAttempt(currentTaskNumber, false, 'schematic');
            alert('❌ Ошибка. Нужно: Фоторезистор -> A0, Светодиод -> Пин 9');
            resetCircuitAnimation();
        }
    }
}

// ==================== АНИМАЦИИ ====================

function activateCircuitAnimation() {
    // Подсвечиваем все компоненты
    document.querySelectorAll('.component-wrapper').forEach(wrapper => {
        wrapper.classList.add('circuit-active');
    });
    // Ищем обычные LED и меняем картинку на включенную
    const leds = document.querySelectorAll('.component-item[alt="LED"]');
    leds.forEach(led => {
        led.src = 'assets/LED_2.png';
        if (led.parentNode) {
            led.parentNode.classList.add('led_2');
        }
    });
    // Ищем RGB LED и меняем картинку на включенную
    const rgbLeds = document.querySelectorAll('.component-item[alt="RGB LED"]');
    rgbLeds.forEach(led => {
        led.src = 'assets/rgbled_2.png'; // Включенный RGB LED
        if (led.parentNode) {
            led.parentNode.classList.add('rgb-led-active');
        }
    });
}

function resetCircuitAnimation() {
    // Убираем классы анимации
    document.querySelectorAll('.circuit-active, .led_2').forEach(el => {
        el.classList.remove('circuit-active', 'led_2');
    });
    // Возвращаем обычные картинки LED
    const leds = document.querySelectorAll('.component-item[alt="LED"]');
    leds.forEach(led => {
        led.src = 'assets/led_1.png';
    });
     // Возвращаем обычные картинки RGB LED
    const rgbLeds = document.querySelectorAll('.component-item[alt="RGB LED"]');
    rgbLeds.forEach(led => {
        led.src = 'assets/rgbled.png'; // Выключенный RGB LED
    });
}


// ==================== РЕЖИМ КОДА ====================
function checkCode() {
    const codeInput = document.getElementById('codeInput');
    if (!codeInput) {
        alert('⚠️ Поле ввода кода не найдено!');
        return;
    }

    const userCode = codeInput.value.trim();

    if (userCode.length < 5) {
        alert('⚠️ Код слишком короткий. Проверьте задание.');
        recordAttempt(currentTaskNumber, false, 'code');
        return;
    }

    // Проверка на русские символы
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(userCode);
    if (hasCyrillic) {
        alert('⚠️ В коде обнаружены русские буквы!\n\n🌍 Пожалуйста, переключите раскладку клавиатуры на английский (ENG).\nКод Arduino пишется только латиницей.');
        recordAttempt(currentTaskNumber, false, 'code');
        return; 
    }

    // ==================== СТРОГАЯ ПРОВЕРКА ПО ЗАДАНИЯМ ====================
    let isCorrect = false;
    let errorMsg = '';

    switch (currentTaskNumber) {
        case 1: // int count = 5;
            if (/^\s*int\s+count\s*=\s*5\s*;\s*$/.test(userCode)) {
                isCorrect = true;
            } else {
                errorMsg = 'Напишите: int count = 5;';
            }
            break;

        case 2: // for цикл
            // Проверяем структуру for с int, условием и инкрементом
            if (/for\s*\(\s*int\s+\w+\s*=\s*\d+\s*;\s*\w+\s*<=?\s*\d+\s*;\s*\w+\+\+?\s*\)\s*\{/.test(userCode)) {
                isCorrect = true;
            } else {
                errorMsg = 'Напишите цикл for. Пример: for (int i = 1; i <= 10; i++) { ... }';
            }
            break;

        case 3: // if условие
            if (/if\s*\([^)]+\)\s*\{/.test(userCode)) {
                isCorrect = true;
            } else {
                errorMsg = 'Напишите if (условие) { ... }';
            }
            break;

        case 4: // pinMode(13, OUTPUT)
            if (/pinMode\s*\(\s*13\s*,\s*OUTPUT\s*\)\s*;/.test(userCode)) {
                isCorrect = true;
            } else {
                errorMsg = 'Напишите: pinMode(13, OUTPUT);';
            }
            break;

        case 5: // digitalWrite(13, HIGH)
            if (/digitalWrite\s*\(\s*13\s*,\s*HIGH\s*\)\s*;/.test(userCode)) {
                isCorrect = true;
            } else {
                errorMsg = 'Напишите: digitalWrite(13, HIGH);';
            }
            break;

        case 6: // analogWrite(9, 128)
            if (/analogWrite\s*\(\s*9\s*,\s*128\s*\)\s*;/.test(userCode)) {
                isCorrect = true;
            } else {
                errorMsg = 'Напишите: analogWrite(9, 128);';
            }
            break;

        case 7: // analogRead(A0)
            if (/analogRead\s*\(\s*A0\s*\)/.test(userCode) && 
                /\b(int|float|double)\s+\w+\s*=\s*analogRead\s*\(\s*A0\s*\)/.test(userCode)) {
                isCorrect = true;
            } else {
                errorMsg = 'Считайте значение: int sensorValue = analogRead(A0);';
            }
            break;

        case 8: // Servo библиотека
            const hasInclude = /#\s*include\s*<Servo\.h>/.test(userCode);
            const hasServoObj = /Servo\s+\w+/.test(userCode);
            const hasAttach = /\.attach\s*\(\s*3\s*\)/.test(userCode);
            const hasWrite = /\.write\s*\(\s*90\s*\)/.test(userCode);
            
            if (hasInclude && hasServoObj && hasAttach && hasWrite) {
                isCorrect = true;
            } else {
                errorMsg = 'Добавьте библиотеку, создайте объект Servo, вызовите attach(3) и write(90)';
            }
            break;

        case 9: // if-else
            const hasIf = /if\s*\([^)]+\)\s*\{/.test(userCode);
            const hasElse = /\}\s*else\s*\{/.test(userCode);
            const hasDigitalWrite = /digitalWrite\s*\(\s*13\s*,\s*(HIGH|LOW)\s*\)/.test(userCode);
            
            if (hasIf && hasElse && hasDigitalWrite) {
                isCorrect = true;
            } else {
                errorMsg = 'Напишите if-else с digitalWrite(13, HIGH/LOW)';
            }
            break;

        case 10: // Комплексное
            const hasAnalogRead = /analogRead\s*\(\s*A0\s*\)/.test(userCode);
            const hasIf300 = /if\s*\([^)]*>\s*300/.test(userCode);
            const hasAnalogWrite255 = /analogWrite\s*\(\s*9\s*,\s*255\s*\)/.test(userCode);
            const hasAnalogWrite0 = /analogWrite\s*\(\s*9\s*,\s*0\s*\)/.test(userCode);
            
            if (hasAnalogRead && hasIf300 && hasAnalogWrite255 && hasAnalogWrite0) {
                isCorrect = true;
            } else {
                errorMsg = 'Считайте A0, проверьте > 300, установите analogWrite(9, 255 или 0)';
            }
            break;

        default:
            // Для неизвестных заданий - простая проверка по ключевым словам
            const task = codeTasks.find(t => t.number === currentTaskNumber);
            if (task) {
                const missing = task.keywords.filter(kw => !userCode.includes(kw));
                if (missing.length === 0) isCorrect = true;
                else errorMsg = `Не хватает: ${missing.join(', ')}`;
            }
    }

    // ==================== РЕЗУЛЬТАТ ПРОВЕРКИ ====================
    if (isCorrect) {
        recordAttempt(currentTaskNumber, true, 'code');
        alert('✅ Отлично! Код верный!');
    } else {
        recordAttempt(currentTaskNumber, false, 'code');
        alert('❌ Ошибка!\n\n' + errorMsg);
    }
}
function showHint() {
    if (isCodeMode) {
        alert('💡 Подсказка: Используйте digitalWrite(pin, HIGH)');
    } else {
        alert('💡 Подсказка: Ток идет от плюса к минусу');
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', () => {
    
    // =================================================================
    // 1. ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ (Работают везде, где есть эти элементы)
    // =================================================================
    
    // --- Кнопка "Проверить" ---
    const checkBtn = document.getElementById('checkBtn');
    if (checkBtn) {
        checkBtn.addEventListener('click', checkCircuit);
    }
    
    // --- Кнопка "Удалить" ---
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteModeActive = !deleteModeActive;
            alert(deleteModeActive ? '🔴 Режим удаления включен' : '⚪ Режим удаления выключен');
        });
    }
    
    // --- Кнопка "Статистика" ---
    const statsBtn = document.querySelector('.btn-statistics');
    if (statsBtn) {
        statsBtn.addEventListener('click', openStats);
    }
    
        // --- Кнопка "Помощь" (Открыть) ---
    const helpBtn = document.querySelector('.btn-help');
    if (helpBtn) {
        helpBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Предотвращаем стандартное поведение
            showHelp();
        });
    }
    
    // --- Кнопка закрытия (Крестик) ---
    const helpClose = document.querySelector('.help-close');
    if (helpClose) {
        helpClose.addEventListener('click', closeHelp);
    }
    
    // --- Кнопка "Понятно" ---
    const helpCloseBtn = document.querySelector('.btn-help-close');
    if (helpCloseBtn) {
        helpCloseBtn.addEventListener('click', closeHelp);
    }
    
    // --- Закрытие по клику на темный фон ---
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                closeHelp();
            }
        });
    }
    
    // --- Задания (Красная линия) ---
    document.querySelectorAll('#redLine span').forEach(span => {
        span.addEventListener('click', (e) => {
            const number = parseInt(e.target.textContent);
            resetCircuitAnimation();
            
            if (isCodeMode) {
                showCodeTask(number);
            } else {
                showTask(number);
            }
        });
    });
    
    // --- Пины Arduino ---
    document.querySelectorAll('.pin-point').forEach(pin => {
        pin.addEventListener('click', handleConnectionClick);
    });
    
    // --- Рабочая область (перетаскивание и удаление) ---
    const workspace = document.getElementById('workspace');
    if (workspace) {
        // Обработка кликов по контактам компонентов
        workspace.addEventListener('click', (e) => {
            if (e.target.classList.contains('component-contact')) {
                handleConnectionClick.call(e.target, e);
            }
        });
        
        // Обработка удаления в режиме Delete
        workspace.addEventListener('click', (e) => {
            if (!deleteModeActive) return;
            
            // Игнорируем клики по интерфейсу
            if (e.target.closest('.btn-footer') || 
                e.target.closest('.components-panel') ||
                e.target.closest('.task-panel') ||
                e.target.closest('.sidebar')) {
                return;
            }
            
            const wire = e.target.closest('.wire');
            if (wire) {
                if (confirm('Удалить провод?')) deleteWire(wire);
                return;
            }
            
            const component = e.target.closest('.component-wrapper');
            if (component) {
                if (confirm('Удалить компонент?')) deleteComponent(component);
                return;
            }
        });
    }
    
    // =================================================================
    // 2. ПРОВЕРКА АВТОРИЗАЦИИ И МАРШРУТИЗАЦИЯ
    // =================================================================
    
    const user = checkAuth(); // Проверка сессии
    
    // Если мы на странице входа (index.html) — останавливаемся здесь.
    // Дальнейший код для дашборда не выполнится.
    if (window.location.pathname.includes('index.html') || window.location.href.endsWith('index.html')) {
        console.log('🏠 Загружена страница входа');
        return; 
    }
    
    // Если мы на дашборде, но пользователь НЕ авторизован — checkAuth() сам сделает редирект.
    // Но на всякий случай проверяем:
    if (!user) {
        console.log('⚠️ Пользователь не авторизован');
        return;
    }
    
    // =================================================================
    // 3. ИНИЦИАЛИЗАЦИЯ ЛИЧНОГО КАБИНЕТА (Только для авторизованных)
    // =================================================================
    
    console.log('✅ Добро пожаловать, ' + user.username);
    
    // Отображение имени
    const nameDisplay = document.getElementById('usernameDisplay');
    if (nameDisplay) nameDisplay.textContent = `👤 ${user.username}`;
    
    // Загрузка статистики
    loadUserStats(user.username);
    initStats(); // Инициализация модуля статистики
    
    // Защита от повторной инициализации
    if (scriptInitialized) return;
    scriptInitialized = true;
    
    // Здесь можно добавить остальную инициализацию, специфичную для дашборда
    // ...
});



// База подсказок для каждого задания
const taskHints = {
    1: {
        title: "Задание №1: Объявление переменной",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Объявите целочисленную переменную с именем <code>count</code> и присвойте ей значение <code>5</code>.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>int count = 5;</pre>
            
            <p><strong>Объяснение:</strong></p>
            <ul>
                <li><code>int</code> - тип данных (целое число)</li>
                <li><code>count</code> - имя переменной</li>
                <li><code>=</code> - оператор присваивания</li>
                <li><code>5</code> - значение</li>
                <li><code>;</code> - точка с запятой (обязательна!)</li>
            </ul>
        `
    },
    2: {
        title: "Задание №2: Цикл for",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Напишите цикл <code>for</code> для вывода чисел от 1 до 10.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>for (int i = 1; i <= 10; i++) {
  Serial.println(i);
}</pre>
            
            <p><strong>Структура цикла for:</strong></p>
            <ul>
                <li><code>int i = 1</code> - инициализация счетчика</li>
                <li><code>i <= 10</code> - условие продолжения</li>
                <li><code>i++</code> - увеличение счетчика</li>
            </ul>
        `
    },
    3: {
        title: "Задание №3: Условный оператор",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Напишите <code>if</code> для проверки, больше ли <code>x</code> нуля.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>if (x > 0) {
  // код выполняется, если x больше 0
}</pre>
            
            <p><strong>Операторы сравнения:</strong></p>
            <ul>
                <li><code>></code> - больше</li>
                <li><code><</code> - меньше</li>
                <li><code>>=</code> - больше или равно</li>
                <li><code><=</code> - меньше или равно</li>
                <li><code>==</code> - равно</li>
            </ul>
        `
    },
    4: {
        title: "Задание №4: Функция setup()",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Инициализируйте пин 13 как выходной в функции <code>setup()</code>.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>void setup() {
  pinMode(13, OUTPUT);
}</pre>
            
            <p><strong>Пояснение:</strong></p>
            <ul>
                <li><code>void setup()</code> - функция, которая выполняется один раз при запуске</li>
                <li><code>pinMode(13, OUTPUT)</code> - устанавливает пин 13 как выход</li>
                <li><code>OUTPUT</code> - константа для выходного режима</li>
            </ul>
        `
    },
    5: {
        title: "Задание №5: Функция loop()",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Включите светодиод на пине 13 в функции <code>loop()</code>.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
}</pre>
            
            <p><strong>Команды:</strong></p>
            <ul>
                <li><code>digitalWrite(13, HIGH)</code> - подает 5V на пин 13 (включает LED)</li>
                <li><code>delay(1000)</code> - пауза 1000 мс (1 секунда)</li>
                <li><code>LOW</code> - 0V (выключить)</li>
            </ul>
        `
    },
    6: {
        title: "Задание №6: Широтно-импульсная модуляция (PWM)",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Используйте <code>analogWrite()</code> для управления яркостью светодиода на пине 9. Значение должно быть 128.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>void setup() {
  analogWrite(9, 128);
}</pre>
            
            <p><strong>PWM пины:</strong> 3, 5, 6, 9, 10, 11</p>
            <p><strong>Значения:</strong> от 0 (выкл) до 255 (максимум)</p>
        `
    },
    7: {
        title: "Задание №7: Чтение аналогового входа",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Считайте значение с аналогового пина A0 и сохраните в переменную <code>sensorValue</code>.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>int sensorValue;

void setup() {
  Serial.begin(9600);
}

void loop() {
  sensorValue = analogRead(A0);
}</pre>
            
            <p><strong>Аналоговые пины:</strong> A0, A1, A2, A3, A4, A5</p>
            <p><strong>Возвращаемое значение:</strong> 0-1023</p>
        `
    },
    8: {
        title: "Задание №8: Управление сервоприводом",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Подключите библиотеку Servo и установите угол 90 градусов на пине 3.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>#include <Servo.h>

Servo myServo;

void setup() {
  myServo.attach(3);
  myServo.write(90);
}</pre>
            
            <p><strong>Углы:</strong> от 0 до 180 градусов</p>
        `
    },
    9: {
        title: "Задание №9: Условный оператор if-else",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Если <code>sensorValue</code> больше 500, включите светодиод на пине 13, иначе выключите.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>if (sensorValue > 500) {
  digitalWrite(13, HIGH);
} else {
  digitalWrite(13, LOW);
}</pre>
            
            <p><strong>Структура:</strong></p>
            <ul>
                <li><code>if (условие)</code> - если условие истинно</li>
                <li><code>else</code> - иначе (если ложно)</li>
            </ul>
        `
    },
    10: {
        title: "Задание №10: Комплексное задание",
        content: `
            <p><strong>Что нужно сделать:</strong></p>
            <p>Считайте значение с A0, если оно больше 300, установите яркость на пине 9 в 255, иначе 0.</p>
            
            <p><strong>Пример кода:</strong></p>
            <pre>int sensorValue;

void setup() {
  Serial.begin(9600);
}

void loop() {
  sensorValue = analogRead(A0);
  
  if (sensorValue > 300) {
    analogWrite(9, 255);
  } else {
    analogWrite(9, 0);
  }
  
  delay(100);
}</pre>
        `
    }
};


// База подсказок для РЕЖИМА СХЕМ
const schematicHints = {
    1: {
        title: "Задание №1: Мигающий светодиод (Схема)",
        content: `
            <p><strong>Как собрать цепь:</strong></p>
            <ul>
                <li>Соедините <strong>Пин 13</strong> на Arduino с <strong>Анодом (+)</strong> светодиода (длинная ножка).</li>
                <li>Соедините <strong>Катод (-)</strong> светодиода (короткая ножка) с одним контактом <strong>Резистора</strong>.</li>
                <li>Второй контакт <strong>Резистора</strong> соедините с <strong>GND</strong> (Земля) на Arduino.</li>
            </ul>
            <p><strong>⚠️ Важно:</strong> Без резистора светодиод сгорит!</p>
        `
    },
    2: {
    title: "Задание №2: RGB светодиод",
    content: `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <h4 style="color: #007bff; margin-bottom: 12px; border-bottom: 2px solid #007bff; padding-bottom: 8px;">
                🌈 Подключение RGB LED
            </h4>
            
            <div style="margin-bottom: 15px;">
                <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 Общий вывод (Common):</strong>
                <div style="background: white; padding: 10px; border-left: 4px solid #6c757d; border-radius: 4px;">
                    Common (2-й контакт слева) → <strong>GND</strong> (Arduino)
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">🔴 Красный канал (R):</strong>
                <div style="background: white; padding: 10px; border-left: 4px solid #dc3545; border-radius: 4px;">
                    R (1-й слева) → <strong>Резистор 220 Ом</strong> → <strong>Пин 9</strong>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">🟢 Зелёный канал (G):</strong>
                <div style="background: white; padding: 10px; border-left: 4px solid #28a745; border-radius: 4px;">
                    G (3-й слева) → <strong>Резистор 220 Ом</strong> → <strong>Пин 10</strong>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">🔵 Синий канал (B):</strong>
                <div style="background: white; padding: 10px; border-left: 4px solid #0d6efd; border-radius: 4px;">
                    B (4-й слева) → <strong>Резистор 220 Ом</strong> → <strong>Пин 11</strong>
                </div>
            </div>
        </div>
        
        <div style="background: #fff3cd; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <strong>⚠️ Важно:</strong>
            <ul style="margin: 8px 0 0 20px; padding: 0;">
                <li>Используйте резисторы 220-330 Ом для каждого канала</li>
                <li>Common — это второй контакт слева (белый маркер)</li>
                <li>Без резисторов светодиод может сгореть!</li>
                <li>RGB LED имеет 4 вывода</li>
            </ul>
        </div>
    `
},
    3: {
        title: "Задание №3: Потенциометр (регулятор)",
        content: `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="color: #007bff; margin-bottom: 12px;">🎚️ Подключение потенциометра</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 Схема:</strong>
                    <div style="background: white; padding: 10px; border-left: 4px solid #28a745; border-radius: 4px; margin-bottom: 10px;">
                        • Левый контакт → <strong>5V</strong><br>
                        • Правый контакт → <strong>GND</strong><br>
                        • Средний контакт → <strong>Аналоговый пин A0</strong>
                    </div>
                </div>
                
                <div style="background: #e7f3ff; padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">
                    <strong>💡 Как работает:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px;">
                        Потенциометр делит напряжение. При повороте ручки значение на пине A0 меняется от 0 до 1023.
                    </p>
                </div>
            </div>
        `
    },
    
    4: {
        title: "Задание №4: Сервопривод",
        content: `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="color: #007bff; margin-bottom: 12px;">🔄 Подключение сервопривода</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 По цветам проводов:</strong>
                    <div style="background: white; padding: 10px; border-left: 4px solid #dc3545; border-radius: 4px; margin-bottom: 10px;">
                        • Красный провод → <strong>5V</strong><br>
                        • Коричневый/Черный провод → <strong>GND</strong><br>
                        • Оранжевый/Желтый провод → <strong>Пин 9</strong> (PWM)
                    </div>
                </div>
                
                <div style="background: #fff3cd; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <strong>⚠️ Важно:</strong>
                    <ul style="margin: 8px 0 0 20px; font-size: 14px;">
                        <li>Серво потребляет большой ток</li>
                        <li>Используйте PWM пины: 3, 5, 6, 9, 10, 11</li>
                        <li>Угол поворота: от 0° до 180°</li>
                    </ul>
                </div>
            </div>
        `
    },
    
    5: {
        title: "Задание №5: Кнопка с подтяжкой",
        content: `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="color: #007bff; margin-bottom: 12px;">🔘 Подключение кнопки</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 Схема с подтяжкой к GND:</strong>
                    <div style="background: white; padding: 10px; border-left: 4px solid #28a745; border-radius: 4px; margin-bottom: 10px;">
                        • Контакт 1 (верхний левый) → <strong>5V</strong><br>
                        • Контакт 2 (верхний правый) → <strong>Пин 2</strong><br>
                        • Контакт 2 → <strong>Резистор 10кОм</strong> → <strong>GND</strong>
                    </div>
                </div>
                
                <div style="background: #e7f3ff; padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">
                    <strong>💡 Как работает:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px;">
                        Без нажатия: пин 2 читает LOW (через резистор).<br>
                        При нажатии: пин 2 читает HIGH (соединение с 5V).
                    </p>
                </div>
            </div>
        `
    },
    
    6: {
        title: "Задание №6: Пьезоэлемент (зуммер)",
        content: `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="color: #007bff; margin-bottom: 12px;">🔊 Подключение пьезоэлемента</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 Схема:</strong>
                    <div style="background: white; padding: 10px; border-left: 4px solid #ffc107; border-radius: 4px; margin-bottom: 10px;">
                        • Положительный контакт (+) → <strong>Пин 8</strong><br>
                        • Отрицательный контакт (-) → <strong>GND</strong>
                    </div>
                </div>
                
                <div style="background: #e7f3ff; padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">
                    <strong>💡 Примечание:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px;">
                        Используйте PWM пины для генерации звука разной частоты.<br>
                        Функция <code>tone(pin, frequency)</code> создает звук.
                    </p>
                </div>
            </div>
        `
    },
    
    7: {
        title: "Задание №7: Светофор (3 LED)",
        content: `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="color: #007bff; margin-bottom: 12px;">🚦 Сборка светофора</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 Подключение светодиодов:</strong>
                    <div style="background: white; padding: 10px; border-left: 4px solid #dc3545; border-radius: 4px; margin-bottom: 10px;">
                        • <strong>Красный LED</strong>: Анод → Резистор → <strong>Пин 11</strong><br>
                        &nbsp;&nbsp;Катод → <strong>GND</strong>
                    </div>
                    <div style="background: white; padding: 10px; border-left: 4px solid #ffc107; border-radius: 4px; margin-bottom: 10px;">
                        • <strong>Желтый LED</strong>: Анод → Резистор → <strong>Пин 10</strong><br>
                        &nbsp;&nbsp;Катод → <strong>GND</strong>
                    </div>
                    <div style="background: white; padding: 10px; border-left: 4px solid #28a745; border-radius: 4px;">
                        • <strong>Зеленый LED</strong>: Анод → Резистор → <strong>Пин 9</strong><br>
                        &nbsp;&nbsp;Катод → <strong>GND</strong>
                    </div>
                </div>
                
                <div style="background: #fff3cd; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <strong>⚠️ Важно:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px;">
                        Каждый светодиод требует свой резистор (220-330 Ом)!
                    </p>
                </div>
            </div>
        `
    },
    
    8: {
        title: "Задание №8: Фоторезистор",
        content: `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="color: #007bff; margin-bottom: 12px;">☀️ Подключение фоторезистора</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 Делитель напряжения:</strong>
                    <div style="background: white; padding: 10px; border-left: 4px solid #28a745; border-radius: 4px; margin-bottom: 10px;">
                        • Фоторезистор → <strong>5V</strong><br>
                        • Фоторезистор → <strong>Резистор 10кОм</strong> → <strong>GND</strong><br>
                        • Точка соединения → <strong>Аналоговый пин A1</strong>
                    </div>
                </div>
                
                <div style="background: #e7f3ff; padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">
                    <strong>💡 Как работает:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px;">
                        На свету сопротивление падает → значение растет.<br>
                        В темноте сопротивление растет → значение падает.
                    </p>
                </div>
            </div>
        `
    },
    
    9: {
        title: "Задание №9: Датчик температуры TMP36",
        content: `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="color: #007bff; margin-bottom: 12px;">🌡️ Подключение TMP36</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 По выводам (плоской стороной к себе):</strong>
                    <div style="background: white; padding: 10px; border-left: 4px solid #dc3545; border-radius: 4px; margin-bottom: 10px;">
                        • Левый вывод → <strong>5V</strong><br>
                        • Средний вывод → <strong>Аналоговый пин A2</strong><br>
                        • Правый вывод → <strong>GND</strong>
                    </div>
                </div>
                
                <div style="background: #fff3cd; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <strong>⚠️ Важно:</strong>
                    <ul style="margin: 8px 0 0 20px; font-size: 14px;">
                        <li>Не перепутайте выводы!</li>
                        <li>Напряжение 0.5V = 0°C</li>
                        <li>Каждые 10mV = +1°C</li>
                    </ul>
                </div>
            </div>
        `
    },
    
    10: {
        title: "Задание №10: Умный ночник",
        content: `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                <h4 style="color: #007bff; margin-bottom: 12px;">💡 Комплексная схема</h4>
                
                <div style="margin-bottom: 15px;">
                    <strong style="color: #2c3e50; display: block; margin-bottom: 8px;">📍 Компоненты:</strong>
                    <div style="background: white; padding: 10px; border-left: 4px solid #28a745; border-radius: 4px; margin-bottom: 10px;">
                        <strong>Фоторезистор:</strong><br>
                        • Фоторезистор + Резистор 10кОм → <strong>A0</strong><br><br>
                        
                        <strong>Светодиод:</strong><br>
                        • LED Анод → Резистор 220 Ом → <strong>Пин 9</strong> (PWM)<br>
                        • LED Катод → <strong>GND</strong>
                    </div>
                </div>
                
                <div style="background: #e7f3ff; padding: 12px; border-radius: 8px; border-left: 4px solid #007bff;">
                    <strong>💡 Задача:</strong>
                    <p style="margin: 8px 0 0 0; font-size: 14px;">
                        Когда темно (значение с A0 < 300), светодиод автоматически включается с плавной яркостью.
                    </p>
                </div>
            </div>
        `
    }
};



// Обработка кнопки подсказки
function showHelp() {
    const modal = document.getElementById('helpModal');
    const helpContent = document.getElementById('helpContent');
    
    if (!modal || !helpContent) {
        alert('⚠️ Элементы подсказки не найдены в HTML!');
        return;
    }

    // 1. ПРОВЕРКА: Выбрано ли задание?
    if (!currentTaskNumber || currentTaskNumber === 0) {
        helpContent.innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 40px; margin-bottom: 15px;">🔢</div>
                <h3 style="margin-bottom: 10px; color: #333;">Задание не выбрано</h3>
                <p style="color: #666; font-size: 16px;">
                    Пожалуйста, выберите <strong>номер задания</strong> в красной линии сверху,<br>
                    чтобы получить подсказку.
                </p>
            </div>
        `;
        modal.classList.add('active');
        return;
    }

    // 2. ОПРЕДЕЛЕНИЕ РЕЖИМА через глобальную переменную isCodeMode
    let helpData = null;

    if (isCodeMode) {
        // РЕЖИМ КОДА - используем taskHints
        helpData = taskHints[currentTaskNumber];
    } else {
        // РЕЖИМ СХЕМ - используем schematicHints
        helpData = schematicHints[currentTaskNumber];
    }

    // 3. ВЫВОД ПОДСКАЗКИ
    if (helpData) {
        helpContent.innerHTML = `
            <h3 style="margin-bottom: 15px; color: #2c3e50;">💡 ${helpData.title}</h3>
            <div style="line-height: 1.6; color: #34495e;">
                ${helpData.content}
            </div>
        `;
    } else {
        helpContent.innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 40px; margin-bottom: 15px;">📝</div>
                <h3 style="margin-bottom: 10px; color: #333;">Подсказка не найдена</h3>
                <p style="color: #666;">
                    Для задания №${currentTaskNumber} подсказка еще не добавлена.<br>
                    Попробуйте собрать схему самостоятельно или обратитесь к учебным материалам.
                </p>
            </div>
        `;
    }
    
    modal.classList.add('active');
}

// Закрытие модального окна
function closeHelp() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.classList.remove('active');
    }
}



// Закрытие по клавише Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeHelp();
    }
});


// ==================== ОБРАБОТКА ВХОДА (для index.html) ====================
function handleLogin(e) {
    e.preventDefault();
    const login = document.getElementById('login')?.value;
    const pass = document.getElementById('password')?.value;
    
    if (!login || !pass || pass.length < 3) {
        alert('⚠️ Введите логин и пароль (мин. 3 символа)');
        return false;
    }
    
    if (loginUser(login, pass)) {
        window.location.href = 'dashboard.html';
    }
    return false;
}



