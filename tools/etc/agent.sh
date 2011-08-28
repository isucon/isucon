#!/bin/bash

APPDIR=$(dirname $0)/..

if [ -f $APPDIR/../../standalone/env.sh ]; then
    . $APPDIR/../../standalone/env.sh
else
    export PATH=$PATH:/Users/tagomoris/.nvm/v0.4.11/bin
    export NODE_PATH=/Users/tagomoris/node_modules/
fi

cd $APPDIR
exec node agent.js
