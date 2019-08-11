import * as express from "express";
import * as multer from "multer";

const multipart = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024,
    }
});

import { keys } from "./itsec";
import * as nacl from "tweetnacl";

export default class {
    private token: string = null;

    public setToken(token: string) {
        this.token = token;
    }

    public serve(port: number) {
        const app = express();

        app.use((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
            res.header("Access-Control-Allow-Headers", "Content-Type");

            next();
        });

        app.post("/", multipart.fields([
            { name: "nonce", maxCount: 1 },
            { name: "pass", maxCount: 1 },
            { name: "publicKey", maxCount: 1 },
        ]), async (req: any, res: any) => {
            if (!(req.files &&
                req.files.nonce &&
                req.files.publicKey &&
                req.files.pass &&
                req.files.nonce[0] &&
                req.files.publicKey[0] &&
                req.files.pass[0]
            )) {
                return res.sendStatus(400);
            }

            const nonce = Uint8Array.from(req.files.nonce[0].buffer),
                pass = Uint8Array.from(req.files.pass[0].buffer),
                publicKey = Uint8Array.from(req.files.publicKey[0].buffer);

            const key = await keys();
            const signature = nacl.box.open(pass, nonce, publicKey, key.encrypt.secretKey);

            if (signature === null || nacl.sign.open(signature, key.sign.publicKey) === null) {
                return res.sendStatus(401);
            }

            if (this.token) {
                return res.send(this.token);
            } else {
                return res.sendStatus(412);
            }
        });

        app.listen(port, () => {
            console.log("Server running");
        });
    }
}
