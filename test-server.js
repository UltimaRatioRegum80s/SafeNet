// Simple test server to verify SafeLy is working
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SafeLy - Community Safety Hub</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 20px;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            max-width: 600px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        .logo { font-size: 4rem; margin-bottom: 10px; }
        h1 { font-size: 3rem; margin: 0 0 10px 0; font-weight: 700; }
        p { font-size: 1.2rem; opacity: 0.9; margin-bottom: 30px; line-height: 1.5; }
        .button {
            background: white;
            color: #0ea5e9;
            border: none;
            padding: 15px 30px;
            font-size: 1.1rem;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
            margin: 10px;
        }
        .button:hover { 
            transform: scale(1.05); 
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .status {
            background: rgba(255, 255, 255, 0.2);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .check { color: #4ade80; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🛡️</div>
        <h1>SafeLy</h1>
        <p>Your Neighborhood Safety Community</p>
        
        <div class="status">
            <h3>Server Status Check</h3>
            <p class="check">✓ Test server is running on port 3001</p>
            <p class="check">✓ SafeLy React app should be running on port 5000</p>
            <p>If you can see this page, the server infrastructure is working correctly.</p>
        </div>
        
        <button class="button" onclick="window.location.href='http://localhost:5000'">
            Go to SafeLy App (Port 5000)
        </button>
        
        <button class="button" onclick="location.reload()">
            Refresh Test
        </button>
    </div>
    
    <script>
        console.log('SafeLy test server loaded successfully');
        console.log('Main app should be available at: http://localhost:5000');
    </script>
</body>
</html>
    `);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`SafeLy test server running on http://localhost:${PORT}`);
  console.log('Main SafeLy app should be running on http://localhost:5000');
});