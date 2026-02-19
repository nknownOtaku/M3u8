const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;


// browser headers (Cloudflare bypass)
function getHeaders(referer, origin) {

    return {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36",

        "Accept":
            "*/*",

        "Accept-Language":
            "en-US,en;q=0.9",

        "Cache-Control":
            "no-cache",

        "Connection":
            "keep-alive",

        "Referer":
            referer,

        "Origin":
            origin
    };

}


// fetch playlist
app.get("/m3u8", async (req, res) => {

    try {

        const url = req.query.url;

        if (!url)
            return res.send("Missing url");

        const parsed =
            new URL(url);

        const headers =
            getHeaders(url, parsed.origin);


        const response =
            await axios.get(url, {
                headers
            });


        let data =
            response.data;

        const base =
            url.substring(0, url.lastIndexOf("/") + 1);


        // rewrite segments
        data =
            data.replace(
                /^(?!#)(.*)$/gm,
                (line) => {

                    if (
                        line.endsWith(".ts") ||
                        line.endsWith(".m4s")
                    ) {

                        const absolute =
                            line.startsWith("http")
                                ? line
                                : base + line;

                        return `/segment?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(url)}`;
                    }

                    return line;

                }
            );


        // rewrite keys
        data =
            data.replace(
                /URI="(.*?)"/g,
                (match, key) => {

                    const absolute =
                        key.startsWith("http")
                            ? key
                            : base + key;

                    return `URI="/key?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(url)}"`;

                }
            );


        res.setHeader(
            "Content-Type",
            "application/vnd.apple.mpegurl"
        );

        res.send(data);

    }
    catch (err) {

        res.status(500).send(err.toString());

    }

});



// proxy segments
app.get("/segment", async (req, res) => {

    try {

        const url =
            req.query.url;

        const referer =
            req.query.referer;

        const parsed =
            new URL(url);

        const headers =
            getHeaders(referer, parsed.origin);


        const response =
            await axios({
                url,
                headers,
                responseType: "stream"
            });


        res.setHeader(
            "Content-Type",
            "video/mp2t"
        );

        response.data.pipe(res);

    }
    catch (err) {

        res.status(500).send(err.toString());

    }

});



// proxy keys
app.get("/key", async (req, res) => {

    try {

        const url =
            req.query.url;

        const referer =
            req.query.referer;

        const parsed =
            new URL(url);

        const headers =
            getHeaders(referer, parsed.origin);


        const response =
            await axios({
                url,
                headers,
                responseType: "stream"
            });

        response.data.pipe(res);

    }
    catch (err) {

        res.status(500).send(err.toString());

    }

});



// universal proxy
app.get("/proxy", async (req, res) => {

    try {

        const url =
            req.query.url;

        const parsed =
            new URL(url);

        const headers =
            getHeaders(url, parsed.origin);


        const response =
            await axios({
                url,
                headers,
                responseType: "stream"
            });

        response.data.pipe(res);

    }
    catch (err) {

        res.status(500).send(err.toString());

    }

});



// open player
app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "public/player.html")
    );

});


app.listen(PORT, () =>
    console.log("Proxy running on port " + PORT)
);
