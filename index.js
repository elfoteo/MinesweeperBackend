const http = require('http');
const { parse } = require('querystring');
const AWS = require('aws-sdk');

// Create an S3 instance
const s3 = new AWS.S3();
const bucketName = 'cyclic-vast-hare-lab-coat-eu-west-3';
const s3Key = 'data.json'; // Set the key (filename) in S3

let users = [];

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

        if (username && score && time && difficulty) {
            users.push({ username, score, time, difficulty });
            await saveDataToS3();
            res.writeHead(302, { 'Location': '/' });
            res.end();
        } else {
            displayLoginForm(res, 'Invalid input');
        }
    });
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

async function startServer() {
    await loadDataFromS3(); // Load data from S3 before starting the server

    const server = http.createServer((req, res) => {
        if (req.method === 'POST') {
            if (req.url === '/submit') {
                handleSubmit(req, res);
            } else {
                handleLogin(req, res);
            }
        } else if (req.url === '/users') {
            displayUsers(res);
        } else if (req.url === '/raw') {
            displayRawData(res);
        } else {
            displayLoginForm(res);
        }
    });

    // Rest of your code remains unchanged

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}/`);
    });
}



startServer();
