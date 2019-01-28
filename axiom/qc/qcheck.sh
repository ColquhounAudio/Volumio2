#!/bin/bash
RTC="false"
APC="false"
TIME="false"
MODULE="8192cu"

gpio -g mode 5 out
gpio -g mode 6 out
gpio -g write 5 0
gpio -g write 6 0

echo "Setting date in May 2018"
/bin/date --set 20180525
echo "QC: Updating Time"
#/usr/sbin/ntpd  -qg
hwclock --systohc
i2cdetect -y 1

echo "QC: First Run, doing quality check"

sync
function findrtc {
mapfile -t data < <(i2cdetect -y 1)

for i in $(seq 1 ${#data[@]}); do
    line=(${data[$i]})
    echo ${line[@]:1} | grep -q 11
    if [ $? -eq 0 ]; then
        RTC="true"
    fi
done
if [ "$RTC" = "true" ]; then
        echo "RTC is present."
else
        echo "RTC not found"
fi
}


function findapplechip {
mapfile -t data < <(i2cdetect -y 1)

  for i in $(seq 1 ${#data[@]}); do
      line=(${data[$i]})
      echo ${line[@]:1} | grep -q UU
      if [ $? -eq 0 ]; then
          APC="true"
      fi
  done
  if [ "$APC" = "true" ]; then
          echo "Apple Chip is present."
  else
          echo "Apple Chip not found"
  fi
}

function settime {
  hwclock --hctosys
}

function checktime {
  YEAR=$(date +%Y)
  if [ "$TIME" == "1970" ]; then
    TIME="false"
    echo "Time was not set properly"
else
    TIME="true"
    echo "Time properly set"
fi
}

function testsound {
    /usr/bin/amixer -M set -c 0 "Digital" 60%
if [[ "$RTC" == "true" && "$APC" == "true" && "$TIME" == "true" ]]; then
      echo "All tests passed"

      /usr/bin/aplay /volumio/axiom/qc/passed.wav


	/bin/systemctl disable qualitycheck.service
        /bin/systemctl stop qualitycheck.service


else
    echo "Quality Check Failed"

     /usr/bin/aplay /volumio/axiom/qc/failed.wav
     /usr/bin/aplay /volumio/axiom/qc/failed.wav
     /usr/bin/aplay /volumio/axiom/qc/failed.wav
    sleep 10
fi
}


echo "Testing RTC"
findrtc
echo "Adding Network Time to RTC"
settime
echo "Checking if proper time has been set"
checktime
echo "Testing Apple Chip"
findapplechip
testsound

sync

exit 0
