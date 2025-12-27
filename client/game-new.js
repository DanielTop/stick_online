// ============================================
// STICK MMO - Open World Multiplayer Game
// ============================================

// Game Configuration
const CONFIG = {
    WORLD_WIDTH: 10000,
    WORLD_HEIGHT: 10000,
    CANVAS_WIDTH: window.innerWidth,
    CANVAS_HEIGHT: window.innerHeight,
    ZONES: 15,
    BOSSES_PER_ZONE: 1,
    BASE_PLAYER_SPEED: 5,
    TILE_SIZE: 100,
    MAX_LEVEL: 10,
    MAX_PLAYERS: 50
};

// Game State
const GAME = {
    device: null,
    power: null,
    username: null,
    nickname: null,
    isGuest: false,
    serverId: null,
    socket: null,
    canvas: null,
    ctx: null,
    player: null,
    camera: null,
    keys: {},
    mouse: { x: 0, y: 0 },
    joystick: { active: false, x: 0, y: 0 },
    otherPlayers: new Map(),
    enemies: new Map(),
    bosses: new Map(),
    projectiles: [],
    particles: [],
    damageTexts: [],
    world: null,
    lastUpdate: Date.now(),
    gameLoop: null,
    friends: [],
    servers: []
};

// ============================================
// ACCOUNT SYSTEM
// ============================================

class AccountSystem {
    constructor() {
        this.accounts = this.loadAccounts();
    }

    loadAccounts() {
        const saved = localStorage.getItem('stick_mmo_accounts');
        return saved ? JSON.parse(saved) : {};
    }

    saveAccounts() {
        localStorage.setItem('stick_mmo_accounts', JSON.stringify(this.accounts));
    }

    register(username, password) {
        if (!username || username.length < 3) {
            return { success: false, error: 'Имя должно быть минимум 3 символа' };
        }
        if (!password || password.length < 4) {
            return { success: false, error: 'Пароль должен быть минимум 4 символа' };
        }
        if (this.accounts[username]) {
            return { success: false, error: 'Это имя уже занято' };
        }

        this.accounts[username] = {
            password: password, // В реальной игре нужно хэшировать!
            createdAt: Date.now(),
            level: 1,
            exp: 0,
            wins: 0,
            losses: 0
        };
        this.saveAccounts();

        return { success: true, username };
    }

    login(username, password) {
        const account = this.accounts[username];
        if (!account) {
            return { success: false, error: 'Аккаунт не найден' };
        }
        if (account.password !== password) {
            return { success: false, error: 'Неверный пароль' };
        }

        return {
            success: true,
            username,
            data: account
        };
    }

    updateStats(username, stats) {
        if (this.accounts[username]) {
            Object.assign(this.accounts[username], stats);
            this.saveAccounts();
        }
    }
}

const accountSystem = new AccountSystem();

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('load', () => {
    initLoginScreen();
    initScreens();
});

function initLoginScreen() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active tab content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tab + '-tab').classList.add('active');
        });
    });

    // Login
    document.getElementById('login-btn').addEventListener('click', () => {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        const result = accountSystem.login(username, password);
        if (result.success) {
            GAME.username = result.username;
            GAME.nickname = result.username;
            GAME.isGuest = false;
            errorEl.textContent = '';
            showScreen('server-selection');
            loadServerList();
        } else {
            errorEl.textContent = result.error;
        }
    });

    // Register
    document.getElementById('register-btn').addEventListener('click', () => {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;
        const errorEl = document.getElementById('register-error');

        if (password !== passwordConfirm) {
            errorEl.textContent = 'Пароли не совпадают';
            return;
        }

        const result = accountSystem.register(username, password);
        if (result.success) {
            GAME.username = result.username;
            GAME.nickname = result.username;
            GAME.isGuest = false;
            errorEl.textContent = '';
            showScreen('server-selection');
            loadServerList();
        } else {
            errorEl.textContent = result.error;
        }
    });

    // Guest
    document.getElementById('guest-btn').addEventListener('click', () => {
        const nickname = document.getElementById('guest-nickname').value.trim();
        const errorEl = document.getElementById('guest-error');

        if (!nickname || nickname.length < 2) {
            errorEl.textContent = 'Ник должен быть минимум 2 символа';
            return;
        }

        GAME.username = 'guest_' + Date.now();
        GAME.nickname = nickname;
        GAME.isGuest = true;
        errorEl.textContent = '';
        showScreen('server-selection');
        loadServerList();
    });

    // Quick Start - автоматический вход как гость "4545 admin"
    document.getElementById('quick-start-btn').addEventListener('click', () => {
        GAME.username = 'guest_' + Date.now();
        GAME.nickname = '4545 admin';
        GAME.isGuest = true;
        GAME.device = 'pc'; // Автоматически выбираем ПК
        GAME.power = 'fire'; // Автоматически выбираем Огонь

        // Пропускаем все экраны и сразу начинаем игру
        startGame();
    });

    // Enter key support
    ['login-username', 'login-password'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('login-btn').click();
        });
    });

    ['register-username', 'register-password', 'register-password-confirm'].forEach(id => {
        document.getElementById(id).addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('register-btn').click();
        });
    });

    document.getElementById('guest-nickname').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') document.getElementById('guest-btn').click();
    });
}

function loadServerList() {
    // Mock server list - in production this would come from the server
    GAME.servers = [
        { id: 'server-1', name: 'Основной сервер', players: 12, capacity: 50, owner: 'Admin' },
        { id: 'server-2', name: 'PvP Арена', players: 8, capacity: 25, owner: 'Warrior123' },
        { id: 'server-3', name: 'Новички', players: 15, capacity: 50, owner: 'Helper' }
    ];

    renderServerList();
    initServerScreenButtons();

    // Connect to socket early to see players
    if (!GAME.socket) {
        initSocketEarly();
    }
}

function renderServerList() {
    const serverList = document.getElementById('server-list');
    serverList.innerHTML = '';

    // Load friends for this session
    if (!GAME.isGuest) {
        const saved = localStorage.getItem(`stick_mmo_friends_${GAME.username}`);
        GAME.friends = saved ? JSON.parse(saved) : [];
    }

    if (GAME.servers.length === 0) {
        serverList.innerHTML = '<div style="color: #aaa; text-align: center; padding: 40px;">Нет доступных серверов. Создайте свой!</div>';
        return;
    }

    GAME.servers.forEach(server => {
        // Check if server owner is a friend
        const isFriendServer = GAME.friends.some(f => f.nickname === server.owner);

        const serverItem = document.createElement('div');
        serverItem.className = 'server-item';
        serverItem.innerHTML = `
            <h3>
                ${isFriendServer ? '⭐ ' : ''}${server.name}
                ${isFriendServer ? ' <span style="color: #f39c12; font-size: 0.8em;">(Друг)</span>' : ''}
            </h3>
            <div class="server-info">Создатель: ${server.owner}</div>
            <div class="server-info server-players">Игроки: ${server.players}/${server.capacity}</div>
        `;

        if (isFriendServer) {
            serverItem.style.borderColor = '#f39c12';
            serverItem.style.background = 'rgba(243, 156, 18, 0.1)';
        }

        serverItem.addEventListener('click', () => {
            if (server.players < server.capacity) {
                joinServer(server.id);
            } else {
                alert('Сервер полон!');
            }
        });

        serverList.appendChild(serverItem);
    });
}

function joinServer(serverId) {
    GAME.serverId = serverId;
    showScreen('device-selection');
}

// Server creation
document.addEventListener('DOMContentLoaded', () => {
    const createServerBtn = document.getElementById('create-server-btn');
    if (createServerBtn) {
        createServerBtn.addEventListener('click', () => {
            const serverName = document.getElementById('server-name-input').value.trim();
            const capacity = parseInt(document.getElementById('server-capacity').value);

            if (!serverName || serverName.length < 3) {
                alert('Название сервера должно быть минимум 3 символа');
                return;
            }

            createServer(serverName, capacity);
        });
    }
});

function createServer(name, capacity) {
    const newServer = {
        id: 'server-' + Date.now(),
        name: name,
        players: 0,
        capacity: capacity,
        owner: GAME.nickname
    };

    GAME.servers.push(newServer);
    renderServerList();

    // Auto-join the created server
    joinServer(newServer.id);

    // Clear input
    document.getElementById('server-name-input').value = '';
}

