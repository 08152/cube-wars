
const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// ------------------------------------------
// SERVER-EINSTELLUNGEN
// ------------------------------------------

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));

// Öffentliche Spieldateien
app.use(express.static(__dirname, {
    index: "index.html",
    extensions: ["html"]
}));

// ------------------------------------------
// STATUS-ROUTE FÜR RENDER
// ------------------------------------------

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "online",
        game: "CUBE WARS",
        version: "1.0.0",
        timestamp: new Date().toISOString()
    });
});

// ------------------------------------------
// STARTSEITE
// ------------------------------------------

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ------------------------------------------
// 404
// ------------------------------------------

app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>404 - CUBE WARS</title>
            <style>
                body {
                    background: #101722;
                    color: white;
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding-top: 15vh;
                }
                h1 {
                    font-size: 60px;
                }
                a {
                    color: #27aaff;
                }
            </style>
        </head>
        <body>
            <h1>404</h1>
            <h2>Diese Seite wurde nicht gefunden.</h2>
            <a href="/">Zurück zu CUBE WARS</a>
        </body>
        </html>
    `);
});

// ------------------------------------------
// SERVER STARTEN
// ------------------------------------------

app.listen(PORT, HOST, () => {
    console.log("--------------------------------");
    console.log("       CUBE WARS SERVER");
    console.log("--------------------------------");
    console.log("Status: ONLINE");
    console.log(`Port: ${PORT}`);
    console.log(`Host: ${HOST}`);
    console.log("--------------------------------");
});
