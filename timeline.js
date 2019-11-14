(function() {
    /* Loads inside the timeline iframe; handles the timeline itself, and
       messages to and from the master embed.js */

    const connectTimelineHandlers = () => {
        const tml = document.getElementById("sil-anim-timeline");
        const rng = tml.querySelector(".sat-numbers input");
        const scl = tml.querySelector(".sat-numbers ul");
        const thm = tml.querySelector(".sat-numbers .thumb");
        const end = tml.querySelector(".sat-controls input");
        const ply = tml.querySelector(".sat-controls button.sat-play");
        const widthOfThumb = 20;
        const widthOfLeftGapBeforeSlider = 3;
        let w = rng.getBoundingClientRect().width - widthOfThumb - widthOfLeftGapBeforeSlider;
        const setInput = () => {
            const frac = rng.valueAsNumber / rng.max;
            thm.style.transform = "translateX(" + (frac * w) + "px)"
            thm.innerHTML = rng.valueAsNumber;
        }
        rng.oninput = setInput;
        setInput();

        let endRedrawScaleTimeout;
        end.oninput = () => {
            rng.max = end.valueAsNumber;
            scl.innerHTML = "";
            clearTimeout(endRedrawScaleTimeout);
            endRedrawScaleTimeout = setTimeout(redrawScale, 100);
            setInput();
        }

        const redrawScale = () => {
            const steps = 6;
            const step = Math.floor(rng.max / steps);
            for (var i=0; i<=steps; i++) {
                let li = document.createElement("li");
                li.innerHTML = step * i + "";
                scl.appendChild(li);
            }
        }
        redrawScale();

        if (window.ResizeObserver) {
            const rso = new ResizeObserver(entries => {
                w = entries[0].contentBoxSize.inlineSize - widthOfThumb - widthOfLeftGapBeforeSlider;
                setInput();
            });
            rso.observe(tml);
        }

        ply.addEventListener("click", async () => {
            window.parent.postMessage({action: "play-button"}, "*");
        }, false);
    }

    const selectionchange = selection => {
        if (selection.length === 0) {
            document.querySelector("#sil-anim-timeline .sat-controls button.sat-record").disabled = true;
        } else {
            document.querySelector("#sil-anim-timeline .sat-controls button.sat-record").disabled = false;
        }
    }

    const createMessageListener = () => {
        window.addEventListener("message", event => {
            console.log("message in timeline from parent", event.data);
            if (event.data.action == "selection") {
                selectionchange(event.data.details);
            }
        }, false);
    }

    const init = () => {
        connectTimelineHandlers();
        createMessageListener();
        console.log("sil-anim-timeline timeline ready for action!");
    }
    init();


})()