function initServerScreenButtons() {
    // Load friends for both guests and accounts
    const storageKey = GAME.isGuest ? `stick_mmo_friends_guest_${GAME.username}` : `stick_mmo_friends_${GAME.username}`;
    const saved = localStorage.getItem(storageKey);
    GAME.friends = saved ? JSON.parse(saved) : [];
    console.log('Friends loaded:', GAME.friends);

    // Toggle player list
    document.getElementById('toggle-player-list-server').addEventListener('click', () => {
        const panel = document.getElementById('player-list-panel-server');
        const btn = document.getElementById('toggle-player-list-server');
        panel.classList.toggle('open');
        btn.classList.toggle('active');

        if (panel.classList.contains('open')) {
            updatePlayerListServer();
            document.getElementById('friends-panel-server').classList.remove('open');
            document.getElementById('toggle-friends-server').classList.remove('active');
            document.getElementById('shop-panel-server').classList.remove('open');
            document.getElementById('toggle-shop-server').classList.remove('active');
        }
    });

    // Toggle friends list
    document.getElementById('toggle-friends-server').addEventListener('click', () => {
        const panel = document.getElementById('friends-panel-server');
        const btn = document.getElementById('toggle-friends-server');
        panel.classList.toggle('open');
        btn.classList.toggle('active');

        if (panel.classList.contains('open')) {
            updateFriendsListServer();
            document.getElementById('player-list-panel-server').classList.remove('open');
            document.getElementById('toggle-player-list-server').classList.remove('active');
            document.getElementById('shop-panel-server').classList.remove('open');
            document.getElementById('toggle-shop-server').classList.remove('active');
        }
    });

    // Toggle shop
    document.getElementById('toggle-shop-server').addEventListener('click', () => {
        const panel = document.getElementById('shop-panel-server');
        const btn = document.getElementById('toggle-shop-server');
        panel.classList.toggle('open');
        btn.classList.toggle('active');

        if (panel.classList.contains('open')) {
            document.getElementById('player-list-panel-server').classList.remove('open');
            document.getElementById('toggle-player-list-server').classList.remove('active');
            document.getElementById('friends-panel-server').classList.remove('open');
            document.getElementById('toggle-friends-server').classList.remove('active');
        }
    });

    // Close buttons
    document.getElementById('close-player-list-server').addEventListener('click', () => {
        document.getElementById('player-list-panel-server').classList.remove('open');
        document.getElementById('toggle-player-list-server').classList.remove('active');
    });

    document.getElementById('close-friends-server').addEventListener('click', () => {
        document.getElementById('friends-panel-server').classList.remove('open');
        document.getElementById('toggle-friends-server').classList.remove('active');
    });

    document.getElementById('close-shop-server').addEventListener('click', () => {
        document.getElementById('shop-panel-server').classList.remove('open');
        document.getElementById('toggle-shop-server').classList.remove('active');
    });
}

function initSocketEarly() {
    // Connect to socket to see online players
    GAME.socket = io();

    GAME.socket.on('connect', () => {
        console.log('Connected to server early');

        // Send temporary player info to see other players
        GAME.socket.emit('player-join', {
            x: 5000,
            y: 5000,
            power: 'fire',
            level: 1,
            nickname: GAME.nickname || 'Гость'
        });
    });

    GAME.socket.on('players', (players) => {
        GAME.otherPlayers.clear();
        Object.entries(players).forEach(([id, data]) => {
            if (id !== GAME.socket.id && data.nickname) {
                const player = {
                    id: id,
                    nickname: data.nickname,
                    level: data.level || 1
                };
                GAME.otherPlayers.set(id, player);
            }
        });

        // Auto-update lists if open
        const playerListPanel = document.getElementById('player-list-panel-server');
        if (playerListPanel && playerListPanel.classList.contains('open')) {
            updatePlayerListServer();
        }

        const friendsPanel = document.getElementById('friends-panel-server');
        if (friendsPanel && friendsPanel.classList.contains('open')) {
            updateFriendsListServer();
        }
    });

    GAME.socket.on('player-joined', (data) => {
        if (data.id !== GAME.socket.id && data.nickname) {
            GAME.otherPlayers.set(data.id, {
                id: data.id,
                nickname: data.nickname,
                level: data.level || 1
            });

            const playerListPanel = document.getElementById('player-list-panel-server');
            if (playerListPanel && playerListPanel.classList.contains('open')) {
                updatePlayerListServer();
            }
        }
    });

    GAME.socket.on('player-left', (id) => {
        GAME.otherPlayers.delete(id);

        const playerListPanel = document.getElementById('player-list-panel-server');
        if (playerListPanel && playerListPanel.classList.contains('open')) {
            updatePlayerListServer();
        }
    });
}

