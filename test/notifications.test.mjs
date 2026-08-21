import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { createServer } from "../src/server.mjs";
import { NotificationError, decryptDeviceToken, encryptDeviceToken, notificationPresentation } from "../src/notification-store.mjs";
import { DisabledPushTransport, FcmHttpV1Transport } from "../src/notification-transport.mjs";
import { classifySnapshotChange } from "../src/trip-group-notifications.mjs";

const stamp="2026-08-02T12:00:00.000Z";
class MemoryNotifications{
  constructor(){this.owner="owner";this.id=randomUUID();this.preferencesByUser=new Map();this.devices=new Map();this.read=false;}
  item(){return{id:this.id,type:"TRIP_ACTIVITY_ADDED",title:"Nieuwe activiteit",body:"Een reisgenoot heeft een activiteit toegevoegd.",createdAt:stamp,readAt:this.read?stamp:null,tripGroupId:randomUUID(),clientTripId:randomUUID(),actorName:"Sophie",deepLink:{route:"trip-group"},metadata:{changeCount:1}};}
  async list(user,{unread}){return{items:user===this.owner&&(!unread||!this.read)?[this.item()]:[],unreadCount:user===this.owner&&!this.read?1:0,nextCursor:null};}
  async unreadCount(user){return{unreadCount:user===this.owner&&!this.read?1:0};}
  async markRead(user,id){if(user!==this.owner||id!==this.id)throw new NotificationError(404,"NOT_FOUND","Notification not found");this.read=true;return this.item();}
  async markAllRead(user){if(user!==this.owner)return{markedRead:0};const count=this.read?0:1;this.read=true;return{markedRead:count};}
  async preferences(user){return this.preferencesByUser.get(user)||defaults();}
  async updatePreferences(user,value){this.preferencesByUser.set(user,{...value,updatedAt:stamp});return this.preferencesByUser.get(user);}
  async registerDevice(user,input){const id=randomUUID(),value={id,installationId:input.installationId,platform:input.platform,provider:input.provider,appVersion:input.appVersion,active:true,lastSeenAt:stamp,createdAt:stamp,updatedAt:stamp,owner:user};this.devices.set(id,value);return (({owner,...dto})=>dto)(value);}
  async unregisterDevice(user,id){const device=this.devices.get(id);if(!device||device.owner!==user)throw new NotificationError(404,"NOT_FOUND","Notification device not found");this.devices.delete(id);return{unregistered:true};}
}
const defaults=()=>({pushEnabled:true,tripGroupActivity:true,tripReminders:true,tripEvents:true,nearby:false,antoineTips:false,badges:false,quietHours:{enabled:true,start:"22:00",end:"08:00",timezone:"Europe/Amsterdam"},deliveryMode:"IMMEDIATE",updatedAt:stamp});
async function environment(run){const store=new MemoryNotifications();const server=createServer({notificationStore:store,authenticateSlice2:req=>{const id=String(req.headers.authorization||"").replace(/^Bearer /,"");return id?{sub:id}:null;}}).listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));try{await run(`http://127.0.0.1:${server.address().port}`,store);}finally{await new Promise(resolve=>server.close(resolve));}}
const call=(base,path,user,method="GET",body)=>fetch(base+path,{method,headers:{...(user?{Authorization:`Bearer ${user}`}:{ }),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});

test("Android notification list contract is private, unread-filtered and owner-scoped",()=>environment(async(base,store)=>{
  const unauth=await call(base,"/api/v1/notifications?unread=true&limit=30",null);assert.equal(unauth.status,401);assert.equal(unauth.headers.get("cache-control"),"private, no-store");
  const response=await call(base,"/api/v1/notifications?unread=true&limit=30","owner");assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"private, no-store");const body=await response.json();assert.equal(body.unreadCount,1);assert.equal(body.items.length,1);for(const field of ["id","type","title","body","createdAt","readAt","tripGroupId","clientTripId","actorName"])assert.ok(field in body.items[0]);assert.equal(JSON.stringify(body).includes("@"),false);
  const isolated=await call(base,`/api/v1/notifications/${store.id}`,"other","PATCH",{read:true});assert.equal(isolated.status,404);
}));

