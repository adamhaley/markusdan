// ---- Extract UTM params ---- 
function getUTMParams() {
    const params = new URLSearchParams(window.location.search);
    const utm = {};

    [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content"
    ].forEach(key => {
        if (params.has(key)) {
            utm[key] = params.get(key);
        }
    });

    return utm;
}

window.addEventListener('load', function () {
    const utmParams = getUTMParams();
    if (!Object.keys(utmParams).length) return;

    const iframe = document.querySelector("iframe[src*='wufoo.com']");
    if (!iframe) return;

    const originalSrc = iframe.getAttribute("src");
    const urlObj = new URL(originalSrc, window.location.href);

    // Map UTM → Wufoo hidden fields
    const fieldMap = {
        utm_source: "Field1430",
        utm_medium: "Field1431",
        utm_campaign: "Field1435",
        utm_term: "Field1434",
        utm_content: "Field1433"
    };

    // Important: **append**, do NOT replace
    Object.entries(utmParams).forEach(([utmKey, utmValue]) => {
        const fieldId = fieldMap[utmKey];

        // 2️⃣ Add Wufoo field value
        if (fieldId) {
            urlObj.searchParams.set(fieldId, utmValue);
        }
    });

    // Write merged URL back in
    iframe.src = urlObj.toString();

    console.log("Updated Wufoo iframe src (merged):", iframe.src);

    function resizeIframe() {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) return;

            const newHeight = iframeDoc.body.scrollHeight + 50; // padding buffer
            iframe.style.height = newHeight + "px";

            console.log("Wufoo iframe auto-resized:", newHeight);
        } catch (e) {
            console.warn("Unable to resize iframe (cross-domain?)", e);
        }
    }

    // Resize whenever iframe loads a new page
    iframe.addEventListener("load", () => {
        setTimeout(resizeIframe, 200);  // give Wufoo time to render
    });

});