function updatePlayerListServer() {
    const content = document.getElementById('player-list-content-server');
    content.innerHTML = '';

    console.log('Updating server player list. Other players:', GAME.otherPlayers.size);

    if (GAME.otherPlayers.size === 0) {
        content.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Нет других игроков<br/>Ждём подключения...</div>';
        return;
    }

    GAME.otherPlayers.forEach((player, id) => {
        console.log('Adding player to server list:', player.nickname, 'ID:', id);
        const isFriend = GAME.friends.some(f => f.id === id);

        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <div class="player-item-info">
                <div class="player-item-name clickable-name" data-id="${id}" data-nickname="${player.nickname}" style="cursor: pointer; text-decoration: underline; color: #4ecdc4;">${player.nickname}</div>
                <div class="player-item-level">Уровень ${player.level || 1}</div>
            </div>
            <div class="player-item-actions">
                ${!isFriend ? `
                    <button class="action-icon-btn" title="Добавить в друзья" data-action="add-friend" data-id="${id}" data-nickname="${player.nickname}">
                        ➕
                    </button>
                ` : '<span style="color: #2ecc71; font-size: 0.9em;">✓ Друг</span>'}
            </div>
        `;

        content.appendChild(playerItem);
    });

    // Add click handler for nicknames
    content.querySelectorAll('.clickable-name').forEach(nameEl => {
        nameEl.addEventListener('click', (e) => {
            e.preventDefault();
            const id = nameEl.getAttribute('data-id');
            const nickname = nameEl.getAttribute('data-nickname');
            console.log('Clicked on nickname:', nickname, 'ID:', id);
            const isFriend = GAME.friends.some(f => f.id === id);
            if (!isFriend) {
                addFriendServer(id, nickname);
            } else {
                showNotificationServer('Уже в друзьях!', '#2ecc71');
            }
        });
    });

    // Add event listeners for buttons
    content.querySelectorAll('[data-action="add-friend"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const nickname = btn.getAttribute('data-nickname');
            addFriendServer(id, nickname);
        });
    });
}

function updateFriendsListServer() {
    const content = document.getElementById('friends-list-content-server');
    content.innerHTML = '';

    if (GAME.friends.length === 0) {
        content.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Нет друзей<br/>Добавьте игроков из списка!</div>';
        return;
    }

    GAME.friends.forEach(friend => {
        const isOnline = GAME.otherPlayers.has(friend.id);

        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        friendItem.innerHTML = `
            <div class="friend-item-info">
                <div class="friend-item-name">
                    ${isOnline ? '🟢' : '⚫'} ${friend.nickname}
                </div>
            </div>
        `;

        content.appendChild(friendItem);
    });
}

function addFriendServer(id, nickname) {
    console.log('addFriendServer called:', id, nickname);

    const exists = GAME.friends.some(f => f.id === id);
    if (exists) {
        showNotificationServer('Уже в друзьях!', '#ff6b6b');
        return;
    }

    GAME.friends.push({ id, nickname });
    saveFriendsServer();

    showNotificationServer(`${nickname} добавлен в друзья!`, '#2ecc71');
    updatePlayerListServer();
    renderServerList(); // Update server list to show friend's servers highlighted
}

function saveFriendsServer() {
    // Save for both guests and accounts
    const storageKey = GAME.isGuest ? `stick_mmo_friends_guest_${GAME.username}` : `stick_mmo_friends_${GAME.username}`;
    localStorage.setItem(storageKey, JSON.stringify(GAME.friends));
    console.log('Friends saved:', GAME.friends);
}

function showNotificationServer(message, color) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${color};
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 18px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

function initScreens() {
    // Device Selection
    document.querySelectorAll('.device-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            GAME.device = e.currentTarget.dataset.device;
            showScreen('power-selection');
        });
    });

    // Power Selection
    document.querySelectorAll('.power-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            GAME.power = e.currentTarget.dataset.power;
            startGame();
        });
    });
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function startGame() {
    showScreen('loading-screen');
    updateLoadingProgress(20, 'Инициализация игры...');

    setTimeout(() => {
        initCanvas();
        initWorld();
        initPlayer();
        initCamera();
        initControls();
        initSocket();
        initPlayerListAndFriends();
        updateLoadingProgress(100, 'Готово!');

        setTimeout(() => {
            showScreen('game-screen');
            if (GAME.device === 'mobile') {
                document.getElementById('mobile-controls').classList.remove('hidden');
            }
            startGameLoop();
        }, 500);
    }, 500);
}

function updateLoadingProgress(percent, text) {
    document.querySelector('.loading-progress').style.width = percent + '%';
    document.getElementById('loading-text').textContent = text;
}

// ============================================
// CANVAS SETUP
// ============================================

function initCanvas() {
    GAME.canvas = document.getElementById('game-canvas');
    GAME.ctx = GAME.canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    GAME.canvas.width = window.innerWidth;
    GAME.canvas.height = window.innerHeight;
    CONFIG.CANVAS_WIDTH = window.innerWidth;
    CONFIG.CANVAS_HEIGHT = window.innerHeight;
}

// ============================================
// WORLD GENERATION
// ============================================

class World {
    constructor() {
        this.width = CONFIG.WORLD_WIDTH;
        this.height = CONFIG.WORLD_HEIGHT;
        this.zones = this.generateZones();
        this.obstacles = this.generateObstacles();
        this.decorations = this.generateDecorations();
        this.ambientParticles = [];
        this.lastParticleSpawn = 0;
    }

    generateZones() {
        const zones = [];
        const zonesPerRow = Math.ceil(Math.sqrt(CONFIG.ZONES));
        const zoneWidth = this.width / zonesPerRow;
        const zoneHeight = this.height / zonesPerRow;

        const zoneTypes = [
            { name: 'Огненная пустошь', color: '#ff6b6b', difficulty: 1 },
            { name: 'Ледяные пещеры', color: '#4ecdc4', difficulty: 1 },
            { name: 'Тёмный лес', color: '#2d4a2b', difficulty: 2 },
            { name: 'Вулканические земли', color: '#d63031', difficulty: 3 },
            { name: 'Кристальные долины', color: '#74b9ff', difficulty: 2 },
            { name: 'Проклятое болото', color: '#636e72', difficulty: 3 },
            { name: 'Небесные острова', color: '#a29bfe', difficulty: 4 },
            { name: 'Пустыня забвения', color: '#fdcb6e', difficulty: 2 },
            { name: 'Грозовые горы', color: '#6c5ce7', difficulty: 4 },
            { name: 'Мёртвые земли', color: '#2d3436', difficulty: 5 },
            { name: 'Радужные поля', color: '#fd79a8', difficulty: 1 },
            { name: 'Тёмная бездна', color: '#0c0c1e', difficulty: 5 },
            { name: 'Золотой храм', color: '#f39c12', difficulty: 4 },
            { name: 'Сад хаоса', color: '#e84393', difficulty: 3 },
            { name: 'Врата преисподней', color: '#c0392b', difficulty: 5 }
        ];

        for (let i = 0; i < CONFIG.ZONES; i++) {
            const row = Math.floor(i / zonesPerRow);
            const col = i % zonesPerRow;
            const type = zoneTypes[i % zoneTypes.length];

            zones.push({
                id: i,
                x: col * zoneWidth,
                y: row * zoneHeight,
                width: zoneWidth,
                height: zoneHeight,
                ...type
            });
        }

        return zones;
    }

    generateObstacles() {
        const obstacles = [];
        const obstacleCount = 200;

        for (let i = 0; i < obstacleCount; i++) {
            obstacles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                width: 50 + Math.random() * 100,
                height: 50 + Math.random() * 100,
                type: Math.random() > 0.5 ? 'rock' : 'tree'
            });
        }

        return obstacles;
    }

    generateDecorations() {
        const decorations = [];

        // Add decorations based on zone themes
        this.zones.forEach(zone => {
            const decorCount = 30;
            const decorTypes = this.getDecorationsForZone(zone);

            for (let i = 0; i < decorCount; i++) {
                const x = zone.x + Math.random() * zone.width;
                const y = zone.y + Math.random() * zone.height;
                const type = decorTypes[Math.floor(Math.random() * decorTypes.length)];

                decorations.push({
                    x, y,
                    type,
                    zoneColor: zone.color,
                    size: 10 + Math.random() * 20,
                    rotation: Math.random() * Math.PI * 2
                });
            }
        });

        return decorations;
    }

    getDecorationsForZone(zone) {
        const decorMap = {
            'Огненная пустошь': ['🔥', '💥', '☄️'],
            'Ледяные пещеры': ['❄️', '🧊', '💎'],
            'Тёмный лес': ['🌲', '🌿', '🍄'],
            'Вулканические земли': ['🌋', '🔥', '💥'],
            'Кристальные долины': ['💎', '✨', '⭐'],
            'Проклятое болото': ['🌿', '💀', '🕷️'],
            'Небесные острова': ['☁️', '⭐', '🌟'],
            'Пустыня забвения': ['🌵', '💀', '🦂'],
            'Грозовые горы': ['⚡', '🌩️', '⛰️'],
            'Мёртвые земли': ['💀', '🦴', '👻'],
            'Радужные поля': ['🌈', '🌸', '🦋'],
            'Тёмная бездна': ['👁️', '💀', '🌑'],
            'Золотой храм': ['👑', '💰', '⚱️'],
            'Сад хаоса': ['🌺', '🦋', '✨'],
            'Врата преисподней': ['🔥', '😈', '💀']
        };

        return decorMap[zone.name] || ['🌟', '✨', '💫'];
    }

    spawnAmbientParticles(playerZone) {
        const now = Date.now();
        if (now - this.lastParticleSpawn < 200) return;

        this.lastParticleSpawn = now;

        if (!playerZone) return;

        // Spawn particles based on zone theme
        const particleTypes = {
            'Огненная пустошь': { color: '#ff6b6b', symbol: '•' },
            'Ледяные пещеры': { color: '#4ecdc4', symbol: '❄' },
            'Вулканические земли': { color: '#d63031', symbol: '•' },
            'Грозовые горы': { color: '#6c5ce7', symbol: '⚡' },
            'Небесные острова': { color: '#a29bfe', symbol: '✨' }
        };

        const particleType = particleTypes[playerZone.name];
        if (!particleType) return;

        // Spawn a few ambient particles near player
        for (let i = 0; i < 2; i++) {
            const offsetX = (Math.random() - 0.5) * 500;
            const offsetY = (Math.random() - 0.5) * 500;

            this.ambientParticles.push({
                x: GAME.player.x + offsetX,
                y: GAME.player.y + offsetY,
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random(),
                life: 1 + Math.random() * 2,
                maxLife: 1 + Math.random() * 2,
                color: particleType.color,
                symbol: particleType.symbol,
                size: 8 + Math.random() * 8
            });
        }
    }

    updateAmbientParticles(deltaTime) {
        this.ambientParticles = this.ambientParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= deltaTime / 1000;
            return p.life > 0;
        });
    }

    drawDecorations(ctx, camera) {
        this.decorations.forEach(decor => {
            const screenX = decor.x - camera.x;
            const screenY = decor.y - camera.y;

            // Only draw if on screen
            if (screenX < -50 || screenX > CONFIG.CANVAS_WIDTH + 50 ||
                screenY < -50 || screenY > CONFIG.CANVAS_HEIGHT + 50) {
                return;
            }

            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(decor.rotation);
            ctx.font = `${decor.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = 0.6;
            ctx.fillText(decor.type, 0, 0);
            ctx.globalAlpha = 1;
            ctx.restore();
        });
    }

    drawAmbientParticles(ctx, camera) {
        this.ambientParticles.forEach(p => {
            const screenX = p.x - camera.x;
            const screenY = p.y - camera.y;

            ctx.save();
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.font = `${p.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(p.symbol, screenX, screenY);
            ctx.restore();
        });
    }

    getZoneAt(x, y) {
        return this.zones.find(zone =>
            x >= zone.x && x < zone.x + zone.width &&
            y >= zone.y && y < zone.y + zone.height
        );
    }
}

function initWorld() {
    GAME.world = new World();
    spawnBosses();
    spawnEnemies();
}

// ============================================
// PLAYER CLASS
// ============================================

class Player {
    constructor(id, x, y, power, nickname = 'Player') {
        this.id = id;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.speed = CONFIG.BASE_PLAYER_SPEED;
        this.size = 40;
        this.power = power;
        this.nickname = nickname;
        this.health = 100;
        this.maxHealth = 100;
        this.level = 1;
        this.exp = 0;
        this.expToNext = 100;
        this.rotation = 0;
        this.evoluta = 0; // Новая валюта
        this.equipment = {
            sword: null,
            armor: null
        };

        // Abilities
        this.abilities = this.initAbilities();

        // Animation
        this.animation = {
            state: 'idle', // idle, walk, attack
            frame: 0,
            timer: 0
        };
    }

    initAbilities() {
        if (this.power === 'fire') {
            return {
                q: { name: 'Огненный шар', damage: 25, cooldown: 2000, lastUsed: 0, color: '#ff6b6b', icon: '🔥' },
                e: { name: 'Взрыв пламени', damage: 40, cooldown: 4000, lastUsed: 0, color: '#d63031', icon: '💥' },
                r: { name: 'Инферно', damage: 80, cooldown: 8000, lastUsed: 0, color: '#ff7675', icon: '⚡' }
            };
        } else {
            return {
                q: { name: 'Ледяной осколок', damage: 20, cooldown: 2000, lastUsed: 0, color: '#4ecdc4', icon: '❄️' },
                e: { name: 'Ледяная тюрьма', damage: 30, cooldown: 4000, lastUsed: 0, color: '#74b9ff', icon: '🧊' },
                r: { name: 'Метель', damage: 70, cooldown: 8000, lastUsed: 0, color: '#0984e3', icon: '🌨️' }
            };
        }
    }

    update(deltaTime) {
        // Movement
        this.x += this.vx;
        this.y += this.vy;

        // World boundaries
        this.x = Math.max(this.size, Math.min(CONFIG.WORLD_WIDTH - this.size, this.x));
        this.y = Math.max(this.size, Math.min(CONFIG.WORLD_HEIGHT - this.size, this.y));

        // Animation
        this.animation.timer += deltaTime;
        if (this.animation.timer > 100) {
            this.animation.frame = (this.animation.frame + 1) % 4;
            this.animation.timer = 0;
        }

        // Friction
        this.vx *= 0.9;
        this.vy *= 0.9;

        // Animation state
        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
            this.animation.state = 'walk';
        } else {
            this.animation.state = 'idle';
        }
    }

    draw(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.rotation);

        // Draw stick figure
        this.drawStickFigure(ctx);

        // Draw power aura
        this.drawPowerAura(ctx);

        // Draw health bar
        this.drawHealthBar(ctx);

        ctx.restore();

        // Draw nickname
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(this.nickname, screenX, screenY - this.size - 30);
        ctx.fillText(this.nickname, screenX, screenY - this.size - 30);

        // Draw level
        ctx.font = '12px Arial';
        ctx.fillStyle = '#f39c12';
        ctx.fillText(`Lv${this.level}`, screenX, screenY - this.size - 15);
    }

    drawStickFigure(ctx) {
        const bobOffset = this.animation.state === 'walk' ? Math.sin(this.animation.frame) * 2 : 0;
        const color = this.power === 'fire' ? '#ff6b6b' : '#4ecdc4';

        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(0, -15 + bobOffset, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(0, -7 + bobOffset);
        ctx.lineTo(0, 10 + bobOffset);
        ctx.stroke();

        // Arms
        const armSwing = this.animation.state === 'walk' ? Math.sin(this.animation.frame) * 10 : 0;
        ctx.beginPath();
        ctx.moveTo(-10, -2 + bobOffset + armSwing);
        ctx.lineTo(0, 0 + bobOffset);
        ctx.lineTo(10, -2 + bobOffset - armSwing);
        ctx.stroke();

        // Legs
        const legSwing = this.animation.state === 'walk' ? Math.sin(this.animation.frame) * 15 : 0;
        ctx.beginPath();
        ctx.moveTo(-8, 20 + bobOffset - legSwing);
        ctx.lineTo(0, 10 + bobOffset);
        ctx.lineTo(8, 20 + bobOffset + legSwing);
        ctx.stroke();
    }

    drawPowerAura(ctx) {
        const color = this.power === 'fire' ? '#ff6b6b' : '#4ecdc4';
        const gradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 30);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '00');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    drawHealthBar(ctx) {
        const barWidth = 50;
        const barHeight = 6;
        const healthPercent = this.health / this.maxHealth;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-barWidth / 2, -this.size - 10, barWidth, barHeight);

        // Health
        ctx.fillStyle = healthPercent > 0.5 ? '#4ecdc4' : '#ff6b6b';
        ctx.fillRect(-barWidth / 2, -this.size - 10, barWidth * healthPercent, barHeight);
    }

    useAbility(key) {
        const ability = this.abilities[key];
        if (!ability) return false;

        const now = Date.now();
        if (now - ability.lastUsed < ability.cooldown) return false;

        ability.lastUsed = now;
        this.createProjectile(ability);
        return true;
    }

    createProjectile(ability) {
        const angle = this.rotation;
        const speed = 10;

        const projectile = {
            x: this.x + Math.cos(angle) * 30,
            y: this.y + Math.sin(angle) * 30,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: ability.damage,
            color: ability.color,
            size: 8,
            owner: this.id,
            range: 500,
            distanceTraveled: 0
        };

        GAME.projectiles.push(projectile);

        // Emit to server
        if (GAME.socket) {
            GAME.socket.emit('projectile', {
                x: projectile.x,
                y: projectile.y,
                vx: projectile.vx,
                vy: projectile.vy,
                damage: projectile.damage,
                color: projectile.color
            });
        }
    }

    takeDamage(damage) {
        this.health = Math.max(0, this.health - damage);
        if (this.health === 0) {
            this.die();
        }
    }

    gainExp(amount) {
        this.exp += amount;
        while (this.exp >= this.expToNext) {
            this.levelUp();
        }
        updateHUD();
    }

    levelUp() {
        // Check max level cap
        if (this.level >= CONFIG.MAX_LEVEL) {
            this.exp = 0; // Reset exp if at max level
            return;
        }

        this.level++;
        this.exp -= this.expToNext;
        this.expToNext = Math.floor(this.expToNext * 1.5);
        this.maxHealth += 20;
        this.health = this.maxHealth;
        this.speed += 0.2;

        // Award Evoluta
        this.evoluta += 100;

        // Unlock new ability for this level
        this.unlockAbilityForLevel(this.level);

        // Visual effect
        createLevelUpEffect(this.x, this.y);

        // Update HUD
        updateHUD();

        // Save progress
        this.saveProgress();
    }

    unlockAbilityForLevel(level) {
        // Define abilities for each level (1-10)
        const levelAbilities = {
            2: { key: 't', name: 'Щит', damage: 0, cooldown: 10000, color: '#95a5a6', icon: '🛡️', type: 'shield' },
            3: { key: 'y', name: 'Телепорт', damage: 0, cooldown: 8000, color: '#9b59b6', icon: '🌀', type: 'teleport' },
            4: { key: 'u', name: 'Молния', damage: 60, cooldown: 5000, color: '#f1c40f', icon: '⚡', type: 'attack' },
            5: { key: 'i', name: 'Исцеление', damage: 0, cooldown: 15000, color: '#2ecc71', icon: '💚', type: 'heal' },
            6: { key: 'o', name: 'Ураган', damage: 90, cooldown: 7000, color: '#1abc9c', icon: '🌪️', type: 'attack' },
            7: { key: 'p', name: 'Метеорит', damage: 120, cooldown: 10000, color: '#e67e22', icon: '☄️', type: 'attack' },
            8: { key: '[', name: 'Ярость', damage: 0, cooldown: 20000, color: '#c0392b', icon: '💢', type: 'buff' },
            9: { key: ']', name: 'Цунами', damage: 150, cooldown: 12000, color: '#3498db', icon: '🌊', type: 'attack' },
            10: { key: '\\', name: 'Армагеддон', damage: 200, cooldown: 30000, color: '#8e44ad', icon: '💀', type: 'ultimate' }
        };

        const newAbility = levelAbilities[level];
        if (newAbility) {
            this.abilities[newAbility.key] = {
                ...newAbility,
                lastUsed: 0
            };

            // Add ability to HUD
            addAbilityToHUD(newAbility);

            // Show notification
            showLevelUpNotification(level, newAbility);
        }
    }

    saveProgress() {
        if (GAME.isGuest) return; // Don't save guest progress

        const progress = {
            level: this.level,
            exp: this.exp,
            maxHealth: this.maxHealth,
            speed: this.speed,
            abilities: this.abilities,
            evoluta: this.evoluta,
            equipment: this.equipment
        };

        accountSystem.updateStats(GAME.username, progress);
    }

    loadProgress(data) {
        if (data) {
            this.level = data.level || 1;
            this.exp = data.exp || 0;
            this.maxHealth = data.maxHealth || 100;
            this.health = this.maxHealth;
            this.speed = data.speed || CONFIG.BASE_PLAYER_SPEED;
            this.evoluta = data.evoluta || 0;
            this.equipment = data.equipment || { sword: null, armor: null };

            // Restore abilities
            if (data.abilities) {
                this.abilities = { ...this.abilities, ...data.abilities };
                // Reset lastUsed times
                Object.keys(this.abilities).forEach(key => {
                    this.abilities[key].lastUsed = 0;
                });
            } else {
                // Unlock abilities based on level
                for (let lvl = 2; lvl <= this.level; lvl++) {
                    this.unlockAbilityForLevel(lvl);
                }
            }
        }
    }

    die() {
        // Respawn logic
        this.health = this.maxHealth;
        this.x = CONFIG.WORLD_WIDTH / 2;
        this.y = CONFIG.WORLD_HEIGHT / 2;
    }
}

function initPlayer() {
    const startX = CONFIG.WORLD_WIDTH / 2;
    const startY = CONFIG.WORLD_HEIGHT / 2;
    GAME.player = new Player('local', startX, startY, GAME.power, GAME.nickname);

    // Load saved progress if not a guest
    if (!GAME.isGuest && accountSystem.accounts[GAME.username]) {
        GAME.player.loadProgress(accountSystem.accounts[GAME.username]);
    }

    updateHUD();
    updateAbilityIcons();
}

function showLevelUpNotification(level, ability) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 30px 50px;
        border-radius: 20px;
        border: 3px solid #fff;
        color: white;
        font-size: 24px;
        font-weight: bold;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        animation: slideIn 0.5s ease-out;
    `;

    notification.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
        <div>УРОВЕНЬ ${level}!</div>
        <div style="font-size: 36px; margin: 15px 0;">${ability.icon}</div>
        <div style="font-size: 20px; color: #ffd700;">Новая способность разблокирована!</div>
        <div style="font-size: 18px; margin-top: 10px;">${ability.name}</div>
        <div style="font-size: 14px; color: #ddd; margin-top: 5px;">Клавиша: ${ability.key.toUpperCase()}</div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translate(-50%, -60%);
        }
        to {
            opacity: 1;
            transform: translate(-50%, -50%);
        }
    }
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

function updateAbilityIcons() {
    // Update ability icons based on player power
    document.querySelector('#ability-1 .ability-icon').textContent = GAME.player.abilities.q.icon;
    document.querySelector('#ability-2 .ability-icon').textContent = GAME.player.abilities.e.icon;
    document.querySelector('#ability-3 .ability-icon').textContent = GAME.player.abilities.r.icon;

    // Restore unlocked abilities from saved progress
    const unlockableKeys = ['t', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'];
    unlockableKeys.forEach(key => {
        if (GAME.player.abilities[key]) {
            addAbilityToHUD(GAME.player.abilities[key]);
        }
    });
}

function addAbilityToHUD(ability) {
    const container = document.getElementById('unlockable-abilities');

    // Check if ability already exists
    if (document.getElementById(`ability-${ability.key}`)) {
        return;
    }

    const abilityEl = document.createElement('div');
    abilityEl.className = 'ability';
    abilityEl.id = `ability-${ability.key}`;
    abilityEl.innerHTML = `
        <div class="ability-key">${ability.key.toUpperCase()}</div>
        <div class="ability-icon">${ability.icon}</div>
        <div class="cooldown"></div>
    `;

    container.appendChild(abilityEl);
}

// ============================================
// CAMERA SYSTEM
// ============================================

class Camera {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.smoothing = 0.1;
    }

    follow(target) {
        this.targetX = target.x - CONFIG.CANVAS_WIDTH / 2;
        this.targetY = target.y - CONFIG.CANVAS_HEIGHT / 2;

        this.x += (this.targetX - this.x) * this.smoothing;
        this.y += (this.targetY - this.y) * this.smoothing;

        // Keep camera in world bounds
        this.x = Math.max(0, Math.min(CONFIG.WORLD_WIDTH - CONFIG.CANVAS_WIDTH, this.x));
        this.y = Math.max(0, Math.min(CONFIG.WORLD_HEIGHT - CONFIG.CANVAS_HEIGHT, this.y));
    }
}

function initCamera() {
    GAME.camera = new Camera(GAME.player.x, GAME.player.y);
}

// ============================================
// CONTROLS
// ============================================

function initControls() {
    if (GAME.device === 'pc') {
        initKeyboardControls();
        initMouseControls();
    } else {
        initTouchControls();
    }
}

function initKeyboardControls() {
    window.addEventListener('keydown', (e) => {
        GAME.keys[e.key.toLowerCase()] = true;

        // Basic abilities
        if (e.key.toLowerCase() === 'q') {
            if (GAME.player.useAbility('q')) {
                setCooldown('ability-1', 2000);
            }
        }
        if (e.key.toLowerCase() === 'e') {
            if (GAME.player.useAbility('e')) {
                setCooldown('ability-2', 4000);
            }
        }
        if (e.key.toLowerCase() === 'r') {
            if (GAME.player.useAbility('r')) {
                setCooldown('ability-3', 8000);
            }
        }

        // New level-up abilities
        const abilityKeys = ['t', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'];
        const key = e.key.toLowerCase();
        if (abilityKeys.includes(key) && GAME.player.abilities[key]) {
            const ability = GAME.player.abilities[key];
            if (GAME.player.useAbility(key)) {
                // Show cooldown notification
                showAbilityCooldownNotification(ability);
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        GAME.keys[e.key.toLowerCase()] = false;
    });
}

function showAbilityCooldownNotification(ability) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 200px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        padding: 15px 30px;
        border-radius: 10px;
        color: white;
        font-size: 16px;
        font-weight: bold;
        z-index: 1000;
        border: 2px solid ${ability.color};
        box-shadow: 0 0 20px ${ability.color};
        pointer-events: none;
    `;

    notification.innerHTML = `${ability.icon} ${ability.name}`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 1500);
}

function initMouseControls() {
    GAME.canvas.addEventListener('mousemove', (e) => {
        GAME.mouse.x = e.clientX;
        GAME.mouse.y = e.clientY;

        // Update player rotation
        const dx = GAME.mouse.x - CONFIG.CANVAS_WIDTH / 2;
        const dy = GAME.mouse.y - CONFIG.CANVAS_HEIGHT / 2;
        GAME.player.rotation = Math.atan2(dy, dx);
    });

    GAME.canvas.addEventListener('click', () => {
        GAME.player.useAbility('q');
        setCooldown('ability-1', 2000);
    });
}

function initTouchControls() {
    const joystick = document.getElementById('movement-joystick');
    const stick = joystick.querySelector('.joystick-stick');
    let touchId = null;

    joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchId = e.touches[0].identifier;
        GAME.joystick.active = true;
    });

    joystick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!GAME.joystick.active) return;

        const touch = Array.from(e.touches).find(t => t.identifier === touchId);
        if (!touch) return;

        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const distance = Math.min(35, Math.sqrt(dx * dx + dy * dy));
        const angle = Math.atan2(dy, dx);

        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        GAME.joystick.x = x / 35;
        GAME.joystick.y = y / 35;

        GAME.player.rotation = angle;
    });

    joystick.addEventListener('touchend', (e) => {
        e.preventDefault();
        GAME.joystick.active = false;
        GAME.joystick.x = 0;
        GAME.joystick.y = 0;
        stick.style.transform = 'translate(-50%, -50%)';
    });

    // Action buttons
    document.getElementById('attack-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        GAME.player.useAbility('q');
        setCooldown('ability-1', 2000);
    });

    document.getElementById('ability1-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (GAME.player.useAbility('q')) {
            setCooldown('ability-1', 2000);
        }
    });

    document.getElementById('ability2-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (GAME.player.useAbility('e')) {
            setCooldown('ability-2', 4000);
        }
    });

    document.getElementById('ability3-btn').addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (GAME.player.useAbility('r')) {
            setCooldown('ability-3', 8000);
        }
    });
}

function handlePlayerInput() {
    if (GAME.device === 'pc') {
        // Keyboard movement
        let dx = 0, dy = 0;
        if (GAME.keys['w'] || GAME.keys['ц']) dy -= 1;
        if (GAME.keys['s'] || GAME.keys['ы']) dy += 1;
        if (GAME.keys['a'] || GAME.keys['ф']) dx -= 1;
        if (GAME.keys['d'] || GAME.keys['в']) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;

            GAME.player.vx = dx * GAME.player.speed;
            GAME.player.vy = dy * GAME.player.speed;
        }
    } else {
        // Joystick movement
        if (GAME.joystick.active) {
            GAME.player.vx = GAME.joystick.x * GAME.player.speed;
            GAME.player.vy = GAME.joystick.y * GAME.player.speed;
        }
    }
}

function setCooldown(abilityId, duration) {
    const ability = document.getElementById(abilityId);
    const cooldown = ability.querySelector('.cooldown');

    cooldown.style.height = '100%';

    let elapsed = 0;
    const interval = setInterval(() => {
        elapsed += 50;
        const percent = 100 - (elapsed / duration * 100);
        cooldown.style.height = percent + '%';

        if (elapsed >= duration) {
            clearInterval(interval);
        }
    }, 50);
}

// ============================================
// ENEMIES & BOSSES
// ============================================

class Enemy {
    constructor(id, x, y, type = 'normal') {
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type;
        this.size = type === 'boss' ? 80 : 30;
        this.health = type === 'boss' ? 500 : 50;
        this.maxHealth = this.health;
        this.speed = type === 'boss' ? 2 : 3;
        this.damage = type === 'boss' ? 20 : 10;
        this.expReward = type === 'boss' ? 200 : 20;
        this.aggro = false;
        this.aggroRange = type === 'boss' ? 400 : 200;
        this.attackRange = 50;
        this.attackCooldown = 1000;
        this.lastAttack = 0;
        this.color = type === 'boss' ? '#c0392b' : '#e74c3c';
    }

    update(deltaTime) {
        // Check aggro
        const dist = this.distanceTo(GAME.player);
        if (dist < this.aggroRange) {
            this.aggro = true;
        }

        if (this.aggro) {
            // Move towards player
            const angle = Math.atan2(GAME.player.y - this.y, GAME.player.x - this.x);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;

            // Attack
            if (dist < this.attackRange) {
                const now = Date.now();
                if (now - this.lastAttack > this.attackCooldown) {
                    this.attack();
                    this.lastAttack = now;
                }
            }
        }
    }

    attack() {
        GAME.player.takeDamage(this.damage);
        updateHUD();
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        GAME.player.gainExp(this.expReward);

        if (this.type === 'boss') {
            GAME.bosses.delete(this.id);
        } else {
            GAME.enemies.delete(this.id);
        }

        // Particle effect
        createDeathEffect(this.x, this.y, this.color);
    }

    draw(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);

        // Draw enemy stick figure
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.type === 'boss' ? 6 : 3;
        ctx.lineCap = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(0, -this.size/3, this.size/5, 0, Math.PI * 2);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(0, -this.size/5);
        ctx.lineTo(0, this.size/3);
        ctx.stroke();

        // Arms
        ctx.beginPath();
        ctx.moveTo(-this.size/4, 0);
        ctx.lineTo(0, 0);
        ctx.lineTo(this.size/4, 0);
        ctx.stroke();

        // Legs
        ctx.beginPath();
        ctx.moveTo(-this.size/5, this.size/2);
        ctx.lineTo(0, this.size/3);
        ctx.lineTo(this.size/5, this.size/2);
        ctx.stroke();

        ctx.restore();

        // Health bar
        const barWidth = this.size * 1.5;
        const barHeight = 6;
        const healthPercent = this.health / this.maxHealth;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(screenX - barWidth / 2, screenY - this.size - 10, barWidth, barHeight);

        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(screenX - barWidth / 2, screenY - this.size - 10, barWidth * healthPercent, barHeight);

        // Boss name
        if (this.type === 'boss') {
            ctx.fillStyle = '#c0392b';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('BOSS', screenX, screenY - this.size - 20);
        }
    }

    distanceTo(target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

function spawnEnemies() {
    const enemyCount = 100;
    for (let i = 0; i < enemyCount; i++) {
        const x = Math.random() * CONFIG.WORLD_WIDTH;
        const y = Math.random() * CONFIG.WORLD_HEIGHT;
        const enemy = new Enemy('enemy_' + i, x, y, 'normal');
        GAME.enemies.set(enemy.id, enemy);
    }
}

function spawnBosses() {
    GAME.world.zones.forEach((zone, index) => {
        const x = zone.x + zone.width / 2;
        const y = zone.y + zone.height / 2;
        const boss = new Enemy('boss_' + index, x, y, 'boss');
        GAME.bosses.set(boss.id, boss);
    });
}

// ============================================
// PROJECTILES
// ============================================

function updateProjectiles(deltaTime) {
    GAME.projectiles = GAME.projectiles.filter(proj => {
        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.distanceTraveled += Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);

        // Check collision with enemies
        for (const [id, enemy] of GAME.enemies) {
            if (checkCollision(proj, enemy)) {
                enemy.takeDamage(proj.damage);
                createHitEffect(proj.x, proj.y, proj.color);
                return false;
            }
        }

        // Check collision with bosses
        for (const [id, boss] of GAME.bosses) {
            if (checkCollision(proj, boss)) {
                boss.takeDamage(proj.damage);
                createHitEffect(proj.x, proj.y, proj.color);
                return false;
            }
        }

        // PvP - Check collision with other players
        for (const [id, otherPlayer] of GAME.otherPlayers) {
            if (checkCollision(proj, otherPlayer) && proj.owner !== id) {
                otherPlayer.takeDamage(proj.damage);
                createHitEffect(proj.x, proj.y, proj.color);

                // Notify server about player damage
                if (GAME.socket) {
                    GAME.socket.emit('player-hit', {
                        targetId: id,
                        damage: proj.damage
                    });
                }

                // Show damage text
                createDamageText(otherPlayer.x, otherPlayer.y, proj.damage);

                return false;
            }
        }

        // Check collision with local player (from other players' projectiles)
        if (proj.owner !== GAME.player.id && checkCollision(proj, GAME.player)) {
            GAME.player.takeDamage(proj.damage);
            createHitEffect(proj.x, proj.y, proj.color);
            updateHUD();

            // Show damage text
            createDamageText(GAME.player.x, GAME.player.y, proj.damage);

            return false;
        }

        return proj.distanceTraveled < proj.range;
    });
}

function drawProjectiles(ctx, camera) {
    GAME.projectiles.forEach(proj => {
        const screenX = proj.x - camera.x;
        const screenY = proj.y - camera.y;

        // Glow effect
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, proj.size * 2);
        gradient.addColorStop(0, proj.color);
        gradient.addColorStop(1, proj.color + '00');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, proj.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, proj.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

function checkCollision(proj, enemy) {
    const dx = proj.x - enemy.x;
    const dy = proj.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < proj.size + enemy.size;
}

// ============================================
// PARTICLES & EFFECTS
// ============================================

function createHitEffect(x, y, color) {
    for (let i = 0; i < 10; i++) {
        GAME.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1,
            color
        });
    }
}

function createDeathEffect(x, y, color) {
    for (let i = 0; i < 30; i++) {
        GAME.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            color
        });
    }
}

function createLevelUpEffect(x, y) {
    for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        GAME.particles.push({
            x, y,
            vx: Math.cos(angle) * 5,
            vy: Math.sin(angle) * 5,
            life: 1,
            color: '#f39c12'
        });
    }
}

function createDamageText(x, y, damage) {
    GAME.damageTexts.push({
        x: x,
        y: y - 30,
        damage: Math.floor(damage),
        life: 1,
        vy: -2
    });
}

function updateParticles(deltaTime) {
    GAME.particles = GAME.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life -= deltaTime / 1000;
        return p.life > 0;
    });
}

function drawParticles(ctx, camera) {
    GAME.particles.forEach(p => {
        const screenX = p.x - camera.x;
        const screenY = p.y - camera.y;

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
}

function updateDamageTexts(deltaTime) {
    GAME.damageTexts = GAME.damageTexts.filter(dt => {
        dt.y += dt.vy;
        dt.life -= deltaTime / 1000;
        return dt.life > 0;
    });
}

function drawDamageTexts(ctx, camera) {
    GAME.damageTexts.forEach(dt => {
        const screenX = dt.x - camera.x;
        const screenY = dt.y - camera.y;

        ctx.save();
        ctx.globalAlpha = dt.life;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText('-' + dt.damage, screenX, screenY);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillText('-' + dt.damage, screenX, screenY);
        ctx.globalAlpha = 1;
        ctx.restore();
    });
}

// ============================================
// WEBSOCKET / MULTIPLAYER
// ============================================

function initSocket() {
    // Автоматически определяем URL сервера
    const SERVER_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : window.location.origin;

    GAME.socket = io(SERVER_URL);

    GAME.socket.on('connect', () => {
        console.log('Connected to server');
        document.getElementById('connection-status').classList.remove('hidden');
        document.getElementById('status-indicator').classList.add('connected');
        document.getElementById('status-text').textContent = 'Подключено';

        // Send player info
        GAME.socket.emit('player-join', {
            x: GAME.player.x,
            y: GAME.player.y,
            power: GAME.player.power,
            level: GAME.player.level,
            nickname: GAME.player.nickname
        });
    });

    GAME.socket.on('disconnect', () => {
        document.getElementById('status-indicator').classList.remove('connected');
        document.getElementById('status-indicator').classList.add('disconnected');
        document.getElementById('status-text').textContent = 'Отключено';
    });

    GAME.socket.on('players', (players) => {
        Object.entries(players).forEach(([id, data]) => {
            if (id !== GAME.socket.id) {
                if (!GAME.otherPlayers.has(id)) {
                    const player = new Player(id, data.x, data.y, data.power, data.nickname || 'Player');
                    player.level = data.level;
                    GAME.otherPlayers.set(id, player);
                } else {
                    const player = GAME.otherPlayers.get(id);
                    player.x = data.x;
                    player.y = data.y;
                    player.rotation = data.rotation;
                    if (data.nickname) player.nickname = data.nickname;
                    if (data.level) player.level = data.level;
                }
            }
        });

        // Count only other players + ourselves = total online
        const totalPlayers = GAME.otherPlayers.size + 1;
        document.getElementById('player-count').textContent = totalPlayers;

        // Auto-update player list if it's open
        const playerListPanel = document.getElementById('player-list-panel');
        if (playerListPanel && playerListPanel.classList.contains('open')) {
            updatePlayerList();
        }

        // Auto-update friends list if it's open
        const friendsPanel = document.getElementById('friends-panel');
        if (friendsPanel && friendsPanel.classList.contains('open')) {
            updateFriendsList();
        }
    });

    GAME.socket.on('player-left', (id) => {
        GAME.otherPlayers.delete(id);

        // Auto-update player list if it's open
        const playerListPanel = document.getElementById('player-list-panel');
        if (playerListPanel && playerListPanel.classList.contains('open')) {
            updatePlayerList();
        }

        // Auto-update friends list if it's open
        const friendsPanel = document.getElementById('friends-panel');
        if (friendsPanel && friendsPanel.classList.contains('open')) {
            updateFriendsList();
        }
    });

    // Receive projectiles from other players
    GAME.socket.on('projectile-spawned', (projectile) => {
        // Don't add our own projectiles (we already have them)
        if (projectile.owner !== GAME.socket.id) {
            GAME.projectiles.push({
                x: projectile.x,
                y: projectile.y,
                vx: projectile.vx,
                vy: projectile.vy,
                damage: projectile.damage,
                color: projectile.color,
                size: 8,
                owner: projectile.owner,
                range: 500,
                distanceTraveled: 0
            });
        }
    });

    // PvP - Receive damage events
    GAME.socket.on('player-damaged', (data) => {
        if (data.id === GAME.socket.id) {
            // We got hit
            GAME.player.health = data.health;
            updateHUD();
        } else {
            // Another player got hit
            const otherPlayer = GAME.otherPlayers.get(data.id);
            if (otherPlayer) {
                otherPlayer.health = data.health;
            }
        }
    });

    // PvP - Player died
    GAME.socket.on('player-died', (data) => {
        const player = data.id === GAME.socket.id ? GAME.player : GAME.otherPlayers.get(data.id);
        if (player) {
            createDeathEffect(player.x, player.y, '#ff6b6b');

            if (data.id === GAME.socket.id) {
                // We died - show death message
                console.log('You were killed by player', data.killerId);
            } else if (data.killerId === GAME.socket.id) {
                // We got a kill!
                console.log('You killed player', data.id);
                GAME.player.gainExp(50); // Bonus XP for PvP kill
                GAME.player.evoluta += 10; // Award Evoluta for kill
                updateHUD();
                GAME.player.saveProgress();
                showNotification('+10 Эволюта за убийство!', '#f39c12');
            }
        }
    });

    // PvP - Player respawned
    GAME.socket.on('player-respawned', (data) => {
        if (data.id === GAME.socket.id) {
            GAME.player.health = GAME.player.maxHealth;
            updateHUD();
        } else {
            const otherPlayer = GAME.otherPlayers.get(data.id);
            if (otherPlayer) {
                otherPlayer.health = otherPlayer.maxHealth;
            }
        }
    });

    // Send position updates
    setInterval(() => {
        if (GAME.socket && GAME.player) {
            GAME.socket.emit('player-move', {
                x: GAME.player.x,
                y: GAME.player.y,
                rotation: GAME.player.rotation,
                level: GAME.player.level
            });
        }
    }, 50);
}

// ============================================
// PLAYER LIST & FRIENDS SYSTEM
// ============================================

function initPlayerListAndFriends() {
    // Load friends from localStorage
    loadFriends();

    // Toggle player list
    document.getElementById('toggle-player-list').addEventListener('click', () => {
        const panel = document.getElementById('player-list-panel');
        const btn = document.getElementById('toggle-player-list');
        panel.classList.toggle('open');
        btn.classList.toggle('active');

        if (panel.classList.contains('open')) {
            updatePlayerList();
            // Close other panels
            document.getElementById('friends-panel').classList.remove('open');
            document.getElementById('toggle-friends').classList.remove('active');
            document.getElementById('shop-panel').classList.remove('open');
            document.getElementById('toggle-shop').classList.remove('active');
        }
    });

    // Toggle friends list
    document.getElementById('toggle-friends').addEventListener('click', () => {
        const panel = document.getElementById('friends-panel');
        const btn = document.getElementById('toggle-friends');
        panel.classList.toggle('open');
        btn.classList.toggle('active');

        if (panel.classList.contains('open')) {
            updateFriendsList();
            // Close other panels
            document.getElementById('player-list-panel').classList.remove('open');
            document.getElementById('toggle-player-list').classList.remove('active');
            document.getElementById('shop-panel').classList.remove('open');
            document.getElementById('toggle-shop').classList.remove('active');
        }
    });

    // Toggle shop
    document.getElementById('toggle-shop').addEventListener('click', () => {
        const panel = document.getElementById('shop-panel');
        const btn = document.getElementById('toggle-shop');
        panel.classList.toggle('open');
        btn.classList.toggle('active');

        if (panel.classList.contains('open')) {
            updateShop();
            // Close other panels
            document.getElementById('player-list-panel').classList.remove('open');
            document.getElementById('toggle-player-list').classList.remove('active');
            document.getElementById('friends-panel').classList.remove('open');
            document.getElementById('toggle-friends').classList.remove('active');
        }
    });

    // Close buttons
    document.getElementById('close-player-list').addEventListener('click', () => {
        document.getElementById('player-list-panel').classList.remove('open');
        document.getElementById('toggle-player-list').classList.remove('active');
    });

    document.getElementById('close-friends').addEventListener('click', () => {
        document.getElementById('friends-panel').classList.remove('open');
        document.getElementById('toggle-friends').classList.remove('active');
    });

    document.getElementById('close-shop').addEventListener('click', () => {
        document.getElementById('shop-panel').classList.remove('open');
        document.getElementById('toggle-shop').classList.remove('active');
    });

    // Shop items click handlers
    initShop();
}

function initShop() {
    const shopData = {
        'sword-1': { type: 'sword', damage: 15, name: 'Железный меч' },
        'sword-2': { type: 'sword', damage: 30, name: 'Стальной меч' },
        'sword-3': { type: 'sword', damage: 60, name: 'Легендарный меч' },
        'armor-1': { type: 'armor', health: 20, name: 'Кожаная броня' },
        'armor-2': { type: 'armor', health: 50, name: 'Стальная броня' },
        'armor-3': { type: 'armor', health: 100, name: 'Королевская броня' }
    };

    document.querySelectorAll('.shop-item').forEach(item => {
        item.addEventListener('click', () => {
            const itemId = item.getAttribute('data-item');
            const cost = parseInt(item.getAttribute('data-cost'));
            const itemData = shopData[itemId];

            // Check if already owned
            if (item.classList.contains('owned')) {
                showNotification('Уже куплено!', '#ff6b6b');
                return;
            }

            // Check if enough evoluta
            if (GAME.player.evoluta < cost) {
                showNotification('Недостаточно Эволюты!', '#ff6b6b');
                return;
            }

            // Purchase item
            GAME.player.evoluta -= cost;

            if (itemData.type === 'sword') {
                GAME.player.equipment.sword = itemId;
            } else if (itemData.type === 'armor') {
                GAME.player.equipment.armor = itemId;
                GAME.player.maxHealth += itemData.health;
                GAME.player.health = GAME.player.maxHealth;
            }

            item.classList.add('owned');
            updateHUD();
            GAME.player.saveProgress();

            showNotification(`Куплено: ${itemData.name}!`, '#2ecc71');
        });
    });
}

function updateShop() {
    // Mark owned items
    document.querySelectorAll('.shop-item').forEach(item => {
        const itemId = item.getAttribute('data-item');

        if (itemId === GAME.player.equipment.sword || itemId === GAME.player.equipment.armor) {
            item.classList.add('owned');
        } else {
            item.classList.remove('owned');
        }
    });
}

function loadFriends() {
    if (GAME.isGuest) return;

    const saved = localStorage.getItem(`stick_mmo_friends_${GAME.username}`);
    GAME.friends = saved ? JSON.parse(saved) : [];
}

function saveFriends() {
    if (GAME.isGuest) return;

    localStorage.setItem(`stick_mmo_friends_${GAME.username}`, JSON.stringify(GAME.friends));
}

function updatePlayerList() {
    const content = document.getElementById('player-list-content');
    content.innerHTML = '';

    console.log('Updating player list. Other players:', GAME.otherPlayers.size);

    if (GAME.otherPlayers.size === 0) {
        content.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Нет других игроков<br/>Ждём подключения...</div>';
        return;
    }

    GAME.otherPlayers.forEach((player, id) => {
        console.log('Adding player to list:', player.nickname, 'ID:', id);
        const isFriend = GAME.friends.some(f => f.id === id);

        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <div class="player-item-info">
                <div class="player-item-name clickable-name" data-id="${id}" data-nickname="${player.nickname}" style="cursor: pointer; text-decoration: underline; color: #4ecdc4;">${player.nickname}</div>
                <div class="player-item-level">Уровень ${player.level || 1}</div>
            </div>
            <div class="player-item-actions">
                ${!isFriend ? `
                    <button class="action-icon-btn" title="Добавить в друзья" data-action="add-friend" data-id="${id}" data-nickname="${player.nickname}">
                        ➕
                    </button>
                ` : '<span style="color: #2ecc71; font-size: 0.9em;">✓ Друг</span>'}
                <button class="action-icon-btn" title="Присоединиться к игроку" data-action="join-player" data-id="${id}">
                    🎯
                </button>
            </div>
        `;

        content.appendChild(playerItem);
    });

    // Add click handler for nicknames
    content.querySelectorAll('.clickable-name').forEach(nameEl => {
        nameEl.addEventListener('click', (e) => {
            e.preventDefault();
            const id = nameEl.getAttribute('data-id');
            const nickname = nameEl.getAttribute('data-nickname');
            console.log('Clicked on nickname:', nickname, 'ID:', id);
            const isFriend = GAME.friends.some(f => f.id === id);
            if (!isFriend) {
                addFriend(id, nickname);
            } else {
                showNotification('Уже в друзьях!', '#2ecc71');
            }
        });
    });

    // Add event listeners
    content.querySelectorAll('[data-action="add-friend"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const nickname = btn.getAttribute('data-nickname');
            addFriend(id, nickname);
        });
    });

    content.querySelectorAll('[data-action="join-player"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            joinPlayer(id);
        });
    });
}

