const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid'); // For generating unique game session IDs
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

let games = {}; // Store the game sessions and players

// Serve static files (HTML, CSS, JS for the frontend)
app.use(express.static(path.join(__dirname,'public')));

// Route to create a new game session
app.get('/create', (req, res) => {
    const gameId = uuidv4(); // Generate unique game ID
    games[gameId] = {
        players: [],
        board: Array(9).fill(null), // 3x3 Tic Tac Toe grid
    };
    res.redirect(`/game/${gameId}`); // Redirect to the game page
});

// Route for players to join a game
app.get('/game/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    if (games[gameId]) {
        res.sendFile(path.join(__dirname, 'public', 'index.html')); // Serve the game page
    } else {
        res.status(404).send('Game not found');
    }
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    // Player joins a game
    socket.on('joinGame', ({ gameId }) => {
        if (games[gameId]) {
            const game = games[gameId];

            // Check if the game is full
            if (game.players.length < 2) {
                game.players.push(socket.id); // Add player to the game
                socket.join(gameId); // Join the room corresponding to the game

                // Notify the player about their role (Player 1 or Player 2)
                const playerNumber = game.players.length;
                socket.emit('playerJoined', { playerNumber });

                // If two players have joined, start the game
                if (game.players.length === 2) {
                    io.to(gameId).emit('startGame');
                    io.to(gameId).emit('emptyscreen');
                } else {
                    socket.emit('waitingForPlayer');
                }
            } else {
                socket.emit('gameFull'); // If two players are already present
            }
        } else {
            socket.emit('gameNotFound');
        }
    });

    // Handle game moves
    socket.on('makeMove', ({ gameId, index, symbol }) => {
        var game = games[gameId];
        if (game && game.players.includes(socket.id)) {
            // Update the game board
            game.board[index] = symbol;

            // Broadcast the move to the other player
            io.to(gameId).emit('moveMade', { index, symbol });
        }
    });
    //winner has been decided
    socket.on('winningPlayer',({xo})=>{
        socket.emit('winner',({xo}));
    });
    // Handle disconnects
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        // Find and remove the player from their game
        for (const gameId in games) {
            const game = games[gameId];
            const playerIndex = game.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                // Notify the other player if someone leaves
                io.to(gameId).emit('playerLeft');
                break;
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/create`);
});
