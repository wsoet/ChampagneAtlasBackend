import { HouseSubmissionError } from "./house-submission-store.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["SUBMITTED","IN_REVIEW","NEEDS_INFO","DUPLICATE","APPROVED","REJECTED","PUBLISHED"]);
class InputError extends Error { constructor(status, code, message, details) { super(message); Object.assign(this,{status,code,details}); } }
const text = (value, field, min, max) => { const out=String(value??"").trim(); if(out.length<min||out.length>max)throw new InputError(400,"INVALID_FIELD",`${field} is invalid`,{field}); return out; };
const optional = (value, field, max) => text(value, field, 0, max);
const url = (value, field, required=true) => {
  const out=String(value||"").trim();
  if(!out&&!required)return "";
  try {
    const candidate=/^[a-z][a-z0-9+.-]*:\/\//i.test(out)?out:`https://${out}`;
    const parsed=new URL(candidate);
    if(parsed.protocol!=="https:"||!parsed.hostname||!parsed.hostname.includes("."))throw new Error();
    return parsed.toString();
  } catch {
    throw new InputError(400,"INVALID_FIELD",`${field} must be a valid website`,{field});
  }
};
async function body(request,max=400*1024){const parts=[];let size=0;for await(const part of request){size+=part.length;if(size>max)throw new InputError(413,"PAYLOAD_TOO_LARGE","Request body is too large");parts.push(part);}try{return parts.length?JSON.parse(Buffer.concat(parts)):{};}catch{throw new InputError(400,"INVALID_JSON","Request body must be valid JSON");}}
function photo(value){if(!value)return{photoMimeType:null,photoData:null};const match=String(value).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!match)throw new InputError(400,"INVALID_PHOTO","Photo must be JPEG, PNG or WebP");const data=Buffer.from(match[2],"base64");if(!data.length||data.length>180*1024)throw new InputError(400,"INVALID_PHOTO","Photo exceeds 180 KB");return{photoMimeType:match[1],photoData:data};}
function submission(input){return{name:text(input.name,"name",2,180),city:optional(input.city,"city",120),address:optional(input.address,"address",300),sourceUrl:url(input.sourceUrl,"sourceUrl",false),websiteUrl:url(input.websiteUrl,"websiteUrl",false),notes:optional(input.notes,"notes",2000),...photo(input.photoData)};}
function adminInput(input){const status=String(input.status||"").toUpperCase();if(!STATUSES.has(status))throw new InputError(400,"INVALID_FIELD","status is invalid",{field:"status"});const version=Number(input.version);if(!Number.isInteger(version)||version<1)throw new InputError(400,"INVALID_FIELD","version is invalid",{field:"version"});const reviewAction=["draft","finish"].includes(String(input.reviewAction||""))?String(input.reviewAction):"draft";if(status==="PUBLISHED"&&!String(input.publishedHouseId||"").trim())throw new InputError(400,"INVALID_FIELD","publishedHouseId is required for PUBLISHED",{field:"publishedHouseId"});if(status==="DUPLICATE"&&!String(input.duplicateHouseId||"").trim())throw new InputError(400,"INVALID_FIELD","duplicateHouseId is required for DUPLICATE",{field:"duplicateHouseId"});return{...submission({...input,photoData:null}),status,version,reviewAction,draftData:input.draftData&&typeof input.draftData==="object"&&!Array.isArray(input.draftData)?input.draftData:{},adminNotes:optional(input.adminNotes,"adminNotes",4000),reporterMessage:optional(input.reporterMessage,"reporterMessage",1000),duplicateHouseId:optional(input.duplicateHouseId,"duplicateHouseId",180),publishedHouseId:optional(input.publishedHouseId,"publishedHouseId",180)};}
const error=(send,response,reason)=>{if(reason instanceof InputError||reason instanceof HouseSubmissionError){send(response,reason.status,{error:{code:reason.code,message:reason.message,...(reason.details?{details:reason.details}:{})}});return;}console.error("House submission request failed:",reason instanceof Error?reason.message:"Unknown error");send(response,500,{error:{code:"INTERNAL_ERROR",message:"House submission request failed"}});};

export async function handleHouseSubmissions({request,response,url:requestUrl,user,admin,adminCsrfValid,store,publishNewHouse,send}) {
  const isUser=/^\/api\/v1\/house-submissions(?:\/|$)/.test(requestUrl.pathname);
  const isAdmin=/^\/api\/admin\/house-submissions(?:\/|$)/.test(requestUrl.pathname);
  if(!isUser&&!isAdmin)return false;
  try {
    if(isUser){
      if(!user){send(response,401,{error:{code:"AUTH_REQUIRED",message:"Authentication required"}});return true;}
      if(requestUrl.pathname==="/api/v1/house-submissions"&&request.method==="POST"){send(response,201,{submission:await store.create(user.sub,submission(await body(request)))});return true;}
      if(requestUrl.pathname==="/api/v1/house-submissions"&&request.method==="GET"){send(response,200,{items:await store.ownerList(user.sub)});return true;}
      const match=requestUrl.pathname.match(/^\/api\/v1\/house-submissions\/([0-9a-f-]+)$/i);
      if(match&&request.method==="GET"){send(response,200,{submission:await store.ownerDetail(user.sub,match[1])});return true;}
    } else {
      if(!admin){send(response,401,{error:{code:"ADMIN_AUTH_REQUIRED",message:"Admin authentication required"}});return true;}
      if(request.method!=="GET"&&!adminCsrfValid){send(response,403,{error:{code:"CSRF_INVALID",message:"Admin security token is invalid"}});return true;}
      if(requestUrl.pathname==="/api/admin/house-submissions"&&request.method==="GET"){
        const status=String(requestUrl.searchParams.get("status")||"").toUpperCase();if(status!=="OPEN"&&status&&!STATUSES.has(status))throw new InputError(400,"INVALID_FIELD","status is invalid");
        send(response,200,{items:await store.adminList({status,search:String(requestUrl.searchParams.get("search")||"").trim().slice(0,120),limit:Math.min(200,Math.max(1,Number(requestUrl.searchParams.get("limit"))||100))})});return true;
      }
      let match=requestUrl.pathname.match(/^\/api\/admin\/house-submissions\/([0-9a-f-]+)$/i);
      if(match&&request.method==="GET"){send(response,200,{submission:await store.adminDetail(match[1])});return true;}
      if(match&&request.method==="PATCH"){const input=adminInput(await body(request));if(input.reviewAction==="finish"&&input.status==="APPROVED"&&!input.publishedHouseId){if(typeof publishNewHouse!=="function")throw new InputError(503,"PUBLISH_UNAVAILABLE","Publishing is temporarily unavailable");input.publishedHouseId=await publishNewHouse(match[1],input,admin.username);input.status="PUBLISHED";}send(response,200,{submission:await store.adminUpdate(match[1],input,admin.username)});return true;}
      match=requestUrl.pathname.match(/^\/api\/admin\/house-submissions\/([0-9a-f-]+)\/photo$/i);
      if(match&&request.method==="GET"){
        const result=await store.photo(match[1]);response.writeHead(200,{"Content-Type":result.mimeType,"Content-Length":result.data.length,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});response.end(result.data);return true;
      }
    }
    send(response,405,{error:{code:"METHOD_NOT_ALLOWED",message:"Method not allowed"}});return true;
  } catch(reason) { error(send,response,reason); return true; }
}