function updateFriendsList() {
    const content = document.getElementById('friends-list-content');
    content.innerHTML = '';

    if (GAME.friends.length === 0) {
        content.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">Нет друзей<br/>Добавьте игроков из списка!</div>';
        return;
    }

    GAME.friends.forEach(friend => {
        const isOnline = GAME.otherPlayers.has(friend.id);

        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        friendItem.innerHTML = `
            <div class="friend-item-info">
                <div class="friend-item-name">
                    ${isOnline ? '🟢' : '⚫'} ${friend.nickname}
                </div>
            </div>
            <div class="friend-item-actions">
                ${isOnline ? `
                    <button class="action-icon-btn" title="Обменяться" data-action="trade-friend" data-id="${friend.id}" data-nickname="${friend.nickname}">
                        🔄
                    </button>
                    <button class="action-icon-btn" title="Присоединиться" data-action="join-friend" data-id="${friend.id}">
                        🎯
                    </button>
                ` : ''}
                <button class="action-icon-btn remove" title="Удалить из друзей" data-action="remove-friend" data-id="${friend.id}">
                    ✕
                </button>
            </div>
        `;

        content.appendChild(friendItem);
    });

    // Add event listeners
    content.querySelectorAll('[data-action="trade-friend"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const nickname = btn.getAttribute('data-nickname');
            startTrade(id, nickname);
        });
    });

    content.querySelectorAll('[data-action="join-friend"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            joinPlayer(id);
        });
    });

    content.querySelectorAll('[data-action="remove-friend"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            removeFriend(id);
        });
    });
}

