import { NotificationError } from "./notification-store.mjs";
import { normalizeContentLanguage } from "./locale.mjs";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class InputError extends Error { constructor(status,code,message,details){super(message);Object.assign(this,{status,code,details});} }
async function jsonBody(request){const parts=[];let size=0;for await(const part of request){size+=part.length;if(size>32768)throw new InputError(413,"PAYLOAD_TOO_LARGE","Request body exceeds 32 KB");parts.push(part);}try{return parts.length?JSON.parse(Buffer.concat(parts)):{};}catch{throw new InputError(400,"INVALID_JSON","Request body must be valid JSON");}}
const uuid=(value,field)=>{const out=String(value||"").toLowerCase();if(!UUID.test(out))throw new InputError(400,"INVALID_FIELD",`${field} must be a UUID`,{field});return out;};
const bool=(value,field)=>{if(typeof value!=="boolean")throw new InputError(400,"INVALID_FIELD",`${field} must be boolean`,{field});return value;};
const shortText=(value,field,min,max)=>{const out=String(value??"").trim();if(out.length<min||out.length>max)throw new InputError(400,"INVALID_FIELD",`${field} is invalid`,{field});return out;};
const time=(value,field)=>{const out=String(value||"");if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(out))throw new InputError(400,"INVALID_FIELD",`${field} must be HH:mm`,{field});return out;};
const sendError=(send,response,error)=>{if(error instanceof NotificationError||error instanceof InputError)send(response,error.status,{error:{code:error.code,message:error.message,...(error.details?{details:error.details}:{})}});else{console.error("Notification request failed:",error instanceof Error?error.message:"Unknown error");send(response,500,{error:{code:"INTERNAL_ERROR",message:"Notification request failed"}});}};

function cursor(value){
  if(!value)return {beforeCreatedAt:null,beforeId:null};
  try{const parsed=JSON.parse(Buffer.from(value,"base64url").toString("utf8"));if(!UUID.test(parsed.id)||Number.isNaN(Date.parse(parsed.createdAt)))throw new Error();return{beforeCreatedAt:new Date(parsed.createdAt).toISOString(),beforeId:parsed.id};}catch{throw new InputError(400,"INVALID_CURSOR","cursor is invalid");}
}
function preferences(body){
  if(!body||typeof body!=="object"||Array.isArray(body))throw new InputError(400,"INVALID_JSON","Preferences must be an object");
  const quiet=body.quietHours;if(!quiet||typeof quiet!=="object"||Array.isArray(quiet))throw new InputError(400,"INVALID_FIELD","quietHours is required",{field:"quietHours"});
  const timezone=shortText(quiet.timezone,"quietHours.timezone",1,80);try{new Intl.DateTimeFormat("en",{timeZone:timezone}).format();}catch{throw new InputError(400,"INVALID_FIELD","quietHours.timezone is invalid",{field:"quietHours.timezone"});}
  if(!["IMMEDIATE","DAILY"].includes(body.deliveryMode))throw new InputError(400,"INVALID_FIELD","deliveryMode must be IMMEDIATE or DAILY",{field:"deliveryMode"});
  return{pushEnabled:bool(body.pushEnabled,"pushEnabled"),tripGroupActivity:bool(body.tripGroupActivity,"tripGroupActivity"),tripReminders:bool(body.tripReminders,"tripReminders"),tripEvents:bool(body.tripEvents,"tripEvents"),nearby:bool(body.nearby,"nearby"),antoineTips:bool(body.antoineTips,"antoineTips"),badges:bool(body.badges,"badges"),quietHours:{enabled:bool(quiet.enabled,"quietHours.enabled"),start:time(quiet.start,"quietHours.start"),end:time(quiet.end,"quietHours.end"),timezone},deliveryMode:body.deliveryMode,locale:normalizeContentLanguage(body.locale)};
}

export async function handleNotifications({request,response,url,user,store,send}){
  if(!/^\/api\/v1\/notifications(?:\/|$)/.test(url.pathname))return false;
  if(!user){send(response,401,{error:{code:"AUTH_REQUIRED",message:"Authentication required"}});return true;}
  try{
    if(url.pathname==="/api/v1/notifications"&&request.method==="GET"){
      const limit=Math.min(100,Math.max(1,Number.parseInt(url.searchParams.get("limit")||"30",10)||30));
      const unread=url.searchParams.get("unread")==="true";
      send(response,200,await store.list(user.sub,{limit,unread,...cursor(url.searchParams.get("cursor"))}));return true;
    }
    if(url.pathname==="/api/v1/notifications/unread-count"&&request.method==="GET"){send(response,200,await store.unreadCount(user.sub));return true;}
    if(url.pathname==="/api/v1/notifications/read-all"&&request.method==="POST"){send(response,200,await store.markAllRead(user.sub));return true;}
    if(url.pathname==="/api/v1/notifications/preferences"&&request.method==="GET"){send(response,200,await store.preferences(user.sub));return true;}
    if(url.pathname==="/api/v1/notifications/preferences"&&request.method==="PUT"){send(response,200,await store.updatePreferences(user.sub,preferences(await jsonBody(request))));return true;}
    if(url.pathname==="/api/v1/notifications/devices"&&request.method==="POST"){
      const body=await jsonBody(request);if(body.platform!=="ANDROID"||body.provider!=="FCM")throw new InputError(400,"INVALID_FIELD","Only ANDROID/FCM is supported");
      send(response,200,await store.registerDevice(user.sub,{installationId:shortText(body.installationId,"installationId",8,128),platform:body.platform,provider:body.provider,pushToken:shortText(body.pushToken,"pushToken",20,4096),appVersion:shortText(body.appVersion||"","appVersion",0,40)}));return true;
    }
    let match=url.pathname.match(/^\/api\/v1\/notifications\/devices\/([0-9a-f-]+)$/i);if(match&&request.method==="DELETE"){send(response,200,await store.unregisterDevice(user.sub,uuid(match[1],"deviceId")));return true;}
    match=url.pathname.match(/^\/api\/v1\/notifications\/([0-9a-f-]+)$/i);if(match&&request.method==="PATCH"){const body=await jsonBody(request);if(body.read!==true)throw new InputError(400,"INVALID_FIELD","read must be true",{field:"read"});send(response,200,await store.markRead(user.sub,uuid(match[1],"notificationId")));return true;}
    send(response,405,{error:{code:"METHOD_NOT_ALLOWED",message:"Method not allowed"}});return true;
  }catch(error){sendError(send,response,error);return true;}
}
