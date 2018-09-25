#!/bin/bash

function volumeup {
gpio mode 21 out
gpio write 21 1
sleep 0.05
gpio write 21 0
sleep 0.2
}

function micup {
gpio mode 5 out
gpio write 5 1
sleep 0.05
gpio write 5 0
sleep 0.2  
}

function karaokeoff {
gpio mode 23 out
gpio write 23 0
}

function startvolume {
volumeup
volumeup
volumeup
volumeup
volumeup
volumeup
}

function setmic {
micup
micup
micup
micup
micup
micup
}

echo "Setting start volume"
startvolume
echo "Setting Micplus"
setmic
echo "Seeting Karaoke OFF"

