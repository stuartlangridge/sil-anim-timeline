#!/bin/bash

while true; do
    inotifywait -q -e modify embed.js timeline.html timeline.css timeline.js display.html
    node bundler.js
done

