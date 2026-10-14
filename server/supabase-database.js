// Server-only adapter. A secret key never reaches the browser or source control.
const columns={users:['id','email','name','password','role','avatar'],sessions:['token','user_id','expires'],quizzes:['id','owner','title','questions'],matches:['id','user_id','title','played_at','correct','attempts','survived','infections','cursed']};
export function openSupabaseDatabase({url,secretKey}){
  if(!url||!secretKey)throw Error('Supabase URL and server secret key are required');
  const origin=new URL(url);if(origin.protocol!=='https:')throw Error('Supabase storage requires HTTPS');
  const headers={apikey:secretKey,'Content-Type':'application/json'};
  if(secretKey.startsWith('eyJ'))headers.Authorization=`Bearer ${secretKey}`;
  async function request(table,params={},method='GET',body,ignoreConflict=false){
    if(!Object.hasOwn(columns,table))throw Error('Unknown storage table');
    const endpoint=new URL(`/rest/v1/frostbound_${table}`,origin);
    for(const [key,value]of Object.entries(params))endpoint.searchParams.set(key,String(value));
    const res=await fetch(endpoint,{method,headers:{...headers,Prefer:ignoreConflict?'resolution=ignore-duplicates,return=minimal':'return=minimal'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
    if(!res.ok){const error=await res.json().catch(()=>({}));if(error.code==='23505')throw Error('ข้อมูลนี้มีอยู่แล้ว');throw Error(`Storage request failed (${res.status})`);}
    if(res.status===204||method!=='GET')return {changes:1};return res.json();
  }
  const first=async(table,params)=>(await request(table,{...params,limit:1}))[0];
  return {
    kind:'supabase',
    prepare(sql){
      // Only the fixed queries used by Frostbound are supported. User-supplied
      // values are encoded as filters or JSON, never interpolated into SQL.
      const query=sql.replace(/\s+/g,' ').trim();
      return {
        async get(...values){
          if(query.startsWith('SELECT u.id,u.email,u.name,u.role,u.avatar FROM users u JOIN sessions')){
            const row=await first('sessions',{select:'user:frostbound_users!inner(id,email,name,role,avatar)',token:`eq.${values[0]}`,expires:`gt.${values[1]}`});return row?.user;
          }
          if(query==='SELECT * FROM users WHERE email=?')return first('users',{select:'*',email:`eq.${values[0]}`});
          if(query==='SELECT id FROM users WHERE email=?')return first('users',{select:'id',email:`eq.${values[0]}`});
          if(query==='SELECT id FROM users WHERE id=?')return first('users',{select:'id',id:`eq.${values[0]}`});
          if(query==='SELECT owner FROM quizzes WHERE id=?')return first('quizzes',{select:'owner',id:`eq.${values[0]}`});
          if(query==='SELECT * FROM quizzes WHERE id=? AND owner=?')return first('quizzes',{select:'*',id:`eq.${values[0]}`,owner:`eq.${values[1]}`});
          throw Error('Unsupported storage lookup');
        },
        async all(...values){
          if(query==='SELECT * FROM quizzes WHERE owner=?')return request('quizzes',{select:'*',owner:`eq.${values[0]}`});
          if(query==='SELECT * FROM matches WHERE user_id=? ORDER BY played_at DESC LIMIT 30')return request('matches',{select:'*',user_id:`eq.${values[0]}`,order:'played_at.desc',limit:30});
          throw Error('Unsupported storage list');
        },
        async run(...values){
          const insert=/^INSERT INTO (users|sessions|quizzes|matches) VALUES\(/.exec(query);
          if(insert){const table=insert[1],row=Object.fromEntries(columns[table].map((name,index)=>[name,values[index]]));const ignore=query.includes('ON CONFLICT');return request(table,ignore?{on_conflict:'id'}:{},'POST',row,ignore);}
          if(query==='UPDATE users SET avatar=? WHERE id=?')return request('users',{id:`eq.${values[1]}`},'PATCH',{avatar:values[0]});
          if(query==='UPDATE quizzes SET title=?,questions=? WHERE id=?')return request('quizzes',{id:`eq.${values[2]}`},'PATCH',{title:values[0],questions:values[1]});
          if(query==='DELETE FROM quizzes WHERE id=? AND owner=?')return request('quizzes',{id:`eq.${values[0]}`,owner:`eq.${values[1]}`},'DELETE');
          if(query==='DELETE FROM sessions WHERE token=?')return request('sessions',{token:`eq.${values[0]}`},'DELETE');
          if(query==='DELETE FROM sessions WHERE expires<?')return request('sessions',{expires:`lt.${values[0]}`},'DELETE');
          throw Error('Unsupported storage mutation');
        }
      };
    },
    async health(){await request('users',{select:'id',limit:1});},
    async close(){}
  };
}
