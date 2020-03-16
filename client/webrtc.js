var localVideo;
var localStream;
var remoteVideo;
var peerConnection;
var uuid;
var serverConnection;
var senddataChannel;
var receiveChannel;

var photo;
var photoContext;
var photoContextW;
var photoContextH;
var trail;


var peerConnectionConfig = {
    'iceServers': [
        { 'urls': 'stun:stun.stunprotocol.org:3478' },
        { 'urls': 'stun:stun.l.google.com:19302' },
    ]
};

function pageReady() {
    uuid = createUUID();

    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');


    photo = document.getElementById('photo');
    photoContext = photo.getContext('2d');
    trail = document.getElementById('trail');

    // serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
    serverConnection = new WebSocket('wss://299c1204s2.qicp.vip:42655');
    serverConnection.onmessage = gotMessageFromServer;
    serverConnection.onopen = openSocket;

    var constraints = {
        video: true,
        audio: true,
    };

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
    } else {
        alert('Your browser does not support getUserMedia API');
    }
}

function getUserMediaSuccess(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
}

function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.ondatachannel = receiveChannelCallback;
    peerConnection.addStream(localStream);

    if (isCaller) {

        senddataChannel = peerConnection.createDataChannel('dataChannel');
        onDataChannelCreated(senddataChannel);

        peerConnection.createOffer().then(createdDescription).catch(errorHandler);
    }
}

function openSocket() {
    serverConnection.send(JSON.stringify({ 'type': 'init', 'room': GetRequest('room') }));
}


function gotMessageFromServer(message) {
    if (!peerConnection) start(false);

    var signal = JSON.parse(message.data);

    // Ignore messages from ourself
    if (signal.uuid == uuid) return;

    if (GetRequest('room') == signal.room) {
        if (signal.sdp) {
            peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {
                // Only create answers in response to offers
                if (signal.sdp.type == 'offer') {
                    peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
                }
            }).catch(errorHandler);
        } else if (signal.ice) {
            peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
        }
    }
}

function gotIceCandidate(event) {
    if (event.candidate != null) {
        serverConnection.send(JSON.stringify({ 'ice': event.candidate, 'uuid': uuid, 'room': GetRequest('room') }));
    }
}

function createdDescription(description) {
    console.log('got description');

    peerConnection.setLocalDescription(description).then(function() {
        serverConnection.send(JSON.stringify({ 'sdp': peerConnection.localDescription, 'uuid': uuid, 'room': GetRequest('room') }));
    }).catch(errorHandler);
}

function gotRemoteStream(event) {
    console.log('got remote stream');
    remoteVideo.srcObject = event.streams[0];

    remoteVideo.onloadedmetadata = function() {
        photo.width = photoContextW = remoteVideo.videoWidth;
        photo.height = photoContextH = remoteVideo.videoHeight;
    };
}

