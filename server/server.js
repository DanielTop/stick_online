// ============================================
// STICK MMO - MULTIPLAYER SERVER
// ============================================

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');

const PORT = process.env.PORT || 3000;

// Disable caching for all static files
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Game state
const gameState = {
    players: {},
    enemies: {},
    bosses: {},
    projectiles: []
};

// Player management
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Player joins
    socket.on('player-join', (data) => {
        gameState.players[socket.id] = {
            id: socket.id,
            x: data.x,
            y: data.y,
            power: data.power,
            level: data.level || 1,
            nickname: data.nickname || 'Player',
            health: 100,
            rotation: 0,
            connectedAt: Date.now()
        };

        console.log(`Player "${data.nickname || 'Player'}" (${socket.id}) joined at (${data.x}, ${data.y}) with power: ${data.power}`);

        // Send current players to new player
        socket.emit('players', gameState.players);

        // Broadcast new player to others
        socket.broadcast.emit('player-joined', {
            id: socket.id,
            ...gameState.players[socket.id]
        });
    });

    // Player movement
    socket.on('player-move', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = data.x;
            gameState.players[socket.id].y = data.y;
            gameState.players[socket.id].rotation = data.rotation;
            gameState.players[socket.id].level = data.level;
        }
    });

    // Player attack/projectile
    socket.on('projectile', (data) => {
        const projectile = {
            id: Date.now() + Math.random(),
            owner: socket.id,
            x: data.x,
            y: data.y,
            vx: data.vx,
            vy: data.vy,
            damage: data.damage,
            color: data.color,
            createdAt: Date.now()
        };

        gameState.projectiles.push(projectile);

        // Broadcast to all players
        io.emit('projectile-spawned', projectile);
    });

    // Player takes damage
    socket.on('player-damage', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].health = data.health;

            // Broadcast to all players
            io.emit('player-damaged', {
                id: socket.id,
                health: data.health
            });
        }
    });

    // Player levels up
    socket.on('player-levelup', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].level = data.level;

            // Broadcast to all players
            io.emit('player-levelup', {
                id: socket.id,
                level: data.level
            });
        }
    });

    // PvP - Player hits another player
    socket.on('player-hit', (data) => {
        const attacker = gameState.players[socket.id];
        const target = gameState.players[data.targetId];

        if (attacker && target) {
            // Apply damage to target
            target.health = Math.max(0, target.health - data.damage);

            // Broadcast damage to all players
            io.emit('player-damaged', {
                id: data.targetId,
                health: target.health,
                attackerId: socket.id
            });

            // Check if target died
            if (target.health <= 0) {
                // Notify all players about death
                io.emit('player-died', {
                    id: data.targetId,
                    killerId: socket.id
                });

                // Respawn target
                setTimeout(() => {
                    if (gameState.players[data.targetId]) {
                        gameState.players[data.targetId].health = 100;
                        io.emit('player-respawned', {
                            id: data.targetId
                        });
                    }
                }, 3000);
            }
        }
    });

    // Enemy/Boss damage
    socket.on('enemy-damage', (data) => {
        // Broadcast enemy damage to all players
        io.emit('enemy-damaged', {
            id: data.id,
            health: data.health,
            type: data.type
        });
    });

    // Enemy/Boss death
    socket.on('enemy-death', (data) => {
        // Broadcast enemy death to all players
        io.emit('enemy-died', {
            id: data.id,
            type: data.type
        });
    });

    // Chat message
    socket.on('chat-message', (message) => {
        io.emit('chat-message', {
            id: socket.id,
            message: message,
            timestamp: Date.now()
        });
    });

    // Player disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        delete gameState.players[socket.id];

        // Broadcast to all players
        io.emit('player-left', socket.id);
    });
});

// Send game state updates to all clients periodically
setInterval(() => {
    // Send player positions to all clients
    io.emit('players', gameState.players);

    // Clean up old projectiles (older than 10 seconds)
    const now = Date.now();
    gameState.projectiles = gameState.projectiles.filter(
        proj => now - proj.createdAt < 10000
    );
}, 50); // 20 times per second

// Server status endpoint
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        players: Object.keys(gameState.players).length,
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

// Start server
http.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║       STICK MMO SERVER RUNNING        ║
╚═══════════════════════════════════════╝

🌐 Server: http://localhost:${PORT}
🎮 Players: 0
⚡ Status: Online

Waiting for players to connect...
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    http.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    http.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
