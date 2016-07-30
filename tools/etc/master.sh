#!/bin/bash

APPDIR=$(dirname $0)/..

if [ -f $APPDIR/../standalone/env.sh ]; then
    . $APPDIR/../standalone/env.sh
else
    export PATH=/home/isucon/.ndenv/shims:/home/isucon/.ndenv/bin:$PATH
fi

cd $APPDIR
exec node master.js