function errorHandler(error) {
    console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

//获取地址栏信息
function GetRequest(value) {
    //url例子：www.bicycle.com?id="123456"&Name="bicycle"；
    var url = decodeURI(location.search); //?id="123456"&Name="bicycle";
    var object = {};
    if (url.indexOf("?") != -1) //url中存在问号，也就说有参数。
    {
        var str = url.substr(1); //得到?后面的字符串
        var strs = str.split("&"); //将得到的参数分隔成数组[id="123456",Name="bicycle"];
        for (var i = 0; i < strs.length; i++) {　　　　　　　　
            object[strs[i].split("=")[0]] = strs[i].split("=")[1]　　　
        }　　
    }
    return object[value];
}


/**
 * 
 * 发送消息  发送消息  发送消息  发送消息 发送消息
 */

//create 发送消息
function CreatesendData() {
    let data = document.getElementById("sendmsg_content").value;

    var _data = {
        type: 'message',
        data: data
    }
    senddataChannel.send(JSON.stringify(_data));
    trace('Sent Data: ' + data);
    document.getElementById("sendmsg_content").value = '';
}

//recieve 发送消息
function RecievesendData() {
    let data = document.getElementById("sendmsg_content").value;
    var _data = {
        type: 'message',
        data: data
    }
    receiveChannel.send(JSON.stringify(_data));
    trace('Sent Data: ' + data);
    document.getElementById("sendmsg_content").value = '';
}

/**
 * 
 * 截图发送  截图发送  截图发送  截图发送 截图发送
 */

//截图并发送
function snapAndSend() {
    snapPhoto();
    sendPhoto();
}

/*
 * 截图 
 */
function snapPhoto() {
    photoContext.drawImage(remoteVideo, 0, 0, photo.width, photo.height);
}

/*
 * 发送截图
 */
function sendPhoto() {
    // Split data channel message in chunks of this byte length.
    var CHUNK_LEN = 64000;
    console.log('width and height ', photoContextW, photoContextH);

    var img = photoContext.getImageData(0, 0, photoContextW, photoContextH),
        len = img.data.byteLength,
        n = len / CHUNK_LEN | 0;

    console.log('Sending a total of ' + len + ' byte(s)');

    senddataChannel.send(len);

    // split the photo and send in chunks of about 64KB
    for (var i = 0; i < n; i++) {
        var start = i * CHUNK_LEN,
            end = (i + 1) * CHUNK_LEN;
        console.log(start + ' - ' + (end - 1));

        senddataChannel.send(img.data.subarray(start, end));
    }

    // send the reminder, if any
    if (len % CHUNK_LEN) {
        console.log('last ' + len % CHUNK_LEN + ' byte(s)');

        senddataChannel.send(img.data.subarray(n * CHUNK_LEN));
    }
}

//接收截图并显示
function RecievePhoto(data) {
    var canvas = document.createElement('canvas');
    canvas.width = photoContextW;
    canvas.height = photoContextH;
    canvas.classList.add('incomingPhoto');
    // trail is the element holding the incoming images
    trail.insertBefore(canvas, trail.firstChild);

    var context = canvas.getContext('2d');
    var img = context.createImageData(photoContextW, photoContextH);
    img.data.set(data);
    context.putImageData(img, 0, 0);
}


/**
 * 
 * 消息通道  消息通道  消息通道  消息通道 消息通道
 */

//创建消息通道
function onDataChannelCreated(channel) {
    console.log('onDataChannelCreated:', channel);

    channel.onopen = function() {
        console.log('CHANNEL opened!!!');
    };

    channel.onclose = function() {
        console.log('Channel closed.');
    }

    channel.onmessage = onCreatedmessageCallBack;
}

//create 接受消息
function onCreatedmessageCallBack(event) {
    trace('create Message');
    // dataChannelReceive.value = event.data;
    console.log(event.data);


    //接收的消息，与文件同时存在有问题

    var _data = JSON.parse(event.data);
    switch (_data.type) {
        case 'message':
            var p = document.createElement("p");
            p.innerHTML = _data.data;
            document.getElementById('recievemsg').appendChild(p);
            break;
        default:
            RecievePhoto(event.data);
            break;
    }
}


//recieve 接受消息通道
function receiveChannelCallback(event) {
    trace('Receive Channel Callback');
    receiveChannel = event.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
}

//recieve 接受消息状态改变的时候
function onReceiveChannelStateChange() {
    var readyState = receiveChannel.readyState;
    trace('Receive channel state is: ' + readyState);
}
//reiceve 接受消息
function onReceiveMessageCallback(event) {
    trace('Received Message');
    // dataChannelReceive.value = event.data;
    console.log(event.data);


    RecievePhoto(event.data);
    return;

    //接收的消息，与文件同时存在有问题

    var _data = JSON.parse(event.data);
    switch (_data.type) {
        case 'message':
            var p = document.createElement("p");
            p.innerHTML = _data.data;
            document.getElementById('recievemsg').appendChild(p);
            break;
        default:
            RecievePhoto(event.data);
            break;
    }
}





function trace(text) {
    if (text[text.length - 1] === '\n') {
        text = text.substring(0, text.length - 1);
    }
    if (window.performance) {
        var now = (window.performance.now() / 1000).toFixed(3);
        console.log(now + ': ' + text);
    } else {
        console.log(text);
    }
}