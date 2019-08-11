import * as path from "path";
const monkeyPatchPathJoinUnpack = (re: RegExp) => {
    const oldJoin = path.join;
    (path.join as any) = (...paths: string[]) => {
        const path = oldJoin(...paths);

        if (re.test(path.replace(/\\/g, "/"))) {
            return path.replace("app.asar", "app.asar.unpacked");
        }

        return path;
    };
};

monkeyPatchPathJoinUnpack(/.*\/node_modules\/clipboardy\/fallbacks\/.*/);

import * as clipboard from "clipboardy";
import { dialog, app, BrowserWindow, Menu, Tray } from "electron";

import { rejectKeys, createApiUrlParams } from "./itsec";
import Server from "./server";
import { IToken, Spotify } from "./spotify";

const permissions = "user-read-currently-playing";
const appPath = app.isPackaged ? app.getAppPath() : "./";

let closed = false;

let appTray: Electron.Tray;

let browser: Electron.BrowserWindow;

const server = new Server();
server.serve(8888);

if (!(process.env.SPOTAUTH_SPOTIFY_CLIENT_ID && process.env.SPOTAUTH_SPOTIFY_CLIENT_SECRET)) {
    dialog.showErrorBox("Ops!", "Environment variables SPOTAUTH_SPOTIFY_CLIENT_ID and/or SPOTAUTH_SPOTIFY_CLIENT_SECRET is missing!");
    app.exit(1);
}

const spotify = new Spotify({
    clientId: process.env.SPOTAUTH_SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTAUTH_SPOTIFY_CLIENT_SECRET,
    redirectUri: "https://localhost",
});

let refreshTimeout: NodeJS.Timeout;

function gotToken(token: IToken) {
    server.setToken(token.accessToken);

    if (refreshTimeout) {
        clearTimeout(refreshTimeout);
    }

    refreshTimeout = setTimeout(() => {
        spotify.refresh(token).then(gotToken).catch(console.error);
    }, token.expires * 1000);
}

async function auth(force?: boolean): Promise<string> {
    force = force || false;

    return new Promise((resolve) => {
        browser.webContents.on("will-redirect", (evt: Electron.Event, urlStr: string) => {
            const url = new URL(urlStr);

            if (url.hostname === "localhost") {
                resolve(url.searchParams.get("code"));
                browser.hide();
                return evt.preventDefault();
            }
        });

        browser.loadURL(spotify.authorize({ scope: permissions, state: "mystate", showDialog: force }));
    });
}

app.on("ready", () => {
    browser = new BrowserWindow({
        height: 725,
        show: false,
        width: 500,
    });

    browser.webContents.on("did-finish-load", () => {
        browser.show();
    });

    browser.on("close", (evt) => {
        browser.hide();

        if (!closed) {
            return evt.preventDefault();
        }
    });

    appTray = new Tray(path.join(appPath, "build/icon.png"));
    appTray.setContextMenu(Menu.buildFromTemplate([
        {
            label: "Authenticate",
            type: "normal",
            click(e) {
                auth(true).then((code) => spotify.token({ code })).then(gotToken).catch(console.error);
            },
        },
        {
            label: "Reject master key",
            type: "normal",
            click(e) {
                rejectKeys();
            },
        },
        {
            label: "Copy new API key",
            type: "normal",
            click(e) {
                createApiUrlParams().then(clipboard.writeSync);
            },
        },
        {
            label: "Exit",
            type: "normal",
            click() {
                closed = true;
                app.quit();
            },
        },
    ]));

    auth().then((code) => spotify.token({ code })).then(gotToken).catch(console.error);
});
