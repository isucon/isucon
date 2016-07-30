#!/bin/bash

APPDIR=$(dirname $0)/..

if [ -f $APPDIR/../standalone/env.sh ]; then
    . $APPDIR/../standalone/env.sh
else
    export PATH=/home/isucon/.ndenv/shims:/home/isucon/.ndenv/bin:$PATH
    export NODE_PATH=/home/isucon/isucon/tools/lib:$NODE_PATH
fi

cd $APPDIR
exec node agent.js
