/**
 * Created by massi on 30/08/15.
 */
var io=require('socket.io-client');

var socket= io.connect('http://192.168.1.111:3000');

console.log("GET BrowseLibrary\n\n");
socket.emit('reboot');

socket.on('pushMultiroom',function(data)
{
    console.log(JSON.stringify(data));
});


