#!/bin/sh
cd /volumio/app/plugins/music_service/volspotconnect2
./vollibrespot -b 320  -c /tmp  \
                  --disable-audio-cache \
                  --name 'AxiomAir-33112d-MR' --initial-volume 80\
                  --backend pipe --device /tmp/snapfifo --verbose
