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
        const rec = tml.querySelector(".sat-controls button.sat-record");
        const dl = tml.querySelector(".sat-controls button.sat-dl");
        const ovl = tml.querySelector(".sat-kf-button-overlay");
        const cnc = tml.querySelector(".sat-kf-button-overlay button.sat-kf-button-cancel");
        const eas = tml.querySelector(".sat-kf-button-overlay button.sat-kf-button-easing");
        const dlt = tml.querySelector(".sat-kf-button-overlay button.sat-kf-button-delete");
        const jmp = tml.querySelector(".sat-kf-button-overlay button.sat-kf-button-jump");
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
        dl.addEventListener("click", async () => {
            window.parent.postMessage({action: "download-button"}, "*");
        }, false);
        rec.addEventListener("click", async () => {
            window.parent.postMessage({
                action: "record-button",
                frame: document.querySelector("#sil-anim-timeline .sat-numbers input").valueAsNumber
            }, "*");
        }, false);
        cnc.addEventListener("click", async () => {
            ovl.style.display = "none";
        }, false);
        eas.addEventListener("click", async () => {
            console.log("easing not implemented");
        }, false);
        jmp.addEventListener("click", async () => {
            window.parent.postMessage({
                action: "jump",
                frame: ovl.dataset.frame,
                node_id: ovl.dataset.node_id
            }, "*");
        }, false);
        dlt.addEventListener("click", async () => {
            window.parent.postMessage({
                action: "delete-keyframe",
                frame: ovl.dataset.frame,
                node_id: ovl.dataset.node_id
            }, "*");
            ovl.style.display = "none";
        }, false);
    }

    const makeTimelineButton = (figma_id, row, frame) => {
        let composition_length = document.querySelector("#sil-anim-timeline .sat-numbers input").max;
        if (!row) {
            row = document.querySelector("#sil-anim-timeline .sat-keyframes [data-figma-id='" + figma_id + "']");
        }
        if (!row) {
            row = document.createElement("div");
            row.className = "row";
            row.dataset.figmaId = figma_id;
            document.querySelector("#sil-anim-timeline .sat-keyframes").appendChild(row);
        }
        /* button click */
        let kf = document.createElement("button");
        kf.onclick = () => {
            if (dragging) return;
            const ovl = document.querySelector(".sat-kf-button-overlay");
            ovl.dataset.frame = frame;
            ovl.dataset.node_id = figma_id;
            ovl.style.display = "block";
        }
        /* button position */
        let xpos_pc = ((frame / composition_length) * 100);
        kf.style.left = xpos_pc + "%";
        /* button move */

        let dragging = false;
        let dragStartX, dragNowX, row_bounds, button_bounds;
        const thumbDragger = document.querySelector("#sil-anim-timeline .sat-numbers .thumb.dragger");
        const mm = e => {
            dragNowX = e.pageX;
            if (Math.abs(dragNowX - dragStartX) > 5) {
                dragging = true;
                let nx = button_bounds.x + dragNowX - dragStartX;
                if (nx > row_bounds.width) nx = row_bounds.width;
                if (nx < 0) nx = 0;
                let dnx = nx - button_bounds.x;
                kf.style.transform = "translateX(" + dnx + "px)";
                thumbDragger.style.transform = "translateX(" + dnx + "px)";
                let frame = Math.round((nx / row_bounds.width) * composition_length);
                thumbDragger.innerHTML = frame;
                thumbDragger.style.display = "flex";
            }
        }
        const mu = e => {
            dragNowX = e.pageX;
            if (Math.abs(dragNowX - dragStartX) > 5) {
                let dest_frame = parseInt(thumbDragger.innerHTML, 10);
                console.log("frame is", dest_frame);
                e.preventDefault();
                window.parent.postMessage({
                    action: "move-keyframe",
                    frame_before: frame,
                    frame_after: dest_frame,
                    node_id: figma_id
                }, "*");
            }
            document.removeEventListener("mousemove", mm, false);
            document.removeEventListener("mouseup", mu, false);
            thumbDragger.style.display = "none";
            kf.style.transform = "";
            kf.style.opacity = 1;
            setTimeout(() => { dragging = false; }, 150); // click will fire while still true so can ignore
        }
        kf.onmousedown = e => {
            dragStartX = e.pageX;
            dragNowX = e.pageX;
            document.addEventListener("mousemove", mm, false);
            document.addEventListener("mouseup", mu, false);
            row_bounds = row.getBoundingClientRect();
            button_bounds = kf.getBoundingClientRect();
            kf.style.opacity = 0.5;
            thumbDragger.style.left = (button_bounds.x - 5) + "px";
        }
        row.appendChild(kf);
    }

    const selectionchange = keyframed_nodes => {
        if (keyframed_nodes.length === 0) {
            document.querySelector("#sil-anim-timeline .sat-controls button.sat-record").disabled = true;
            document.querySelector("#sil-anim-timeline .sat-keyframes").innerHTML = "";
        } else {
            document.querySelector("#sil-anim-timeline .sat-controls button.sat-record").disabled = false;
            document.querySelector("#sil-anim-timeline .sat-keyframes").innerHTML = "";
            keyframed_nodes.forEach(kn => {
                let row = document.createElement("div");
                row.className = "row";
                row.dataset.figmaId = kn.figma_id;
                Object.keys(kn.keyframes).forEach(frame => {
                    makeTimelineButton(kn.figma_id, row, frame);
                })
                if (Object.keys(kn.keyframes).length > 0) {
                    document.querySelector("#sil-anim-timeline .sat-keyframes").appendChild(row);
                }
            });
        }
    }

    const createMessageListener = () => {
        window.addEventListener("message", event => {
            if (event.data.action == "selection") {
                selectionchange(event.data.details);
            } else if (event.data.action == "record-complete") {
                event.data.figma_ids.forEach(figma_id => {
                    makeTimelineButton(figma_id, null, event.data.frame);
                });
            } else {
                console.log("unrecognised event in timeline", event.data);
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
