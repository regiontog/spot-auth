import { net } from "electron";
import { stringify } from "querystring";

export interface IToken {
    expires: number;
    refreshToken: string;
    accessToken: string;
}

function url(base: string, query: any): string {
    return base + "?" + stringify(query);
}

function post(uri: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const request = net.request({
            method: "POST",
            url: uri,
        });

        request.on("error", (error) => {
            reject(error);
        });

        request.on("response", (response) => {
            response.on("error", (error: Electron.Event) => {
                reject(error);
            });

            response.on("data", (chunk) => {
                resolve(JSON.parse(chunk.toString()));
            });
        });

        body = stringify(body);

        request.setHeader("Content-Type", "application/x-www-form-urlencoded");
        request.setHeader("Content-Length", body.length);
        request.end(body);
    });
}

const AUTH = "https://accounts.spotify.com/authorize";

const AUTH_DEFAULTS = {
    scope: "",
};

const TOKEN = "https://accounts.spotify.com/api/token";

export class Spotify {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;

    constructor({
        clientId,
        clientSecret,
        redirectUri,
    }: { clientSecret: string, clientId: string, redirectUri: string }) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    public authorize(attrs: { state: any, scope?: string, showDialog?: boolean }): string {
        return url(AUTH, {
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: "code",
            ...AUTH_DEFAULTS,
            scope: attrs.scope,
            show_dialog: attrs.showDialog,
            state: attrs.state,
        });
    }

    public token(attrs: { code: string }): Promise<IToken> {
        return post(TOKEN, {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: "authorization_code",
            redirect_uri: this.redirectUri,
            ...attrs,
        }).then((json) => ({
            accessToken: json.access_token,
            expires: parseInt(json.expires_in, 10),
            refreshToken: json.refresh_token,
        }));
    }

    public refresh({ refreshToken }: { refreshToken: string }): Promise<IToken> {
        return post(TOKEN, {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }).then((json) => ({
            accessToken: json.access_token,
            expires: parseInt(json.expires_in, 10),
            refreshToken: json.refresh_token,
        }));
    }
}
