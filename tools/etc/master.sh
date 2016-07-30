#!/bin/bash

APPDIR=$(dirname $0)/..

if [ -f $APPDIR/../../standalone/env.sh ]; then
    . $APPDIR/../../standalone/env.sh
else
    export PATH=$PATH:/home/isucon/.nvm/v0.4.11/bin
    export NODE_PATH=/home/isucon/node_modules/
fi

cd $APPDIR
exec node master.js
