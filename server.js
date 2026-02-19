const express = require("express");
const axios = require("axios");
const cors = require("cors");
const puppeteer = require("puppeteer");
const path = require("path");

const app = express();

app.use(cors());

// serve static files
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 10000;

let browser;
let cookies = "";
let userAgent = "";


// launch browser
async function initBrowser() {

    browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
        ]
    });

    const page = await browser.newPage();

    userAgent = await page.evaluate(() => navigator.userAgent);

    await page.close();

    console.log("Browser ready");

}

initBrowser();


// get cookies
async function getCookies(url) {

    const page = await browser.newPage();

    await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000
    });

    const ck = await page.cookies();

    cookies = ck.map(c => `${c.name}=${c.value}`).join("; ");

    await page.close();

    return cookies;

}


// fetch stream
async function fetchStream(url, referer) {

    if (!cookies)
        await getCookies(url);

    return axios({
        method: "GET",
        url,
        responseType: "stream",
        headers: {
            "User-Agent": userAgent,
            "Referer": referer || url,
            "Origin": new URL(url).origin,
            "Cookie": cookies
        }
    });

}


// playlist proxy
app.get("/m3u8", async (req, res) => {

    try {

        const url = req.query.url;

        if (!url)
            return res.send("Missing url");

        await getCookies(url);

        const response = await axios({
            url,
            headers: {
                "User-Agent": userAgent,
                "Cookie": cookies
            }
        });

        let data = response.data;

        const base =
            url.substring(0, url.lastIndexOf("/") + 1);


        // rewrite ts segments
        data = data.replace(
            /^(?!#)(.*\.ts)$/gm,
            (segment) => {

                const absolute =
                    segment.startsWith("http")
                        ? segment
                        : base + segment;

                return `/segment?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(url)}`;
            }
        );


        // rewrite keys
        data = data.replace(
            /URI="(.*?)"/g,
            (match, keyUrl) => {

                const absolute =
                    keyUrl.startsWith("http")
                        ? keyUrl
                        : base + keyUrl;

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



// segment proxy
app.get("/segment", async (req, res) => {

    try {

        const stream =
            await fetchStream(
                req.query.url,
                req.query.referer
            );

        res.setHeader(
            "Content-Type",
            "video/mp2t"
        );

        stream.data.pipe(res);

    }
    catch (err) {

        res.status(500).send(err.toString());

    }

});



// key proxy
app.get("/key", async (req, res) => {

    try {

        const stream =
            await fetchStream(
                req.query.url,
                req.query.referer
            );

        stream.data.pipe(res);

    }
    catch (err) {

        res.status(500).send(err.toString());

    }

});



// universal proxy
app.get("/proxy", async (req, res) => {

    try {

        const stream =
            await fetchStream(req.query.url);

        stream.data.pipe(res);

    }
    catch (err) {

        res.status(500).send(err.toString());

    }

});



// open player at root
app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "public/player.html")
    );

});


app.listen(PORT, () =>
    console.log("Server running on port " + PORT)
);