function startTrade(playerId, playerNickname) {
    // Simple trade prompt
    const amount = prompt(`Обмен с ${playerNickname}\nСколько Эволюты отправить? (У вас: ${GAME.player.evoluta})`);

    if (!amount) return;

    const tradeAmount = parseInt(amount);

    if (isNaN(tradeAmount) || tradeAmount <= 0) {
        showNotification('Неверное количество!', '#ff6b6b');
        return;
    }

    if (tradeAmount > GAME.player.evoluta) {
        showNotification('Недостаточно Эволюты!', '#ff6b6b');
        return;
    }

    // Send evoluta
    GAME.player.evoluta -= tradeAmount;
    updateHUD();
    GAME.player.saveProgress();

    // In real game, this would send to the other player via socket
    // For now, just show notification
    showNotification(`Отправлено ${tradeAmount} 💎 игроку ${playerNickname}!`, '#f39c12');

    // Note: Full implementation would require socket.io event to transfer evoluta
    // between players on the server side
}

function addFriend(id, nickname) {
    console.log('addFriend called:', id, nickname);

    if (GAME.friends.some(f => f.id === id)) {
        console.log('Already a friend');
        showNotification('Уже в друзьях!', '#2ecc71');
        return;
    }

    GAME.friends.push({ id, nickname });
    console.log('Friend added. Total friends:', GAME.friends.length);

    saveFriends();
    updatePlayerList();
    updateFriendsList();

    // Show notification
    showNotification(`${nickname} добавлен в друзья!`, '#4ecdc4');
}