test("mark read and mark all read follow the Android contract",()=>environment(async(base,store)=>{
  let response=await call(base,`/api/v1/notifications/${store.id}`,"owner","PATCH",{read:true});assert.equal(response.status,200);assert.ok((await response.json()).readAt);
  response=await call(base,"/api/v1/notifications/read-all","owner","POST");assert.equal(response.status,200);assert.equal((await response.json()).markedRead,0);
  assert.equal((await(await call(base,"/api/v1/notifications?unread=true","owner")).json()).items.length,0);
}));

test("preferences and owner-scoped device registration validate their contracts",()=>environment(async(base)=>{
  const prefs={...defaults(),updatedAt:undefined,nearby:true};delete prefs.updatedAt;
  let response=await call(base,"/api/v1/notifications/preferences","owner","PUT",prefs);assert.equal(response.status,200);assert.equal((await response.json()).nearby,true);
  response=await call(base,"/api/v1/notifications/devices","owner","POST",{installationId:"install-123",platform:"ANDROID",provider:"FCM",pushToken:"a".repeat(32),appVersion:"2.0"});assert.equal(response.status,200);const device=await response.json();assert.equal("pushToken" in device,false);
  assert.equal((await call(base,`/api/v1/notifications/devices/${device.id}`,"other","DELETE")).status,404);
  assert.equal((await call(base,`/api/v1/notifications/devices/${device.id}`,"owner","DELETE")).status,200);
}));

test("device token cipher round-trips without raw storage and disabled transport is safe",async()=>{
  const key=randomBytes(32),raw="fcm-device-registration-token",encrypted=encryptDeviceToken(raw,key);assert.notEqual(encrypted,raw);assert.equal(encrypted.includes(raw),false);assert.equal(decryptDeviceToken(encrypted,key),raw);
  assert.deepEqual(await new DisabledPushTransport().send({}),{delivered:false,disabled:true});
});

test("FCM HTTP v1 adapter authenticates and sends only the safe notification contract",async()=>{
  const {privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});const calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});return calls.length===1?new Response(JSON.stringify({access_token:"access",expires_in:3600}),{status:200}):new Response(JSON.stringify({name:"projects/test/messages/1"}),{status:200});};
  const transport=new FcmHttpV1Transport({projectId:"atlas",clientEmail:"fcm@example.invalid",privateKey:privateKey.export({type:"pkcs8",format:"pem"}),fetchImpl});
  await transport.send({token:"device-token",notification:{id:randomUUID(),type:"TRIP_ACTIVITY_ADDED",title:"Nieuwe activiteit",body:"Een reisgenoot heeft een activiteit toegevoegd.",deepLink:{route:"trip-group",tripGroupId:randomUUID()},metadata:{changeCount:1}}});
  assert.equal(calls.length,2);assert.match(calls[0].url,/oauth2\.googleapis\.com\/token/);assert.match(calls[1].url,/fcm\.googleapis\.com\/v1\/projects\/atlas\/messages:send/);
  const payload=JSON.parse(calls[1].options.body);assert.equal(payload.message.token,"device-token");assert.equal(payload.message.android.notification.channel_id,"trip_group_activity");assert.equal(JSON.stringify(payload).includes("email"),false);
});

test("snapshot classification distinguishes activity changes and bundles metadata",()=>{
  const before={name:"Reims",startDate:"2026-09-01",endDate:"2026-09-02",houseIds:["a"],houseDates:{a:"2026-09-01"},houseTimes:{a:"10:00"},events:[]};
  assert.equal(classifySnapshotChange(before,{...before,houseIds:["a","b"]}).type,"TRIP_ACTIVITY_ADDED");
  const bundle=classifySnapshotChange(before,{...before,name:"Epernay",houseIds:[]});assert.equal(bundle.type,"TRIP_GROUP_ACTIVITY_BUNDLE");assert.equal(bundle.metadata.bundled,true);assert.deepEqual(bundle.metadata.changeTypes,["TRIP_TITLE_CHANGED","ACTIVITY_REMOVED"]);
  assert.equal(classifySnapshotChange(before,{...before}),null);
});

test("notification presentation follows the recipient locale with English fallback", () => {
  assert.equal(notificationPresentation("TRIP_ACTIVITY_ADDED", "nl-NL").title, "Nieuwe activiteit");
  assert.equal(notificationPresentation("TRIP_ACTIVITY_ADDED", "en-GB").title, "New activity");
  assert.equal(notificationPresentation("TRIP_ACTIVITY_ADDED", "fr-FR").title, "New activity");
});
