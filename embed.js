window.silAnimTimelineTerminate = (function() {
    /* Embed file: contains the parts that interact with Figma,
       creates the iframe with the timeline in and positions it,
       and sends messages back and forth to the timeline */
    const TIMELINE_HTML = ``;
    const TIMELINE_CSS = ``;
    const TIMELINE_JS = ``;

    let timelineWindow;

    const selectionchange = () => {
        console.log("FIXME selection change", window.figma.currentPage.selection.length);
        if (window.figma.currentPage.selection.length === 0) {
            timelineWindow.postMessage({action: "selection", details: []});
        } else {
            let seldetails = window.figma.currentPage.selection.map(node => node.id);
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

    const playPressed = async () => {
        const im = await figma.currentPage.exportAsync({format:"SVG", svgIdAttribute: true});
        const svgtext = new TextDecoder("utf-8").decode(im);
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgtext, "image/svg+xml");
        const mapping = getSvgNamesForNodes();
        for (let calculated_svgname in mapping) {
            let svgel = doc.getElementById(calculated_svgname);
            if (!svgel) { continue; }
            svgel.setAttribute("data-figma-nodeid", mapping[calculated_svgname].id);
        }
        // there should now be no SVG elements with an ID but without a nodeid
        const unmatched = doc.querySelectorAll("[id]:not([data-figma-nodeid])");
        if (unmatched.length > 0) {
            console.warn("Failed to match up the following nodes:", unmatched);
        }
        const finaltext = new XMLSerializer().serializeToString(doc);
        console.log(finaltext);
    }

    const createMessageListener = () => {
        window.addEventListener("message", event => {
            console.log("message in parent from timeline", event.data);
            if (event.data.action == "play-button") {
                playPressed();
            }
        }, false);
    }

    const setup = () => {
        if (window.figma) {
            connectFigmaHandlers();
            selectionchange();
        }
        createMessageListener();
    }

    const terminate = () => {
        window.figma.off("selectionchange", selectionchange);
        window.figma.off("currentpagechange", pagechange);
    }

    const init = () => {
        uninject();
        inject();
        setTimeout(setup, 20);
        console.log("sil-anim-timeline master ready for action!");
    }
    init();

    return terminate;

})();
