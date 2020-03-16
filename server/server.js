const HTTPS_PORT = 8443;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

// Yes, TLS is required
const serverConfig = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
};

// ----------------------------------------------------------------------------------------

// Create a server for the client html page
const handleRequest = function(request, response) {
    // Render the single client html file for any request the HTTP server receives
    console.log('request received: ' + request.url);

    if (request.url === '/webrtc.js') {
        response.writeHead(200, { 'Content-Type': 'application/javascript' });
        response.end(fs.readFileSync('client/webrtc.js'));
    } else if (request.url === '/vconsole.min.js') {
        response.writeHead(200, { 'Content-Type': 'application/javascript' });
        response.end(fs.readFileSync('vconsole.min.js'));
    } else {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(fs.readFileSync('client/index.html'));
    }
};

const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({ server: httpsServer });

wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        // Broadcast any received message to all clients
        console.log('received: %s', message);
        var recieveData = JSON.parse(message)
        if (recieveData.type) {
            switch (recieveData.type) {
                case 'init':
                    wss.initRoom(recieveData.room);
                    break;
                default:
                    break;
            }
        } else {
            wss.broadcast(message);
        }
    });
});

wss.broadcast = function(data) {
    this.clients.forEach(function(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
};

//添加房间的概念
wss.roomList = [];
wss.initRoom = function(room) {
    if (wss.roomList.indexOf(room) >= 0) {

    } else {
        wss.roomList.push(room);
    }
}

console.log('Server running. Visit https://localhost:' + HTTPS_PORT + ' in Firefox/Chrome.\n\n\
Some important notes:\n\
  * Note the HTTPS; there is no HTTP -> HTTPS redirect.\n\
  * You\'ll also need to accept the invalid TLS certificate.\n\
  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.\n');