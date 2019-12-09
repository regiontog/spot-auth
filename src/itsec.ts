import * as persist from "node-persist";
import * as nacl from "tweetnacl";

let hasInit = false;

export function decode(data: Uint8Array): string {
    const uint16view = new Uint16Array(data.buffer);

    return String.fromCharCode.apply(null, uint16view);
}

export type Keys = {
    sign: { publicKey: Uint8Array, secretKey: Uint8Array },
    encrypt: { publicKey: Uint8Array, secretKey: Uint8Array }
};

function* uint8ArrayValues(key: any): IterableIterator<number> {
    const len = Object.keys(key).length;

    for (let i = 0; i < len; i++) {
        yield key[i];
    }
}

export async function keys(): Promise<Keys> {
    if (!hasInit) {
        await persist.init();
        hasInit = true;
    }

    let key = await persist.getItem("master-key");

    if (!key) {
        key = {
            encrypt: nacl.box.keyPair(),
            sign: nacl.sign.keyPair(),
        };

        await persist.setItem("master-key", {
            encrypt: {
                publicKey: Buffer.from(key.encrypt.publicKey).toString("base64"),
                secretKey: Buffer.from(key.encrypt.secretKey).toString("base64"),
            },
            sign: {
                publicKey: Buffer.from(key.sign.publicKey).toString("base64"),
                secretKey: Buffer.from(key.sign.secretKey).toString("base64"),
            },
        });
    } else {
        key = {
            sign: {
                publicKey: new Uint8Array(Buffer.from(key.sign.publicKey, "base64")),
                secretKey: new Uint8Array(Buffer.from(key.sign.secretKey, "base64")),
            },
            encrypt: {
                publicKey: new Uint8Array(Buffer.from(key.encrypt.publicKey, "base64")),
                secretKey: new Uint8Array(Buffer.from(key.encrypt.secretKey, "base64")),
            },
        };
    }

    return key;
}

export async function rejectKeys() {
    if (!hasInit) {
        await persist.init();
        hasInit = true;
    }

    await persist.removeItem("master-key");
}

export async function createApiUrlParams(): Promise<string> {
    const { sign, encrypt } = await keys();

    const base64url = (array: Uint8Array) => {
        return Buffer.from(array).toString("base64")
            .replace(/\+/g, '-')
            .replace(/=/g, '~')
            .replace(/\//g, '_');
    }

    return base64url(encrypt.publicKey) + "." + base64url(nacl.sign(nacl.randomBytes(32), sign.secretKey));
}
