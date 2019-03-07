#!/bin/sh
cd /volumio/app/plugins/music_service/volspotconnect2
./vollibrespot -b 320  -c /tmp  \
                  --disable-audio-cache \
                  --name 'AxiomAir-33112d' --initial-volume 50\
                  --device volume  \
#                  --verbose