function removeFriend(id) {
    GAME.friends = GAME.friends.filter(f => f.id !== id);
    saveFriends();
    updateFriendsList();

    showNotification('Друг удален', '#ff6b6b');
}

function joinPlayer(playerId) {
    const player = GAME.otherPlayers.get(playerId);
    if (!player) {
        showNotification('Игрок не найден', '#ff6b6b');
        return;
    }

    // Teleport to player's position
    GAME.player.x = player.x + 50; // Slight offset
    GAME.player.y = player.y + 50;

    // Close panels
    document.getElementById('player-list-panel').classList.remove('open');
    document.getElementById('friends-panel').classList.remove('open');
    document.getElementById('toggle-player-list').classList.remove('active');
    document.getElementById('toggle-friends').classList.remove('active');

    showNotification(`Телепортация к ${player.nickname}!`, '#4ecdc4');
}

function showNotification(message, color) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        font-size: 16px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease-out;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add animation for notifications
const notifStyle = document.createElement('style');
notifStyle.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notifStyle);

// ============================================
// HUD UPDATES
// ============================================

function updateHUD() {
    document.getElementById('health-value').textContent = Math.ceil(GAME.player.health);
    document.getElementById('health-bar').style.width = (GAME.player.health / GAME.player.maxHealth * 100) + '%';

    document.getElementById('player-level').textContent = GAME.player.level;
    document.getElementById('exp-value').textContent = Math.floor(GAME.player.exp);
    document.getElementById('exp-bar').style.width = (GAME.player.exp / GAME.player.expToNext * 100) + '%';
    document.querySelector('#exp-bar').parentElement.nextElementSibling.innerHTML =
        `<span id="exp-value">${Math.floor(GAME.player.exp)}</span>/${GAME.player.expToNext}`;

    document.getElementById('evoluta-value').textContent = GAME.player.evoluta;
}

