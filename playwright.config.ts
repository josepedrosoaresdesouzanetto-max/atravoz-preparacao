import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
process.env.E2E_OPERATOR_TOKEN ||= randomBytes(32).toString('hex');
process.env.E2E_DATABASE ||= resolve('runtime',`e2e-${Date.now()}.sqlite3`);
const python=resolve(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
export default defineConfig({testDir:'tests/e2e',timeout:45000,workers:1,fullyParallel:false,
  reporter:[['list'],['json',{outputFile:'test-results/e2e-results.json'}]],
  use:{baseURL:'http://127.0.0.1:8010',channel:process.env.E2E_CHANNEL||'msedge',viewport:{width:390,height:844},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}},
  webServer:{command:`"${python}" scripts/serve.py`,url:'http://127.0.0.1:8010/api/v1/ready',reuseExistingServer:false,env:{PORT:'8010',OPERATOR_TOKEN:process.env.E2E_OPERATOR_TOKEN,DATABASE_PATH:process.env.E2E_DATABASE,AI_PROVIDER:'rules'}}});
