import {DatabaseSync} from 'node:sqlite';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import {openSupabaseDatabase} from './supabase-database.js';

const schema=`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,avatar INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS quizzes(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,questions TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),title TEXT,played_at BIGINT,correct INTEGER,attempts INTEGER,survived INTEGER,infections INTEGER,cursed INTEGER);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires);
CREATE INDEX IF NOT EXISTS matches_user_date_idx ON matches(user_id,played_at);
CREATE INDEX IF NOT EXISTS quizzes_owner_idx ON quizzes(owner);`;

export async function openDatabase({connectionString=process.env.DATABASE_URL,dataDir}={}){
  if(process.env.SUPABASE_URL){
    const db=openSupabaseDatabase({url:process.env.SUPABASE_URL,secretKey:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY});
    await db.health();return db;
  }
  if(connectionString){
    pg.types.setTypeParser(20,value=>Number(value));
    // Render's private database URL stays inside the Singapore network. TLS can
    // be required with PGSSLMODE=require for database providers that support it.
    const pool=new pg.Pool({connectionString,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
    pool.on('error',()=>console.error('Database connection interrupted'));
    await pool.query(schema);
    return {
      kind:'postgres',
      prepare(sql){let i=0;const text=sql.replaceAll('?',()=>`$${++i}`);return {
        async get(...values){return (await pool.query(text,values)).rows[0];},
        async all(...values){return (await pool.query(text,values)).rows;},
        async run(...values){return {changes:(await pool.query(text,values)).rowCount};}
      };},
      async health(){await pool.query('SELECT 1');},
      async close(){await pool.end();}
    };
  }
  fs.mkdirSync(dataDir,{recursive:true});const sqlite=new DatabaseSync(path.join(dataDir,'frostbound.sqlite'));
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;'+schema);
  return {kind:'sqlite',prepare:sql=>sqlite.prepare(sql),async health(){sqlite.prepare('SELECT 1').get();},async close(){sqlite.close();}};
}