function updateMinimap() {
    const minimap = document.getElementById('minimap');
    const ctx = minimap.getContext ? minimap.getContext('2d') : null;

    if (!ctx) {
        // Create canvas for minimap
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        minimap.appendChild(canvas);
        return;
    }
}

// ============================================
// RENDERING
// ============================================

function render() {
    const ctx = GAME.ctx;
    const camera = GAME.camera;

    // Clear
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Draw world zones
    GAME.world.zones.forEach(zone => {
        const screenX = zone.x - camera.x;
        const screenY = zone.y - camera.y;

        // Zone background
        ctx.fillStyle = zone.color + '20';
        ctx.fillRect(screenX, screenY, zone.width, zone.height);

        // Zone border
        ctx.strokeStyle = zone.color + '80';
        ctx.lineWidth = 3;
        ctx.strokeRect(screenX, screenY, zone.width, zone.height);

        // Zone name (if close enough)
        const distToZone = Math.sqrt(
            Math.pow(GAME.player.x - (zone.x + zone.width/2), 2) +
            Math.pow(GAME.player.y - (zone.y + zone.height/2), 2)
        );

        if (distToZone < zone.width) {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(zone.name, screenX + zone.width/2, screenY + 40);
            ctx.font = '16px Arial';
            ctx.fillText(`Уровень ${zone.difficulty}`, screenX + zone.width/2, screenY + 65);
        }
    });

    // Draw decorations (behind everything)
    GAME.world.drawDecorations(ctx, camera);

    // Draw obstacles
    GAME.world.obstacles.forEach(obs => {
        const screenX = obs.x - camera.x;
        const screenY = obs.y - camera.y;

        ctx.fillStyle = obs.type === 'rock' ? '#555' : '#2d4a2b';
        ctx.fillRect(screenX, screenY, obs.width, obs.height);
    });

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = CONFIG.TILE_SIZE;
    const startX = Math.floor(camera.x / gridSize) * gridSize - camera.x;
    const startY = Math.floor(camera.y / gridSize) * gridSize - camera.y;

    for (let x = startX; x < CONFIG.CANVAS_WIDTH; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CONFIG.CANVAS_HEIGHT);
        ctx.stroke();
    }

    for (let y = startY; y < CONFIG.CANVAS_HEIGHT; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CONFIG.CANVAS_WIDTH, y);
        ctx.stroke();
    }

    // Draw enemies
    GAME.enemies.forEach(enemy => enemy.draw(ctx, camera));

    // Draw bosses
    GAME.bosses.forEach(boss => boss.draw(ctx, camera));

    // Draw other players
    GAME.otherPlayers.forEach(player => player.draw(ctx, camera));

    // Draw player
    GAME.player.draw(ctx, camera);

    // Draw projectiles
    drawProjectiles(ctx, camera);

    // Draw particles
    drawParticles(ctx, camera);

    // Draw ambient particles
    GAME.world.drawAmbientParticles(ctx, camera);

    // Draw damage texts
    drawDamageTexts(ctx, camera);

    // Current zone indicator
    const currentZone = GAME.world.getZoneAt(GAME.player.x, GAME.player.y);
    if (currentZone) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, CONFIG.CANVAS_HEIGHT - 60, 250, 50);
        ctx.fillStyle = currentZone.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(currentZone.name, 20, CONFIG.CANVAS_HEIGHT - 35);
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(`Уровень сложности: ${currentZone.difficulty}`, 20, CONFIG.CANVAS_HEIGHT - 18);
    }
}

