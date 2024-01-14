const http = require('http');
const { parse } = require('querystring');
const AWS = require('aws-sdk');

// Create an S3 instance
const s3 = new AWS.S3();
// Constants for AWS S3 configuration
const bucketName = 'cyclic-vast-hare-lab-coat-eu-west-3';
const s3Key = 'leaderboard.json'; // Set the key (filename) in S3

let users = [];

// Enum-like object for Minesweeper difficulty levels
const MinesweeperDifficulty = {
    EASY: 'EASY',
    MEDIUM: 'MEDIUM',
    HARD: 'HARD'
};

// Function to load user data from S3
async function loadDataFromS3() {
    const s3Params = {
        Bucket: bucketName,
        Key: s3Key,
    };

    try {
        const data = await s3.getObject(s3Params).promise();
        const { users: loadedUsers } = JSON.parse(data.Body.toString());

        users = loadedUsers;

        console.log('Data loaded from S3.');
    } catch (error) {
        console.error('Error loading data from S3:', error);
    }
}

// Function to save user data to S3
async function saveDataToS3() {
    const s3Params = {
        Bucket: bucketName,
        Key: s3Key,
        Body: JSON.stringify({ users }),
        ContentType: 'application/json',
    };

    try {
        await s3.putObject(s3Params).promise();
        console.log('Data saved to S3.');
    } catch (error) {
        console.error('Error saving data to S3:', error);
    }
}


function handleLogin(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        const formData = parse(body);
        const { username, score, time, difficulty } = formData;
        
        // Convert difficulty string to MinesweeperDifficulty enum
        const enumDifficulty = MinesweeperDifficulty[difficulty];
        
        // Convert time string to total minutes
        const totalMinutes = convertTimeToMinutes(time);
        console.log(totalMinutes);
        console.log(enumDifficulty);
        
        if (username && score && time && enumDifficulty) {
            users.push({ username, score, time, difficulty: enumDifficulty });
        
            // Sort the users
            sortUsers();
        
            await saveDataToS3();
            res.writeHead(302, { 'Location': '/' });
            res.end();
        } else {
            displayLoginForm(res, 'Invalid input');
        }

    });
}

// Helper function to convert time string to total minutes input format: [mm:ss]
function convertTimeToMinutes(time) {
    const [minutes, seconds] = time.split(':');
    return parseInt(minutes, 10) * 60 + parseInt(seconds, 10);
}

async function displayLoginForm(res, message = '') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(`
        <html>
        <head>
            <title>Login Counter</title>
        </head>
        <body>
            <h1>Login Counter</h1>
            <p>${message}</p>
            <form method="post">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
                <label for="score">Score:</label>
                <input type="text" id="score" name="score" required>
                <label for="time">Time:</label>
                <input type="text" id="time" name="time" required>
                <label for="difficulty">Difficulty:</label>
                <input type="text" id="difficulty" name="difficulty" required>
                <button type="submit">Login</button>
            </form>
            <p><a href="/users">View Users</a></p>
        </body>
        </html>
    `);
    res.end();
}

function displayUsers(res) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write(`
        <html>
        <head>
            <title>User List</title>
        </head>
        <body>
            <h1>User List</h1>
            <ul>
                ${users.map(user => `<li>${user.username} - Score: ${user.score}, Time: ${user.time}, Difficulty: ${user.difficulty}</li>`).join('')}
            </ul>
            <p><a href="/">Back to Login</a></p>
        </body>
        </html>
    `);
    res.end();
}

function displayRawData(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify({ users }));
    res.end();
}

function handleSubmit(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        const formData = JSON.parse(body);
        const { username, score, time, difficulty } = formData;

        if (username && score && time && difficulty) {
            users.push({ username, score, time, difficulty });

            sortUsers();

            await saveDataToS3();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.write(JSON.stringify({ success: true, message: 'Data submitted successfully.' }));
            res.end();
        } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.write(JSON.stringify({ success: false, message: 'Invalid input.' }));
            res.end();
        }
    });
}

function sortUsers(){
    // Sort the users array based on the specified criteria
    // Criteria: From Hard to Easy difficulty
    // Then from the most to the least Score
    // Then from the least to the most Time
    users.sort((a, b) => {
        const difficultyComparison = Object.keys(MinesweeperDifficulty).indexOf(b.difficulty) - Object.keys(MinesweeperDifficulty).indexOf(a.difficulty);
        if (difficultyComparison === 0) {
            const scoreComparison = b.score - a.score;
            if (scoreComparison === 0) {
                // Convert time to minutes for correct comparison
                return convertTimeToMinutes(a.time) - convertTimeToMinutes(b.time);
            }
            return scoreComparison;
        }
        return difficultyComparison;
    });
    
    // Limit the users array to a size of 5
    users = users.slice(0, 5);
}

async function startServer() {
    await loadDataFromS3(); // Load data from S3 before starting the server

    const server = http.createServer((req, res) => {
        if (req.method === 'POST') {
            if (req.url === '/submit') {
                handleSubmit(req, res);
            } else if (req.url === '/erase') {
                handleManage(req, res);
            } else {
                handleLogin(req, res);
            }
        }
        else if (req.url === '/erase') {
            handleManage(req, res);
        } else if (req.url === '/users') {
            displayUsers(res);
        } else if (req.url === '/raw') {
            displayRawData(res);
        } else {
            displayLoginForm(res);
        }
    });

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}/`);
    });
}

// New function to handle management requests
function handleManage(req, res) {
    if (req.url === '/erase' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const formData = parse(body);
            const password = formData.password;

            // Check if the provided password is correct
            if (password === 'admin') {
                // Erase data from S3
                try {
                    await s3.deleteObject({
                        Bucket: bucketName,
                        Key: s3Key,
                    }).promise();

                    console.log('Data erased from S3.');
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.write('Data erased from S3.');
                    res.end();
                } catch (error) {
                    console.error('Error erasing data from S3:', error);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.write('Internal Server Error');
                    res.end();
                }
                // Empty the users array
                users = [];
            } else {
                // Incorrect password
                res.writeHead(401, { 'Content-Type': 'text/plain' });
                res.write('Unauthorized');
                res.end();
            }
        });
    } else {
        // Display the management form
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write(`
            <html>
            <head>
                <title>Erase all data</title>
            </head>
            <body>
                <h1>Erase all data</h1>
                <form method="post">
                    <label for="password">Password:</label>
                    <input type="password" id="password" name="password" required>
                    <button type="submit">Erase</button>
                </form>
            </body>
            </html>
        `);
        res.end();
    }
}




startServer();
