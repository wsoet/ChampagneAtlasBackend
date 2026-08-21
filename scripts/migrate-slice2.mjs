import { readFileSync } from "node:fs";
import pg from "pg";

const dryRun=process.argv.includes("--dry-run");
const url=String(process.env.DATABASE_URL||"").trim();
if(!url)throw new Error("DATABASE_URL is required");
const sslDisabled=["0","false","disable"].includes(String(process.env.DATABASE_SSL||"").toLowerCase())||url.includes("localhost");
const client=new pg.Client({connectionString:url,ssl:sslDisabled?false:{rejectUnauthorized:false}});
const sql=readFileSync(new URL("../migrations/002_slice2_visit_collect.up.sql",import.meta.url),"utf8")
  .replace(/^BEGIN;|COMMIT;\s*$/gim,"");
await client.connect();
try{await client.query("BEGIN");await client.query(sql);if(dryRun){await client.query("ROLLBACK");console.log("Slice 2 migration dry-run succeeded; transaction rolled back.");}else{await client.query("COMMIT");console.log("Slice 2 migration applied.");}}
catch(error){await client.query("ROLLBACK");throw error;}finally{await client.end();}
