/**
 * Created by massi on 30/08/15.
 */
var io=require('socket.io-client');

var socket= io.connect('http://192.168.1.111:3000');

console.log("GET BrowseLibrary\n\n");
socket.emit('setMultiroom', {ip:'http://192.168.1.110:3000',set:'single',volume:100});

socket.on('pushMultiroom',function(data)
{
    console.log(JSON.stringify(data));
});


