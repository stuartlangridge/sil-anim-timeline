window.silAnimTimelineTerminate = (function() {
    /* Embed file: contains the parts that interact with Figma,
       creates the iframe with the timeline in and positions it,
       and sends messages back and forth to the timeline */
    const TIMELINE_HTML = ``;
    const TIMELINE_CSS = ``;
    const TIMELINE_JS = ``;
    const DISPLAY_HTML = ``;

    const KEYFRAMABLE_PROPERTIES = new Set(["x", "y"]);

    let timelineWindow;

    const selectionchange = () => {
        if (window.figma.currentPage.selection.length === 0) {
            timelineWindow.postMessage({action: "selection", details: []});
        } else {
            let seldetails = window.figma.currentPage.selection.map(node => {
                return {
                    figma_id: node.id,
                    keyframes: JSON.parse(node.getSharedPluginData("silanimtimeline", "keyframe-data") || "{}")
                }
            });
            timelineWindow.postMessage({action: "selection", details: seldetails});
        }
    }

    const pagechange = () => {
        selectionchange();
    }

    const connectFigmaHandlers = () => {
        window.figma.on("selectionchange", selectionchange);
        window.figma.on("currentpagechange", pagechange);
    }


    const getSvgNamesForNodes = () => {
        let names = {};
        let nameIndices = {};
        window.figma.currentPage.findAll().forEach(o => {
            let index = "";
            if (nameIndices[o.name]) {
                index = "_" + (nameIndices[o.name] + 1);
                nameIndices[o.name] += 1
            } else {
                nameIndices[o.name] = 1;
            }
            names[o.name + index] = o;
        });
        return names;
    }

    const uninject = () => {
        // remove our previous code if it's in there
        const timeline_container = document.getElementById("sil-anim-timeline-container");
        if (timeline_container) timeline_container.remove();
        const timeline_script = document.getElementById("sil-anim-timeline-script");
        if (timeline_script) timeline_script.remove();
    }

    const actuallyPositionTimeline = (cont, cvs) => {
        const bb = cvs.getBoundingClientRect();
        cont.style.left = bb.x + "px";
        cont.style.width = bb.width + "px";
    }

    const positionTimeline = () => {
        const cont = document.getElementById("sil-anim-timeline-container");
        const cvs = document.querySelector("canvas");

        if (window.ResizeObserver) {
            const rso = new ResizeObserver(entries => {
                actuallyPositionTimeline(cont, cvs);
            });
            rso.observe(cont, cvs);
        }
        actuallyPositionTimeline(cont, cvs);
    }

    const inject = () => {
        let cont = document.createElement("iframe");
        cont.setAttribute("id", "sil-anim-timeline-container");
        cont.srcdoc = `<!doctype html>
        <html><head><style>${TIMELINE_CSS}</style></head>
        <body>${TIMELINE_HTML}<script>${TIMELINE_JS}</script></body></html>`;
        cont.style.height = "80px";
        cont.style.position = "fixed";
        cont.style.bottom = "0";
        cont.style.zIndex = "999";
        cont.setAttribute("scrolling", "no");

        document.body.appendChild(cont);
        timelineWindow = cont.contentWindow;
        positionTimeline();
    }

    const getSvgText = async () => {
        const im = await figma.currentPage.exportAsync({format:"SVG", svgIdAttribute: true});
        const svgtext = new TextDecoder("utf-8").decode(im);
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgtext, "image/svg+xml");
        const mapping = getSvgNamesForNodes();
        for (let calculated_svgname in mapping) {
            let svgel = doc.getElementById(calculated_svgname);
            if (!svgel) { continue; }
            let figmanode = mapping[calculated_svgname];
            let keyframe_data = figmanode.getSharedPluginData("silanimtimeline", "keyframe-data");
            if (!keyframe_data) {
                keyframe_data = {}
            } else {
                keyframe_data = JSON.parse(keyframe_data);
            }

            let keyframes = Object.keys(keyframe_data);
            if (keyframes.length > 0) {
                svgel.setAttribute("data-keyframes", keyframes.join(","));
            }
            for (var frame in keyframe_data) {
                for (var prop in keyframe_data[frame]) {
                    svgel.setAttribute(`data-keyframe-${frame}-${prop}`, keyframe_data[frame][prop]);
                }
            }
        }
        // there should now be no SVG elements with an ID but without a nodeid
        const unmatched = doc.querySelectorAll("[id]:not([data-figma-nodeid])");
        if (unmatched.length > 0) {
            console.warn("Failed to match up the following nodes:", unmatched);
        }
        const finaltext = new XMLSerializer().serializeToString(doc);
        return finaltext;
    }

    const downloadPressed = async () => {
        const svgtext = await getSvgText();
        const blob = new Blob([DISPLAY_HTML.replace("$SVG", svgtext)], { type: 'text/html' });
        const dl_url = window.URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = dl_url;
        a.download = window.figma.currentPage.name + ".html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    const playPressed = async () => {
        const svgtext = await getSvgText();
        const tl = document.getElementById("sil-anim-timeline-container");
        const tlbr = tl.getBoundingClientRect();
        let veil = document.createElement("div");
        let ifr = document.createElement("iframe");
        ifr.srcdoc = DISPLAY_HTML.replace("$SVG", svgtext);
        ifr.style.position = "fixed";
        ifr.style.bottom = (tlbr.height + 20) + "px";
        ifr.style.width = (tlbr.width * 0.8) + "px";
        ifr.style.height = (tlbr.width * 0.8) + "px";
        ifr.style.left = (tlbr.left + (tlbr.width * 0.1)) + "px";
        ifr.style.backgroundColor = "white";
        ifr.style.boxShadow = "0 0 20px 20px white";

        veil.style.position = "fixed";
        veil.style.top = 0;
        veil.style.left = 0;
        veil.style.width = "100vw";
        veil.style.height = "100vh";
        veil.style.zIndex = 1050;
        veil.style.backgroundColor = "rgba(0,0,0,0.7)";
        veil.appendChild(ifr);
        document.body.appendChild(veil);
        veil.onclick = () => { veil.remove(); }
    }

    const recordPressed = async (frame) => {
        figma.currentPage.selection.forEach(s => {
            let keyframe_data = {};
            // grab all properties from this node...
            let pp = s.__proto__;
            Object.getOwnPropertyNames(pp).map(
                prop => [prop, Object.getOwnPropertyDescriptor(pp, prop)]
            )
                // which have getters
                .filter(d => d[1].get)
                // and are on our list of animatable things
                .filter(d => KEYFRAMABLE_PROPERTIES.has(d[0]))
                // and stash them in data
                .forEach(d => { keyframe_data[d[0]] = s[d[0]]; })
            // and merge that data with the data on the node, if any
            let existing_keyframe_data = s.getSharedPluginData("silanimtimeline", "keyframe-data");
            if (!existing_keyframe_data) {
                existing_keyframe_data = {}
            } else {
                existing_keyframe_data = JSON.parse(existing_keyframe_data);
            }
            existing_keyframe_data[frame] = keyframe_data;
            s.setSharedPluginData("silanimtimeline", "keyframe-data", JSON.stringify(existing_keyframe_data));
        })
        timelineWindow.postMessage({
            action: "record-complete",
            frame: frame,
            figma_ids: figma.currentPage.selection.map(node => node.id)
        });
    }

    const messageHandler = event => {
        if (event.data.action == "play-button") {
            playPressed();
        } else if (event.data.action == "record-button") {
            recordPressed(event.data.frame);
        } else if (event.data.action == "download-button") {
            downloadPressed();
        } else {
            console.log("unrecognised event in embed", event.data);
        }
    }

    const setup = () => {
        if (window.figma) {
            connectFigmaHandlers();
        }
        window.addEventListener("message", messageHandler, false);
    }

    const terminate = () => {
        window.figma.off("selectionchange", selectionchange);
        window.figma.off("currentpagechange", pagechange);
        window.removeEventListener("message", messageHandler, false);
    }

    const init = () => {
        uninject();
        inject();
        setup();
        setTimeout(selectionchange, 250);
        console.log("sil-anim-timeline master ready for action!");
    }
    init();

    return terminate;

})();
