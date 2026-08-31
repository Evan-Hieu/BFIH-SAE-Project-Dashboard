import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createApp} from './app.mjs';
const port=Number(process.env.PORT||8787),dbPath=resolve(process.env.DB_PATH||'server/data/users.sqlite');mkdirSync(dirname(dbPath),{recursive:true});
const app=await createApp({dbPath,origin:process.env.APP_ORIGIN||`http://127.0.0.1:${port}`,adminEmail:process.env.ADMIN_EMAIL,adminPassword:process.env.ADMIN_PASSWORD,clientId:process.env.GOOGLE_CLIENT_ID||'492543731435-6022j8hevc78905inrvcpcfein03rp5r.apps.googleusercontent.com'});
app.server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`SAE server listening on port ${port}`));