// ============================================
// GAME LOOP
// ============================================

function startGameLoop() {
    // Auto-save every 30 seconds
    setInterval(() => {
        if (GAME.player && !GAME.isGuest) {
            GAME.player.saveProgress();
        }
    }, 30000);

    function loop() {
        const now = Date.now();
        const deltaTime = now - GAME.lastUpdate;
        GAME.lastUpdate = now;

        // Update
        handlePlayerInput();
        GAME.player.update(deltaTime);
        GAME.camera.follow(GAME.player);

        GAME.enemies.forEach(enemy => enemy.update(deltaTime));
        GAME.bosses.forEach(boss => boss.update(deltaTime));

        updateProjectiles(deltaTime);
        updateParticles(deltaTime);
        updateDamageTexts(deltaTime);

        // Update ambient particles
        const currentZone = GAME.world.getZoneAt(GAME.player.x, GAME.player.y);
        GAME.world.spawnAmbientParticles(currentZone);
        GAME.world.updateAmbientParticles(deltaTime);

        // Render
        render();

        GAME.gameLoop = requestAnimationFrame(loop);
    }

    loop();
}

// ============================================
// UTILITY
// ============================================

window.addEventListener('beforeunload', () => {
    if (GAME.socket) {
        GAME.socket.disconnect();
    }
});
